"""
Backlink Gap Analysis
=====================
Finds sites linking to competing San Diego SEO agencies but not to us.
Uses Brave Search to discover competitor backlinks, scores by relevance.
Results cached in research_cache.json under "backlink_prospects".
"""

import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

# Known competing SD SEO agencies to analyze
COMPETITORS = [
    "ignitedigital.com",
    "digitaloperative.com",
    "powerdms.com",
    "seoinsandiego.com",
    "sddigitalmarketing.com",
]

OUR_DOMAIN = "echolocalagency.com"

# Queries to find pages that link to SEO agencies
LINK_QUERIES = [
    '"SEO agency" "San Diego" resources',
    '"SEO company" "San Diego" recommended',
    '"digital marketing" "San Diego" directory',
    '"local SEO" "San Diego" partners',
    '"home service" "SEO" resources links',
    '"contractor marketing" resources recommended',
]


def find_backlink_gaps(max_pages=20):
    """Find sites linking to competitors but not us.

    Returns:
        List of prospect dicts with url, domain, relevance_score, context
    """
    if not BRAVE_API_KEY:
        print("  [backlink_gap] No BRAVE_API_KEY")
        return []

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }

    prospects = []
    seen_domains = set()
    pages_checked = 0

    for query in LINK_QUERIES:
        if pages_checked >= max_pages:
            break

        try:
            resp = requests.get(BRAVE_URL, headers=headers, params={
                "q": query,
                "count": 10,
                "search_lang": "en",
                "country": "US",
            }, timeout=10)

            if resp.status_code != 200:
                continue

            data = resp.json()
            results = data.get("web", {}).get("results", [])

            for r in results:
                pages_checked += 1
                url = r.get("url", "")
                domain = _extract_domain(url)
                title = r.get("title", "")
                description = r.get("description", "")

                # Skip if it's a competitor site itself
                if any(comp in domain for comp in COMPETITORS):
                    continue
                # Skip our own domain
                if OUR_DOMAIN in domain:
                    continue
                # Skip duplicates
                if domain in seen_domains:
                    continue

                # Check if the page mentions any competitor
                page_text = f"{title} {description}".lower()
                mentions_competitor = any(comp.split(".")[0] in page_text for comp in COMPETITORS)
                mentions_seo = any(term in page_text for term in ["seo", "marketing", "digital", "agency"])

                if mentions_competitor or mentions_seo:
                    relevance = _score_relevance(page_text, mentions_competitor)
                    seen_domains.add(domain)
                    prospects.append({
                        "page_url": url,
                        "domain": domain,
                        "title": title,
                        "relevance_score": relevance,
                        "context": f"Found via: {query[:50]}",
                        "mentions_competitor": mentions_competitor,
                    })

            time.sleep(0.4)

        except Exception as e:
            print(f"  [backlink_gap] Error for query '{query[:30]}': {e}")

    # Sort by relevance
    prospects.sort(key=lambda x: x["relevance_score"], reverse=True)
    print(f"  [backlink_gap] Found {len(prospects)} prospects from {pages_checked} pages")
    return prospects[:30]


def _score_relevance(text, mentions_competitor):
    """Score relevance 1-10 based on page content signals."""
    score = 3  # base score

    if mentions_competitor:
        score += 3
    if "resource" in text or "recommended" in text:
        score += 2
    if "san diego" in text:
        score += 1
    if "home service" in text or "contractor" in text:
        score += 1

    return min(10, score)


def _extract_domain(url):
    """Extract domain from URL."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc
    except Exception:
        return url
