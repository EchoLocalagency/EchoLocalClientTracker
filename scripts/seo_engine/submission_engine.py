"""
Submission Engine
==================
Auto-submits client profiles to Tier 3 no-CAPTCHA directories using Playwright
with human-like form filling, stealth anti-detection, rate limiting, NAP
consistency validation, and failure screenshot capture.

Designed for sequential single-client runs. Do not run multiple instances for
the same client concurrently -- rate limit checks are not atomic across processes.

Usage:
    python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean --dry-run
    python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean
    python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean --limit 3
"""

import argparse
import asyncio
import os
import random
import sys
import traceback
from datetime import date, datetime, timedelta
from enum import Enum
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from scripts.seo_engine.form_configs import get_form_config

load_dotenv()

# --- Constants ---
DAILY_CAP = 5
WEEKLY_CAP = 8
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SCREENSHOTS_DIR = BASE_DIR / "screenshots"

# Realistic browser context settings
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
VIEWPORT = {"width": 1280, "height": 900}

# Client trade mapping (mirrors CLIENT_TRADE_MAP from seo-engine/page.tsx)
# Universal directories (trades=[]) always match all clients.
CLIENT_TRADE_MAP = {
    "integrity-pro-washers": ["pressure_washing", "home_services"],
    "mr-green-turf-clean": ["turf", "home_services"],
    "az-turf-cleaning": ["turf", "landscaping", "home_services"],
    "echo-local": ["seo_agency"],
}


# --- Exceptions ---
class RateLimitExceeded(Exception):
    """Raised when daily or weekly submission cap is reached."""
    pass


# --- State Machine ---
class SubmissionStage(Enum):
    FORM_LOADED = "form_loaded"
    FORM_FILLED = "form_filled"
    POST_SENT = "post_sent"


# --- Supabase Helper ---
def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


# --- Rate Limiter (SUB-02) ---
def check_rate_limits(sb, client_id: str) -> tuple:
    """
    Check daily and weekly submission caps.

    Returns (today_count, week_count).
    Raises RateLimitExceeded if either cap is reached.
    """
    today_str = date.today().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()

    today_resp = (
        sb.table("submissions")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .gte("submitted_at", today_str)
        .execute()
    )
    week_resp = (
        sb.table("submissions")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .gte("submitted_at", week_start)
        .execute()
    )

    today_count = today_resp.count or 0
    week_count = week_resp.count or 0

    if today_count >= DAILY_CAP:
        raise RateLimitExceeded(f"Daily cap reached ({today_count}/{DAILY_CAP})")
    if week_count >= WEEKLY_CAP:
        raise RateLimitExceeded(f"Weekly cap reached ({week_count}/{WEEKLY_CAP})")

    return today_count, week_count


# --- NAP Audit (SUB-04) ---
def nap_audit(profile: dict, form_data: dict) -> list:
    """
    Compare canonical profile fields against form data.

    Returns list of mismatch descriptions. Empty list means consistent.
    Any mismatch blocks the submission.
    """
    NAP_FIELDS = ["business_name", "phone", "address_city", "address_state", "website"]
    mismatches = []
    for field in NAP_FIELDS:
        canonical = (profile.get(field) or "").strip()
        form_value = (form_data.get(field) or "").strip()
        if canonical and form_value and canonical != form_value:
            mismatches.append(f"{field}: '{canonical}' != '{form_value}'")
    return mismatches


# --- Stage Persistence ---
def _advance_stage(sb, submission_id: str, stage: SubmissionStage):
    """
    Persist stage to submissions.metadata using read-then-merge.

    Preserves existing metadata keys while updating stage info.
    """
    existing_resp = sb.table("submissions").select("metadata").eq("id", submission_id).execute()
    existing_meta = {}
    if existing_resp.data:
        existing_meta = existing_resp.data[0].get("metadata") or {}

    existing_meta["stage"] = stage.value
    existing_meta["stage_updated_at"] = datetime.utcnow().isoformat()

    sb.table("submissions").update({"metadata": existing_meta}).eq("id", submission_id).execute()


# --- Form Data Builder ---
def _build_form_data(profile: dict) -> dict:
    """
    Build form data dict from client profile.

    Maps canonical field names to profile values.
    """
    return {
        "business_name": profile.get("business_name"),
        "phone": profile.get("phone"),
        "address_street": profile.get("address_street"),
        "address_city": profile.get("address_city"),
        "address_state": profile.get("address_state"),
        "address_zip": profile.get("address_zip"),
        "email": profile.get("email"),
        "website": profile.get("website"),
        "description": profile.get("description") or profile.get("short_description"),
    }


# --- Form Filling (SUB-01) ---
async def _fill_form(page, form_data: dict, form_config: dict):
    """
    Fill form fields using locator strategies with human-like typing.

    Tries each locator strategy in priority order for each field.
    Uses press_sequentially with random delays between keystrokes.
    """
    for field_name, value in form_data.items():
        if not value:
            continue

        strategies = form_config.get(field_name, [])
        filled = False

        for strategy in strategies:
            try:
                loc_type = strategy["type"]
                loc_value = strategy["value"]

                if loc_type == "label":
                    locator = page.get_by_label(loc_value)
                elif loc_type == "placeholder":
                    locator = page.get_by_placeholder(loc_value)
                elif loc_type == "css":
                    locator = page.locator(loc_value)
                else:
                    continue

                # Check if locator is visible before interacting
                if await locator.count() == 0:
                    continue
                if not await locator.first.is_visible():
                    continue

                await locator.first.click()
                await locator.first.clear()
                delay = random.randint(80, 180)
                await locator.first.press_sequentially(str(value), delay=delay)
                await page.wait_for_timeout(random.randint(200, 600))
                filled = True
                break  # Field filled successfully, move to next field

            except Exception:
                continue  # Try next locator strategy

        if not filled:
            print(f"  [WARN] Could not find form field for: {field_name}")


# --- Submit Button Click ---
async def _click_submit(page):
    """
    Try multiple strategies to find and click the submit button.

    Tries: role button "Submit", role button "Send", button[type=submit],
    input[type=submit].
    """
    strategies = [
        lambda: page.get_by_role("button", name="Submit"),
        lambda: page.get_by_role("button", name="Send"),
        lambda: page.locator("button[type='submit']"),
        lambda: page.locator("input[type='submit']"),
    ]

    for get_locator in strategies:
        try:
            locator = get_locator()
            if await locator.count() > 0 and await locator.first.is_visible():
                await locator.first.click()
                return True
        except Exception:
            continue

    print("  [WARN] Could not find submit button")
    return False


# --- Screenshot Capture (SUB-05) ---
async def _capture_screenshot(page, client_slug: str, dir_domain: str) -> str:
    """
    Capture full-page screenshot on failure.

    Returns path to saved screenshot.
    """
    screenshots_dir = SCREENSHOTS_DIR / client_slug
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = screenshots_dir / f"{dir_domain}_{ts}.png"
    await page.screenshot(path=str(path), full_page=True)
    return str(path)


# --- CAPTCHA Runtime Check ---
async def _check_runtime_captcha(page) -> bool:
    """
    Check for JS-rendered CAPTCHAs that the static audit may have missed.

    Returns True if CAPTCHA detected.
    """
    try:
        has_captcha = await page.evaluate(
            "() => !!(window.grecaptcha || window.hcaptcha || "
            "document.querySelector('[data-sitekey]'))"
        )
        return bool(has_captcha)
    except Exception:
        return False


# --- Single Directory Submission ---
async def _submit_to_directory(page, profile: dict, directory: dict,
                                submission_id: str, sb, form_config: dict) -> str:
    """
    Submit client profile to one directory.

    Returns final status: 'submitted', 'skipped', or 'failed'.
    Persists stage to metadata before each transition.
    """
    dir_domain = directory["domain"]
    client_slug = profile.get("_client_slug", "unknown")

    try:
        # Stage 1: Load form
        print(f"  Loading: {directory['submission_url']}")
        await page.goto(directory["submission_url"], timeout=30000)
        await page.wait_for_load_state("networkidle", timeout=15000)
        _advance_stage(sb, submission_id, SubmissionStage.FORM_LOADED)

        # Runtime CAPTCHA check (catches JS-rendered CAPTCHAs missed by static audit)
        if await _check_runtime_captcha(page):
            print(f"  CAPTCHA detected at runtime on {dir_domain} -- skipping")
            sb.table("directories").update(
                {"captcha_status": "simple_captcha"}
            ).eq("id", directory["id"]).execute()
            sb.table("submissions").update({
                "status": "skipped",
                "notes": "Runtime CAPTCHA detected -- directory captcha_status updated",
            }).eq("id", submission_id).execute()
            return "skipped"

        # Stage 2: Fill form
        form_data = _build_form_data(profile)

        # NAP audit before filling
        mismatches = nap_audit(profile, form_data)
        if mismatches:
            mismatch_str = "; ".join(mismatches)
            print(f"  NAP mismatch -- skipping: {mismatch_str}")
            sb.table("submissions").update({
                "status": "skipped",
                "notes": f"NAP mismatch: {mismatch_str}",
            }).eq("id", submission_id).execute()
            return "skipped"

        await _fill_form(page, form_data, form_config)
        _advance_stage(sb, submission_id, SubmissionStage.FORM_FILLED)

        # Stage 3: Submit
        clicked = await _click_submit(page)
        if not clicked:
            # Could not find submit button -- mark failed
            screenshot_path = await _capture_screenshot(page, client_slug, dir_domain)
            existing_resp = sb.table("submissions").select("metadata").eq("id", submission_id).execute()
            existing_meta = (existing_resp.data[0].get("metadata") or {}) if existing_resp.data else {}
            existing_meta["error"] = "Submit button not found"
            existing_meta["screenshot"] = screenshot_path
            existing_meta["failed_at"] = datetime.utcnow().isoformat()
            sb.table("submissions").update({
                "status": "failed",
                "metadata": existing_meta,
                "notes": "Failed: submit button not found on form",
            }).eq("id", submission_id).execute()
            return "failed"

        # Wait for confirmation (URL change or timeout)
        try:
            await page.wait_for_url("**", timeout=10000)
        except Exception:
            pass  # Timeout is OK -- some forms don't redirect

        await page.wait_for_timeout(3000)
        _advance_stage(sb, submission_id, SubmissionStage.POST_SENT)

        # Mark submitted
        existing_resp = sb.table("submissions").select("metadata").eq("id", submission_id).execute()
        existing_meta = (existing_resp.data[0].get("metadata") or {}) if existing_resp.data else {}
        existing_meta["completed_at"] = datetime.utcnow().isoformat()

        sb.table("submissions").update({
            "status": "submitted",
            "submitted_at": datetime.utcnow().isoformat(),
            "notes": "Auto-submitted by submission_engine",
            "metadata": existing_meta,
        }).eq("id", submission_id).execute()

        print(f"  Submitted successfully to {dir_domain}")
        return "submitted"

    except Exception as e:
        # Check if POST was already sent -- if so, mark submitted not failed
        stage_resp = sb.table("submissions").select("metadata").eq("id", submission_id).execute()
        current_meta = {}
        current_stage = None
        if stage_resp.data:
            current_meta = stage_resp.data[0].get("metadata") or {}
            current_stage = current_meta.get("stage")

        if current_stage == SubmissionStage.POST_SENT.value:
            current_meta["post_submit_error"] = str(e)[:200]
            current_meta["completed_at"] = datetime.utcnow().isoformat()
            sb.table("submissions").update({
                "status": "submitted",
                "submitted_at": datetime.utcnow().isoformat(),
                "notes": f"POST sent, post-submit error: {str(e)[:200]}",
                "metadata": current_meta,
            }).eq("id", submission_id).execute()
            print(f"  POST was sent to {dir_domain} (post-submit error logged)")
            return "submitted"

        # Pre-POST failure: capture screenshot
        screenshot_path = None
        try:
            screenshot_path = await _capture_screenshot(page, client_slug, dir_domain)
        except Exception:
            pass  # Don't let screenshot failure hide the real error

        current_meta["error"] = str(e)[:500]
        current_meta["traceback"] = traceback.format_exc()[:1000]
        current_meta["screenshot"] = screenshot_path
        current_meta["failed_at"] = datetime.utcnow().isoformat()

        sb.table("submissions").update({
            "status": "failed",
            "metadata": current_meta,
            "notes": f"Failed at stage {current_stage}: {str(e)[:200]}",
        }).eq("id", submission_id).execute()

        print(f"  Failed on {dir_domain}: {str(e)[:100]}")
        return "failed"


# --- Client Trade Matching ---
def _client_matches_directory(client_trades: list, directory_trades: list) -> bool:
    """
    Check if any of a client's trades match a directory's accepted trades.

    Empty directory trades means universal (accepts all).
    """
    if not directory_trades:
        return True
    return bool(set(client_trades) & set(directory_trades))


# --- Main Engine ---
async def run_submission_engine(client_slug: str, dry_run: bool = False,
                                 run_limit: int = 5):
    """
    Main submission loop for a single client.

    1. Load client and profile
    2. Check rate limits
    3. Query eligible Tier 3 no-CAPTCHA directories
    4. Filter out already-submitted directories
    5. For each eligible directory: NAP audit, fill form, submit
    """
    sb = _get_supabase()

    # --- Load client ---
    client_resp = sb.table("clients").select("id, slug, name").eq("slug", client_slug).execute()
    if not client_resp.data:
        print(f"[ERROR] No client found with slug '{client_slug}'")
        sys.exit(1)
    client = client_resp.data[0]
    client_id = client["id"]
    client_trades = CLIENT_TRADE_MAP.get(client_slug, [])
    print(f"Client: {client['name']} ({client_slug}), trades: {client_trades}")

    # --- Load profile ---
    profile_resp = (
        sb.table("client_profiles")
        .select("*")
        .eq("client_id", client_id)
        .execute()
    )
    if not profile_resp.data:
        print(f"[ERROR] No client profile found for client_id '{client_id}'")
        print("Run seed_client_profiles.py first.")
        sys.exit(1)
    profile = profile_resp.data[0]
    profile["_client_slug"] = client_slug  # Attach slug for screenshot paths

    # --- Check rate limits ---
    try:
        today_count, week_count = check_rate_limits(sb, client_id)
        print(f"Rate limits: {today_count}/{DAILY_CAP} today, {week_count}/{WEEKLY_CAP} this week")
    except RateLimitExceeded as e:
        print(f"[RATE LIMIT] {e}")
        return

    # --- Query eligible directories ---
    dir_resp = (
        sb.table("directories")
        .select("*")
        .eq("tier", 3)
        .eq("captcha_status", "no_captcha")
        .eq("enabled", True)
        .execute()
    )

    # Filter by client trade
    eligible_dirs = [
        d for d in (dir_resp.data or [])
        if _client_matches_directory(client_trades, d.get("trades", []))
    ]

    if not eligible_dirs:
        print("No eligible Tier 3 no-CAPTCHA directories found for this client's trade.")
        return

    # --- Get existing submissions to skip ---
    existing_resp = (
        sb.table("submissions")
        .select("directory_id, status")
        .eq("client_id", client_id)
        .execute()
    )
    skip_statuses = {"submitted", "approved", "verified", "skipped", "existing_needs_review"}
    already_done = {
        row["directory_id"]
        for row in (existing_resp.data or [])
        if row["status"] in skip_statuses
    }

    # Filter out already-done directories
    pending_dirs = [d for d in eligible_dirs if d["id"] not in already_done]

    # Also check for failed submissions that should not be retried
    failed_ids = {
        row["directory_id"]
        for row in (existing_resp.data or [])
        if row["status"] == "failed"
    }
    pending_dirs = [d for d in pending_dirs if d["id"] not in failed_ids]

    print(f"Eligible directories: {len(eligible_dirs)} total, {len(pending_dirs)} pending")

    if not pending_dirs:
        print("All eligible directories already have submissions. Nothing to do.")
        return

    # --- Dry run mode ---
    if dry_run:
        print("\n-- DRY RUN: Would submit to these directories --")
        remaining_daily = DAILY_CAP - today_count
        remaining_weekly = WEEKLY_CAP - week_count
        budget = min(run_limit, remaining_daily, remaining_weekly)
        for i, d in enumerate(pending_dirs[:budget]):
            print(f"  {i+1}. {d['name']} ({d['domain']}) -- DA: {d.get('da_score', 'N/A')}")
        if len(pending_dirs) > budget:
            print(f"  ... and {len(pending_dirs) - budget} more (capped by rate limits/run limit)")
        print(f"\nBudget: {budget} submissions (run_limit={run_limit}, "
              f"daily_remaining={remaining_daily}, weekly_remaining={remaining_weekly})")
        return

    # --- Check Playwright browser binary ---
    try:
        from playwright.async_api import async_playwright
        from playwright_stealth import Stealth
    except ImportError as e:
        print(f"[ERROR] Missing dependency: {e}")
        print("Run: pip3 install playwright==1.58.0 playwright-stealth==2.0.2")
        sys.exit(1)

    # --- Submit loop ---
    submitted_count = 0
    skipped_count = 0
    failed_count = 0

    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)

        for directory in pending_dirs:
            # Re-check rate limits before each submission
            try:
                today_count, week_count = check_rate_limits(sb, client_id)
            except RateLimitExceeded as e:
                print(f"[RATE LIMIT] {e} -- stopping")
                break

            # Check run limit
            if submitted_count >= run_limit:
                print(f"Run limit reached ({run_limit}) -- stopping")
                break

            dir_domain = directory["domain"]
            print(f"\n[{submitted_count + skipped_count + failed_count + 1}] {directory['name']} ({dir_domain})")

            # Create or update submission row to pending
            sub_resp = (
                sb.table("submissions")
                .select("id")
                .eq("client_id", client_id)
                .eq("directory_id", directory["id"])
                .execute()
            )

            if sub_resp.data:
                submission_id = sub_resp.data[0]["id"]
                sb.table("submissions").update({
                    "status": "pending",
                    "metadata": {},
                    "notes": None,
                }).eq("id", submission_id).execute()
            else:
                insert_resp = sb.table("submissions").insert({
                    "client_id": client_id,
                    "directory_id": directory["id"],
                    "status": "pending",
                    "metadata": {},
                }).execute()
                submission_id = insert_resp.data[0]["id"]

            # Open fresh page for each directory
            context = await browser.new_context(
                viewport=VIEWPORT,
                user_agent=USER_AGENT,
                locale="en-US",
            )
            page = await context.new_page()

            try:
                form_config = get_form_config(dir_domain)
                result = await _submit_to_directory(
                    page, profile, directory, submission_id, sb, form_config
                )

                if result == "submitted":
                    submitted_count += 1
                elif result == "skipped":
                    skipped_count += 1
                elif result == "failed":
                    failed_count += 1
            finally:
                await context.close()

            # Brief pause between directories
            await asyncio.sleep(random.uniform(2, 5))

        await browser.close()

    # --- Summary ---
    print(f"\nDone. Submitted: {submitted_count}, Skipped: {skipped_count}, Failed: {failed_count}")


# --- CLI Entry Point ---
def main():
    parser = argparse.ArgumentParser(
        description="Auto-submit client profiles to Tier 3 no-CAPTCHA directories"
    )
    parser.add_argument(
        "--client-slug", required=True,
        help="Client slug (e.g. mr-green-turf-clean)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show eligible directories and rate limit status without submitting"
    )
    parser.add_argument(
        "--limit", type=int, default=5,
        help="Max submissions this run (default: 5, hard-capped by daily/weekly limits)"
    )
    args = parser.parse_args()

    asyncio.run(run_submission_engine(
        client_slug=args.client_slug,
        dry_run=args.dry_run,
        run_limit=args.limit,
    ))


if __name__ == "__main__":
    main()
