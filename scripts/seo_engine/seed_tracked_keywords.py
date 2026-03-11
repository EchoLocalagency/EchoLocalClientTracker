"""
Seed Tracked Keywords
=====================
Reads target_keywords from clients.json and inserts into tracked_keywords.
Backfills keyword_snapshots from existing gsc_queries data.

Usage:
    python3 -m scripts.seo_engine.seed_tracked_keywords
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
CLIENTS_FILE = BASE_DIR / "clients.json"


def seed():
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    total_seeded = 0
    total_backfilled = 0

    for client in clients:
        slug = client["slug"]
        target_keywords = client.get("target_keywords", [])
        if not target_keywords:
            continue

        # Get Supabase client ID
        resp = sb.table("clients").select("id").eq("slug", slug).execute()
        if not resp.data:
            print(f"  {slug}: not in Supabase, skipping")
            continue
        client_id = resp.data[0]["id"]

        print(f"\n  {slug} ({len(target_keywords)} target keywords)")

        # Upsert tracked keywords
        rows = [
            {
                "client_id": client_id,
                "keyword": kw,
                "source": "target_list",
                "is_active": True,
            }
            for kw in target_keywords
        ]
        sb.table("tracked_keywords").upsert(
            rows,
            on_conflict="client_id,keyword",
        ).execute()
        total_seeded += len(rows)
        print(f"    Seeded {len(rows)} tracked keywords")

        # Backfill from gsc_queries: find matching keywords in history
        gsc_resp = (
            sb.table("gsc_queries")
            .select("query, run_date, position, impressions, clicks")
            .eq("client_id", client_id)
            .order("run_date", desc=False)
            .execute()
        )

        if not gsc_resp.data:
            print(f"    No GSC history to backfill")
            continue

        kw_set = set(kw.lower() for kw in target_keywords)
        backfill_rows = []
        for row in gsc_resp.data:
            if row["query"].lower() in kw_set:
                backfill_rows.append({
                    "client_id": client_id,
                    "keyword": row["query"],
                    "checked_at": row["run_date"],
                    "source": "gsc",
                    "position": row["position"],
                    "impressions": row["impressions"],
                    "clicks": row["clicks"],
                })

        if backfill_rows:
            # Batch upsert in chunks of 100
            for i in range(0, len(backfill_rows), 100):
                chunk = backfill_rows[i : i + 100]
                sb.table("keyword_snapshots").upsert(
                    chunk,
                    on_conflict="client_id,keyword,checked_at,source",
                ).execute()
            total_backfilled += len(backfill_rows)
            print(f"    Backfilled {len(backfill_rows)} GSC snapshots")
        else:
            print(f"    No matching GSC queries to backfill")

    print(f"\nDone: {total_seeded} keywords seeded, {total_backfilled} snapshots backfilled")


if __name__ == "__main__":
    seed()
