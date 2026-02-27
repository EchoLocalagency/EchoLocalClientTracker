"""
Client Performance Report Pipeline
Pulls GA4, GSC, and PageSpeed data for all clients.
Analyzes trends and writes curated results to Supabase.
Also saves local JSON backup.

Usage: python3 scripts/run_reports.py
"""

import warnings
warnings.filterwarnings("ignore")

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import urllib.request
import requests
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Metric, Dimension,
    FilterExpression, Filter, OrderBy
)
from googleapiclient.discovery import build
from supabase import create_client

# ── Config ──────────────────────────────────────────────────────────────

load_dotenv()
REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN")
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
PSI_KEY = os.getenv("PSI_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
CLIENTS_FILE = BASE_DIR / "clients.json"
REPORTS_DIR = BASE_DIR / "reports"

# ── Auth ────────────────────────────────────────────────────────────────

def get_creds():
    return Credentials(
        token=None,
        refresh_token=REFRESH_TOKEN,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token"
    )

# ── GA4 ─────────────────────────────────────────────────────────────────

def pull_ga4(creds, property_id, start, end):
    client = BetaAnalyticsDataClient(credentials=creds)

    # Total sessions
    resp_all = client.run_report(RunReportRequest(
        property=property_id,
        date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
        metrics=[Metric(name="sessions")],
    ))
    sessions = int(resp_all.rows[0].metric_values[0].value) if resp_all.rows else 0

    # Organic sessions only
    resp_org = client.run_report(RunReportRequest(
        property=property_id,
        date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
        dimensions=[Dimension(name="sessionDefaultChannelGroup")],
        metrics=[Metric(name="sessions")],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="sessionDefaultChannelGroup",
                string_filter=Filter.StringFilter(
                    value="Organic Search",
                    match_type=Filter.StringFilter.MatchType.EXACT
                )
            )
        )
    ))
    organic = int(resp_org.rows[0].metric_values[0].value) if resp_org.rows else 0

    # Phone click events
    resp_phone = client.run_report(RunReportRequest(
        property=property_id,
        date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
        metrics=[Metric(name="eventCount")],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="eventName",
                string_filter=Filter.StringFilter(
                    value="phone_click",
                    match_type=Filter.StringFilter.MatchType.EXACT
                )
            )
        )
    ))
    phone_clicks = int(resp_phone.rows[0].metric_values[0].value) if resp_phone.rows else 0

    # Form submit events
    resp_form = client.run_report(RunReportRequest(
        property=property_id,
        date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
        metrics=[Metric(name="eventCount")],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="eventName",
                string_filter=Filter.StringFilter(
                    value="form_submit",
                    match_type=Filter.StringFilter.MatchType.EXACT
                )
            )
        )
    ))
    form_submits = int(resp_form.rows[0].metric_values[0].value) if resp_form.rows else 0

    return {
        "sessions": sessions,
        "organic": organic,
        "phone_clicks": phone_clicks,
        "form_submits": form_submits,
    }

# ── GSC ─────────────────────────────────────────────────────────────────

def pull_gsc(creds, site_url, start, end):
    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

    # Aggregate metrics
    agg_resp = service.searchanalytics().query(
        siteUrl=site_url,
        body={
            "startDate": str(start),
            "endDate": str(end),
            "dimensions": [],
            "rowLimit": 1,
        }
    ).execute()

    agg_row = agg_resp.get("rows", [{}])[0] if agg_resp.get("rows") else {}
    impressions = int(agg_row.get("impressions", 0))
    clicks = int(agg_row.get("clicks", 0))
    position = round(agg_row.get("position", 0), 1)

    # Top queries (up to 25)
    query_resp = service.searchanalytics().query(
        siteUrl=site_url,
        body={
            "startDate": str(start),
            "endDate": str(end),
            "dimensions": ["query"],
            "rowLimit": 25,
            "orderBy": [{"fieldName": "impressions", "sortOrder": "DESCENDING"}],
        }
    ).execute()

    top_queries = []
    for row in query_resp.get("rows", []):
        top_queries.append({
            "query": row["keys"][0],
            "impressions": int(row.get("impressions", 0)),
            "clicks": int(row.get("clicks", 0)),
            "position": round(row.get("position", 0), 1),
        })

    return {
        "impressions": impressions,
        "clicks": clicks,
        "avg_position": position,
        "top_queries": top_queries,
    }

# ── PageSpeed ───────────────────────────────────────────────────────────

def pull_pagespeed(url):
    results = {}
    for strategy in ["mobile", "desktop"]:
        api_url = (
            f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
            f"?url={url}&strategy={strategy}&key={PSI_KEY}"
        )
        req = urllib.request.Request(api_url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())

        lh = data.get("lighthouseResult", {})
        cats = lh.get("categories", {})
        audits = lh.get("audits", {})

        score = int((cats.get("performance", {}).get("score", 0) or 0) * 100)
        lcp = audits.get("largest-contentful-paint", {}).get("displayValue", "")
        cls = audits.get("cumulative-layout-shift", {}).get("displayValue", "")
        tbt = audits.get("total-blocking-time", {}).get("displayValue", "")

        results[strategy] = {
            "score": score,
            "lcp": lcp,
            "cls": cls,
            "tbt": tbt,
        }

    return results

# ── GBP (Google Business Profile) ──────────────────────────────────────

def pull_gbp(creds, location_id, start, end):
    service = build("businessprofileperformance", "v1", credentials=creds, cache_discovery=False)

    metrics = [
        "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
        "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
        "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
        "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
        "CALL_CLICKS",
        "WEBSITE_CLICKS",
        "BUSINESS_DIRECTION_REQUESTS",
    ]

    totals = {}
    for metric in metrics:
        result = service.locations().getDailyMetricsTimeSeries(
            name=location_id,
            dailyMetric=metric,
            dailyRange_startDate_year=start.year,
            dailyRange_startDate_month=start.month,
            dailyRange_startDate_day=start.day,
            dailyRange_endDate_year=end.year,
            dailyRange_endDate_month=end.month,
            dailyRange_endDate_day=end.day,
        ).execute()

        total = 0
        for dv in result.get("timeSeries", {}).get("datedValues", []):
            val = dv.get("value")
            if val:
                total += int(val)
        totals[metric] = total

    maps_impressions = totals["BUSINESS_IMPRESSIONS_DESKTOP_MAPS"] + totals["BUSINESS_IMPRESSIONS_MOBILE_MAPS"]
    search_impressions = totals["BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"] + totals["BUSINESS_IMPRESSIONS_MOBILE_SEARCH"]

    return {
        "maps_impressions": maps_impressions,
        "search_impressions": search_impressions,
        "total_impressions": maps_impressions + search_impressions,
        "call_clicks": totals["CALL_CLICKS"],
        "website_clicks": totals["WEBSITE_CLICKS"],
        "direction_requests": totals["BUSINESS_DIRECTION_REQUESTS"],
    }

# ── GHL Form Submissions ───────────────────────────────────────────────

def pull_ghl_forms(ghl_token, location_id, form_name, start, end):
    headers = {
        "Authorization": f"Bearer {ghl_token}",
        "Version": "2021-07-28",
    }

    # Get forms list to find the form ID
    forms_resp = requests.get(
        f"https://services.leadconnectorhq.com/forms/?locationId={location_id}",
        headers=headers, timeout=15,
    )
    if forms_resp.status_code != 200:
        raise Exception(f"Forms list failed: {forms_resp.status_code}")

    forms = forms_resp.json().get("forms", [])
    form_id = None
    for form in forms:
        if form.get("name", "").lower() == form_name.lower():
            form_id = form["id"]
            break

    if not form_id:
        raise Exception(f"Form '{form_name}' not found in location {location_id}")

    # Get submissions for that form
    all_submissions = []
    page = 1
    while True:
        subs_resp = requests.get(
            f"https://services.leadconnectorhq.com/forms/submissions"
            f"?locationId={location_id}&formId={form_id}&page={page}&limit=100"
            f"&startAt={start}T00:00:00Z&endAt={end}T23:59:59Z",
            headers=headers, timeout=15,
        )
        if subs_resp.status_code != 200:
            break

        data = subs_resp.json()
        subs = data.get("submissions", [])
        if not subs:
            break

        all_submissions.extend(subs)
        meta = data.get("meta", {})
        if page >= meta.get("total", 1) // 100 + 1:
            break
        page += 1

    return len(all_submissions)


# ── Main Pipeline ───────────────────────────────────────────────────────

def run_report(client, creds, today):
    name = client["name"]
    slug = client["slug"]
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")

    # Date ranges: current 14 days + previous 14 days
    # GSC lags ~3 days, so end at today-3
    period_end = today - timedelta(days=3)
    period_start = period_end - timedelta(days=13)
    prev_end = period_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=13)

    report = {
        "client": name,
        "slug": slug,
        "date": str(today),
        "period_start": str(period_start),
        "period_end": str(period_end),
        "prev_start": str(prev_start),
        "prev_end": str(prev_end),
    }

    # ── GA4 ──
    print(f"  Pulling GA4...")
    try:
        ga4_current = pull_ga4(creds, client["ga4_property"], period_start, period_end)
        ga4_prev = pull_ga4(creds, client["ga4_property"], prev_start, prev_end)
        report["ga4"] = {
            "sessions": ga4_current["sessions"],
            "sessions_prev": ga4_prev["sessions"],
            "organic": ga4_current["organic"],
            "organic_prev": ga4_prev["organic"],
            "phone_clicks": ga4_current["phone_clicks"],
            "phone_clicks_prev": ga4_prev["phone_clicks"],
            "form_submits": ga4_current["form_submits"],
            "form_submits_prev": ga4_prev["form_submits"],
        }
        print(f"    Sessions: {ga4_current['sessions']} (prev: {ga4_prev['sessions']})")
        print(f"    Organic:  {ga4_current['organic']} (prev: {ga4_prev['organic']})")
        print(f"    Phone clicks: {ga4_current['phone_clicks']} | Form submits: {ga4_current['form_submits']}")
    except Exception as e:
        print(f"    GA4 ERROR: {e}")
        report["ga4"] = {"sessions": 0, "sessions_prev": 0, "organic": 0, "organic_prev": 0,
                         "phone_clicks": 0, "phone_clicks_prev": 0, "form_submits": 0, "form_submits_prev": 0}

    # ── GSC ──
    print(f"  Pulling GSC...")
    try:
        gsc_current = pull_gsc(creds, client["gsc_url"], period_start, period_end)
        gsc_prev = pull_gsc(creds, client["gsc_url"], prev_start, prev_end)
        report["gsc"] = {
            "impressions": gsc_current["impressions"],
            "impressions_prev": gsc_prev["impressions"],
            "clicks": gsc_current["clicks"],
            "clicks_prev": gsc_prev["clicks"],
            "avg_position": gsc_current["avg_position"],
            "avg_position_prev": gsc_prev["avg_position"],
            "top_queries": gsc_current["top_queries"],
        }
        print(f"    Impressions: {gsc_current['impressions']} (prev: {gsc_prev['impressions']})")
        print(f"    Clicks: {gsc_current['clicks']} (prev: {gsc_prev['clicks']})")
        print(f"    Avg Position: {gsc_current['avg_position']} (prev: {gsc_prev['avg_position']})")
        print(f"    Top queries: {len(gsc_current['top_queries'])}")
    except Exception as e:
        print(f"    GSC ERROR: {e}")
        report["gsc"] = {"impressions": 0, "impressions_prev": 0, "clicks": 0, "clicks_prev": 0,
                         "avg_position": 0, "avg_position_prev": 0, "top_queries": []}

    # ── PageSpeed ──
    print(f"  Pulling PageSpeed...")
    try:
        psi = pull_pagespeed(client["website"])
        report["pagespeed"] = {
            "mobile_score": psi["mobile"]["score"],
            "desktop_score": psi["desktop"]["score"],
            "lcp_mobile": psi["mobile"]["lcp"],
            "lcp_desktop": psi["desktop"]["lcp"],
            "cls_mobile": psi["mobile"]["cls"],
            "cls_desktop": psi["desktop"]["cls"],
            "tbt_mobile": psi["mobile"]["tbt"],
            "tbt_desktop": psi["desktop"]["tbt"],
        }
        print(f"    Mobile: {psi['mobile']['score']} | Desktop: {psi['desktop']['score']}")
        print(f"    LCP (mobile): {psi['mobile']['lcp']} | CLS: {psi['mobile']['cls']}")
    except Exception as e:
        print(f"    PageSpeed ERROR: {e}")
        report["pagespeed"] = {"mobile_score": 0, "desktop_score": 0, "lcp_mobile": "", "lcp_desktop": "",
                               "cls_mobile": "", "cls_desktop": "", "tbt_mobile": "", "tbt_desktop": ""}

    # ── GHL Form Submissions ──
    if client.get("ghl_token"):
        print(f"  Pulling GHL form submissions...")
        try:
            ghl_current = pull_ghl_forms(
                client["ghl_token"], client["ghl_location_id"],
                client["ghl_form_name"], period_start, period_end)
            ghl_prev = pull_ghl_forms(
                client["ghl_token"], client["ghl_location_id"],
                client["ghl_form_name"], prev_start, prev_end)
            report["ghl_form_submits"] = ghl_current
            report["ghl_form_submits_prev"] = ghl_prev
            # Override GA4 form submits with GHL data (source of truth)
            report["ga4"]["form_submits"] = ghl_current
            report["ga4"]["form_submits_prev"] = ghl_prev
            print(f"    Form submits: {ghl_current} (prev: {ghl_prev})")
        except Exception as e:
            print(f"    GHL ERROR: {e}")
            report["ghl_form_submits"] = 0
            report["ghl_form_submits_prev"] = 0

    # ── GBP (Google Business Profile) ──
    if client.get("gbp_location"):
        print(f"  Pulling GBP metrics...")
        try:
            gbp_current = pull_gbp(creds, client["gbp_location"], period_start, period_end)
            gbp_prev = pull_gbp(creds, client["gbp_location"], prev_start, prev_end)
            report["gbp"] = {
                "maps_impressions": gbp_current["maps_impressions"],
                "maps_impressions_prev": gbp_prev["maps_impressions"],
                "search_impressions": gbp_current["search_impressions"],
                "search_impressions_prev": gbp_prev["search_impressions"],
                "total_impressions": gbp_current["total_impressions"],
                "total_impressions_prev": gbp_prev["total_impressions"],
                "call_clicks": gbp_current["call_clicks"],
                "call_clicks_prev": gbp_prev["call_clicks"],
                "website_clicks": gbp_current["website_clicks"],
                "website_clicks_prev": gbp_prev["website_clicks"],
                "direction_requests": gbp_current["direction_requests"],
                "direction_requests_prev": gbp_prev["direction_requests"],
            }
            print(f"    Impressions: {gbp_current['total_impressions']} (prev: {gbp_prev['total_impressions']})")
            print(f"    Maps: {gbp_current['maps_impressions']} | Search: {gbp_current['search_impressions']}")
            print(f"    Calls: {gbp_current['call_clicks']} | Website: {gbp_current['website_clicks']} | Directions: {gbp_current['direction_requests']}")
        except Exception as e:
            print(f"    GBP ERROR: {e}")
            report["gbp"] = {"maps_impressions": 0, "maps_impressions_prev": 0,
                             "search_impressions": 0, "search_impressions_prev": 0,
                             "total_impressions": 0, "total_impressions_prev": 0,
                             "call_clicks": 0, "call_clicks_prev": 0,
                             "website_clicks": 0, "website_clicks_prev": 0,
                             "direction_requests": 0, "direction_requests_prev": 0}
    else:
        report["gbp"] = None

    # ── Analysis ──
    report["flags"] = []
    ps = report["pagespeed"]
    ga = report["ga4"]
    gsc = report["gsc"]

    if ps["mobile_score"] < 50:
        report["flags"].append(f"Mobile speed score critically low ({ps['mobile_score']})")

    lcp_val = float(ps["lcp_mobile"].replace(",", "").split()[0]) if ps["lcp_mobile"] else 0
    if lcp_val > 4:
        report["flags"].append(f"Mobile LCP is {ps['lcp_mobile']} — above 4s threshold")

    if ga["organic_prev"] > 0:
        organic_delta = ((ga["organic"] - ga["organic_prev"]) / ga["organic_prev"]) * 100
        if organic_delta < -20:
            report["flags"].append(f"Organic sessions dropped {abs(organic_delta):.0f}% vs prior period")

    if gsc["impressions_prev"] > 0:
        imp_delta = ((gsc["impressions"] - gsc["impressions_prev"]) / gsc["impressions_prev"]) * 100
        if imp_delta < -20:
            report["flags"].append(f"Search impressions dropped {abs(imp_delta):.0f}%")

    if ga["sessions"] > 0:
        total_conversions = ga["phone_clicks"] + ga["form_submits"]
        conv_rate = (total_conversions / ga["sessions"]) * 100
        report["conversion_rate"] = round(conv_rate, 1)
    else:
        report["conversion_rate"] = 0

    if report["flags"]:
        print(f"\n  !! FLAGS:")
        for f in report["flags"]:
            print(f"     - {f}")

    return report


def save_local(report):
    slug = report["slug"]
    run_date = report["date"]
    out_dir = REPORTS_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{run_date}.json"
    with open(out_file, "w") as f:
        json.dump(report, f, indent=2)
    print(f"  Saved: {out_file}")


def push_to_supabase(report):
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Get client ID from Supabase
    client_resp = sb.table("clients").select("id").eq("slug", report["slug"]).execute()
    if not client_resp.data:
        print(f"  Supabase: client '{report['slug']}' not found, skipping")
        return
    client_id = client_resp.data[0]["id"]

    ga = report["ga4"]
    gsc = report["gsc"]
    ps = report["pagespeed"]

    # Upsert report row
    report_row = {
        "client_id": client_id,
        "run_date": report["date"],
        "period_start": report["period_start"],
        "period_end": report["period_end"],
        "ga4_sessions": ga["sessions"],
        "ga4_sessions_prev": ga["sessions_prev"],
        "ga4_organic": ga["organic"],
        "ga4_organic_prev": ga["organic_prev"],
        "ga4_phone_clicks": ga["phone_clicks"],
        "ga4_phone_clicks_prev": ga["phone_clicks_prev"],
        "ga4_form_submits": ga["form_submits"],
        "ga4_form_submits_prev": ga["form_submits_prev"],
        "gsc_impressions": gsc["impressions"],
        "gsc_impressions_prev": gsc["impressions_prev"],
        "gsc_clicks": gsc["clicks"],
        "gsc_clicks_prev": gsc["clicks_prev"],
        "gsc_avg_position": gsc["avg_position"],
        "gsc_avg_position_prev": gsc["avg_position_prev"],
        "psi_mobile_score": ps["mobile_score"],
        "psi_desktop_score": ps["desktop_score"],
        "psi_lcp_mobile": ps["lcp_mobile"],
        "psi_lcp_desktop": ps["lcp_desktop"],
        "psi_cls_mobile": ps["cls_mobile"],
        "psi_cls_desktop": ps["cls_desktop"],
        "psi_tbt_mobile": ps["tbt_mobile"],
        "psi_tbt_desktop": ps["tbt_desktop"],
    }

    gbp = report.get("gbp")
    if gbp:
        report_row.update({
            "gbp_maps_impressions": gbp["maps_impressions"],
            "gbp_maps_impressions_prev": gbp["maps_impressions_prev"],
            "gbp_search_impressions": gbp["search_impressions"],
            "gbp_search_impressions_prev": gbp["search_impressions_prev"],
            "gbp_total_impressions": gbp["total_impressions"],
            "gbp_total_impressions_prev": gbp["total_impressions_prev"],
            "gbp_call_clicks": gbp["call_clicks"],
            "gbp_call_clicks_prev": gbp["call_clicks_prev"],
            "gbp_website_clicks": gbp["website_clicks"],
            "gbp_website_clicks_prev": gbp["website_clicks_prev"],
            "gbp_direction_requests": gbp["direction_requests"],
            "gbp_direction_requests_prev": gbp["direction_requests_prev"],
        })

    resp = sb.table("reports").upsert(
        report_row,
        on_conflict="client_id,run_date"
    ).execute()

    if resp.data:
        report_id = resp.data[0]["id"]
        print(f"  Supabase: report upserted (id: {report_id})")

        # Delete old queries for this report, then insert fresh
        sb.table("gsc_queries").delete().eq("report_id", report_id).execute()

        # Insert top queries
        if gsc["top_queries"]:
            query_rows = [
                {
                    "report_id": report_id,
                    "client_id": client_id,
                    "run_date": report["date"],
                    "query": q["query"],
                    "impressions": q["impressions"],
                    "clicks": q["clicks"],
                    "position": q["position"],
                }
                for q in gsc["top_queries"]
            ]
            sb.table("gsc_queries").insert(query_rows).execute()
            print(f"  Supabase: {len(query_rows)} queries inserted")
    else:
        print(f"  Supabase: upsert returned no data")


def print_summary(reports):
    print(f"\n\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")

    for r in reports:
        ga = r["ga4"]
        gsc = r["gsc"]
        ps = r["pagespeed"]
        name = r["client"]

        def delta_str(curr, prev):
            if prev == 0:
                return "new"
            d = ((curr - prev) / prev) * 100
            sign = "+" if d >= 0 else ""
            return f"{sign}{d:.0f}%"

        print(f"\n  {name}")
        print(f"  {'─'*40}")
        print(f"  Sessions:      {ga['sessions']:>6}  ({delta_str(ga['sessions'], ga['sessions_prev'])})")
        print(f"  Organic:       {ga['organic']:>6}  ({delta_str(ga['organic'], ga['organic_prev'])})")
        print(f"  Impressions:   {gsc['impressions']:>6}  ({delta_str(gsc['impressions'], gsc['impressions_prev'])})")
        print(f"  Clicks:        {gsc['clicks']:>6}  ({delta_str(gsc['clicks'], gsc['clicks_prev'])})")
        print(f"  Avg Position:  {gsc['avg_position']:>6}")
        print(f"  Phone Clicks:  {ga['phone_clicks']:>6}  | Form Submits: {ga['form_submits']}")
        print(f"  Conv Rate:     {r.get('conversion_rate', 0):>5.1f}%")
        print(f"  Mobile Score:  {ps['mobile_score']:>6}  | Desktop: {ps['desktop_score']}")
        print(f"  LCP (mobile):  {ps['lcp_mobile']:>10}")

        gbp = r.get("gbp")
        if gbp:
            print(f"  GBP Impressions: {gbp['total_impressions']:>4}  ({delta_str(gbp['total_impressions'], gbp['total_impressions_prev'])})")
            print(f"    Maps: {gbp['maps_impressions']}  Search: {gbp['search_impressions']}")
            print(f"    Calls: {gbp['call_clicks']}  Website: {gbp['website_clicks']}  Directions: {gbp['direction_requests']}")

        if r["flags"]:
            print(f"\n  !! Red Flags:")
            for flag in r["flags"]:
                print(f"     - {flag}")


def main():
    today = date.today()
    print(f"Client Performance Report — {today}")
    print(f"Period: {today - timedelta(days=16)} to {today - timedelta(days=3)}")

    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    creds = get_creds()
    all_reports = []

    for client in clients:
        report = run_report(client, creds, today)
        save_local(report)
        push_to_supabase(report)
        all_reports.append(report)

    print_summary(all_reports)
    print(f"\nDone. {len(all_reports)} reports saved to Supabase + local JSON.")


if __name__ == "__main__":
    main()
