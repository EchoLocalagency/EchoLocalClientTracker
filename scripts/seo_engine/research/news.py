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


def score_news_urgency(articles, target_keywords):
    """Score news articles for newsjacking urgency (0-10).

    Scores based on:
    - Recency (within 48h = high)
    - Keyword relevance to client's target keywords

    Args:
        articles: List of article dicts from pull_news()
        target_keywords: Client's target keyword list

    Returns:
        List of articles with added 'urgency_score' field, filtered to >= 5
    """
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    scored = []

    # Normalize target keywords for matching
    kw_lower = [kw.lower() for kw in target_keywords]

    for article in articles:
        score = 0

        # Recency score (0-5)
        published = article.get("published_at", "")
        if published:
            try:
                pub_dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
                hours_ago = (now - pub_dt).total_seconds() / 3600
                if hours_ago < 24:
                    score += 5
                elif hours_ago < 48:
                    score += 4
                elif hours_ago < 72:
                    score += 3
                elif hours_ago < 168:  # 1 week
                    score += 2
                else:
                    score += 1
            except (ValueError, TypeError):
                score += 1

        # Keyword relevance score (0-5)
        title = (article.get("title", "") + " " + article.get("description", "")).lower()
        kw_matches = sum(1 for kw in kw_lower if kw in title)
        # Also check individual words from keywords
        kw_words = set()
        for kw in kw_lower:
            kw_words.update(kw.split())
        word_matches = sum(1 for w in kw_words if w in title and len(w) > 3)

        if kw_matches >= 2:
            score += 5
        elif kw_matches == 1:
            score += 4
        elif word_matches >= 3:
            score += 3
        elif word_matches >= 1:
            score += 2

        article["urgency_score"] = min(score, 10)
        scored.append(article)

    # Return only articles scoring >= 5, sorted by score desc
    scored = [a for a in scored if a["urgency_score"] >= 5]
    scored.sort(key=lambda x: x["urgency_score"], reverse=True)
    return scored
