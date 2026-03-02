"""
Brand Mention Monitor
=====================
Finds mentions of "Echo Local" or "echolocalagency" online that don't link back to us.
These are free backlink opportunities -- just ask for the link.
"""

import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

OUR_DOMAIN = "echolocalagency.com"

# Brand name variations to search for
BRAND_QUERIES = [
    '"Echo Local" -site:echolocalagency.com',
    '"echolocalagency" -site:echolocalagency.com',
    '"Echo Local agency" SEO -site:echolocalagency.com',
    '"Brian Egan" "Echo Local" -site:echolocalagency.com',
]

# Domains that won't give us useful backlinks
SKIP_DOMAINS = [
    "google.com", "facebook.com", "twitter.com", "instagram.com",
    "youtube.com", "linkedin.com", "yelp.com", "bbb.org",
    "reddit.com", "github.com", "netlify.app",
]


def find_unlinked_mentions():
    """Find pages mentioning our brand without linking to us.

    Returns:
        List of mention dicts with page_url, domain, context
    """
    if not BRAVE_API_KEY:
        print("  [brand_mentions] No BRAVE_API_KEY")
        return []

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }

    mentions = []
    seen_domains = set()

    for query in BRAND_QUERIES:
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
                url = r.get("url", "")
                domain = _extract_domain(url)
                title = r.get("title", "")

                if any(skip in domain for skip in SKIP_DOMAINS):
                    continue
                if OUR_DOMAIN in domain:
                    continue
                if domain in seen_domains:
                    continue

                # Verify the page doesn't already link to us
                has_link = _check_for_existing_link(url)
                if has_link:
                    continue

                seen_domains.add(domain)
                mentions.append({
                    "page_url": url,
                    "domain": domain,
                    "title": title,
                    "context": f"Mentions Echo Local but no backlink",
                    "relevance_score": 8,
                })

            time.sleep(0.4)

        except Exception as e:
            print(f"  [brand_mentions] Error for query '{query[:30]}': {e}")

    print(f"  [brand_mentions] Found {len(mentions)} unlinked mentions")
    return mentions


def _check_for_existing_link(page_url):
    """Fetch page and check if it already links to our domain."""
    try:
        resp = requests.get(page_url, timeout=8, headers={
            "User-Agent": "Mozilla/5.0 (compatible; EchoLocal mention checker)"
        })
        if resp.status_code != 200:
            return False
        return OUR_DOMAIN in resp.text
    except Exception:
        return False


def _extract_domain(url):
    """Extract domain from URL."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc
    except Exception:
        return url
