"""
GEO Scorer - Citation-Readiness Analysis
==========================================
Scores client pages for GEO citation-readiness on a 0-5 binary checklist.
Reads local HTML files (zero API cost). Stores daily scores in Supabase
for trend tracking. Brain integration deferred to Phase 3.

Factors (each 0 or 1):
  1. answer_block    -- Concise paragraph (30-80 words) in first 10 paragraphs
  2. stats_density   -- 2+ stat-like patterns (percentages, years, ratings)
  3. schema_present  -- Has JSON-LD schema block
  4. heading_structure -- 3+ H2 tags
  5. freshness_signal -- 2025/2026 in text, or "updated"/"last modified" patterns

Usage:
    from scripts.seo_engine.geo_scorer import score_page, score_all_pages
    result = score_page(html_string)
    results = score_all_pages(client_config)
"""

import glob
import os
import re

from bs4 import BeautifulSoup


# Stat-like patterns (excludes phone numbers and zip codes)
STATS_PATTERNS = [
    r'\d+%',                                  # percentages
    r'\d+\+?\s*years?',                       # years of experience
    r'over\s+\d+',                            # "over 500"
    r'rated\s+\d',                            # "rated 5"
    r'\d+\s*out\s*of\s*\d+',                 # "4 out of 5"
    r'\$[\d,]+',                              # dollar amounts
    r'\d+\s*(?:sq\.?\s*ft|square\s*feet)',    # square footage
]

# Patterns to exclude from stats matching (phone numbers, zip codes)
EXCLUDE_PATTERNS = [
    r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',  # phone numbers
    r'\b\d{5}\b(?![\d%])',                     # 5-digit zip codes (not followed by digit or %)
]


def score_page(html: str) -> dict:
    """Score a page for GEO citation-readiness (0-5 binary checklist).

    Args:
        html: Raw HTML string of the page.

    Returns:
        {"score": int, "factors": {"answer_block": 0|1, ...}}
    """
    soup = BeautifulSoup(html, "html.parser")
    factors = {
        "answer_block": _check_answer_block(soup),
        "stats_density": _check_stats_density(soup),
        "schema_present": _check_schema(html),
        "heading_structure": _check_headings(soup),
        "freshness_signal": _check_freshness(soup, html),
    }
    score = sum(factors.values())
    return {"score": score, "factors": factors}


def score_all_pages(client_config: dict) -> list:
    """Score all HTML pages for a client and upsert to Supabase.

    Args:
        client_config: Client dict with website_local_path, website, _supabase_id.

    Returns:
        List of {"page_path": str, "score": int, "factors": dict} for logging.
    """
    website_path = client_config.get("website_local_path", "")
    if not website_path or not os.path.isdir(website_path):
        return []

    client_id = client_config.get("_supabase_id")
    base_url = client_config.get("website", "").rstrip("/")

    # Glob for *.html files (non-recursive -- flat static sites)
    html_files = glob.glob(os.path.join(website_path, "*.html"))
    if not html_files:
        return []

    results = []
    rows_to_upsert = []

    for filepath in sorted(html_files):
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                html = f.read()
        except Exception as e:
            print(f"    [geo] Could not read {filepath}: {e}")
            continue

        result = score_page(html)
        page_path = os.path.basename(filepath)
        page_url = f"{base_url}/{page_path}" if base_url else ""

        results.append({
            "page_path": page_path,
            "score": result["score"],
            "factors": result["factors"],
        })

        if client_id:
            rows_to_upsert.append({
                "client_id": client_id,
                "page_path": page_path,
                "page_url": page_url,
                "score": result["score"],
                "factors": result["factors"],
            })

    # Upsert to Supabase
    if rows_to_upsert:
        try:
            sb = _get_supabase()
            for row in rows_to_upsert:
                sb.table("geo_scores").upsert(
                    row,
                    on_conflict="client_id,page_path,scored_at",
                ).execute()
        except Exception as e:
            print(f"    [geo] Supabase upsert failed: {e}")

    return results


def _get_supabase():
    """Get Supabase client (same pattern as serpapi_client.py)."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    return create_client(url, key)


def _check_answer_block(soup) -> int:
    """Check if page has a concise answer paragraph (30-80 words) in first 10 paragraphs."""
    body = soup.find("body")
    if not body:
        # Fallback: check all paragraphs if no body tag
        paragraphs = soup.find_all("p")[:10]
    else:
        paragraphs = body.find_all("p")[:10]

    for p in paragraphs:
        text = p.get_text(strip=True)
        word_count = len(text.split())
        if 30 <= word_count <= 80:
            return 1
    return 0


def _check_stats_density(soup) -> int:
    """Check if page contains at least 2 stat-like patterns.

    Excludes phone numbers (10-digit) and zip codes (5-digit standalone).
    """
    text = soup.get_text()

    # Remove phone numbers and zip codes from text before checking stats
    cleaned_text = text
    for pattern in EXCLUDE_PATTERNS:
        cleaned_text = re.sub(pattern, "", cleaned_text)

    count = sum(1 for pattern in STATS_PATTERNS if re.search(pattern, cleaned_text, re.I))
    return 1 if count >= 2 else 0


def _check_schema(html: str) -> int:
    """Check if page has at least one JSON-LD schema block."""
    pattern = r'<script\s+type=["\']application/ld\+json["\']>'
    return 1 if re.search(pattern, html, re.I) else 0


def _check_headings(soup) -> int:
    """Check if page has 3+ H2 tags (suggests good topic coverage)."""
    h2s = soup.find_all("h2")
    return 1 if len(h2s) >= 3 else 0


def _check_freshness(soup, html: str) -> int:
    """Check for freshness signals: recent year or 'updated'/'last modified' text."""
    text = soup.get_text()
    # Check for 2025 or 2026 in text
    if re.search(r'(?:2025|2026)', text):
        return 1
    # Check for "updated", "last modified", or "published" patterns with a date
    if re.search(r'(?:updated|last\s+modified|published)\s*:?\s*\w+\s+\d', text, re.I):
        return 1
    return 0
