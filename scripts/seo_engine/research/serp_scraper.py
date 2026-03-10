"""
SERP Scraper via SerpAPI
========================
Scrapes Google Search results for target keywords using SerpAPI.
Budget-gated through serpapi_client (200/client/month, 950/global).

Replaces the previous Apify-based scraper. Same return format for backward
compatibility, plus raw extras (AI Overview, PAA, Featured Snippets) for Phase 2.
"""

from scripts.seo_engine.serpapi_client import search_google, format_organic_results, fetch_ai_overview


# SerpAPI needs full location strings. Map short client formats.
LOCATION_MAP = {
    "Poway, CA": "Poway, California, United States",
    "San Diego, CA": "San Diego, California, United States",
    "Mesa, AZ": "Mesa, Arizona, United States",
    "Oceanside, CA": "Oceanside, California, United States",
    "Phoenix, AZ": "Phoenix, Arizona, United States",
    "Scottsdale, AZ": "Scottsdale, Arizona, United States",
    "Tucson, AZ": "Tucson, Arizona, United States",
    "Los Angeles, CA": "Los Angeles, California, United States",
}

# Common state abbreviation -> full name for fallback expansion
STATE_ABBREVS = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}


def resolve_location(short_location: str) -> str:
    """Map client primary_market to SerpAPI location format.

    Handles:
      - Direct lookup in LOCATION_MAP
      - Already-full format ("City, State, United States")
      - Auto-expansion of "City, XX" using STATE_ABBREVS
      - Unknown formats passed through with a warning
    """
    if short_location in LOCATION_MAP:
        return LOCATION_MAP[short_location]

    # Already in full format
    if ", United States" in short_location:
        return short_location

    # Try auto-expanding "City, XX" -> "City, StateName, United States"
    parts = [p.strip() for p in short_location.split(",")]
    if len(parts) == 2 and parts[1].upper() in STATE_ABBREVS:
        full_state = STATE_ABBREVS[parts[1].upper()]
        return f"{parts[0]}, {full_state}, United States"

    print(f"  [serp] WARNING: Unknown location format '{short_location}', passing as-is")
    return short_location


def scrape_serp(keywords, location="Poway, California, United States", max_results=10, client_id=None):
    """Scrape Google SERPs for a list of keywords via SerpAPI.

    Args:
        keywords: List of search queries.
        location: Location string (short "City, ST" or full SerpAPI format).
        max_results: Number of organic results per keyword (currently informational).
        client_id: Supabase client UUID for budget tracking. If None, prints a warning.

    Returns:
        Tuple of (organic_results, raw_extras):
          - organic_results: dict mapping keyword -> list of result dicts
            (position, title, url, description). Same format as the old Apify scraper.
          - raw_extras: dict mapping keyword -> dict with ai_overview,
            related_questions, and answer_box from SerpAPI (for Phase 2).
    """
    if client_id is None:
        print("  [serp] WARNING: No client_id provided -- budget tracking disabled for this run")

    # Resolve short location format to full SerpAPI location
    resolved_location = resolve_location(location)

    organic_results = {}
    raw_extras = {}

    for kw in keywords:
        try:
            result = search_google(kw, client_id, resolved_location)

            # Budget gate blocked this search
            if result.get("blocked"):
                print(f"  [serp] SKIPPED '{kw}': {result.get('reason', 'budget exceeded')}")
                continue

            # Format organic results in legacy format
            organic_results[kw] = format_organic_results(result)

            # Store raw data for Phase 2 (AI Overview, PAA, Featured Snippets)
            ai_overview_data = result.get("ai_overview")

            # Two-step AI Overview: if page_token exists, fetch full AI Overview immediately
            # Token expires in ~60 seconds, must be called before next keyword
            if ai_overview_data and ai_overview_data.get("page_token") and client_id:
                print(f"  [serp] AI Overview page_token found for '{kw}', fetching full overview...")
                followup = fetch_ai_overview(ai_overview_data["page_token"], client_id)
                if not followup.get("blocked") and not followup.get("error"):
                    # Replace with full AI Overview data from follow-up
                    ai_overview_data = followup.get("ai_overview", ai_overview_data)
                    print(f"  [serp] Full AI Overview fetched for '{kw}'")
                else:
                    reason = followup.get("reason") or followup.get("error", "unknown")
                    print(f"  [serp] AI Overview follow-up skipped for '{kw}': {reason}")

            raw_extras[kw] = {
                "ai_overview": ai_overview_data,
                "related_questions": result.get("related_questions", []),
                "answer_box": result.get("answer_box"),
            }

        except Exception as e:
            print(f"  [serp] Error for '{kw}': {e}")
            continue

    return organic_results, raw_extras
