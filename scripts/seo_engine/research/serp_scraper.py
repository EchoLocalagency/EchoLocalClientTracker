"""
SERP Scraper via Apify
======================
Scrapes Google Search results for target keywords to see who outranks you.
Uses the Google Search Results Scraper actor on Apify.

Cost: ~$0.005 per search. 18 keywords = ~$0.09 per run.
"""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()
APIFY_TOKEN = os.getenv("APIFY_TOKEN", "")

# Apify Google Search Results Scraper actor
ACTOR_ID = "nFJndFXA5zjCTuudP"  # apify/google-search-scraper


def scrape_serp(keywords, location="Poway, California, United States", max_results=10):
    """Scrape Google SERPs for a list of keywords via Apify.

    Args:
        keywords: List of search queries.
        location: Google Ads location string for local results.
        max_results: Number of organic results per keyword.

    Returns:
        dict mapping keyword -> list of result dicts (position, title, url, description).
    """
    if not APIFY_TOKEN:
        print("  [serp] Missing APIFY_TOKEN in .env")
        return {}

    results = {}

    # Process keywords individually to keep costs predictable
    for kw in keywords:
        try:
            # Start the actor run
            run_resp = requests.post(
                f"https://api.apify.com/v2/acts/{ACTOR_ID}/runs",
                params={"token": APIFY_TOKEN},
                json={
                    "queries": kw,
                    "maxPagesPerQuery": 1,
                    "resultsPerPage": max_results,
                    "languageCode": "en",
                    "countryCode": "us",
                    "customDataFunction": "",
                    "mobileResults": False,
                },
                timeout=30,
            )
            if run_resp.status_code != 201:
                print(f"  [serp] Failed to start run for '{kw}': {run_resp.status_code}")
                continue

            run_id = run_resp.json().get("data", {}).get("id")
            if not run_id:
                continue

            # Poll for completion (max 60 seconds)
            for _ in range(12):
                time.sleep(5)
                status_resp = requests.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": APIFY_TOKEN},
                    timeout=10,
                )
                status = status_resp.json().get("data", {}).get("status")
                if status == "SUCCEEDED":
                    break
                if status in ("FAILED", "ABORTED", "TIMED-OUT"):
                    print(f"  [serp] Run {status} for '{kw}'")
                    break
            else:
                print(f"  [serp] Timed out waiting for '{kw}'")
                continue

            # Get results from dataset
            dataset_id = status_resp.json().get("data", {}).get("defaultDatasetId")
            if not dataset_id:
                continue

            items_resp = requests.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": APIFY_TOKEN, "format": "json"},
                timeout=15,
            )
            items = items_resp.json() if items_resp.status_code == 200 else []

            kw_results = []
            for item in items:
                organic = item.get("organicResults", [])
                for r in organic[:max_results]:
                    kw_results.append({
                        "position": r.get("position", 0),
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "description": r.get("description", ""),
                    })

            results[kw] = kw_results

        except Exception as e:
            print(f"  [serp] Error for '{kw}': {e}")
            continue

    return results
