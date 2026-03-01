"""
Data Collector
==============
Thin wrapper around run_reports.py functions.
Adds page inventory scanning for the brain's context.
"""

import json
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path

# Add parent dir so we can import from scripts.run_reports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from run_reports import (
    get_creds,
    pull_gsc,
    pull_gsc_target_keywords,
    pull_gbp,
    pull_gbp_keywords,
    pull_ga4,
)

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
REPORTS_DIR = BASE_DIR / "reports"


def collect_performance_data(client, creds=None):
    """Pull fresh GSC, GA4, GBP data for a single client.

    Returns the same structure as a report JSON but without saving it.
    """
    creds = creds or get_creds()
    today = date.today()
    period_end = today - timedelta(days=3)
    period_start = period_end - timedelta(days=13)
    prev_end = period_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=13)

    data = {
        "date": str(today),
        "period_start": str(period_start),
        "period_end": str(period_end),
    }

    # GA4
    try:
        ga_curr = pull_ga4(creds, client["ga4_property"], period_start, period_end)
        ga_prev = pull_ga4(creds, client["ga4_property"], prev_start, prev_end)
        data["ga4"] = {
            "sessions": ga_curr["sessions"],
            "sessions_prev": ga_prev["sessions"],
            "organic": ga_curr["organic"],
            "organic_prev": ga_prev["organic"],
            "phone_clicks": ga_curr["phone_clicks"],
            "form_submits": ga_curr["form_submits"],
        }
    except Exception as e:
        print(f"  [data_collector] GA4 error: {e}")
        data["ga4"] = {"sessions": 0, "sessions_prev": 0, "organic": 0,
                       "organic_prev": 0, "phone_clicks": 0, "form_submits": 0}

    # GSC
    try:
        gsc_curr = pull_gsc(creds, client["gsc_url"], period_start, period_end)
        gsc_prev = pull_gsc(creds, client["gsc_url"], prev_start, prev_end)
        data["gsc"] = {
            "impressions": gsc_curr["impressions"],
            "impressions_prev": gsc_prev["impressions"],
            "clicks": gsc_curr["clicks"],
            "clicks_prev": gsc_prev["clicks"],
            "avg_position": gsc_curr["avg_position"],
            "avg_position_prev": gsc_prev["avg_position"],
            "top_queries": gsc_curr["top_queries"],
        }
    except Exception as e:
        print(f"  [data_collector] GSC error: {e}")
        data["gsc"] = {"impressions": 0, "impressions_prev": 0, "clicks": 0,
                       "clicks_prev": 0, "avg_position": 0, "avg_position_prev": 0,
                       "top_queries": []}

    # Target keywords
    target_kws = client.get("target_keywords", [])
    if target_kws:
        try:
            data["target_keyword_rankings"] = pull_gsc_target_keywords(
                creds, client["gsc_url"], target_kws, period_start, period_end
            )
        except Exception as e:
            print(f"  [data_collector] Target keyword error: {e}")
            data["target_keyword_rankings"] = []
    else:
        data["target_keyword_rankings"] = []

    # GBP
    if client.get("gbp_location"):
        try:
            gbp_curr = pull_gbp(creds, client["gbp_location"], period_start, period_end)
            gbp_prev = pull_gbp(creds, client["gbp_location"], prev_start, prev_end)
            data["gbp"] = {
                "total_impressions": gbp_curr["total_impressions"],
                "total_impressions_prev": gbp_prev["total_impressions"],
                "maps_impressions": gbp_curr["maps_impressions"],
                "search_impressions": gbp_curr["search_impressions"],
                "call_clicks": gbp_curr["call_clicks"],
                "website_clicks": gbp_curr["website_clicks"],
                "direction_requests": gbp_curr["direction_requests"],
            }
        except Exception as e:
            print(f"  [data_collector] GBP error: {e}")
            data["gbp"] = {"total_impressions": 0, "total_impressions_prev": 0,
                           "maps_impressions": 0, "search_impressions": 0,
                           "call_clicks": 0, "website_clicks": 0, "direction_requests": 0}

        # GBP keywords
        try:
            data["gbp_keywords"] = pull_gbp_keywords(
                creds, client["gbp_location"], period_end.year, period_end.month
            )
        except Exception as e:
            print(f"  [data_collector] GBP keywords error: {e}")
            data["gbp_keywords"] = []
    else:
        data["gbp"] = None
        data["gbp_keywords"] = []

    return data


def scan_page_inventory(website_path):
    """Scan all HTML files in the website directory.

    Returns a list of dicts with: filename, title, meta_description, h1, url.
    This gives the brain awareness of existing content.
    """
    website_path = Path(website_path)
    if not website_path.exists():
        print(f"  [data_collector] Website path not found: {website_path}")
        return []

    pages = []
    for html_file in sorted(website_path.rglob("*.html")):
        rel_path = html_file.relative_to(website_path)
        content = html_file.read_text(errors="ignore")

        # Extract title
        title_match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
        title = title_match.group(1).strip() if title_match else ""

        # Extract meta description
        desc_match = re.search(
            r'<meta\s+name="description"\s+content="(.*?)"',
            content, re.IGNORECASE
        )
        meta_desc = desc_match.group(1).strip() if desc_match else ""

        # Extract first H1
        h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", content, re.IGNORECASE | re.DOTALL)
        h1 = re.sub(r"<[^>]+>", "", h1_match.group(1)).strip() if h1_match else ""

        pages.append({
            "filename": str(rel_path),
            "title": title,
            "meta_description": meta_desc[:160],
            "h1": h1,
        })

    return pages


def load_latest_report(slug):
    """Load the most recent JSON report for a client slug."""
    report_dir = REPORTS_DIR / slug
    if not report_dir.exists():
        return None

    json_files = sorted(report_dir.glob("*.json"), reverse=True)
    if not json_files:
        return None

    with open(json_files[0]) as f:
        return json.load(f)
