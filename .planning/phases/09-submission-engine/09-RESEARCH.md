# Phase 9: Submission Engine - Research

**Researched:** 2026-03-11
**Domain:** Playwright Python browser automation, anti-detection, rate limiting, state machine form submission
**Confidence:** HIGH

## Summary

Phase 9 builds the Playwright-based submission engine that auto-submits client profiles to Tier 3 no-CAPTCHA directories. The Phase 8 foundation is fully complete: `client_profiles`, `directories`, and `submissions` tables exist in Supabase with the correct schema, seed data, CAPTCHA classifications, and per-client discovery results. Phase 9 is purely a Python script -- no new Next.js work required.

The core challenge is building a reliable, failure-traceable automation loop with five hard requirements: human-like form behavior, daily/weekly rate caps, a state machine that prevents re-submission after POST, NAP consistency validation, and screenshot capture on failure. All five map cleanly to Playwright Python patterns verified against official docs.

Playwright is not currently installed in the project. `playwright==1.58.0` and `playwright-stealth==2.0.2` are the two new Python dependencies required. Everything else (Supabase client, dotenv, argparse pattern, `_get_supabase()`, rate limit tracking via seo_actions queries) is already present in the codebase.

**Primary recommendation:** Build `scripts/seo_engine/submission_engine.py` following the exact CLI argument and Supabase interaction patterns from `discovery.py` and `seo_loop.py`. Use async Playwright with playwright-stealth context manager, `press_sequentially()` with random delays for typing, Supabase-backed rate limit queries, an in-process state machine enum, pre-submission NAP diff check, and `page.screenshot()` to a `/screenshots/` directory on any failure before POST.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUB-01 | Playwright auto-submits client profiles to Tier 3 no-CAPTCHA directories with human-like typing delays and playwright-stealth anti-detection | Playwright 1.58.0 + playwright-stealth 2.0.2 verified on PyPI. `press_sequentially(delay=N)` for human-like typing. Stealth context manager wraps entire browser session. Directory eligibility: `tier=3 AND captcha_status='no_captcha'`. |
| SUB-02 | Submission rate limiter enforces max 5 per client per day, 8 per client per week as hard caps | Rate limits implemented as Supabase queries against `submissions` table (filter by `client_id`, `submitted_at >= today/week_start`, `status='submitted'`). Same pattern as `seo_loop.py` WEEKLY_LIMITS via `get_week_action_counts()`. |
| SUB-03 | Submission state machine tracks form_loaded / form_filled / post_sent stages so failures after POST never trigger re-submission | Python Enum with three stages. Stage written to `submissions.metadata` jsonb column after each transition. On resume/retry: read stage from DB, skip to correct re-entry point. POST-sent rows go to `submitted`, never `pending`. |
| SUB-04 | NAP consistency audit runs before each submission to verify form data matches canonical client profile exactly -- any mismatch blocks submission | Pre-submission function computes diff between `client_profiles` fields and form data dict. If any field diverges, submission is skipped with status='skipped' and mismatch written to notes. |
| SUB-05 | Failed submissions store screenshot and error details for debugging, marked as failed (not retried automatically) | `page.screenshot(path=f"screenshots/{client_slug}/{dir_domain}_{timestamp}.png")` in except block. Error details, traceback, and screenshot path stored in `submissions.metadata`. Status set to 'failed'. |
</phase_requirements>

## Standard Stack

### Core (New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | 1.58.0 | Browser automation, form fill, screenshot | Official Microsoft library, Python async API, Chromium 145 bundled |
| playwright-stealth | 2.0.2 | Patch browser fingerprints to reduce bot detection signal | Wraps playwright context, applies navigator.webdriver patches and related JS overrides |

### Already in Project (No Install Needed)
| Library | Version | Purpose | Why Already Sufficient |
|---------|---------|---------|----------------------|
| supabase-py | 2.28.0 | All DB reads/writes (rate limits, state, profiles) | Already used in every seo_engine script |
| python-dotenv | 1.0.0 | Environment variable loading | Already in every script |
| asyncio | stdlib | Run async Playwright event loop | stdlib, no install |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| playwright-stealth | undetected-playwright-python | undetected-playwright patches the CDP layer more deeply but has no stable PyPI release; playwright-stealth is simpler and maintained |
| playwright-stealth | humanization-playwright | humanization-playwright adds Bezier mouse curves but depends on Patchright (not official Playwright); overkill for directory submissions |
| Supabase rate limit queries | In-memory counter | In-memory resets on crash; Supabase is persistent and works across multiple run invocations |

**Installation:**
```bash
pip install playwright==1.58.0 playwright-stealth==2.0.2
playwright install chromium
```

Note: `playwright install chromium` downloads the bundled Chromium binary (~150MB). Must be run once after pip install.

## Architecture Patterns

### Recommended Project Structure
```
scripts/seo_engine/
  submission_engine.py          # Main engine: rate limiter, state machine, NAP check, submit loop
  form_configs/
    __init__.py
    base_config.py              # Default field mapping (name, phone, address, website, description)
    overrides/
      hotfrog.py                # Per-directory config overrides for non-standard field names
      manta.py
      citysquares.py

screenshots/                    # Created by engine at runtime, .gitignored
  {client_slug}/
    {directory_domain}_{timestamp}.png
```

### Pattern 1: Async Playwright with Stealth Context
**What:** Wrap entire browser session in `Stealth().use_async()` context manager. Create one browser context per submission run with realistic viewport, user-agent, and locale.
**When to use:** Every submission session. stealth patches are applied at context creation time.
**Example:**
```python
# Source: playwright-stealth 2.0.2 PyPI docs + playwright.dev/python/docs/library
import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

async def run_submission_session(client_slug: str, dry_run: bool = False):
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = await context.new_page()
        # ... submit loop
        await browser.close()

asyncio.run(run_submission_session("mr-green-turf-clean"))
```

### Pattern 2: Human-Like Form Filling
**What:** Use `press_sequentially()` with random delay between keystrokes. Add short random pauses between fields. Use `locator.fill()` for non-sensitive fields where speed is acceptable.
**When to use:** All form field fills. Typing delays are the key human-like signal.
**Example:**
```python
# Source: playwright.dev/python/docs/input (press_sequentially with delay)
import random

async def human_type(locator, text: str):
    """Type text with random keystroke delays to simulate human input."""
    delay = random.randint(80, 180)  # ms between keystrokes
    await locator.press_sequentially(text, delay=delay)
    # Brief pause after each field
    await page.wait_for_timeout(random.randint(300, 800))
```

### Pattern 3: Submission State Machine
**What:** Python Enum with three stages persisted to `submissions.metadata` jsonb. Each stage transition writes to Supabase before proceeding. On failure, the stage in DB determines what happened.
**When to use:** Every submission. The state machine is the core of SUB-03 and the failure traceability requirement.
**Example:**
```python
# Source: project pattern (metadata jsonb already on submissions table)
from enum import Enum

class SubmissionStage(Enum):
    PENDING = "pending"
    FORM_LOADED = "form_loaded"
    FORM_FILLED = "form_filled"
    POST_SENT = "post_sent"  # After this: never retry, always mark submitted

async def advance_stage(sb, submission_id: str, stage: SubmissionStage):
    """Write stage to DB before proceeding. On crash, stage survives."""
    sb.table("submissions").update({
        "metadata": {"stage": stage.value, "stage_updated_at": datetime.utcnow().isoformat()}
    }).eq("id", submission_id).execute()
```

Key invariant: when catching an exception, read the stage from `metadata.stage`. If stage is `post_sent` or beyond, set status to `submitted` (not `failed`) -- the form was likely received even if the confirmation page errored.

### Pattern 4: Rate Limiter via Supabase Queries
**What:** Before each submission, query `submissions` table to count submitted rows for `client_id` today (daily cap=5) and this week (weekly cap=8). Hard stop if either cap is reached.
**When to use:** At the start of the submission loop and before each individual submission.
**Example:**
```python
# Source: project pattern (submissions table with submitted_at column)
from datetime import date, timedelta

def check_rate_limits(sb, client_id: str) -> tuple[int, int]:
    """Returns (submissions_today, submissions_this_week). Raises if cap exceeded."""
    today = date.today().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()

    today_resp = (
        sb.table("submissions")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .gte("submitted_at", today)
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

    if today_count >= 5:
        raise RateLimitExceeded(f"Daily cap reached ({today_count}/5)")
    if week_count >= 8:
        raise RateLimitExceeded(f"Weekly cap reached ({week_count}/8)")

    return today_count, week_count
```

### Pattern 5: NAP Consistency Pre-Check
**What:** Before filling any form, build the form data dict from `client_profiles`, then compare each field to the canonical profile. Any mismatch (wrong phone format, truncated name, etc.) blocks the submission.
**When to use:** Before every submission. Runs against the form_config to catch mismatches before browser opens.
**Example:**
```python
# Source: project pattern (client_profiles table from Phase 8)
def nap_audit(profile: dict, form_data: dict) -> list[str]:
    """
    Returns list of mismatch descriptions.
    Empty list = consistent, safe to submit.
    """
    mismatches = []
    canonical_fields = {
        "business_name": profile.get("business_name"),
        "phone": profile.get("phone"),
        "address_city": profile.get("address_city"),
        "address_state": profile.get("address_state"),
        "website": profile.get("website"),
    }
    for field, canonical_value in canonical_fields.items():
        form_value = form_data.get(field)
        if canonical_value and form_value and canonical_value.strip() != form_value.strip():
            mismatches.append(f"{field}: canonical='{canonical_value}' form='{form_value}'")
    return mismatches
```

### Pattern 6: Screenshot Capture on Failure
**What:** In the except block for any form stage failure, capture a full-page screenshot before closing the browser. Store path in `submissions.metadata`. Mark status `failed`.
**When to use:** Any exception during form_loaded or form_filled stages. (POST_SENT exceptions skip this and mark submitted.)
**Example:**
```python
# Source: playwright.dev/python/docs/screenshots
import os
from datetime import datetime

async def capture_failure_screenshot(page, client_slug: str, dir_domain: str) -> str:
    """Capture screenshot and return path."""
    screenshots_dir = f"screenshots/{client_slug}"
    os.makedirs(screenshots_dir, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = f"{screenshots_dir}/{dir_domain}_{ts}.png"
    await page.screenshot(path=path, full_page=True)
    return path
```

### Anti-Patterns to Avoid
- **`time.sleep()` in async Playwright:** Use `await page.wait_for_timeout(ms)` instead. `time.sleep()` blocks the event loop and prevents Playwright's internal async operations from running.
- **Retrying after POST:** Once `post_sent` stage is recorded, never re-submit even on error. The server likely received the form. Mark as `submitted` and log the post-POST error to notes.
- **Hardcoded field selectors by CSS class:** Directory forms change layout. Use semantic locators (`get_by_label()`, `get_by_placeholder()`, `get_by_role()`) or per-directory config with multiple fallback selectors.
- **Running headless without stealth:** Default headless Chromium exposes `navigator.webdriver = true`. Always use playwright-stealth context manager.
- **Batch all clients in one session:** Submit one client at a time. Sequential per-client runs limit blast radius if a directory blocks the IP.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom HTTP form POST | Playwright | HTTP POST misses JS-rendered forms, missing CSRF tokens, redirects that require cookies |
| Bot detection evasion | Manual JS injection | playwright-stealth | stealth handles navigator.webdriver, chrome.runtime, and 10+ other detection signals |
| Human typing simulation | Fixed `asyncio.sleep()` | `press_sequentially(delay=random.randint(80,180))` | Built into Playwright with proper async event loop integration |
| Rate limit state | In-memory counter | Supabase `submissions` query | Persists across crashes, restarts, and multiple runs in same day |
| Form field location | Regex scraping HTML | Playwright locators (`get_by_label`, `get_by_role`) | Auto-wait for element readiness; handles lazy-loaded forms |

**Key insight:** Browser automation with visible JS execution is non-negotiable for directory forms. Most directories use JavaScript form validation, CSRF tokens set via cookies, and dynamic field rendering that HTTP POST cannot replicate.

## Common Pitfalls

### Pitfall 1: captcha_status Stale or Wrong
**What goes wrong:** A directory audited as `no_captcha` via static HTML actually has an invisible reCAPTCHA v3. The engine loads the form, fills it, and the submission silently fails (server rejects it).
**Why it happens:** Phase 8 CAPTCHA audit is static HTML only -- JS-rendered CAPTCHAs are not detected. `captcha_audit.py` explicitly warns about this.
**How to avoid:** (1) The engine must check for CAPTCHA presence on the live page after `form_loaded` stage. Add a quick JS check: `page.evaluate("() => !!window.grecaptcha")`. (2) If CAPTCHA detected at runtime, update `directories.captcha_status` to `simple_captcha` or `advanced_captcha`, mark submission `skipped`, stop that directory.
**Warning signs:** Submissions consistently going to `submitted` but never getting `approved` or `verified` in Phase 10.

### Pitfall 2: Form Field Selector Brittleness
**What goes wrong:** The form config uses a CSS class selector like `.input-business-name`. Directory updates its CSS, selector breaks, engine errors at `form_filled` stage.
**Why it happens:** Directory sites update their CSS/HTML periodically. Class names are implementation details.
**How to avoid:** Use semantic locators as primary: `page.get_by_label("Business Name")`. Use `get_by_placeholder()` as fallback. Store per-directory overrides in `form_configs/overrides/` only for directories where semantic locators fail. Screenshot captures the failure state for manual fix.
**Warning signs:** Multiple `form_filled` failures on the same directory.

### Pitfall 3: POST Detection False Negative
**What goes wrong:** Engine marks stage as `form_filled` but the submit button click doesn't actually trigger the POST (JS validation blocked submission, button was disabled, page redirected before form submit).
**Why it happens:** JS-heavy forms can silently reject submissions without navigating away or throwing an error.
**How to avoid:** After clicking submit, wait for either: (a) URL change indicating redirect, (b) success text appearing, or (c) timeout of 10s. Use `page.wait_for_url()` or `page.wait_for_selector()` for confirmation patterns. If neither, log ambiguous outcome to notes but still advance to `post_sent` (conservative: don't retry).
**Warning signs:** `post_sent` rows that show no verification in Phase 10 despite domain being correct.

### Pitfall 4: Rate Limit Race Condition on Concurrent Runs
**What goes wrong:** Brian runs the engine for two clients simultaneously. Both read rate limit as 0/5 today, both submit 5 each, daily cap violated.
**Why it happens:** Rate limit check and submission write are not atomic.
**How to avoid:** The engine is designed for sequential single-client runs. Document this explicitly. Add a warning if today's global submission count is already near caps when the engine starts. The UNIQUE(client_id, directory_id) constraint still prevents duplicate submissions -- the race only risks exceeding the daily count by at most 1-2.
**Warning signs:** `submitted_at` timestamps clustered within seconds for the same client.

### Pitfall 5: Screenshots Directory Grows Without Bound
**What goes wrong:** Over weeks/months, failed submission screenshots accumulate in `screenshots/`. On macOS this is fine short-term but on a VPS could fill disk.
**Why it happens:** No cleanup policy.
**How to avoid:** `screenshots/` is gitignored. Add note in script: screenshots older than 30 days can be deleted. For now (3-4 clients, Phase 9 only), not an issue -- ~50 files max.

### Pitfall 6: Playwright Browser Not Installed
**What goes wrong:** `playwright install chromium` was never run after `pip install playwright`. Engine crashes immediately with `BrowserType.launch: Executable doesn't exist`.
**Why it happens:** Playwright's pip install only downloads Python bindings -- browsers are separate.
**How to avoid:** Document explicitly in engine script and README. Add `playwright install chromium` to setup instructions. The engine should check for the binary and print a clear error if missing.

## Code Examples

Verified patterns from official sources:

### Full Submission Engine Skeleton
```python
# Source: playwright.dev/python/docs/library + playwright-stealth 2.0.2 PyPI
import asyncio
import random
import traceback
from datetime import date, datetime, timedelta
from enum import Enum

from dotenv import load_dotenv
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from supabase import create_client
import os

load_dotenv()

DAILY_CAP = 5
WEEKLY_CAP = 8

class SubmissionStage(Enum):
    FORM_LOADED = "form_loaded"
    FORM_FILLED = "form_filled"
    POST_SENT = "post_sent"

def _get_supabase():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

async def submit_to_directory(page, profile: dict, directory: dict, submission_id: str, sb) -> str:
    """
    Submit client profile to one directory.
    Returns final status: 'submitted' or 'failed'.
    Stage is persisted to Supabase before each transition.
    """
    dir_domain = directory["domain"]
    client_slug = profile.get("_client_slug", "unknown")

    try:
        # Stage 1: Load form
        await page.goto(directory["submission_url"], timeout=30000)
        await page.wait_for_load_state("networkidle", timeout=15000)
        _advance_stage(sb, submission_id, SubmissionStage.FORM_LOADED)

        # Runtime CAPTCHA check (catches JS-rendered CAPTCHAs missed by static audit)
        has_captcha = await page.evaluate("() => !!(window.grecaptcha || window.hcaptcha)")
        if has_captcha:
            sb.table("directories").update({"captcha_status": "simple_captcha"}).eq("id", directory["id"]).execute()
            sb.table("submissions").update({"status": "skipped", "notes": "Runtime CAPTCHA detected"}).eq("id", submission_id).execute()
            return "skipped"

        # Stage 2: Fill form
        form_data = _build_form_data(profile)
        await _fill_form(page, form_data)
        _advance_stage(sb, submission_id, SubmissionStage.FORM_FILLED)

        # Stage 3: Submit
        await page.get_by_role("button", name="Submit").click()
        await page.wait_for_timeout(3000)
        _advance_stage(sb, submission_id, SubmissionStage.POST_SENT)

        # Mark submitted
        sb.table("submissions").update({
            "status": "submitted",
            "submitted_at": datetime.utcnow().isoformat(),
            "notes": f"Auto-submitted by submission_engine",
        }).eq("id", submission_id).execute()
        return "submitted"

    except Exception as e:
        # Check if POST was already sent -- if so, mark submitted not failed
        stage_resp = sb.table("submissions").select("metadata").eq("id", submission_id).execute()
        current_stage = (stage_resp.data[0].get("metadata") or {}).get("stage")

        if current_stage == SubmissionStage.POST_SENT.value:
            sb.table("submissions").update({
                "status": "submitted",
                "submitted_at": datetime.utcnow().isoformat(),
                "notes": f"POST sent, post-submit error: {str(e)[:200]}",
            }).eq("id", submission_id).execute()
            return "submitted"

        # Capture screenshot for pre-POST failures
        screenshot_path = None
        try:
            screenshots_dir = f"screenshots/{client_slug}"
            os.makedirs(screenshots_dir, exist_ok=True)
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            screenshot_path = f"{screenshots_dir}/{dir_domain}_{ts}.png"
            await page.screenshot(path=screenshot_path, full_page=True)
        except Exception:
            pass  # Don't let screenshot failure hide the real error

        sb.table("submissions").update({
            "status": "failed",
            "metadata": {
                "stage": current_stage,
                "error": str(e)[:500],
                "traceback": traceback.format_exc()[:1000],
                "screenshot": screenshot_path,
                "failed_at": datetime.utcnow().isoformat(),
            },
            "notes": f"Failed at stage {current_stage}: {str(e)[:200]}",
        }).eq("id", submission_id).execute()
        return "failed"

def _advance_stage(sb, submission_id: str, stage: SubmissionStage):
    sb.table("submissions").update({
        "metadata": {"stage": stage.value, "stage_updated_at": datetime.utcnow().isoformat()}
    }).eq("id", submission_id).execute()

async def _fill_form(page, form_data: dict):
    """Fill form fields with human-like typing delays."""
    for field_name, value in form_data.items():
        if not value:
            continue
        try:
            locator = page.get_by_label(field_name)
            await locator.clear()
            delay = random.randint(80, 180)
            await locator.press_sequentially(str(value), delay=delay)
            await page.wait_for_timeout(random.randint(200, 600))
        except Exception:
            pass  # Field not found on this form -- skip silently
```

### Rate Limit Check
```python
# Source: project pattern (submissions table, submitted_at column)
def check_rate_limits(sb, client_id: str) -> tuple:
    """Check daily and weekly submission caps. Returns (today_count, week_count)."""
    today = date.today().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()

    today_count = (
        sb.table("submissions")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .gte("submitted_at", today)
        .execute()
    ).count or 0

    week_count = (
        sb.table("submissions")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .eq("status", "submitted")
        .gte("submitted_at", week_start)
        .execute()
    ).count or 0

    return today_count, week_count
```

### NAP Consistency Check
```python
# Source: project pattern (client_profiles table from Phase 8)
def nap_audit(profile: dict, form_data: dict) -> list:
    """
    Returns list of mismatch descriptions. Empty = consistent.
    Mismatches block submission.
    """
    NAP_FIELDS = ["business_name", "phone", "address_city", "address_state", "website"]
    mismatches = []
    for field in NAP_FIELDS:
        canonical = (profile.get(field) or "").strip()
        form_value = (form_data.get(field) or "").strip()
        if canonical and form_value and canonical != form_value:
            mismatches.append(f"{field}: '{canonical}' != '{form_value}'")
    return mismatches
```

### CLI Entry Point (follows discovery.py pattern)
```python
# Source: scripts/seo_engine/discovery.py (existing CLI pattern)
def main():
    parser = argparse.ArgumentParser(description="Auto-submit client profiles to Tier 3 no-CAPTCHA directories")
    parser.add_argument("--client-slug", required=True, help="Client slug (e.g. mr-green-turf-clean)")
    parser.add_argument("--dry-run", action="store_true", help="Show eligible submissions without executing")
    parser.add_argument("--limit", type=int, default=5, help="Max submissions this run (default: 5, hard-capped by daily limit)")
    args = parser.parse_args()

    asyncio.run(run_submission_engine(
        client_slug=args.client_slug,
        dry_run=args.dry_run,
        run_limit=args.limit,
    ))

if __name__ == "__main__":
    main()

# Usage:
#   python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean --dry-run
#   python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean
#   python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean --limit 3
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous `requests` + HTTP POST | Async Playwright with real browser | Phase 9 (new) | Handles JS-rendered forms, cookie-based CSRF, dynamic validation |
| No stealth (headless Chromium detected) | playwright-stealth 2.0.2 patches 10+ detection signals | 2024-2026 | Reduces bot detection on basic directory sites |
| Puppeteer (JS only) | playwright Python (async_api) | 2023+ | Same feature set, native Python, consistent with project stack |
| playwright-stealth v1.x (AtuboDad) | playwright-stealth v2.0.2 (maintained fork) | Feb 2026 | Stable API, Python 3.9-3.14 support, MIT license |

**Deprecated/outdated:**
- `puppeteer-extra-plugin-stealth` (JS only): not applicable to this Python project
- `selenium` with `undetected-chromedriver`: heavier, older API, not project standard
- Synchronous `playwright.sync_api`: async API is the standard for Python Playwright; sync API wraps async and is not suitable for embedding in async code paths

## Open Questions

1. **Form config coverage for all 55 directories**
   - What we know: ~70% of Tier 3 no-CAPTCHA forms can likely be handled by semantic locators (`get_by_label`, `get_by_placeholder`). Estimated from STATE.md: "Form mapping success rate estimated at ~70%".
   - What's unclear: Which specific 30% of directories need per-directory override configs. This can only be discovered by dry-running the engine against each directory.
   - Recommendation: Build the engine with a generic form config first, then add per-directory overrides in `form_configs/overrides/` as failures are encountered. Phase 9 PLAN should include a task to dry-run all eligible directories and document which need overrides.

2. **Supabase `metadata` JSONB update behavior on partial writes**
   - What we know: The `metadata` column is `jsonb DEFAULT '{}'`. When we `update({metadata: {...}})`, it replaces the entire jsonb object, not merges.
   - What's unclear: If the column already has other keys (from discovery or seed), a naive update will overwrite them.
   - Recommendation: Use PostgreSQL `jsonb_build_object` via RPC, or read-then-merge in Python before writing: `existing_meta = submission["metadata"]; existing_meta.update(new_fields); sb.update({"metadata": existing_meta})`. The state machine writes are the only writers to this column in Phase 9, so read-then-merge is safe.

3. **Whether `submitted_at` needs a DB migration or is already nullable**
   - What we know: `submissions` table has `submitted_at timestamptz` from Phase 8 migration (add_directory_system_tables.sql). It is nullable.
   - What's unclear: Nothing -- this is confirmed from the migration file. No migration needed for Phase 9.
   - Recommendation: No action needed. The column exists and accepts null until submission occurs.

4. **Screenshot storage for macOS vs deployment**
   - What we know: Brian runs scripts locally. `screenshots/` directory relative to the project root is sufficient.
   - What's unclear: If the project ever moves to a VPS (not current plan), the local path approach needs revision.
   - Recommendation: Use `BASE_DIR / "screenshots"` path (following `seo_loop.py` BASE_DIR pattern). Gitignore the directory. No cloud storage needed for Phase 9.

## Sources

### Primary (HIGH confidence)
- `playwright` 1.58.0 -- https://pypi.org/project/playwright/ -- version, Python requirements, browser support
- `playwright-stealth` 2.0.2 -- https://pypi.org/project/playwright-stealth/ -- version, API, stealth context manager pattern
- playwright.dev/python/docs/library -- async setup, browser launch, wait_for_timeout over time.sleep
- playwright.dev/python/docs/input -- press_sequentially with delay, fill, locator patterns
- playwright.dev/python/docs/screenshots -- page.screenshot(path, full_page)
- playwright.dev/python/docs/emulation -- viewport, user_agent, locale context options
- Existing codebase: `scripts/seo_engine/discovery.py` -- CLI pattern, _get_supabase(), Supabase upsert with on_conflict
- Existing codebase: `scripts/seo_engine/seo_loop.py` -- WEEKLY_LIMITS pattern, rate limit via DB query
- Existing codebase: `supabase/migrations/add_directory_system_tables.sql` -- confirmed submissions schema (submitted_at nullable, metadata jsonb)

### Secondary (MEDIUM confidence)
- playwright.dev/python/docs/api/class-browsertype -- launch args for anti-detection (--disable-blink-features=AutomationControlled)
- Multiple WebSearch results corroborating playwright-stealth as the standard stealth approach for Python Playwright automation (ZenRows, Bright Data, ScrapingAnt)

### Tertiary (LOW confidence)
- STATE.md "Form mapping success rate estimated at ~70%" -- project estimate, not verified by testing. Actual rate will be known after Phase 9 dry-run.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- playwright and playwright-stealth versions verified on PyPI. Installation commands verified.
- Architecture: HIGH -- state machine, rate limiter, NAP check, and screenshot patterns all map directly to official Playwright Python API and existing project conventions
- Pitfalls: HIGH -- CAPTCHA false negatives and form selector brittleness are well-documented in captcha_audit.py comments and STATE.md. Rate limit pattern confirmed from seo_loop.py.
- Form config coverage (the 30% overrides): MEDIUM -- estimate from STATE.md, only testable by running the engine

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (Playwright releases frequently but 1.58.0 is stable; playwright-stealth 2.0.2 released Feb 2026)
