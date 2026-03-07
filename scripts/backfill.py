"""
Historical backfill — pulls all available data in 14-day windows
GA4: back to property creation date
GSC: back 16 months (API limit)
PageSpeed: current only (no historical API) — stored once on latest run
"""

import warnings
warnings.filterwarnings("ignore")

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
import urllib.request
from google.oauth2.credentials import Credentials
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Metric, Dimension,
    FilterExpression, Filter
)
from googleapiclient.discovery import build
from supabase import create_client

from run_reports import pull_gbp

load_dotenv()
REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN")
CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
PSI_KEY       = os.getenv("PSI_KEY")
SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")

BASE_DIR     = Path("/Users/brianegan/EchoLocalClientTracker")
CLIENTS_FILE = BASE_DIR / "clients.json"

# GSC API max is 16 months back; GA4 can go further but we cap at 16 months too
BACKFILL_START = date.today() - timedelta(days=16 * 30)
# End 3 days ago (GSC lag)
BACKFILL_END   = date.today() - timedelta(days=3)


def get_creds():
    return Credentials(
        token=None,
        refresh_token=REFRESH_TOKEN,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token"
    )


def pull_ga4(creds, property_id, start, end):
    client = BetaAnalyticsDataClient(credentials=creds)

    def run(extra_filter=None):
        req = RunReportRequest(
            property=property_id,
            date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
            metrics=[Metric(name="sessions")],
        )
        if extra_filter:
            req.dimension_filter = extra_filter
        resp = client.run_report(req)
        return int(resp.rows[0].metric_values[0].value) if resp.rows else 0

    sessions = run()
    organic = run(FilterExpression(filter=Filter(
        field_name="sessionDefaultChannelGroup",
        string_filter=Filter.StringFilter(
            value="Organic Search",
            match_type=Filter.StringFilter.MatchType.EXACT
        )
    )))

    def run_event(event_name):
        resp = client.run_report(RunReportRequest(
            property=property_id,
            date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
            metrics=[Metric(name="eventCount")],
            dimension_filter=FilterExpression(filter=Filter(
                field_name="eventName",
                string_filter=Filter.StringFilter(
                    value=event_name,
                    match_type=Filter.StringFilter.MatchType.EXACT
                )
            ))
        ))
        return int(resp.rows[0].metric_values[0].value) if resp.rows else 0

    return {
        "sessions": sessions,
        "organic": organic,
        "phone_clicks": run_event("phone_click"),
        "form_submits": run_event("form_submit"),
    }


def pull_gsc(creds, site_url, start, end):
    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

    agg = service.searchanalytics().query(
        siteUrl=site_url,
        body={"startDate": str(start), "endDate": str(end), "dimensions": [], "rowLimit": 1}
    ).execute()
    row = agg.get("rows", [{}])[0] if agg.get("rows") else {}

    query_resp = service.searchanalytics().query(
        siteUrl=site_url,
        body={
            "startDate": str(start), "endDate": str(end),
            "dimensions": ["query"], "rowLimit": 25,
            "orderBy": [{"fieldName": "impressions", "sortOrder": "DESCENDING"}],
        }
    ).execute()

    top_queries = [
        {
            "query": r["keys"][0],
            "impressions": int(r.get("impressions", 0)),
            "clicks": int(r.get("clicks", 0)),
            "position": round(r.get("position", 0), 1),
        }
        for r in query_resp.get("rows", [])
    ]

    return {
        "impressions": int(row.get("impressions", 0)),
        "clicks": int(row.get("clicks", 0)),
        "avg_position": round(row.get("position", 0), 1),
        "top_queries": top_queries,
    }


def pull_pagespeed(url):
    results = {}
    for strategy in ["mobile", "desktop"]:
        api_url = (
            f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
            f"?url={url}&strategy={strategy}&key={PSI_KEY}"
        )
        with urllib.request.urlopen(urllib.request.Request(api_url), timeout=30) as resp:
            data = json.loads(resp.read())
        lh = data.get("lighthouseResult", {})
        cats = lh.get("categories", {})
        audits = lh.get("audits", {})
        results[strategy] = {
            "score": int((cats.get("performance", {}).get("score", 0) or 0) * 100),
            "lcp": audits.get("largest-contentful-paint", {}).get("displayValue", ""),
            "cls": audits.get("cumulative-layout-shift", {}).get("displayValue", ""),
            "tbt": audits.get("total-blocking-time", {}).get("displayValue", ""),
        }
    return results


def generate_windows(start, end):
    """Generate daily windows from oldest to newest."""
    windows = []
    cursor = start
    while cursor <= end:
        windows.append((cursor, cursor))
        cursor += timedelta(days=1)
    return windows


def main():
    import sys
    slug_filter = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    if slug_filter:
        clients = [c for c in clients if c["slug"] in slug_filter]
        print(f"Filtering to: {[c['name'] for c in clients]}")

    creds = get_creds()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch current PageSpeed once per client (no historical API)
    print("Fetching current PageSpeed scores (used for all historical rows)...")
    psi_cache = {}
    for client in clients:
        try:
            psi_cache[client["slug"]] = pull_pagespeed(client["website"])
            print(f"  {client['name']}: mobile {psi_cache[client['slug']]['mobile']['score']} | desktop {psi_cache[client['slug']]['desktop']['score']}")
        except Exception as e:
            print(f"  {client['name']} PageSpeed error: {e}")
            psi_cache[client["slug"]] = None

    windows = generate_windows(BACKFILL_START, BACKFILL_END)
    print(f"\nBackfilling {len(windows)} periods from {BACKFILL_START} to {BACKFILL_END}\n")

    for client in clients:
        slug = client["slug"]
        name = client["name"]

        # Get Supabase client ID
        resp = sb.table("clients").select("id").eq("slug", slug).execute()
        if not resp.data:
            print(f"Client '{slug}' not found in Supabase, skipping")
            continue
        client_id = resp.data[0]["id"]

        # Get already-existing run dates to skip
        existing = sb.table("reports").select("run_date").eq("client_id", client_id).execute()
        existing_dates = {r["run_date"] for r in (existing.data or [])}

        print(f"\n{'='*60}")
        print(f"  {name}  ({len(windows)} windows, {len(existing_dates)} already in DB)")
        print(f"{'='*60}")

        psi = psi_cache.get(slug)

        for (w_start, w_end) in windows:
            run_date = str(date.today())  # tag each historical row with today's backfill date
            # Use period end date as the logical run date for charting
            logical_run_date = str(w_end + timedelta(days=3))

            if logical_run_date in existing_dates:
                print(f"  Skipping {w_start} → {w_end} (already in DB)")
                continue

            print(f"  Period {w_start} → {w_end} ...", end=" ", flush=True)

            # Previous period: same day last week
            prev_start = w_start - timedelta(days=7)
            prev_end   = prev_start

            try:
                ga  = pull_ga4(creds, client["ga4_property"], w_start, w_end)
                gap = pull_ga4(creds, client["ga4_property"], prev_start, prev_end)
            except Exception as e:
                print(f"GA4 error: {e}")
                continue

            try:
                gsc  = pull_gsc(creds, client["gsc_url"], w_start, w_end)
                gscp = pull_gsc(creds, client["gsc_url"], prev_start, prev_end)
            except Exception as e:
                print(f"GSC error: {e}")
                gsc  = {"impressions": 0, "clicks": 0, "avg_position": 0, "top_queries": []}
                gscp = {"impressions": 0, "clicks": 0, "avg_position": 0, "top_queries": []}

            # GBP (if client has a location configured)
            gbp_empty = {"maps_impressions": 0, "search_impressions": 0, "total_impressions": 0,
                         "call_clicks": 0, "website_clicks": 0, "direction_requests": 0}
            gbp = gbp_empty
            gbpp = gbp_empty
            if client.get("gbp_location"):
                try:
                    gbp = pull_gbp(creds, client["gbp_location"], w_start, w_end)
                    gbpp = pull_gbp(creds, client["gbp_location"], prev_start, prev_end)
                except Exception as e:
                    print(f"GBP error: {e}")

            row = {
                "client_id":            client_id,
                "run_date":             logical_run_date,
                "period_start":         str(w_start),
                "period_end":           str(w_end),
                "ga4_sessions":         ga["sessions"],
                "ga4_sessions_prev":    gap["sessions"],
                "ga4_organic":          ga["organic"],
                "ga4_organic_prev":     gap["organic"],
                "ga4_phone_clicks":     ga["phone_clicks"],
                "ga4_phone_clicks_prev":gap["phone_clicks"],
                "ga4_form_submits":     ga["form_submits"],
                "ga4_form_submits_prev":gap["form_submits"],
                "gsc_impressions":      gsc["impressions"],
                "gsc_impressions_prev": gscp["impressions"],
                "gsc_clicks":           gsc["clicks"],
                "gsc_clicks_prev":      gscp["clicks"],
                "gsc_avg_position":     gsc["avg_position"],
                "gsc_avg_position_prev":gscp["avg_position"],
                "psi_mobile_score":     psi["mobile"]["score"] if psi else 0,
                "psi_desktop_score":    psi["desktop"]["score"] if psi else 0,
                "psi_lcp_mobile":       psi["mobile"]["lcp"] if psi else "",
                "psi_lcp_desktop":      psi["desktop"]["lcp"] if psi else "",
                "psi_cls_mobile":       psi["mobile"]["cls"] if psi else "",
                "psi_cls_desktop":      psi["desktop"]["cls"] if psi else "",
                "psi_tbt_mobile":       psi["mobile"]["tbt"] if psi else "",
                "psi_tbt_desktop":      psi["desktop"]["tbt"] if psi else "",
                "gbp_maps_impressions":      gbp["maps_impressions"],
                "gbp_maps_impressions_prev": gbpp["maps_impressions"],
                "gbp_search_impressions":      gbp["search_impressions"],
                "gbp_search_impressions_prev": gbpp["search_impressions"],
                "gbp_total_impressions":      gbp["total_impressions"],
                "gbp_total_impressions_prev": gbpp["total_impressions"],
                "gbp_call_clicks":      gbp["call_clicks"],
                "gbp_call_clicks_prev": gbpp["call_clicks"],
                "gbp_website_clicks":      gbp["website_clicks"],
                "gbp_website_clicks_prev": gbpp["website_clicks"],
                "gbp_direction_requests":      gbp["direction_requests"],
                "gbp_direction_requests_prev": gbpp["direction_requests"],
            }

            result = sb.table("reports").upsert(row, on_conflict="client_id,run_date").execute()
            report_id = result.data[0]["id"] if result.data else None

            gbp_str = f" gbp={gbp['total_impressions']}" if gbp["total_impressions"] else ""
            print(f"sessions={ga['sessions']} organic={ga['organic']} impressions={gsc['impressions']} clicks={gsc['clicks']}{gbp_str}")

            # Insert GSC queries
            if report_id and gsc["top_queries"]:
                sb.table("gsc_queries").delete().eq("report_id", report_id).execute()
                sb.table("gsc_queries").insert([
                    {
                        "report_id":   report_id,
                        "client_id":   client_id,
                        "run_date":    logical_run_date,
                        "query":       q["query"],
                        "impressions": q["impressions"],
                        "clicks":      q["clicks"],
                        "position":    q["position"],
                    }
                    for q in gsc["top_queries"]
                ]).execute()

    print("\n\nBackfill complete.")


if __name__ == "__main__":
    main()
