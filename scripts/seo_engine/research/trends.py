"""
Google Trends via Brave Search
==============================
Uses Brave Search API to find trending/rising queries related to target keywords.
Reliable alternative to pytrends (which gets 429'd by Google).

Brave API: 2000 free requests/month.
"""

import json
import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"


def pull_trends(keywords, geo="US-CA-825"):
    """Pull trending/related queries using Brave Search.

    Searches for each keyword + "trending" / "rising" to find what people
    are currently searching for. Extracts related terms from results.

    Args:
        keywords: List of keywords to check.
        geo: Kept for interface compatibility.

    Returns:
        dict with seasonal_interest, rising_queries, and peak_months.
    """
    if not BRAVE_API_KEY:
        print("  [trends] No BRAVE_API_KEY in .env")
        return {"seasonal_interest": {}, "rising_queries": [], "peak_months": {}}

    result = {
        "seasonal_interest": {},
        "rising_queries": [],
        "peak_months": {},
    }

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }

    for kw in keywords:
        # Search for trending context around each keyword
        for query_suffix in ["trending 2026", "popular near me"]:
            search_query = f"{kw} {query_suffix} San Diego"
            try:
                resp = requests.get(BRAVE_URL, headers=headers, params={
                    "q": search_query,
                    "count": 5,
                    "search_lang": "en",
                    "country": "US",
                }, timeout=10)

                if resp.status_code != 200:
                    print(f"  [trends] Brave returned {resp.status_code} for '{search_query}'")
                    continue

                data = resp.json()

                # Extract related queries from search results
                for item in data.get("web", {}).get("results", []):
                    title = item.get("title", "")
                    desc = item.get("description", "")
                    # Pull relevant phrases from titles and descriptions
                    _extract_rising_queries(title + " " + desc, keywords, result)

                # Extract from related searches if available
                for related in data.get("query", {}).get("related_searches", []):
                    result["rising_queries"].append(related)

                time.sleep(0.3)  # gentle rate limit

            except Exception as e:
                print(f"  [trends] Brave error for '{search_query}': {e}")

        # Estimate seasonal interest from result count
        try:
            resp = requests.get(BRAVE_URL, headers=headers, params={
                "q": f"{kw} San Diego",
                "count": 1,
                "search_lang": "en",
                "country": "US",
            }, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                total = data.get("web", {}).get("totalResults", 0)
                # Normalize to 0-100 scale (rough estimate)
                if total > 0:
                    score = min(100, max(1, total // 10000))
                    result["seasonal_interest"][kw] = score
            time.sleep(0.3)
        except Exception:
            pass

    # Deduplicate
    result["rising_queries"] = list(dict.fromkeys(result["rising_queries"]))[:15]
    return result


def _extract_rising_queries(text, seed_keywords, result):
    """Extract relevant query-like phrases from search result text."""
    text_lower = text.lower()
    seed_words = set()
    for kw in seed_keywords:
        seed_words.update(kw.lower().split())

    # Look for quoted phrases or strong keyword matches
    # Split on common delimiters
    fragments = text.split("|") + text.split("-") + text.split(":")
    for frag in fragments:
        frag = frag.strip()
        if len(frag) < 10 or len(frag) > 80:
            continue
        frag_lower = frag.lower()
        hits = [w for w in seed_words if w in frag_lower and len(w) > 3]
        if len(hits) >= 2:
            result["rising_queries"].append(frag.strip())


def score_trend_urgency(trends_data, target_keywords):
    """Score trend urgency for newsjacking potential (0-10).

    Flags rising queries that match target keywords.

    Args:
        trends_data: Dict from pull_trends() with seasonal_interest and rising_queries
        target_keywords: Client's target keyword list

    Returns:
        List of dicts: [{"query": "...", "urgency_score": 8, "reason": "..."}, ...]
    """
    if not trends_data:
        return []

    kw_lower = [kw.lower() for kw in target_keywords]
    kw_words = set()
    for kw in kw_lower:
        kw_words.update(kw.split())

    scored = []

    for query in trends_data.get("rising_queries", []):
        query_lower = query.lower()
        score = 0
        reason = ""

        # Direct keyword match
        for kw in kw_lower:
            if kw in query_lower or query_lower in kw:
                score += 7
                reason = f"Rising query matches target keyword '{kw}'"
                break

        # Partial word match
        if score == 0:
            word_hits = [w for w in kw_words if w in query_lower and len(w) > 3]
            if len(word_hits) >= 2:
                score += 5
                reason = f"Rising query contains key terms: {', '.join(word_hits)}"
            elif len(word_hits) == 1:
                score += 3
                reason = f"Rising query contains: {word_hits[0]}"

        # Boost for high seasonal interest
        for kw, interest in trends_data.get("seasonal_interest", {}).items():
            if kw.lower() in query_lower and interest >= 70:
                score += 2
                reason += f" (seasonal interest: {interest}/100)"
                break

        score = min(score, 10)
        if score >= 5:
            scored.append({
                "query": query,
                "urgency_score": score,
                "reason": reason,
            })

    scored.sort(key=lambda x: x["urgency_score"], reverse=True)
    return scored
