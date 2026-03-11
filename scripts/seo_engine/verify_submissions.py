"""
Submission Verification Loop
==============================
Checks whether submitted directory listings went live via Brave Search
site: queries, updates verified listings with live URLs, and escalates
stale submissions at 14-day and 21-day thresholds.

Uses budget-gated brave_client.py -- stops gracefully if budget is exceeded.

Usage:
    python3 -m scripts.seo_engine.verify_submissions --dry-run
    python3 -m scripts.seo_engine.verify_submissions --client-slug mr-green-turf-clean --dry-run
    python3 -m scripts.seo_engine.verify_submissions --client-slug mr-green-turf-clean
"""

import argparse
import os
import sys
import time
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client

from scripts.seo_engine.brave_client import search_brave

load_dotenv()

# Thresholds
MIN_AGE_DAYS = 7       # Only check submissions older than 7 days
ALERT_DAYS = 14        # Print alert for unverified submissions older than 14 days
NEEDS_REVIEW_DAYS = 21 # Mark needs_review for submissions older than 21 days
RECHECK_DAYS = 7       # Skip submissions checked within this many days


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def _parse_timestamp(ts_str):
    """Parse a Supabase timestamp string, stripping timezone info."""
    if not ts_str:
        return None
    # Handle ISO format with or without timezone
    ts_str = ts_str.replace("Z", "+00:00")
    if "+" in ts_str and ts_str.index("+") > 10:
        ts_str = ts_str[: ts_str.index("+")]
    elif ts_str.endswith("Z"):
        ts_str = ts_str[:-1]
    # Handle fractional seconds
    if "." in ts_str:
        ts_str = ts_str[:26]  # Truncate to microseconds max
    try:
        return datetime.fromisoformat(ts_str)
    except ValueError:
        return None


def get_clients_with_submissions(sb, client_slug=None):
    """
    Get client IDs that have submitted directory listings.

    If client_slug provided, resolve to single client.
    Otherwise, get all distinct client_ids from submitted submissions.
    """
    if client_slug:
        client_resp = (
            sb.table("clients")
            .select("id, slug, name")
            .eq("slug", client_slug)
            .execute()
        )
        if not client_resp.data:
            print(f"[ERROR] No client found with slug '{client_slug}'")
            sys.exit(1)
        return client_resp.data

    # Get all clients that have submitted submissions
    subs_resp = (
        sb.table("submissions")
        .select("client_id")
        .eq("status", "submitted")
        .execute()
    )
    if not subs_resp.data:
        return []

    client_ids = list(set(row["client_id"] for row in subs_resp.data))
    if not client_ids:
        return []

    # Resolve client info
    clients = []
    for cid in client_ids:
        resp = sb.table("clients").select("id, slug, name").eq("id", cid).execute()
        if resp.data:
            clients.append(resp.data[0])
    return clients


def get_submissions_to_verify(sb, client_id):
    """
    Get submissions eligible for Brave Search verification.

    Eligible: status='submitted', submitted_at >= 7 days ago,
    and not checked within the last 7 days (via metadata.last_verification_check).
    """
    cutoff = (datetime.utcnow() - timedelta(days=MIN_AGE_DAYS)).isoformat()

    subs_resp = (
        sb.table("submissions")
        .select("id, client_id, directory_id, status, submitted_at, metadata, notes")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .lte("submitted_at", cutoff)
        .execute()
    )
    submissions = subs_resp.data or []

    # Filter out recently checked submissions
    now = datetime.utcnow()
    eligible = []
    for sub in submissions:
        metadata = sub.get("metadata") or {}
        last_check = metadata.get("last_verification_check")
        if last_check:
            check_dt = _parse_timestamp(last_check)
            if check_dt and (now - check_dt) < timedelta(days=RECHECK_DAYS):
                continue  # Skip -- checked recently
        eligible.append(sub)

    return eligible


def verify_single_submission(sb, submission, directory, profile, dry_run=False):
    """
    Check a single submission via Brave Search.

    Returns: "verified", "not_found", "budget_exceeded", or "skipped"
    """
    domain = directory.get("domain", "")
    business_name = profile.get("business_name", "")
    city = profile.get("address_city", "")
    query = f'site:{domain} "{business_name}" "{city}"'

    if dry_run:
        days_ago = "?"
        submitted_at = _parse_timestamp(submission.get("submitted_at"))
        if submitted_at:
            days_ago = (datetime.utcnow() - submitted_at).days
        print(f"    [{directory.get('name', domain)}] ({days_ago}d ago)")
        print(f"      Query: {query}")
        return "skipped"

    # Make Brave Search call
    result = search_brave(
        query=query,
        client_id=str(submission["client_id"]),
        count=3,
    )

    # Budget exceeded -- signal to stop
    if result.get("blocked"):
        print(f"    [BUDGET] {result.get('reason', 'Budget exceeded')}")
        return "budget_exceeded"

    web_results = result.get("web", {}).get("results", [])

    if web_results:
        # Found -- update to verified
        live_url = web_results[0].get("url", "")
        now_iso = datetime.utcnow().isoformat()

        # Read-then-merge metadata
        existing_resp = (
            sb.table("submissions")
            .select("metadata")
            .eq("id", submission["id"])
            .execute()
        )
        existing_meta = {}
        if existing_resp.data:
            existing_meta = existing_resp.data[0].get("metadata") or {}

        existing_meta["last_verification_check"] = now_iso
        existing_meta["verified_via"] = "brave_search"

        sb.table("submissions").update({
            "status": "verified",
            "live_url": live_url,
            "verified_at": now_iso,
            "metadata": existing_meta,
            "notes": f"Verified via Brave Search: {live_url}",
        }).eq("id", submission["id"]).execute()

        print(f"    [VERIFIED] {directory.get('name', domain)} -> {live_url}")
        return "verified"
    else:
        # Not found -- update last_verification_check only
        now_iso = datetime.utcnow().isoformat()

        existing_resp = (
            sb.table("submissions")
            .select("metadata")
            .eq("id", submission["id"])
            .execute()
        )
        existing_meta = {}
        if existing_resp.data:
            existing_meta = existing_resp.data[0].get("metadata") or {}

        existing_meta["last_verification_check"] = now_iso

        sb.table("submissions").update({
            "metadata": existing_meta,
        }).eq("id", submission["id"]).execute()

        print(f"    [NOT FOUND] {directory.get('name', domain)}")
        return "not_found"


def escalate_stale_submissions(sb, client_id, directories_lookup, dry_run=False):
    """
    Escalate stale submissions at 14-day and 21-day thresholds.

    Process 21-day BEFORE 14-day to avoid alerting on rows already marked needs_review.
    Returns dict with counts: {"needs_review": N, "alerted": N}
    """
    now = datetime.utcnow()
    counts = {"needs_review": 0, "alerted": 0}

    # --- 21-day: Mark needs_review ---
    cutoff_21 = (now - timedelta(days=NEEDS_REVIEW_DAYS)).isoformat()
    stale_21_resp = (
        sb.table("submissions")
        .select("id, directory_id, submitted_at, metadata")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .lte("submitted_at", cutoff_21)
        .execute()
    )
    stale_21 = stale_21_resp.data or []
    needs_review_ids = set()

    for sub in stale_21:
        dir_info = directories_lookup.get(sub["directory_id"], {})
        dir_name = dir_info.get("name", f"dir_{sub['directory_id']}")

        if dry_run:
            print(f"    [WOULD MARK needs_review] {dir_name} (>21 days)")
        else:
            # Read-then-merge metadata
            existing_resp = (
                sb.table("submissions")
                .select("metadata")
                .eq("id", sub["id"])
                .execute()
            )
            existing_meta = {}
            if existing_resp.data:
                existing_meta = existing_resp.data[0].get("metadata") or {}

            existing_meta["escalated_at"] = now.isoformat()
            existing_meta["escalation_reason"] = "unverified_21_days"

            sb.table("submissions").update({
                "status": "needs_review",
                "notes": f"Unverified after 21+ days -- marked for manual review",
                "metadata": existing_meta,
            }).eq("id", sub["id"]).execute()

            print(f"    [NEEDS REVIEW] {dir_name} (>21 days)")

        needs_review_ids.add(sub["id"])
        counts["needs_review"] += 1

    # --- 14-day: Alert (but skip those already marked needs_review above) ---
    cutoff_14 = (now - timedelta(days=ALERT_DAYS)).isoformat()
    stale_14_resp = (
        sb.table("submissions")
        .select("id, directory_id, submitted_at")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .lte("submitted_at", cutoff_14)
        .execute()
    )
    stale_14 = stale_14_resp.data or []

    for sub in stale_14:
        if sub["id"] in needs_review_ids:
            continue  # Already handled by 21-day escalation

        dir_info = directories_lookup.get(sub["directory_id"], {})
        dir_name = dir_info.get("name", f"dir_{sub['directory_id']}")

        submitted_at = _parse_timestamp(sub.get("submitted_at"))
        days_ago = (now - submitted_at).days if submitted_at else "?"

        if dry_run:
            print(f"    [WOULD ALERT] {dir_name} ({days_ago}d unverified)")
        else:
            print(f"    [ALERT] {dir_name} -- {days_ago} days unverified")

        counts["alerted"] += 1

    return counts


def verify_submissions(client_slug=None, dry_run=False):
    """
    Main orchestrator: verify submitted directory listings via Brave Search.

    1. Get client list (single or all with submitted directories)
    2. For each client: load profile, load directories, get eligible submissions
    3. Verify each submission via Brave Search
    4. Escalate stale submissions (14-day alert, 21-day needs_review)
    5. Print summary
    """
    sb = _get_supabase()

    clients = get_clients_with_submissions(sb, client_slug)

    if not clients:
        print("\nNo clients with submitted directory listings found.")
        print("Nothing to verify.")
        return

    total_checked = 0
    total_verified = 0
    total_not_found = 0
    total_skipped = 0
    total_alerted = 0
    total_needs_review = 0
    budget_exceeded = False

    for client in clients:
        client_id = client["id"]
        client_name = client.get("name", client.get("slug", "unknown"))

        # Load profile
        profile_resp = (
            sb.table("client_profiles")
            .select("business_name, phone, address_city, address_state")
            .eq("client_id", client_id)
            .execute()
        )
        if not profile_resp.data:
            print(f"\n[WARN] No profile for {client_name} -- skipping")
            continue
        profile = profile_resp.data[0]

        # Load all directories as lookup dict
        dirs_resp = (
            sb.table("directories")
            .select("id, name, domain, enabled")
            .execute()
        )
        directories_lookup = {d["id"]: d for d in (dirs_resp.data or [])}

        # Get eligible submissions
        submissions = get_submissions_to_verify(sb, client_id)

        print(f"\n{'='*60}")
        print(f"  Verification: {client_name}")
        print(f"  Business: {profile.get('business_name', 'N/A')}")
        print(f"  City: {profile.get('address_city', 'N/A')}")
        print(f"  Eligible submissions: {len(submissions)}")
        if dry_run:
            print(f"  MODE: DRY RUN (no API calls, no DB updates)")
        print(f"{'='*60}")

        if not submissions:
            print("  No eligible submissions to verify for this client.")

        # Verify each submission
        print(f"\n  --- Verification Checks ---")
        for sub in submissions:
            directory = directories_lookup.get(sub["directory_id"])
            if not directory:
                print(f"    [SKIP] Unknown directory_id: {sub['directory_id']}")
                total_skipped += 1
                continue

            result = verify_single_submission(sb, sub, directory, profile, dry_run)
            total_checked += 1

            if result == "verified":
                total_verified += 1
            elif result == "not_found":
                total_not_found += 1
            elif result == "skipped":
                total_skipped += 1
            elif result == "budget_exceeded":
                budget_exceeded = True
                print(f"\n  [BUDGET] Stopping verification -- budget exceeded")
                break

            # Rate limit between Brave API calls (brave_client already sleeps 1s)
            if not dry_run and result in ("verified", "not_found"):
                time.sleep(0.1)

        if budget_exceeded:
            break

        # Escalation checks
        print(f"\n  --- Escalation Checks ---")
        esc_counts = escalate_stale_submissions(
            sb, client_id, directories_lookup, dry_run
        )
        total_alerted += esc_counts["alerted"]
        total_needs_review += esc_counts["needs_review"]

        if esc_counts["alerted"] == 0 and esc_counts["needs_review"] == 0:
            print("  No stale submissions to escalate.")

    # Final summary
    print(f"\n{'='*60}")
    print(f"  Verification Summary")
    print(f"{'='*60}")
    print(f"  Clients processed: {len(clients)}")
    print(f"  Submissions checked: {total_checked}")
    print(f"  Verified (live): {total_verified}")
    print(f"  Not found: {total_not_found}")
    print(f"  Skipped (dry-run/unknown): {total_skipped}")
    print(f"  14-day alerts: {total_alerted}")
    print(f"  21-day needs_review: {total_needs_review}")
    if budget_exceeded:
        print(f"  NOTE: Stopped early due to Brave Search budget")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Verify submitted directory listings via Brave Search"
    )
    parser.add_argument(
        "--client-slug",
        default=None,
        help="Client slug (e.g. mr-green-turf-clean). Omit to check all clients.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show verification plan without making API calls or DB updates",
    )
    args = parser.parse_args()

    verify_submissions(
        client_slug=args.client_slug,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
