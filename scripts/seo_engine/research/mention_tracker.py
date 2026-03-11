"""
Cross-Platform Mention Tracker
===============================
Tracks client mentions across directories, forums, and review sites using Brave Search.
Parses competitor AI Overview citations from existing serp_features data (zero API cost).

Usage:
    from scripts.seo_engine.research.mention_tracker import track_mentions, parse_competitor_citations
"""

import json
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import create_client

from scripts.seo_engine.brave_client import search_brave
from scripts.seo_engine.serpapi_client import url_matches_client

load_dotenv()


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


# Domain -> platform mapping
PLATFORM_MAP = {
    "yelp.com": "yelp",
    "bbb.org": "bbb",
    "homeadvisor.com": "homeadvisor",
    "thumbtack.com": "thumbtack",
    "angi.com": "angi",
    "nextdoor.com": "nextdoor",
    "google.com": "google",
    "facebook.com": "facebook",
    "instagram.com": "instagram",
}

# Domain -> mention_type mapping
MENTION_TYPE_MAP = {
    "yelp.com": "directory_listing",
    "bbb.org": "directory_listing",
    "homeadvisor.com": "directory_listing",
    "thumbtack.com": "directory_listing",
    "angi.com": "directory_listing",
    "nextdoor.com": "forum_mention",
    "reddit.com": "forum_mention",
}


def _classify_platform(domain: str) -> str:
    """Classify a domain into a platform name."""
    domain_lower = domain.lower().replace("www.", "")
    for key, platform in PLATFORM_MAP.items():
        if key in domain_lower:
            return platform
    return domain_lower


def _classify_mention_type(domain: str) -> str:
    """Classify mention type based on domain."""
    domain_lower = domain.lower().replace("www.", "")
    for key, mtype in MENTION_TYPE_MAP.items():
        if key in domain_lower:
            return mtype
    # Default classification based on common patterns
    if any(term in domain_lower for term in ["review", "rating"]):
        return "review"
    if any(term in domain_lower for term in ["forum", "community", "discuss"]):
        return "forum_mention"
    return "directory_listing"


def _extract_city(client_config: dict) -> str:
    """Extract city from client config (primary_market or first service_area)."""
    market = client_config.get("primary_market", "")
    if market:
        # primary_market is like "San Diego, CA" -- take the city part
        return market.split(",")[0].strip()

    service_areas = client_config.get("service_areas", [])
    if service_areas:
        return service_areas[0]

    return ""


def track_mentions(client_config) -> list:
    """Search for client mentions across directories, forums, and review sites.

    Uses Brave Search to find where the client appears online.
    Upserts results to Supabase mentions table.

    Args:
        client_config: Dict with name, _supabase_id, primary_market, service_areas.

    Returns:
        List of mention dicts found.
    """
    client_name = client_config.get("name", "")
    client_id = client_config.get("_supabase_id", "")
    city = _extract_city(client_config)

    if not client_name or not client_id:
        print("  [mentions] Missing client name or _supabase_id, skipping")
        return []

    # Build search queries
    queries = []
    if city:
        queries.append(f'"{client_name}" "{city}" site:yelp.com')
        queries.append(f'"{client_name}" "{city}" site:bbb.org')
        queries.append(f'"{client_name}" "{city}" reviews')
        queries.append(f'"{client_name}" "{city}" forum')
    else:
        queries.append(f'"{client_name}" site:yelp.com')
        queries.append(f'"{client_name}" site:bbb.org')

    queries.append(f'"{client_name}" site:homeadvisor.com')
    queries.append(f'"{client_name}" site:thumbtack.com')
    queries.append(f'"{client_name}" site:angi.com')
    queries.append(f'"{client_name}" site:nextdoor.com')

    mentions = []
    seen_urls = set()

    for query in queries:
        try:
            resp = search_brave(query, client_id=client_id, count=10)
            if resp.get("blocked"):
                print(f"  [mentions] Budget blocked: {resp.get('reason')}")
                break  # Stop if budget exhausted

            web_results = resp.get("web", {}).get("results", [])
            for item in web_results:
                url = item.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                parsed = urlparse(url)
                domain = parsed.netloc.lower().replace("www.", "")
                platform = _classify_platform(domain)
                mention_type = _classify_mention_type(domain)

                mention = {
                    "client_id": client_id,
                    "platform": platform,
                    "source_url": url,
                    "source_domain": domain,
                    "mention_type": mention_type,
                    "title": item.get("title", ""),
                    "snippet": item.get("description", ""),
                }
                mentions.append(mention)

        except Exception as e:
            print(f"  [mentions] Error searching '{query}': {e}")
            continue

    # Upsert to Supabase
    if mentions:
        try:
            sb = _get_supabase()
            for mention in mentions:
                sb.table("mentions").upsert(
                    mention,
                    on_conflict="client_id,source_url",
                ).execute()
            print(f"  [mentions] Upserted {len(mentions)} mentions to Supabase")
        except Exception as e:
            print(f"  [mentions] Supabase upsert error: {e}")

    print(f"  [mentions] Found {len(mentions)} cross-platform mentions")
    return mentions


def parse_competitor_citations(client_id: str, client_website: str) -> list:
    """Parse competitor AI Overview citations from existing serp_features data.

    Zero API calls -- reads from Supabase serp_features table only.
    Finds URLs cited in AI Overviews that are NOT the client's site (competitors).
    Upserts to competitor_aio_citations table.

    Args:
        client_id: Supabase client UUID.
        client_website: Client website URL for exclusion matching.

    Returns:
        List of competitor citation dicts.
    """
    if not client_id or not client_website:
        return []

    sb = _get_supabase()
    citations = []

    try:
        # Fetch recent serp_features rows with AI Overviews
        resp = (
            sb.table("serp_features")
            .select("keyword, ai_overview_references")
            .eq("client_id", client_id)
            .eq("has_ai_overview", True)
            .order("collected_at", desc=True)
            .limit(100)
            .execute()
        )

        if not resp.data:
            print("  [competitor_aio] No AI Overview data found in serp_features")
            return []

        # Deduplicate by keyword (keep latest only, which is first due to ORDER BY)
        seen_keywords = set()
        rows = []
        for row in resp.data:
            kw = row.get("keyword", "")
            if kw not in seen_keywords:
                seen_keywords.add(kw)
                rows.append(row)

        # Parse references for competitor URLs
        for row in rows:
            keyword = row.get("keyword", "")
            refs_raw = row.get("ai_overview_references", "[]")

            # Handle both JSON string and already-parsed list
            if isinstance(refs_raw, str):
                try:
                    references = json.loads(refs_raw)
                except (json.JSONDecodeError, TypeError):
                    continue
            elif isinstance(refs_raw, list):
                references = refs_raw
            else:
                continue

            for ref in references:
                ref_url = ref.get("link", "") or ref.get("url", "")
                if not ref_url:
                    continue

                # Skip if this is the client's own site
                if url_matches_client(ref_url, client_website):
                    continue

                parsed = urlparse(ref_url)
                competitor_domain = parsed.netloc.lower().replace("www.", "")
                citation_title = ref.get("title", "") or ref.get("text", "")

                citation = {
                    "client_id": client_id,
                    "keyword": keyword,
                    "competitor_url": ref_url,
                    "competitor_domain": competitor_domain,
                    "citation_title": citation_title,
                }
                citations.append(citation)

        # Upsert to Supabase
        if citations:
            for cit in citations:
                try:
                    sb.table("competitor_aio_citations").upsert(
                        cit,
                        on_conflict="client_id,keyword,competitor_url",
                    ).execute()
                except Exception as e:
                    print(f"  [competitor_aio] Upsert error for {cit['competitor_url']}: {e}")

            print(f"  [competitor_aio] Upserted {len(citations)} competitor citations")

    except Exception as e:
        print(f"  [competitor_aio] Error parsing citations: {e}")

    return citations
