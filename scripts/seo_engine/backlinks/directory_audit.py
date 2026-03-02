"""
Directory Audit
===============
One-time script: checks which business directories Echo Local is listed on.
Uses Brave Search to find existing listings.
Run manually, outputs a checklist.

Usage:
    python3 -m scripts.seo_engine.backlinks.directory_audit
"""

import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

# Top directories for local SEO agencies
DIRECTORIES = [
    {"name": "Google Business Profile", "query": "site:google.com/maps Echo Local Oceanside"},
    {"name": "Yelp", "query": "site:yelp.com Echo Local Oceanside"},
    {"name": "BBB", "query": "site:bbb.org Echo Local"},
    {"name": "Clutch", "query": "site:clutch.co Echo Local"},
    {"name": "DesignRush", "query": "site:designrush.com Echo Local"},
    {"name": "UpCity", "query": "site:upcity.com Echo Local"},
    {"name": "GoodFirms", "query": "site:goodfirms.co Echo Local"},
    {"name": "Expertise.com", "query": "site:expertise.com SEO Oceanside"},
    {"name": "Thumbtack", "query": "site:thumbtack.com Echo Local Oceanside"},
    {"name": "Bark", "query": "site:bark.com Echo Local"},
    {"name": "LinkedIn", "query": "site:linkedin.com/company Echo Local Agency"},
    {"name": "Crunchbase", "query": "site:crunchbase.com Echo Local"},
    {"name": "Facebook", "query": "site:facebook.com Echo Local Agency Oceanside"},
    {"name": "Alignable", "query": "site:alignable.com Echo Local"},
    {"name": "Manta", "query": "site:manta.com Echo Local Oceanside"},
]


def audit_directories():
    """Check each directory for existing listings."""
    if not BRAVE_API_KEY:
        print("No BRAVE_API_KEY set. Cannot run directory audit.")
        return []

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }

    results = []
    print(f"\nDirectory Audit for Echo Local")
    print(f"{'='*60}")

    for d in DIRECTORIES:
        try:
            resp = requests.get(BRAVE_URL, headers=headers, params={
                "q": d["query"],
                "count": 3,
            }, timeout=10)

            if resp.status_code != 200:
                results.append({"name": d["name"], "status": "error", "url": ""})
                print(f"  [ ? ] {d['name']:<20} -- API error {resp.status_code}")
                continue

            data = resp.json()
            web_results = data.get("web", {}).get("results", [])

            if web_results:
                url = web_results[0].get("url", "")
                results.append({"name": d["name"], "status": "found", "url": url})
                print(f"  [YES] {d['name']:<20} {url}")
            else:
                results.append({"name": d["name"], "status": "not_found", "url": ""})
                print(f"  [ - ] {d['name']:<20} NOT FOUND -- go claim it")

            time.sleep(0.4)

        except Exception as e:
            results.append({"name": d["name"], "status": "error", "url": ""})
            print(f"  [ ? ] {d['name']:<20} -- {e}")

    # Summary
    found = [r for r in results if r["status"] == "found"]
    missing = [r for r in results if r["status"] == "not_found"]
    print(f"\n{'='*60}")
    print(f"  Listed: {len(found)}/{len(DIRECTORIES)}")
    if missing:
        print(f"  Missing ({len(missing)}):")
        for m in missing:
            print(f"    - {m['name']}")
    print(f"{'='*60}")

    return results


if __name__ == "__main__":
    audit_directories()
