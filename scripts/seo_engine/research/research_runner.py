"""
Research Runner
===============
Orchestrates all research modules. Runs on Saturday only.
Caches results to JSON for Mon/Thu runs to reference.
"""

import json
from datetime import date
from pathlib import Path

from .trends import pull_trends
from .reddit import pull_reddit_questions
from .serp_scraper import scrape_serp
from .news import pull_news

REPORTS_DIR = Path("/Users/brianegan/EchoLocalClientTracker/reports")


def _cache_path(slug):
    return REPORTS_DIR / slug / "research_cache.json"


def load_research_cache(slug):
    """Load cached research data. Returns None if stale or missing."""
    path = _cache_path(slug)
    if not path.exists():
        return None

    try:
        with open(path) as f:
            cache = json.load(f)
        return cache
    except (json.JSONDecodeError, IOError):
        return None


def run_research(client_config, force=False):
    """Run all research modules and cache results.

    Only runs on Saturday unless force=True.
    Mon/Thu runs should call load_research_cache() instead.
    """
    today = date.today()
    slug = client_config["slug"]
    is_saturday = today.weekday() == 5

    if not is_saturday and not force:
        print(f"  [research] Skipping research (not Saturday). Loading cache...")
        return load_research_cache(slug)

    print(f"  [research] Running full research cycle...")

    target_kws = client_config.get("target_keywords", [])
    # Pick a subset of keywords for SERP scraping to control cost
    # Focus on striking-distance keywords (ones we're actually targeting)
    serp_keywords = target_kws[:8] if target_kws else []

    # Trends keywords (broader, for seasonal patterns)
    trends_keywords = list(set([
        "turf cleaning",
        "artificial turf cleaning",
        "artificial grass cleaning",
        "synthetic turf maintenance",
        "pet turf cleaning",
    ] + target_kws[:3]))[:10]

    cache = {"last_updated": str(today)}

    # 1. Google Trends
    print(f"  [research] Pulling Google Trends...")
    try:
        cache["trends"] = pull_trends(trends_keywords[:5])
    except Exception as e:
        print(f"  [research] Trends error: {e}")
        cache["trends"] = {}

    # 2. Reddit
    print(f"  [research] Pulling Reddit questions...")
    try:
        cache["reddit_questions"] = pull_reddit_questions()
    except Exception as e:
        print(f"  [research] Reddit error: {e}")
        cache["reddit_questions"] = []

    # 3. SERP scraping
    if serp_keywords:
        print(f"  [research] Scraping SERPs for {len(serp_keywords)} keywords...")
        try:
            cache["competitor_serps"] = scrape_serp(serp_keywords)
        except Exception as e:
            print(f"  [research] SERP error: {e}")
            cache["competitor_serps"] = {}
    else:
        cache["competitor_serps"] = {}

    # 4. News
    print(f"  [research] Pulling trending news...")
    try:
        cache["trending_news"] = pull_news()
    except Exception as e:
        print(f"  [research] News error: {e}")
        cache["trending_news"] = []

    # Save cache
    cache_path = _cache_path(slug)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(cache, f, indent=2)
    print(f"  [research] Cache saved to {cache_path}")

    return cache
