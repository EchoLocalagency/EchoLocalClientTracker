"""
Tracker Data Health Check
Runs after daily report pipeline to validate data integrity.
Checks for: all-zero reports, missing GBP data, missing conversions,
NULL anomalies, stale data, and error flags.

Usage: python3 scripts/health_check.py
"""

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CLIENTS_FILE = Path("/Users/brianegan/EchoLocalClientTracker/clients.json")


def run_health_check():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    today = date.today()
    issues = []
    warnings = []

    with open(CLIENTS_FILE) as f:
        clients_config = json.load(f)
    config_by_slug = {c["slug"]: c for c in clients_config}

    # Get all clients from Supabase
    clients = sb.table("clients").select("*").execute().data
    if not clients:
        issues.append("CRITICAL: No clients found in Supabase")
        return issues, warnings

    for client in clients:
        client_id = client["id"]
        name = client["name"]
        slug = client["slug"]
        config = config_by_slug.get(slug, {})
        prefix = f"[{name}]"

        # Get last 14 reports
        reports = sb.table("reports").select("*") \
            .eq("client_id", client_id) \
            .order("run_date", desc=True) \
            .limit(14) \
            .execute().data

        if not reports:
            issues.append(f"{prefix} No reports found at all")
            continue

        latest = reports[0]
        latest_date = latest["run_date"]

        # --- Check 1: Stale data (no report in last 2 days) ---
        days_since = (today - date.fromisoformat(latest_date)).days
        if days_since > 2:
            issues.append(f"{prefix} Stale data: last report is {days_since} days old ({latest_date})")

        # --- Check 2: Error flags on latest report ---
        error_flags = latest.get("error_flags") or []
        if error_flags:
            issues.append(f"{prefix} Latest report ({latest_date}) had errors: {', '.join(error_flags)}")

        # --- Check 3: All-zero GA4 (likely API failure) ---
        if (latest.get("ga4_sessions") or 0) == 0 and (latest.get("ga4_organic") or 0) == 0:
            # Check if this is actually a zero day or an API failure
            # Look at recent history to see if sessions are normally > 0
            recent_sessions = [r.get("ga4_sessions") or 0 for r in reports[1:7]]
            avg_sessions = sum(recent_sessions) / max(len(recent_sessions), 1)
            if avg_sessions > 5:
                issues.append(
                    f"{prefix} Latest report has 0 sessions + 0 organic "
                    f"(avg of prior reports: {avg_sessions:.0f}). Likely GA4 API failure."
                )

        # --- Check 4: GBP data missing when client has gbp_location ---
        has_gbp_config = bool(config.get("gbp_location"))
        if has_gbp_config:
            gbp_impressions = latest.get("gbp_total_impressions")
            if gbp_impressions is None:
                # Check if previous reports have GBP data
                prev_with_gbp = [r for r in reports[1:] if r.get("gbp_total_impressions") is not None]
                if prev_with_gbp:
                    issues.append(
                        f"{prefix} Latest report ({latest_date}) has NULL GBP data "
                        f"but {len(prev_with_gbp)} prior reports have data. GBP pull likely failed."
                    )
                else:
                    warnings.append(f"{prefix} GBP configured but no GBP data in any recent report")
            elif gbp_impressions == 0:
                # Check historical -- 0 could be legit for a single day
                prev_gbp = [r.get("gbp_total_impressions") or 0 for r in reports[1:7]]
                avg_gbp = sum(prev_gbp) / max(len(prev_gbp), 1)
                if avg_gbp > 10:
                    warnings.append(
                        f"{prefix} GBP impressions = 0 today (avg prior: {avg_gbp:.0f}). "
                        f"Could be data lag for daily pull."
                    )

        # --- Check 5: Conversions vanished ---
        # Check if client historically has conversions but latest shows none
        has_form_config = "form_submit" in config.get("conversion_events", [])
        if has_form_config:
            recent_forms = [r.get("ga4_form_submits") or 0 for r in reports[:7]]
            historical_forms = [r.get("ga4_form_submits") or 0 for r in reports]
            if sum(historical_forms) > 0 and sum(recent_forms) == 0:
                warnings.append(
                    f"{prefix} Form submits have been 0 for last {len(recent_forms)} reports "
                    f"but were non-zero historically. Check if form tracking is still active."
                )

        # Phone clicks
        recent_phones = [r.get("ga4_phone_clicks") or 0 for r in reports[:7]]
        historical_phones = [r.get("ga4_phone_clicks") or 0 for r in reports]
        if sum(historical_phones) > 0 and sum(recent_phones) == 0:
            warnings.append(
                f"{prefix} Phone clicks have been 0 for last {len(recent_phones)} reports "
                f"but were non-zero historically."
            )

        # GBP call clicks and website clicks
        if has_gbp_config:
            recent_gbp_calls = [r.get("gbp_call_clicks") or 0 for r in reports[:7]]
            historical_gbp_calls = [r.get("gbp_call_clicks") or 0 for r in reports]
            if sum(historical_gbp_calls) > 0 and sum(recent_gbp_calls) == 0:
                warnings.append(
                    f"{prefix} GBP call clicks have been 0 for last {len(recent_gbp_calls)} reports "
                    f"but were non-zero historically."
                )

            recent_gbp_web = [r.get("gbp_website_clicks") or 0 for r in reports[:7]]
            historical_gbp_web = [r.get("gbp_website_clicks") or 0 for r in reports]
            if sum(historical_gbp_web) > 0 and sum(recent_gbp_web) == 0:
                warnings.append(
                    f"{prefix} GBP website clicks have been 0 for last {len(recent_gbp_web)} reports "
                    f"but were non-zero historically."
                )

        # --- Check 6: period_start/period_end sanity ---
        ps = latest.get("period_start")
        pe = latest.get("period_end")
        if not ps or not pe:
            issues.append(f"{prefix} Latest report missing period_start or period_end")
        else:
            start_d = date.fromisoformat(ps)
            end_d = date.fromisoformat(pe)
            if end_d < start_d:
                issues.append(f"{prefix} period_end ({pe}) before period_start ({ps})")
            period_days = (end_d - start_d).days + 1
            if period_days > 30:
                warnings.append(f"{prefix} Unusually long period: {period_days} days ({ps} to {pe})")

        # --- Check 7: NULL vs 0 anomalies ---
        # If GA4 ran successfully, sessions should be a number (even if 0), not NULL
        if latest.get("ga4_sessions") is None and "ga4_failed" not in error_flags:
            warnings.append(f"{prefix} ga4_sessions is NULL but no ga4_failed error flag")

        # --- Check 8: GSC queries exist for latest report ---
        queries = sb.table("gsc_queries").select("id") \
            .eq("report_id", latest["id"]) \
            .limit(1) \
            .execute().data
        if not queries and (latest.get("gsc_impressions") or 0) > 0:
            warnings.append(
                f"{prefix} Has {latest['gsc_impressions']} GSC impressions "
                f"but no queries stored for report {latest['id']}"
            )

    return issues, warnings


def main():
    print(f"Tracker Health Check -- {date.today()}")
    print("=" * 60)

    issues, warnings = run_health_check()

    if issues:
        print(f"\nISSUES ({len(issues)}):")
        for i in issues:
            print(f"  [!] {i}")

    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  [?] {w}")

    if not issues and not warnings:
        print("\nAll checks passed. Data looks healthy.")

    # Summary
    total = len(issues) + len(warnings)
    print(f"\n{'=' * 60}")
    print(f"Result: {len(issues)} issues, {len(warnings)} warnings")

    # Exit with error code if there are critical issues
    if issues:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
