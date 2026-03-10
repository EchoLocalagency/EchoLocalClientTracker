"""
SerpAPI Client - Budget-gated search wrapper
=============================================
Core module for all SERP queries. Every search flows through here.
Budget caps are enforced in Supabase before each API call.

Usage:
    from scripts.seo_engine.serpapi_client import search_google, check_budget, check_account_balance

Functions:
    search_google(query, client_id, location, search_type) -> dict
    check_budget(client_id) -> dict
    check_account_balance() -> dict
    format_organic_results(serpapi_results) -> list
"""

import os
from datetime import date

import requests
from dotenv import load_dotenv
from serpapi import GoogleSearch
from supabase import create_client

load_dotenv()

# Hard budget caps -- $25/mo plan = 100 searches/mo from SerpAPI,
# but we gate at the application level per client and globally.
CLIENT_MONTHLY_LIMIT = 200
GLOBAL_MONTHLY_LIMIT = 950


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def check_budget(client_id: str) -> dict:
    """
    Check if a client (and globally) is within monthly SerpAPI budget.

    Queries Supabase serpapi_usage fresh every time -- no caching.
    Returns dict with allowed, client_used, client_limit, global_used, global_limit, reason.
    """
    sb = _get_supabase()
    month_start = date.today().replace(day=1).isoformat()

    # Per-client usage this month
    client_resp = (
        sb.table("serpapi_usage")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .gte("searched_at", month_start)
        .execute()
    )
    client_used = client_resp.count or 0

    # Global usage this month
    global_resp = (
        sb.table("serpapi_usage")
        .select("id", count="exact")
        .gte("searched_at", month_start)
        .execute()
    )
    global_used = global_resp.count or 0

    result = {
        "allowed": True,
        "client_used": client_used,
        "client_limit": CLIENT_MONTHLY_LIMIT,
        "global_used": global_used,
        "global_limit": GLOBAL_MONTHLY_LIMIT,
        "reason": None,
    }

    if client_used >= CLIENT_MONTHLY_LIMIT:
        result["allowed"] = False
        result["reason"] = f"Client cap reached ({client_used}/{CLIENT_MONTHLY_LIMIT})"
    elif global_used >= GLOBAL_MONTHLY_LIMIT:
        result["allowed"] = False
        result["reason"] = f"Global cap reached ({global_used}/{GLOBAL_MONTHLY_LIMIT})"

    return result


def search_google(
    query: str,
    client_id: str,
    location: str,
    search_type: str = "organic",
) -> dict:
    """
    Execute a SerpAPI Google search with budget gate.

    Checks budget before calling. Logs usage after successful call.
    Returns full SerpAPI results dict, or {"blocked": True, "reason": ...} if over budget.
    """
    # Budget gate -- always checked first
    budget = check_budget(client_id)
    if not budget["allowed"]:
        print(f"[serpapi] BLOCKED: {budget['reason']}")
        return {"blocked": True, "reason": budget["reason"]}

    # Execute search
    params = {
        "q": query,
        "location": location,
        "gl": "us",
        "hl": "en",
        "api_key": os.getenv("SERPAPI_KEY"),
        "engine": "google",
    }
    search = GoogleSearch(params)
    results = search.get_dict()

    # Log usage ONLY after successful API call
    sb = _get_supabase()
    sb.table("serpapi_usage").insert(
        {
            "client_id": client_id,
            "query": query,
            "search_type": search_type,
            "location": location,
        }
    ).execute()

    return results


def format_organic_results(serpapi_results: dict) -> list:
    """
    Convert SerpAPI response to legacy format for backward compatibility.

    Returns list of dicts with: position, title, url, description.
    Matches the format from research_runner.py's cache.
    """
    organic = serpapi_results.get("organic_results", [])
    formatted = []
    for r in organic:
        formatted.append(
            {
                "position": r.get("position"),
                "title": r.get("title", ""),
                "url": r.get("link", ""),
                "description": r.get("snippet", ""),
            }
        )
    return formatted


def check_account_balance() -> dict:
    """
    Check SerpAPI account balance without consuming a credit.

    Returns dict with searches_used, searches_limit, searches_remaining, plan.
    On error, returns dict with "error" key.
    """
    try:
        resp = requests.get(
            "https://serpapi.com/account.json",
            params={"api_key": os.getenv("SERPAPI_KEY")},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "searches_used": data.get("this_month_usage", 0),
            "searches_limit": data.get("plan_searches_left", 0)
            + data.get("this_month_usage", 0),
            "searches_remaining": data.get("plan_searches_left", 0),
            "plan": data.get("plan_name", "unknown"),
        }
    except Exception as e:
        print(f"[serpapi] Account API error: {e}")
        return {"error": str(e)}
