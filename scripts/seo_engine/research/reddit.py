"""
Reddit API
==========
Pulls recent questions from relevant subreddits about turf cleaning,
artificial grass, pets, and local SD topics.

Requires a Reddit app: reddit.com/prefs/apps (free, "script" type).
Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to .env.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")

# Subreddits relevant to turf cleaning / home services
DEFAULT_SUBREDDITS = [
    "lawncare",
    "ArtificialTurf",
    "dogs",
    "SanDiego",
    "homeimprovement",
]

# Search terms to find relevant posts
DEFAULT_SEARCH_TERMS = [
    "artificial turf cleaning",
    "turf cleaning",
    "artificial grass smell",
    "synthetic turf maintenance",
    "pet turf odor",
    "dog pee artificial grass",
]


def _get_reddit_token():
    """Get OAuth2 bearer token from Reddit."""
    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        print("  [reddit] Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET in .env")
        return None

    auth = requests.auth.HTTPBasicAuth(REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET)
    data = {"grant_type": "client_credentials"}
    headers = {"User-Agent": "SEOEngine/1.0"}

    resp = requests.post(
        "https://www.reddit.com/api/v1/access_token",
        auth=auth, data=data, headers=headers, timeout=10,
    )
    if resp.status_code != 200:
        print(f"  [reddit] Auth failed: {resp.status_code}")
        return None

    return resp.json().get("access_token")


def pull_reddit_questions(subreddits=None, search_terms=None, limit=20):
    """Pull relevant questions from Reddit.

    Returns list of dicts with: title, subreddit, score, url, selftext_preview.
    """
    token = _get_reddit_token()
    if not token:
        return []

    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "SEOEngine/1.0",
    }

    subreddits = subreddits or DEFAULT_SUBREDDITS
    search_terms = search_terms or DEFAULT_SEARCH_TERMS
    results = []
    seen_ids = set()

    # Search across subreddits
    for sub in subreddits:
        for term in search_terms:
            try:
                resp = requests.get(
                    f"https://oauth.reddit.com/r/{sub}/search",
                    headers=headers,
                    params={
                        "q": term,
                        "restrict_sr": "true",
                        "sort": "relevance",
                        "t": "month",  # Last month only
                        "limit": 5,
                    },
                    timeout=10,
                )
                if resp.status_code != 200:
                    continue

                posts = resp.json().get("data", {}).get("children", [])
                for post in posts:
                    d = post.get("data", {})
                    post_id = d.get("id")
                    if post_id in seen_ids:
                        continue
                    seen_ids.add(post_id)

                    results.append({
                        "title": d.get("title", ""),
                        "subreddit": d.get("subreddit", sub),
                        "score": d.get("score", 0),
                        "url": f"https://reddit.com{d.get('permalink', '')}",
                        "selftext_preview": (d.get("selftext", "") or "")[:200],
                    })
            except Exception as e:
                print(f"  [reddit] Error searching r/{sub} for '{term}': {e}")
                continue

    # Sort by score descending, take top N
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]
