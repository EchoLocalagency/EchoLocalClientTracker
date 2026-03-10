"""
Brave Search Client - Budget-gated search wrapper
===================================================
Core module for all Brave Search API queries. Every Brave search flows through here.
Budget caps are enforced in Supabase before each API call.

Mirrors serpapi_client.py pattern exactly.

Usage:
    from scripts.seo_engine.brave_client import search_brave, check_budget

Functions:
    search_brave(query, client_id, count, search_lang, country) -> dict
    check_budget(client_id) -> dict
"""

import os
import time
from datetime import date

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Hard budget caps -- $5 credit = ~1k queries, budget at 800 to stay safe.
CLIENT_MONTHLY_LIMIT = 200
GLOBAL_MONTHLY_LIMIT = 800

BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def check_budget(client_id: str) -> dict:
    """
    Check if a client (and globally) is within monthly Brave Search budget.

    Queries Supabase brave_usage fresh every time -- no caching.
    Returns dict with allowed, client_used, client_limit, global_used, global_limit, reason.
    """
    sb = _get_supabase()
    month_start = date.today().replace(day=1).isoformat()

    # Per-client usage this month
    client_resp = (
        sb.table("brave_usage")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .gte("searched_at", month_start)
        .execute()
    )
    client_used = client_resp.count or 0

    # Global usage this month
    global_resp = (
        sb.table("brave_usage")
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


def search_brave(
    query: str,
    client_id: str,
    count: int = 10,
    search_lang: str = "en",
    country: str = "US",
) -> dict:
    """
    Execute a Brave Search API call with budget gate.

    Checks budget before calling. Logs usage after successful call.
    Returns full Brave Search results dict, or {"blocked": True, "reason": ...} if over budget.
    """
    if not BRAVE_API_KEY:
        print("[brave] No BRAVE_API_KEY set")
        return {"blocked": True, "reason": "No BRAVE_API_KEY configured"}

    # Budget gate -- always checked first
    budget = check_budget(client_id)
    if not budget["allowed"]:
        print(f"[brave] BLOCKED: {budget['reason']}")
        return {"blocked": True, "reason": budget["reason"]}

    # Rate limit: Brave free tier = 1 req/sec
    time.sleep(1.0)

    # Execute search
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }
    params = {
        "q": query,
        "count": count,
        "search_lang": search_lang,
        "country": country,
    }

    resp = requests.get(BRAVE_URL, headers=headers, params=params, timeout=10)
    resp.raise_for_status()

    # Log usage ONLY after successful API call
    sb = _get_supabase()
    sb.table("brave_usage").insert(
        {
            "client_id": client_id,
            "query": query,
            "search_type": "web",
        }
    ).execute()

    return resp.json()
