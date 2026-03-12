"""
Backfill GSC query history for all active clients.
Pulls day-by-day GSC data from each client's earliest gsc_queries entry to yesterday,
upserting all results so no historical data is lost.

Usage: python3 scripts/backfill_gsc_history.py
"""

import json
import os
import time
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from supabase import create_client

load_dotenv()

REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN")
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
CLIENTS_FILE = BASE_DIR / "clients.json"


def get_creds():
    return Credentials(
        token=None,
        refresh_token=REFRESH_TOKEN,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
    )


def pull_gsc_day(service, site_url, day):
    """Pull all GSC queries for a single day (up to 5000)."""
    day_str = str(day)
    resp = service.searchanalytics().query(
        siteUrl=site_url,
        body={
            "startDate": day_str,
            "endDate": day_str,
            "dimensions": ["query"],
            "rowLimit": 5000,
            "orderBy": [{"fieldName": "impressions", "sortOrder": "DESCENDING"}],
        },
    ).execute()

    queries = []
    for row in resp.get("rows", []):
        queries.append({
            "query": row["keys"][0],
            "impressions": int(row.get("impressions", 0)),
            "clicks": int(row.get("clicks", 0)),
            "position": round(row.get("position", 0), 1),
        })
    return queries


def main():
    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    creds = get_creds()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    yesterday = date.today() - timedelta(days=1)

    # Only backfill clients that already have GSC data
    target_slugs = ["integrity-pro-washers", "mr-green-turf-clean"]

    for client in clients:
        if client["slug"] not in target_slugs:
            print(f"Skipping {client['name']}")
            continue

        gsc_url = client.get("gsc_url", "")
        if not gsc_url:
            print(f"Skipping {client['name']} -- no gsc_url")
            continue

        # Look up Supabase client ID
        print(f"Looking up {client['name']} in Supabase...")
        client_resp = sb.table("clients").select("id").eq("slug", client["slug"]).execute()
        if not client_resp.data:
            print(f"Skipping {client['name']} -- not in Supabase")
            continue
        client_id = client_resp.data[0]["id"]
        print(f"  Client ID: {client_id}")

        # Find earliest existing gsc_queries entry for this client
        earliest_resp = (
            sb.table("gsc_queries")
            .select("run_date")
            .eq("client_id", client_id)
            .order("run_date", desc=False)
            .limit(1)
            .execute()
        )

        if earliest_resp.data:
            start_date = date.fromisoformat(earliest_resp.data[0]["run_date"])
        else:
            # No existing data -- go back 90 days
            start_date = yesterday - timedelta(days=90)

        print(f"\n{'='*60}")
        print(f"  {client['name']}")
        print(f"  Backfilling {start_date} to {yesterday}")
        print(f"{'='*60}")

        service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
        current_day = start_date
        total_upserted = 0
        days_processed = 0
        total_days = (yesterday - start_date).days + 1

        while current_day <= yesterday:
            try:
                queries = pull_gsc_day(service, gsc_url, current_day)
            except Exception as e:
                print(f"  {current_day} -- ERROR: {e}")
                current_day += timedelta(days=1)
                time.sleep(0.5)
                continue

            if queries:
                rows = [
                    {
                        "client_id": client_id,
                        "run_date": str(current_day),
                        "query": q["query"],
                        "impressions": q["impressions"],
                        "clicks": q["clicks"],
                        "position": q["position"],
                    }
                    for q in queries
                ]
                sb.table("gsc_queries").upsert(
                    rows,
                    on_conflict="client_id,run_date,query",
                ).execute()
                total_upserted += len(rows)

            days_processed += 1
            if days_processed % 10 == 0 or current_day == yesterday:
                print(f"  {current_day} -- {len(queries)} queries  ({days_processed}/{total_days} days, {total_upserted} total rows)")

            current_day += timedelta(days=1)
            time.sleep(0.5)

        print(f"  Done: {days_processed} days, {total_upserted} rows upserted")

    print("\nBackfill complete.")


if __name__ == "__main__":
    main()
