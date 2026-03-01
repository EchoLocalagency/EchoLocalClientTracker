"""
NewsAPI
=======
Pulls trending articles for blog post hooks.
Free tier: 100 requests/day.

Get key at newsapi.org. Add NEWS_API_KEY to .env.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")

DEFAULT_QUERIES = [
    "artificial turf",
    "lawn care San Diego",
    "pet health outdoor",
    "San Diego home improvement",
]


def pull_news(queries=None, page_size=5):
    """Pull trending news articles relevant to the business.

    Returns list of dicts with: title, source, url, description, published_at.
    """
    if not NEWS_API_KEY:
        print("  [news] Missing NEWS_API_KEY in .env")
        return []

    queries = queries or DEFAULT_QUERIES
    results = []
    seen_urls = set()

    for query in queries:
        try:
            resp = requests.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "sortBy": "relevancy",
                    "pageSize": page_size,
                    "language": "en",
                    "apiKey": NEWS_API_KEY,
                },
                timeout=10,
            )
            if resp.status_code != 200:
                print(f"  [news] API error for '{query}': {resp.status_code}")
                continue

            articles = resp.json().get("articles", [])
            for article in articles:
                url = article.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                results.append({
                    "title": article.get("title", ""),
                    "source": article.get("source", {}).get("name", ""),
                    "url": url,
                    "description": (article.get("description") or "")[:200],
                    "published_at": article.get("publishedAt", ""),
                })
        except Exception as e:
            print(f"  [news] Error for '{query}': {e}")
            continue

    # Sort by recency
    results.sort(key=lambda x: x.get("published_at", ""), reverse=True)
    return results[:15]
