"""
Broken Link Finder
==================
Finds broken outbound links on SEO/contractor resource pages.
Uses Brave Search to find resource pages, then HEAD-checks outbound links for 404s.
Max 20 pages per cycle to stay polite.
"""

import os
import re
import time

import requests
from dotenv import load_dotenv

load_dotenv()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

# Resource page queries -- pages likely to have outbound links
RESOURCE_QUERIES = [
    '"SEO resources" "San Diego"',
    '"contractor resources" links',
    '"home service" resources recommended links',
    '"local SEO" resources tools list',
    '"digital marketing" resources "small business"',
]

# Domains to skip (won't have editable links)
SKIP_DOMAINS = [
    "google.com", "facebook.com", "twitter.com", "instagram.com",
    "youtube.com", "linkedin.com", "yelp.com", "wikipedia.org",
    "reddit.com", "amazon.com", "apple.com",
]


def find_broken_links(max_pages=20):
    """Find broken outbound links on resource pages.

    Returns:
        List of opportunity dicts with page_url, broken_url, page_title, contact hints
    """
    if not BRAVE_API_KEY:
        print("  [broken_links] No BRAVE_API_KEY")
        return []

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }

    opportunities = []
    pages_checked = 0

    for query in RESOURCE_QUERIES:
        if pages_checked >= max_pages:
            break

        try:
            resp = requests.get(BRAVE_URL, headers=headers, params={
                "q": query,
                "count": 5,
                "search_lang": "en",
                "country": "US",
            }, timeout=10)

            if resp.status_code != 200:
                continue

            data = resp.json()
            results = data.get("web", {}).get("results", [])

            for r in results:
                if pages_checked >= max_pages:
                    break

                url = r.get("url", "")
                domain = _extract_domain(url)
                title = r.get("title", "")

                if any(skip in domain for skip in SKIP_DOMAINS):
                    continue

                pages_checked += 1

                # Fetch the page and extract outbound links
                broken = _check_page_links(url)
                for broken_url in broken:
                    opportunities.append({
                        "page_url": url,
                        "page_title": title,
                        "domain": domain,
                        "broken_url": broken_url,
                        "relevance_score": 7,
                        "context": f"Broken link found on {domain}",
                    })

                time.sleep(0.5)

            time.sleep(0.3)

        except Exception as e:
            print(f"  [broken_links] Error for query '{query[:30]}': {e}")

    print(f"  [broken_links] Found {len(opportunities)} broken links from {pages_checked} pages")
    return opportunities[:20]


def _check_page_links(page_url):
    """Fetch a page and HEAD-check its outbound links for 404s."""
    broken = []
    try:
        resp = requests.get(page_url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; EchoLocal link checker)"
        })
        if resp.status_code != 200:
            return []

        # Extract href links from HTML
        links = re.findall(r'href=["\']?(https?://[^"\'\s>]+)', resp.text)
        page_domain = _extract_domain(page_url)

        # Only check external links (not the page's own domain)
        external = [
            link for link in links
            if _extract_domain(link) != page_domain
            and not any(skip in link for skip in SKIP_DOMAINS)
        ]

        # Check a sample (max 10 per page to stay polite)
        for link in external[:10]:
            try:
                head = requests.head(link, timeout=5, allow_redirects=True, headers={
                    "User-Agent": "Mozilla/5.0 (compatible; EchoLocal link checker)"
                })
                if head.status_code in (404, 410, 521, 522, 523):
                    broken.append(link)
                time.sleep(0.3)
            except requests.exceptions.RequestException:
                # Connection errors could mean the site is down
                broken.append(link)

    except Exception as e:
        print(f"  [broken_links] Error checking {page_url}: {e}")

    return broken


def _extract_domain(url):
    """Extract domain from URL."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc
    except Exception:
        return url
