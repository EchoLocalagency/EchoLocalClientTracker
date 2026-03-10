"""
GEO Data Helper
================
Fetches GEO scoring and SERP feature data from Supabase and formats
compact sections for the brain prompt.

Functions:
    get_latest_geo_scores(client_id) -> list
    get_latest_serp_features(client_id) -> list
    format_geo_section(geo_scores, serp_features, char_budget=3000) -> str
"""

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def get_all_paa_questions(client_id: str) -> list:
    """Fetch deduplicated PAA questions from serp_features for a client.

    Queries serp_features table ordered by collected_at desc, deduplicates
    by keyword (keeps latest), collects all unique questions across keywords.

    Returns list of unique question strings.
    """
    import json as _json

    sb = _get_supabase()
    resp = (
        sb.table("serp_features")
        .select("keyword, paa_questions")
        .eq("client_id", client_id)
        .order("collected_at", desc=True)
        .limit(100)
        .execute()
    )

    seen_keywords = set()
    all_questions = set()
    for row in resp.data or []:
        kw = row.get("keyword", "")
        if kw in seen_keywords:
            continue
        seen_keywords.add(kw)

        paa = row.get("paa_questions")
        if paa is None:
            continue
        # Handle paa_questions being either a list or a JSON string
        if isinstance(paa, str):
            try:
                paa = _json.loads(paa)
            except (ValueError, _json.JSONDecodeError):
                continue
        if isinstance(paa, list):
            for q in paa:
                if isinstance(q, str) and q.strip():
                    all_questions.add(q.strip())

    return list(all_questions)


def get_latest_geo_scores(client_id: str) -> list:
    """Query Supabase geo_scores for latest scores per page for this client.

    Orders by scored_at desc, limits to 50, deduplicates by page_path
    keeping most recent. Returns list of dicts with keys:
    page_path, page_url, score, factors, scored_at.
    """
    sb = _get_supabase()
    resp = (
        sb.table("geo_scores")
        .select("page_path, page_url, score, factors, scored_at")
        .eq("client_id", client_id)
        .order("scored_at", desc=True)
        .limit(50)
        .execute()
    )

    # Deduplicate by page_path, keeping the most recent (already sorted desc)
    seen = set()
    results = []
    for row in resp.data or []:
        path = row.get("page_path", "")
        if path not in seen:
            seen.add(path)
            results.append(row)

    return results


def get_latest_serp_features(client_id: str) -> list:
    """Query Supabase serp_features for latest per-keyword data.

    Orders by collected_at desc, limits to 50, deduplicates by keyword.
    Returns list of dicts with keys: keyword, has_ai_overview,
    client_cited_in_ai_overview, has_featured_snippet,
    featured_snippet_holder, client_has_snippet, paa_questions, collected_at.
    """
    sb = _get_supabase()
    resp = (
        sb.table("serp_features")
        .select(
            "keyword, has_ai_overview, client_cited_in_ai_overview, "
            "has_featured_snippet, featured_snippet_holder, "
            "client_has_snippet, paa_questions, collected_at"
        )
        .eq("client_id", client_id)
        .order("collected_at", desc=True)
        .limit(50)
        .execute()
    )

    # Deduplicate by keyword, keeping most recent
    seen = set()
    results = []
    for row in resp.data or []:
        kw = row.get("keyword", "")
        if kw not in seen:
            seen.add(kw)
            results.append(row)

    return results


def format_geo_section(geo_scores: list, serp_features: list,
                       char_budget: int = 3000) -> str:
    """Format GEO scores and SERP features into compact table rows for
    the brain prompt.

    GEO scores sorted by score ascending (worst first), capped at 20 rows.
    SERP features sorted with has_ai_overview=True first, capped at 15 rows.
    Enforces char_budget by breaking out of loops when approaching limit.

    Returns a prompt section string.
    """
    if not geo_scores and not serp_features:
        return ""

    lines = []
    current_len = 0

    # -- GEO Citation-Readiness Scores --
    if geo_scores:
        header = "\nGEO CITATION-READINESS SCORES (page | score/5 | missing factors):\n"
        lines.append(header)
        current_len += len(header)

        # Sort worst first (ascending score)
        sorted_scores = sorted(geo_scores, key=lambda x: x.get("score", 0))

        for page in sorted_scores[:20]:
            factors = page.get("factors", {})
            if isinstance(factors, dict):
                missing = [k for k, v in factors.items() if v == 0]
            else:
                missing = []

            missing_str = ", ".join(missing) if missing else "all present"
            path = page.get("page_path", "?")[:30]
            score = page.get("score", 0)
            line = f"  {path:<30} {score}/5  missing: {missing_str}\n"

            if current_len + len(line) > char_budget - 300:
                break
            lines.append(line)
            current_len += len(line)

        footer = "  Pages with score 0-2 need geo_content_upgrade actions.\n"
        lines.append(footer)
        current_len += len(footer)

    # -- AI Overview + Citation Status --
    if serp_features and current_len < char_budget - 200:
        header = "\nAI OVERVIEW + CITATION STATUS (keyword | AIO | cited | snippet holder):\n"
        lines.append(header)
        current_len += len(header)

        # Sort: has_ai_overview=True first
        sorted_features = sorted(
            serp_features,
            key=lambda x: (not x.get("has_ai_overview", False)),
        )

        for sf in sorted_features[:15]:
            aio = "YES" if sf.get("has_ai_overview") else "no"
            cited = "CITED" if sf.get("client_cited_in_ai_overview") else "-"
            holder = sf.get("featured_snippet_holder", "")
            snippet = holder[:25] if sf.get("has_featured_snippet") and holder else "-"
            kw = sf.get("keyword", "?")[:35]
            line = f"  {kw:<35} AIO:{aio:<3} {cited:<5} snippet:{snippet}\n"

            if current_len + len(line) > char_budget - 100:
                break
            lines.append(line)
            current_len += len(line)

        footer = "  Keywords with AIO=YES but Cited=- are highest priority.\n"
        lines.append(footer)
        current_len += len(footer)

    return "".join(lines)
