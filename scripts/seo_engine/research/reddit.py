"""
Reddit Question Mining (Brave-powered)
=======================================
Pulls relevant Reddit questions using Brave Search site:reddit.com queries.
No Reddit API dependency -- all searches go through brave_client.py budget gate.

Usage:
    from scripts.seo_engine.research.reddit import pull_reddit_questions_brave
"""

import warnings
from urllib.parse import urlparse

from scripts.seo_engine.brave_client import search_brave

# Search terms to find relevant posts
DEFAULT_SEARCH_TERMS = [
    "artificial turf cleaning",
    "turf cleaning",
    "artificial grass smell",
    "synthetic turf maintenance",
    "pet turf odor",
    "dog pee artificial grass",
]


def _extract_subreddit(url: str) -> str:
    """Extract subreddit name from a Reddit URL."""
    try:
        path = urlparse(url).path
        parts = [p for p in path.split("/") if p]
        if len(parts) >= 2 and parts[0] == "r":
            return parts[1]
    except Exception:
        pass
    return ""


def pull_reddit_questions_brave(client_config, limit=20) -> list:
    """Pull relevant Reddit questions using Brave Search.

    Searches site:reddit.com for niche terms and client-specific keywords.
    All queries go through brave_client.py for budget gating.

    Args:
        client_config: Dict with _supabase_id, target_keywords, niche/slug.
        limit: Max results to return.

    Returns:
        List of dicts: {title, url, snippet, subreddit, search_term}
    """
    client_id = client_config.get("_supabase_id", "")
    if not client_id:
        print("  [reddit] No _supabase_id in client_config, skipping")
        return []

    target_kws = client_config.get("target_keywords", [])
    results = []
    seen_urls = set()

    # Generic niche queries from DEFAULT_SEARCH_TERMS
    for term in DEFAULT_SEARCH_TERMS:
        query = f"{term} site:reddit.com"
        try:
            resp = search_brave(query, client_id=client_id, count=10)
            if resp.get("blocked"):
                print(f"  [reddit] Budget blocked: {resp.get('reason')}")
                break  # Stop all queries if budget exhausted
            _collect_results(resp, term, results, seen_urls)
        except Exception as e:
            print(f"  [reddit] Error searching '{term}': {e}")
            continue

    # Client-specific keyword queries (top 3 keywords)
    for kw in target_kws[:3]:
        query = f'"{kw}" site:reddit.com question'
        try:
            resp = search_brave(query, client_id=client_id, count=10)
            if resp.get("blocked"):
                print(f"  [reddit] Budget blocked: {resp.get('reason')}")
                break
            _collect_results(resp, kw, results, seen_urls)
        except Exception as e:
            print(f"  [reddit] Error searching keyword '{kw}': {e}")
            continue

    print(f"  [reddit] Found {len(results)} Reddit questions via Brave")
    return results[:limit]


def _collect_results(resp: dict, search_term: str, results: list, seen_urls: set):
    """Parse Brave response and collect Reddit results."""
    web_results = resp.get("web", {}).get("results", [])
    for item in web_results:
        url = item.get("url", "")
        if "reddit.com" not in url:
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)
        results.append({
            "title": item.get("title", ""),
            "url": url,
            "snippet": item.get("description", ""),
            "subreddit": _extract_subreddit(url),
            "search_term": search_term,
        })


def pull_reddit_questions(subreddits=None, search_terms=None, limit=20):
    """DEPRECATED: Use pull_reddit_questions_brave() instead.

    Kept for backward compatibility. Returns empty list.
    """
    warnings.warn(
        "pull_reddit_questions() is deprecated. Use pull_reddit_questions_brave(client_config) instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    print("  [reddit] WARNING: pull_reddit_questions() is deprecated. Use pull_reddit_questions_brave().")
    return []
