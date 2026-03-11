"""
CAPTCHA Audit for Directory Submission URLs
=============================================
Fetches each directory's submission URL and checks the HTML for known CAPTCHA
markers. Classifies directories as no_captcha, simple_captcha, advanced_captcha,
or unknown. Results inform Phase 9's Playwright automation engine.

LIMITATION: This script only checks the initial HTML response. Directories that
load CAPTCHAs via JavaScript after page load (invisible reCAPTCHA v3, dynamically
injected challenges) will be classified as 'no_captcha' here but may actually
have CAPTCHAs. Brian should manually review directories classified as 'no_captcha'
(~15-20 expected) before Phase 9 automation begins.

Usage:
    python3 -m scripts.seo_engine.captcha_audit
    python3 -m scripts.seo_engine.captcha_audit --update
    python3 -m scripts.seo_engine.captcha_audit --only-unknown
    python3 -m scripts.seo_engine.captcha_audit --only-unknown --update
"""

import argparse
import os
import sys
import time
from datetime import datetime

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# CAPTCHA detection patterns (checked against lowercased HTML source)
CAPTCHA_PATTERNS = {
    "recaptcha_v2": [
        "google.com/recaptcha",
        "g-recaptcha",
        "recaptcha/api.js",
    ],
    "recaptcha_v3": [
        "recaptcha/api.js?render=",
    ],
    "hcaptcha": [
        "hcaptcha.com",
        "h-captcha",
    ],
    "turnstile": [
        "challenges.cloudflare.com/turnstile",
    ],
}

# User-Agent to avoid bot blocks on initial fetch
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def _detect_captcha(html: str) -> tuple:
    """
    Detect CAPTCHA type from HTML source.

    Returns:
        (status, method) tuple where:
        - status: 'no_captcha', 'simple_captcha', or 'advanced_captcha'
        - method: description of what was detected, or None
    """
    html_lower = html.lower()

    # Check each pattern family
    detected = {}
    for captcha_type, patterns in CAPTCHA_PATTERNS.items():
        for pattern in patterns:
            if pattern.lower() in html_lower:
                detected[captcha_type] = pattern
                break

    if not detected:
        return "no_captcha", None

    # Classify based on what was found
    # reCAPTCHA v3 (invisible) = advanced
    if "recaptcha_v3" in detected:
        return "advanced_captcha", f"reCAPTCHA v3 ({detected['recaptcha_v3']})"

    # hCaptcha = advanced (image challenges)
    if "hcaptcha" in detected:
        return "advanced_captcha", f"hCaptcha ({detected['hcaptcha']})"

    # Turnstile = advanced (Cloudflare managed challenge)
    if "turnstile" in detected:
        return "advanced_captcha", f"Cloudflare Turnstile ({detected['turnstile']})"

    # reCAPTCHA v2 checkbox = simple
    if "recaptcha_v2" in detected:
        return "simple_captcha", f"reCAPTCHA v2 ({detected['recaptcha_v2']})"

    return "no_captcha", None


def audit_captchas(update: bool = False, only_unknown: bool = False):
    """
    Audit all directory submission URLs for CAPTCHA markers.

    Args:
        update: If True, write results to Supabase directories table
        only_unknown: If True, only check directories with captcha_status='unknown'
    """
    sb = _get_supabase()

    # Fetch directories
    query = sb.table("directories").select(
        "id, name, domain, submission_url, captcha_status, enabled"
    ).eq("enabled", True)

    if only_unknown:
        query = query.eq("captcha_status", "unknown")

    dirs_resp = query.execute()
    directories = dirs_resp.data or []

    # Filter to directories with submission URLs
    dirs_with_urls = [d for d in directories if d.get("submission_url")]
    dirs_without_urls = [d for d in directories if not d.get("submission_url")]

    print(f"\n{'='*80}")
    print(f"  CAPTCHA Audit")
    print(f"  Directories with submission URLs: {len(dirs_with_urls)}")
    print(f"  Directories without URLs (skipped): {len(dirs_without_urls)}")
    if only_unknown:
        print(f"  Filter: only unknown captcha_status")
    if update:
        print(f"  Mode: LIVE UPDATE (writing to Supabase)")
    else:
        print(f"  Mode: DRY RUN (report only)")
    print(f"{'='*80}\n")

    if not dirs_with_urls:
        print("  No directories to audit.")
        return

    # Results tracking
    results = []
    counts = {"no_captcha": 0, "simple_captcha": 0, "advanced_captcha": 0, "unknown": 0, "failed": 0}

    # Print table header
    print(f"  {'Directory':<25} {'Status':<18} {'Detection':<40} {'URL'}")
    print(f"  {'-'*25} {'-'*18} {'-'*40} {'-'*40}")

    for d in dirs_with_urls:
        url = d["submission_url"]
        dir_name = d["name"][:24]

        try:
            resp = requests.get(
                url,
                headers={"User-Agent": USER_AGENT},
                timeout=10,
                allow_redirects=True,
            )

            if resp.status_code >= 400:
                status = "unknown"
                method = f"HTTP {resp.status_code}"
                counts["failed"] += 1
            else:
                status, method = _detect_captcha(resp.text)
                counts[status] += 1

        except requests.exceptions.Timeout:
            status = "unknown"
            method = "Timeout (10s)"
            counts["failed"] += 1
        except requests.exceptions.ConnectionError as e:
            status = "unknown"
            method = f"Connection error"
            counts["failed"] += 1
        except Exception as e:
            status = "unknown"
            method = str(e)[:40]
            counts["failed"] += 1

        results.append({
            "directory_id": d["id"],
            "name": d["name"],
            "url": url,
            "status": status,
            "method": method,
        })

        # Color-coded output (ANSI)
        if status == "no_captcha":
            color = "\033[92m"  # green
        elif status == "simple_captcha":
            color = "\033[93m"  # yellow
        elif status == "advanced_captcha":
            color = "\033[91m"  # red
        else:
            color = "\033[90m"  # gray
        reset = "\033[0m"

        method_display = method or "-"
        print(f"  {dir_name:<25} {color}{status:<18}{reset} {method_display:<40} {url[:50]}")

        # Be polite to directory servers
        time.sleep(2)

    # --- Summary ---
    print(f"\n{'='*80}")
    print(f"  Summary:")
    print(f"    No CAPTCHA:       {counts['no_captcha']}")
    print(f"    Simple CAPTCHA:   {counts['simple_captcha']}")
    print(f"    Advanced CAPTCHA: {counts['advanced_captcha']}")
    print(f"    Unknown/Failed:   {counts['unknown'] + counts['failed']}")
    print(f"    Total checked:    {len(results)}")
    print(f"{'='*80}")

    if counts["no_captcha"] > 0:
        print(f"\n  NOTE: {counts['no_captcha']} directories show no CAPTCHA in initial HTML.")
        print(f"  Some may load CAPTCHAs via JavaScript after page render.")
        print(f"  Manual review recommended before Phase 9 automation.\n")

    # --- Update Supabase if --update flag ---
    if update:
        updated = 0
        for r in results:
            if r["status"] != "unknown" or r["method"]:
                update_data = {
                    "captcha_status": r["status"],
                    "captcha_checked_at": datetime.utcnow().isoformat(),
                }
                sb.table("directories").update(update_data).eq("id", r["directory_id"]).execute()
                updated += 1

        print(f"  Updated {updated} directories in Supabase\n")
    else:
        print(f"  Run with --update to write results to Supabase\n")


def main():
    parser = argparse.ArgumentParser(description="Audit directory submission URLs for CAPTCHA markers")
    parser.add_argument("--update", action="store_true", help="Write results to Supabase (default: dry-run)")
    parser.add_argument(
        "--only-unknown",
        action="store_true",
        help="Only check directories with captcha_status='unknown'",
    )
    args = parser.parse_args()

    audit_captchas(update=args.update, only_unknown=args.only_unknown)


if __name__ == "__main__":
    main()
