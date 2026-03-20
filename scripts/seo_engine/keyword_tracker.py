"""
Keyword Tracker - Weekly SerpAPI rank checker
=============================================
Checks all tracked keywords for a client via SerpAPI.
Stores position, map pack, SERP features in keyword_snapshots.

Usage:
    Called from seo_loop.py on research days (Wed/Sat).
"""

import json
import os
from datetime import date, timedelta

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def _get_supabase():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def check_all_tracked_keywords(client_config: dict, client_id: str):
    """
    Check SerpAPI rank for all active tracked keywords.

    Pre-checks budget, fetches tracked keywords, queries SerpAPI for each,
    and upserts results into keyword_snapshots.
    """
    from .serpapi_client import search_google, check_budget, url_matches_client

    sb = _get_supabase()

    # Fetch active tracked keywords
    resp = (
        sb.table("tracked_keywords")
        .select("keyword")
        .eq("client_id", client_id)
        .eq("is_active", True)
        .execute()
    )
    keywords = [r["keyword"] for r in (resp.data or [])]

    if not keywords:
        print("  [kw-tracker] No tracked keywords found")
        return []

    print(f"  [kw-tracker] Checking {len(keywords)} tracked keywords...")

    # Pre-flight budget check
    budget = check_budget(client_id)
    if not budget["allowed"]:
        print(f"  [kw-tracker] BLOCKED: {budget['reason']}")
        return []

    needed = len(keywords)
    remaining_client = budget["client_limit"] - budget["client_used"]
    remaining_global = budget["global_limit"] - budget["global_used"]
    available = min(remaining_client, remaining_global)

    if needed > available:
        print(f"  [kw-tracker] Budget tight: need {needed}, have {available}. Checking what we can.")
        keywords = keywords[:available]

    client_website = client_config.get("website", "")
    location = client_config.get("primary_market", "San Diego, CA")
    today = date.today().isoformat()
    results = []

    for kw in keywords:
        # Re-check budget each iteration (other processes may consume credits)
        budget = check_budget(client_id)
        if not budget["allowed"]:
            print(f"  [kw-tracker] Budget exhausted mid-run, stopping")
            break

        serp_data = search_google(
            query=kw,
            client_id=client_id,
            location=location,
            search_type="rank_check",
        )

        if serp_data.get("blocked"):
            print(f"  [kw-tracker] Blocked on '{kw}': {serp_data.get('reason')}")
            break

        # Find client position in organic results
        position = None
        serp_url = None
        competitor_positions = []
        organic = serp_data.get("organic_results", [])
        for result in organic:
            url = result.get("link", "")
            if url_matches_client(url, client_website):
                position = result.get("position")
                serp_url = url
            else:
                # Track top 3 non-client competitor domains
                if len(competitor_positions) < 3:
                    try:
                        from urllib.parse import urlparse
                        domain = urlparse(url).netloc.lower().lstrip("www.")
                    except Exception:
                        domain = url
                    competitor_positions.append({
                        "domain": domain,
                        "position": result.get("position"),
                        "url": url,
                    })

        # Check map pack
        in_map_pack = False
        map_pack_position = None
        local_results = serp_data.get("local_results", {})
        places = local_results.get("places", []) if isinstance(local_results, dict) else []
        for i, place in enumerate(places):
            place_link = place.get("links", {}).get("website", "")
            if url_matches_client(place_link, client_website):
                in_map_pack = True
                map_pack_position = i + 1
                break

        # SERP features
        has_featured_snippet = "featured_snippet" in serp_data or "answer_box" in serp_data
        has_ai_overview = "ai_overview" in serp_data
        client_cited_in_aio = False
        if has_ai_overview:
            aio = serp_data.get("ai_overview", {})
            aio_text = str(aio)
            if client_website and client_website.replace("https://", "").replace("http://", "").rstrip("/") in aio_text:
                client_cited_in_aio = True

        snapshot = {
            "client_id": client_id,
            "keyword": kw,
            "checked_at": today,
            "source": "serpapi",
            "position": position,
            "serp_position": int(position) if position else None,
            "in_map_pack": in_map_pack,
            "map_pack_position": map_pack_position,
            "has_featured_snippet": has_featured_snippet,
            "has_ai_overview": has_ai_overview,
            "client_cited_in_aio": client_cited_in_aio,
            "serp_url": serp_url,
            "competitor_positions": competitor_positions if competitor_positions else None,
        }

        # Upsert into keyword_snapshots
        sb.table("keyword_snapshots").upsert(
            snapshot,
            on_conflict="client_id,keyword,checked_at,source",
        ).execute()

        status = f"pos {position}" if position else "NR"
        mp = " (map pack)" if in_map_pack else ""
        print(f"    {kw:<45} {status}{mp}")
        results.append(snapshot)

    print(f"  [kw-tracker] Done: {len(results)}/{len(keywords)} checked")
    return results


def get_competitor_alerts(client_id: str, min_gain: int = 3):
    """Detect significant competitor position changes between last 2 SerpAPI snapshots.

    Compares competitor_positions JSONB between the two most recent snapshots
    for each keyword. Returns alerts where a competitor gained min_gain+ positions.

    Args:
        client_id: Supabase client UUID.
        min_gain: Minimum position gain to trigger an alert (default 3).

    Returns:
        List of alert dicts: [{"keyword": ..., "domain": ..., "old_pos": ..., "new_pos": ..., "gained": ...}]
    """
    sb = _get_supabase()
    alerts = []

    # Get the two most recent SerpAPI check dates for this client
    dates_resp = (
        sb.table("keyword_snapshots")
        .select("checked_at")
        .eq("client_id", client_id)
        .eq("source", "serpapi")
        .order("checked_at", desc=True)
        .limit(200)
        .execute()
    )
    if not dates_resp.data:
        return []

    # Get unique dates
    unique_dates = sorted(set(r["checked_at"] for r in dates_resp.data), reverse=True)
    if len(unique_dates) < 2:
        return []

    current_date = unique_dates[0]
    previous_date = unique_dates[1]

    # Fetch snapshots for both dates
    current_resp = (
        sb.table("keyword_snapshots")
        .select("keyword, competitor_positions")
        .eq("client_id", client_id)
        .eq("source", "serpapi")
        .eq("checked_at", current_date)
        .execute()
    )
    previous_resp = (
        sb.table("keyword_snapshots")
        .select("keyword, competitor_positions")
        .eq("client_id", client_id)
        .eq("source", "serpapi")
        .eq("checked_at", previous_date)
        .execute()
    )

    # Build lookup: keyword -> {domain: position} for previous
    prev_lookup = {}
    for snap in (previous_resp.data or []):
        comps = snap.get("competitor_positions")
        if not comps:
            continue
        if isinstance(comps, str):
            try:
                comps = json.loads(comps)
            except (json.JSONDecodeError, TypeError):
                continue
        kw = snap["keyword"]
        prev_lookup[kw] = {c["domain"]: c["position"] for c in comps if c.get("domain") and c.get("position")}

    # Compare current vs previous
    for snap in (current_resp.data or []):
        comps = snap.get("competitor_positions")
        if not comps:
            continue
        if isinstance(comps, str):
            try:
                comps = json.loads(comps)
            except (json.JSONDecodeError, TypeError):
                continue
        kw = snap["keyword"]
        prev_positions = prev_lookup.get(kw, {})

        for comp in comps:
            domain = comp.get("domain")
            new_pos = comp.get("position")
            if not domain or not new_pos:
                continue
            old_pos = prev_positions.get(domain)
            if old_pos is not None and old_pos - new_pos >= min_gain:
                alerts.append({
                    "keyword": kw,
                    "domain": domain,
                    "old_pos": old_pos,
                    "new_pos": new_pos,
                    "gained": old_pos - new_pos,
                })

    # Sort by biggest gain
    alerts.sort(key=lambda a: a["gained"], reverse=True)
    return alerts
