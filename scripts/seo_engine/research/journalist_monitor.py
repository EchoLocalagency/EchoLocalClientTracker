"""
Journalist/HARO Monitor
========================
Finds journalist queries, #journorequest posts, and contributor requests
related to SEO, digital marketing, or home services.
Filters by freshness (past week) and relevance.
"""

import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

# Queries to find journalist/contributor opportunities
JOURNALIST_QUERIES = [
    '#journorequest SEO',
    '#journorequest "digital marketing"',
    '#journorequest "small business"',
    '"looking for sources" SEO local',
    '"contributor wanted" "digital marketing"',
    '"seeking experts" SEO',
    'site:helpareporter.com SEO',
    'site:sourcebottle.com "digital marketing"',
    '"guest post" "local SEO" guidelines',
    '"write for us" "digital marketing" "home service"',
]

# Topics we can credibly pitch on
RELEVANT_TOPICS = [
    "seo", "local seo", "digital marketing", "small business",
    "home service", "contractor", "google business", "gbp",
    "search engine", "content marketing", "ai marketing",
    "automation", "organic traffic", "backlinks",
]


def find_journalist_opportunities():
    """Find journalist queries and contributor opportunities.

    Returns:
        List of opportunity dicts with url, query/topic, freshness
    """
    if not BRAVE_API_KEY:
        print("  [journalist_monitor] No BRAVE_API_KEY")
        return []

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }

    opportunities = []
    seen_urls = set()

    for query in JOURNALIST_QUERIES:
        try:
            resp = requests.get(BRAVE_URL, headers=headers, params={
                "q": query,
                "count": 5,
                "search_lang": "en",
                "country": "US",
                "freshness": "pw",  # past week
            }, timeout=10)

            if resp.status_code != 200:
                continue

            data = resp.json()
            results = data.get("web", {}).get("results", [])

            for r in results:
                url = r.get("url", "")
                if url in seen_urls:
                    continue

                title = r.get("title", "")
                description = r.get("description", "")
                text = f"{title} {description}".lower()

                # Check relevance
                relevance = sum(1 for topic in RELEVANT_TOPICS if topic in text)
                if relevance < 1:
                    continue

                seen_urls.add(url)
                opportunities.append({
                    "url": url,
                    "title": title,
                    "description": description[:200],
                    "query": query,
                    "topic": _extract_topic(text),
                    "relevance_score": min(10, 4 + relevance),
                    "context": f"Journalist/contributor opportunity",
                })

            time.sleep(0.4)

        except Exception as e:
            print(f"  [journalist_monitor] Error for query '{query[:30]}': {e}")

    # Sort by relevance
    opportunities.sort(key=lambda x: x["relevance_score"], reverse=True)
    print(f"  [journalist_monitor] Found {len(opportunities)} opportunities")
    return opportunities[:15]


def _extract_topic(text):
    """Extract the most relevant topic from text."""
    for topic in RELEVANT_TOPICS:
        if topic in text:
            return topic
    return "digital marketing"
