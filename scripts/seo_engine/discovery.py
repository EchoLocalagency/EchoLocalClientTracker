"""
Listing Discovery via Brave Search
====================================
On-demand per-client script: searches each enabled directory for pre-existing
listings using Brave Search site: queries. Found listings are upserted as
'existing_needs_review' submission rows so Brian can verify before Phase 9
automation begins.

Uses budget-gated brave_client.py -- stops gracefully if budget is exceeded.

Usage:
    python3 -m scripts.seo_engine.discovery --client-slug mr-green-turf-clean
    python3 -m scripts.seo_engine.discovery --client-slug mr-green-turf-clean --dry-run
    python3 -m scripts.seo_engine.discovery --client-slug mr-green-turf-clean --skip-checked-days 7
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


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def discover_existing_listings(client_slug: str, dry_run: bool = False, skip_days: int = 30):
    """
    Search each enabled directory for pre-existing listings for a given client.

    Args:
        client_slug: Client slug (e.g. 'mr-green-turf-clean')
        dry_run: If True, show what would be searched without making API calls
        skip_days: Skip directories checked within this many days (default 30)
    """
    sb = _get_supabase()

    # --- Load client and profile ---
    client_resp = sb.table("clients").select("id, slug, name").eq("slug", client_slug).execute()
    if not client_resp.data:
        print(f"[ERROR] No client found with slug '{client_slug}'")
        sys.exit(1)

    client = client_resp.data[0]
    client_id = client["id"]

    profile_resp = (
        sb.table("client_profiles")
        .select("business_name, phone, address_city, address_state")
        .eq("client_id", client_id)
        .execute()
    )
    if not profile_resp.data:
        print("[ERROR] No client profile found. Run seed_client_profiles.py first.")
        sys.exit(1)

    profile = profile_resp.data[0]
    business_name = profile["business_name"]
    city = profile.get("address_city") or ""

    # --- Load enabled directories ---
    dirs_resp = sb.table("directories").select("id, name, domain, enabled").eq("enabled", True).execute()
    directories = dirs_resp.data or []

    if not directories:
        print("[WARN] No enabled directories found in Supabase.")
        return

    # --- Determine which directories to skip (recently checked) ---
    cutoff = (datetime.utcnow() - timedelta(days=skip_days)).isoformat()

    # Fetch existing submissions for this client that were recently discovered
    existing_resp = (
        sb.table("submissions")
        .select("directory_id, status, notes, updated_at")
        .eq("client_id", client_id)
        .execute()
    )
    existing_subs = {row["directory_id"]: row for row in (existing_resp.data or [])}

    # Build skip set: directories recently checked via Brave discovery
    skip_dir_ids = set()
    for dir_id, sub in existing_subs.items():
        notes = sub.get("notes") or ""
        updated = sub.get("updated_at") or ""
        if "Discovered via Brave" in notes and updated >= cutoff:
            skip_dir_ids.add(dir_id)

    # Also skip directories where submission has a non-pending status (don't overwrite)
    protected_statuses = {"submitted", "verified", "skipped", "existing_needs_review"}
    protected_dir_ids = set()
    for dir_id, sub in existing_subs.items():
        if sub.get("status") in protected_statuses:
            protected_dir_ids.add(dir_id)

    to_check = []
    skipped_recent = 0
    for d in directories:
        if d["id"] in skip_dir_ids:
            skipped_recent += 1
        else:
            to_check.append(d)

    # --- Pre-run summary ---
    print(f"\n{'='*60}")
    print(f"  Listing Discovery: {business_name}")
    print(f"  City: {city}")
    print(f"  Directories to check: {len(to_check)}")
    print(f"  Skipped (checked within {skip_days}d): {skipped_recent}")
    print(f"  Estimated Brave queries: {len(to_check)}")
    if dry_run:
        print(f"  MODE: DRY RUN (no API calls)")
    print(f"{'='*60}\n")

    if dry_run:
        for d in to_check:
            query = f'site:{d["domain"]} "{business_name}" "{city}"'
            protected = " [PROTECTED - won't overwrite]" if d["id"] in protected_dir_ids else ""
            print(f"  Would search: {query}{protected}")
        print(f"\n  Total queries that would be made: {len(to_check)}")
        return

    # --- Search loop ---
    found = []
    not_found = []
    queries_used = 0

    for d in to_check:
        query = f'site:{d["domain"]} "{business_name}" "{city}"'
        print(f"  Searching {d['name']}...", end=" ", flush=True)

        result = search_brave(query=query, client_id=client_id, count=3)
        queries_used += 1

        # Budget exceeded -- stop gracefully
        if result.get("blocked"):
            print(f"\n\n[BUDGET] {result.get('reason', 'Budget exceeded')}")
            print(f"  Stopping discovery. Partial results below.\n")
            break

        web_results = result.get("web", {}).get("results", [])

        if web_results:
            first = web_results[0]
            live_url = first.get("url", "")
            title = first.get("title", "")
            found.append({"directory": d, "url": live_url, "title": title})
            print(f"FOUND -> {live_url}")

            # Only upsert if no protected existing submission
            if d["id"] not in protected_dir_ids:
                sb.table("submissions").upsert(
                    {
                        "client_id": client_id,
                        "directory_id": d["id"],
                        "status": "existing_needs_review",
                        "live_url": live_url,
                        "notes": f"Discovered via Brave Search: {title}",
                    },
                    on_conflict="client_id,directory_id",
                ).execute()
            else:
                print(f"    (existing submission preserved -- status already set)")
        else:
            not_found.append(d)
            print(f"not found")

        # Rate limit: Brave API 1 req/sec (brave_client already sleeps 1s, add 0.1s buffer)
        time.sleep(0.1)

    # --- Post-run summary ---
    print(f"\n{'='*60}")
    print(f"  Discovery complete for {business_name}")
    print(f"{'='*60}")
    print(f"  Found on: {len(found)} directories")
    for f_item in found:
        print(f"    - {f_item['directory']['name']}: {f_item['url']}")
    print(f"  Not found on: {len(not_found)} directories")
    for nf in not_found:
        print(f"    - {nf['name']}")
    print(f"  Skipped (already checked): {skipped_recent}")
    print(f"  Brave queries used: {queries_used}")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Discover existing directory listings via Brave Search")
    parser.add_argument("--client-slug", required=True, help="Client slug (e.g. mr-green-turf-clean)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be searched without making API calls")
    parser.add_argument(
        "--skip-checked-days",
        type=int,
        default=30,
        help="Skip directories checked within N days (default: 30)",
    )
    args = parser.parse_args()

    discover_existing_listings(
        client_slug=args.client_slug,
        dry_run=args.dry_run,
        skip_days=args.skip_checked_days,
    )


if __name__ == "__main__":
    main()
