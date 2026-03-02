"""
Keyword Discovery
=================
Finds new keyword opportunities the system isn't tracking yet.
Two sources:
1. GSC queries -- keywords you're already getting impressions for but aren't targeting
2. Brave Search -- "People Also Ask" and related searches around existing keywords

These get fed to the brain as KEYWORD OPPORTUNITIES so it can create content
for keywords you actually have a chance of ranking for.
"""

import os
import re
import time

import requests
from dotenv import load_dotenv

load_dotenv()
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"

# Junk patterns to filter from keyword opportunities
_JUNK_PATTERNS = [
    r"[▷☎️►▶◄●★☆✓✔✗✘→←↑↓™®©]",  # unicode symbols and trademark
    r"updated \d{4}",            # "updated 2026"
    r"\d+ best\b",               # "10 best"
    r"\bthe \d+\b",              # "the 10 artificial turf..."
    r"\bhours\b.*\byelp\b",     # yelp listings
    r"\bnextdoor\b",            # nextdoor listings
    r"\bangi\b|\bhomeadvisor\b", # directory sites
    r"\bthumbtack\b",
    r"\bfacebook\b|\binstagram\b|\btiktok\b|\byoutube\b",  # social media
    r"\bfree estimates\b",       # directory CTAs
    r"\babout us\b",             # page titles, not keywords
    r"\bdistributor\b|\bsupplier\b|\binstaller\b",  # different service verticals
    r"https?://",                # URLs
    r"\s{2,}",                   # multiple spaces (scraped title joins)
]
_JUNK_RE = re.compile("|".join(_JUNK_PATTERNS), re.IGNORECASE)

# Competitor brand names to filter out
_COMPETITOR_BRANDS = [
    "turfresh", "turfspa", "big bully", "turfix", "synlawn",
    "foreverlawn", "install it direct", "heavenly greens",
    "sgw", "san diego turf center", "us turf", "purchase green",
]


def discover_from_gsc(gsc_queries, target_keywords):
    """Find GSC queries you rank for but aren't actively targeting.

    These are free wins -- Google already shows you for these terms,
    you just need dedicated content to push them higher.

    Args:
        gsc_queries: List of dicts from GSC top_queries (query, impressions, clicks, position)
        target_keywords: Current target_keywords from clients.json

    Returns:
        List of opportunity dicts sorted by potential (high impressions + bad position = gold)
    """
    target_set = set(kw.lower() for kw in target_keywords)
    opportunities = []

    for q in gsc_queries:
        query = q.get("query", "").lower().strip()
        if not query or query in target_set:
            continue

        # Skip branded queries
        if any(brand in query for brand in ["mr green", "integrity pro", "echo local"]):
            continue

        impressions = q.get("impressions", 0)
        clicks = q.get("clicks", 0)
        position = q.get("position", 100)

        # Score: high impressions + poor position = biggest opportunity
        # Position 8-30 with decent impressions = striking distance
        potential = 0
        if 5 <= position <= 20:
            potential = impressions * 3  # striking distance, high ROI
        elif 20 < position <= 40:
            potential = impressions * 2  # within reach
        elif position < 5:
            potential = impressions  # already ranking well, maintain
        else:
            potential = impressions * 0.5  # long shot

        if impressions >= 5:  # filter noise
            opportunities.append({
                "keyword": query,
                "impressions": impressions,
                "clicks": clicks,
                "position": round(position, 1),
                "potential": round(potential),
                "source": "gsc",
                "reason": _classify_opportunity(position, impressions),
            })

    opportunities.sort(key=lambda x: x["potential"], reverse=True)
    return opportunities[:20]


def discover_from_brave(seed_keywords, market="San Diego", client_brands=None):
    """Find related keywords via Brave Search suggestions and People Also Ask.

    Args:
        seed_keywords: List of existing target keywords to expand from
        market: Local market for geo-relevant queries
        client_brands: List of client brand name variations to filter out

    Returns:
        List of keyword opportunity dicts
    """
    if not BRAVE_API_KEY:
        print("  [keyword_discovery] No BRAVE_API_KEY")
        return []

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }

    opportunities = []
    seen = set(kw.lower() for kw in seed_keywords)

    # Use a subset of seeds to control API usage
    seeds_to_check = seed_keywords[:6]

    for kw in seeds_to_check:
        try:
            resp = requests.get(BRAVE_URL, headers=headers, params={
                "q": f"{kw} {market}",
                "count": 10,
                "search_lang": "en",
                "country": "US",
            }, timeout=10)

            if resp.status_code != 200:
                continue

            data = resp.json()

            # Extract "People Also Ask" / FAQ results
            faq = data.get("faq", {}).get("results", [])
            for item in faq:
                question = item.get("question", "").strip()
                if question and question.lower() not in seen and not _is_junk_keyword(question, client_brands):
                    seen.add(question.lower())
                    opportunities.append({
                        "keyword": question,
                        "source": "brave_paa",
                        "seed": kw,
                        "reason": "People Also Ask -- real user question, great for FAQ/blog content",
                    })

            # Extract related searches / query suggestions
            related = data.get("query", {}).get("related_searches", [])
            for term in related:
                term_lower = term.lower().strip()
                if term_lower not in seen and len(term_lower) > 5 and not _is_junk_keyword(term, client_brands):
                    seen.add(term_lower)
                    opportunities.append({
                        "keyword": term,
                        "source": "brave_related",
                        "seed": kw,
                        "reason": "Related search -- Google suggests this to users searching your keywords",
                    })

            # Extract long-tail variations from result titles
            for item in data.get("web", {}).get("results", []):
                title = item.get("title", "")
                _extract_longtail(title, kw, seen, opportunities, client_brands)

            time.sleep(0.3)

        except Exception as e:
            print(f"  [keyword_discovery] Brave error for '{kw}': {e}")

    return opportunities[:25]


def discover_keywords(gsc_queries, target_keywords, market="San Diego", client_name=""):
    """Run full keyword discovery pipeline.

    Returns combined, deduplicated list of opportunities from all sources.
    """
    print(f"  [keyword_discovery] Scanning for untapped keywords...")

    # Build brand name variations to filter from results
    client_brands = ["echo local"]
    if client_name:
        # Add variations: "Mr Green Turf Clean" -> ["mr green", "mr. green", "mr green turf"]
        name_lower = client_name.lower()
        client_brands.append(name_lower)
        words = name_lower.split()
        if len(words) >= 2:
            client_brands.append(" ".join(words[:2]))
            client_brands.append(f"{words[0]}. {words[1]}")

    # Source 1: GSC queries you rank for but aren't targeting
    gsc_opps = discover_from_gsc(gsc_queries, target_keywords)
    if gsc_opps:
        print(f"  [keyword_discovery] Found {len(gsc_opps)} GSC opportunities")

    # Source 2: Brave Search related queries and PAA
    brave_opps = discover_from_brave(target_keywords, market, client_brands=client_brands)
    if brave_opps:
        print(f"  [keyword_discovery] Found {len(brave_opps)} Brave opportunities")

    # Combine and deduplicate
    seen = set()
    combined = []
    for opp in gsc_opps + brave_opps:
        kw = opp["keyword"].lower()
        if kw not in seen:
            seen.add(kw)
            combined.append(opp)

    return combined


def _is_junk_keyword(text, extra_brands=None):
    """Return True if the keyword looks like scraped noise rather than a real search term."""
    text_lower = text.lower()
    # Unicode junk or directory patterns
    if _JUNK_RE.search(text):
        return True
    # Competitor brands
    if any(brand in text_lower for brand in _COMPETITOR_BRANDS):
        return True
    # Client's own brand names (not useful as keyword opportunities)
    if extra_brands:
        if any(brand in text_lower for brand in extra_brands):
            return True
    # Too many special characters (scraped titles)
    special_count = sum(1 for c in text if not c.isalnum() and c not in " -',?.")
    if special_count > 2:
        return True
    return False


def _classify_opportunity(position, impressions):
    """Classify a keyword opportunity by its type."""
    if 5 <= position <= 10 and impressions >= 20:
        return "STRIKING DISTANCE -- small push could hit page 1 top 5"
    elif 10 < position <= 20 and impressions >= 10:
        return "Page 2 contender -- dedicated content could break into page 1"
    elif position < 5:
        return "Already ranking -- create supporting content to hold position"
    elif impressions >= 50:
        return "High volume, poor position -- needs dedicated page or blog post"
    else:
        return "Low-competition long-tail -- easy win with targeted content"


def _extract_longtail(title, seed_kw, seen, opportunities, client_brands=None):
    """Extract long-tail keyword phrases from search result titles."""
    title_lower = title.lower()
    seed_lower = seed_kw.lower()
    seed_words = set(seed_lower.split())

    # Only extract if title contains at least 2 seed words
    hits = [w for w in seed_words if w in title_lower and len(w) > 3]
    if len(hits) < 2:
        return

    # Clean title into a keyword-like phrase
    # Remove common noise
    clean = title_lower
    for noise in ["...", "|", " - ", "top ", "best ", "#1 "]:
        clean = clean.replace(noise, " ")
    clean = " ".join(clean.split())  # collapse whitespace
    clean = clean.strip()

    if 10 < len(clean) < 80 and clean not in seen and not _is_junk_keyword(clean, client_brands):
        seen.add(clean)
        opportunities.append({
            "keyword": clean,
            "source": "brave_longtail",
            "seed": seed_kw,
            "reason": "Long-tail variation -- less competition than head terms",
        })
