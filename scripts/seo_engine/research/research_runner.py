"""
Research Runner
===============
Orchestrates all research modules. Runs on Wednesday + Saturday.
Caches results to JSON for other daily runs to reference.
"""

import json
from datetime import date
from pathlib import Path

from .trends import pull_trends, score_trend_urgency
from .reddit import pull_reddit_questions
from .serp_scraper import scrape_serp
from .news import pull_news, score_news_urgency

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

    Only runs on Wednesday + Saturday unless force=True.
    Other daily runs should call load_research_cache() instead.
    """
    today = date.today()
    slug = client_config["slug"]
    is_research_day = today.weekday() in (2, 5)  # Wednesday=2, Saturday=5

    if not is_research_day and not force:
        print(f"  [research] Skipping research (not Wed/Sat). Loading cache...")
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

    # 5. Backlink gap analysis
    print(f"  [research] Running backlink gap analysis...")
    try:
        from .backlink_gap import find_backlink_gaps
        cache["backlink_prospects"] = find_backlink_gaps()
    except Exception as e:
        print(f"  [research] Backlink gap error: {e}")
        cache["backlink_prospects"] = []

    # 6. Broken link finder
    print(f"  [research] Scanning for broken links...")
    try:
        from .broken_links import find_broken_links
        cache["broken_link_opportunities"] = find_broken_links()
    except Exception as e:
        print(f"  [research] Broken links error: {e}")
        cache["broken_link_opportunities"] = []

    # 7. Brand mention monitor
    print(f"  [research] Checking for unlinked brand mentions...")
    try:
        from .brand_mentions import find_unlinked_mentions
        cache["brand_mentions"] = find_unlinked_mentions()
    except Exception as e:
        print(f"  [research] Brand mentions error: {e}")
        cache["brand_mentions"] = []

    # 8. Journalist/HARO monitor
    print(f"  [research] Scanning journalist opportunities...")
    try:
        from .journalist_monitor import find_journalist_opportunities
        cache["journalist_opportunities"] = find_journalist_opportunities()
    except Exception as e:
        print(f"  [research] Journalist monitor error: {e}")
        cache["journalist_opportunities"] = []

    # 9. AEO crawler check (AI bot access)
    print(f"  [research] Checking AI crawler access...")
    try:
        from .aeo_crawler_check import check_crawlers
        website = client_config.get("website", "")
        if website:
            cache["aeo_crawler_check"] = check_crawlers(website)
            blocked = cache["aeo_crawler_check"].get("blocked", [])
            if blocked:
                print(f"  [research] WARNING: Blocked AI crawlers: {', '.join(blocked)}")
        else:
            cache["aeo_crawler_check"] = {}
    except Exception as e:
        print(f"  [research] AEO crawler check error: {e}")
        cache["aeo_crawler_check"] = {}

    # 10. AEO opportunity extraction (question queries from GSC)
    print(f"  [research] Extracting AEO opportunities...")
    try:
        from .aeo_opportunities import extract_aeo_opportunities
        gsc_queries = cache.get("competitor_serps", {})
        # We need actual GSC queries -- these come from performance data, not research cache.
        # Pass reddit questions for cross-referencing.
        # Note: GSC queries are passed in at seo_loop level, so we store a placeholder here.
        # The actual extraction happens in the brain prompt builder with live GSC data.
        cache["aeo_opportunities"] = []  # populated at brain prompt time with live GSC data
    except Exception as e:
        print(f"  [research] AEO opportunities error: {e}")
        cache["aeo_opportunities"] = []

    # Save cache
    cache_path = _cache_path(slug)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(cache, f, indent=2)
    print(f"  [research] Cache saved to {cache_path}")

    return cache


def run_fast_research(client_config):
    """Run lightweight research every cycle (not just Saturday).

    Only pulls trends + news (cheap/free), scores for newsjacking urgency.
    Does NOT run Reddit or SERP scraping (those stay Saturday-only).

    Returns:
        dict with newsjack_alerts (scored news + trends)
    """
    slug = client_config["slug"]
    target_kws = client_config.get("target_keywords", [])

    print(f"  [research] Running fast research (trends + news)...")
    result = {"newsjack_alerts": []}

    # Trends: only use cached data from Saturday (avoids 429 rate limits from Google)
    cached = load_research_cache(slug)
    trends_data = cached.get("trends", {}) if cached else {}
    if trends_data:
        try:
            trend_alerts = score_trend_urgency(trends_data, target_kws)
            for alert in trend_alerts:
                result["newsjack_alerts"].append({
                    "type": "trend",
                    "query": alert["query"],
                    "urgency_score": alert["urgency_score"],
                    "reason": alert["reason"],
                })
        except Exception as e:
            print(f"  [research] Trend scoring error: {e}")
    else:
        print(f"  [research] No cached trends data, skipping trend alerts")

    # Quick news check
    try:
        articles = pull_news(page_size=3)
        news_alerts = score_news_urgency(articles, target_kws)
        for article in news_alerts[:3]:
            result["newsjack_alerts"].append({
                "type": "news",
                "title": article["title"],
                "url": article.get("url", ""),
                "urgency_score": article["urgency_score"],
                "source": article.get("source", ""),
            })
    except Exception as e:
        print(f"  [research] Fast news error: {e}")

    # Sort all alerts by urgency
    result["newsjack_alerts"].sort(
        key=lambda x: x.get("urgency_score", 0), reverse=True
    )

    # Merge into existing cache if available
    cache = load_research_cache(slug) or {}
    cache["newsjack_alerts"] = result["newsjack_alerts"]
    cache["fast_research_date"] = str(date.today())

    cache_path = _cache_path(slug)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(cache, f, indent=2)

    return result
