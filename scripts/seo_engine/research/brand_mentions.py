"""
Brand Mention Monitor
=====================
Finds mentions of "Echo Local" or "echolocalagency" online that don't link back to us.
These are free backlink opportunities -- just ask for the link.

All Brave Search calls route through brave_client.py for budget tracking.
"""

import os

import requests
from dotenv import load_dotenv
from supabase import create_client

from scripts.seo_engine.brave_client import search_brave

load_dotenv()

OUR_DOMAIN = "echolocalagency.com"

# Echo Local's Supabase client ID for budget tracking
ECHO_LOCAL_CLIENT_ID = "ccb14e38-cd5f-4517-a24f-3f156bcd6b9d"

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

    Uses brave_client.search_brave() for budget-gated Brave Search calls.

    Returns:
        List of mention dicts with page_url, domain, context
    """
    mentions = []
    seen_domains = set()

    for query in BRAND_QUERIES:
        try:
            data = search_brave(
                query=query,
                client_id=ECHO_LOCAL_CLIENT_ID,
                count=10,
            )

            # Handle budget blocks
            if data.get("blocked"):
                print(f"  [brand_mentions] Budget blocked: {data.get('reason', 'unknown')}")
                break

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
