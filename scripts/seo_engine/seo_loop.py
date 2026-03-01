"""
SEO Loop - Main Orchestrator
=============================
Runs 3x/week (Mon/Thu/Sat) via launchd.
Collects data, calls the brain, executes actions, logs outcomes.

Usage:
    python3 -m scripts.seo_engine.seo_loop                          # all clients, dry run
    python3 -m scripts.seo_engine.seo_loop --live                   # all clients, live
    python3 -m scripts.seo_engine.seo_loop --client mr-green-turf-clean  # single client
    python3 -m scripts.seo_engine.seo_loop --live --client mr-green-turf-clean
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client
import os

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
CLIENTS_FILE = BASE_DIR / "clients.json"

# Weekly rate limits (hard-coded, not relying on the brain)
WEEKLY_LIMITS = {
    "gbp_post": 3,
    "gbp_qanda": 2,
    "blog_post": 2,
    "page_edit": 1,
    "location_page": 1,
}

# Clients eligible for the SEO engine
ELIGIBLE_SLUGS = {"mr-green-turf-clean"}


def get_client_id(slug):
    """Look up Supabase client ID by slug."""
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    resp = sb.table("clients").select("id").eq("slug", slug).execute()
    if resp.data:
        return resp.data[0]["id"]
    return None


def run_client(client, dry_run=True):
    """Run the full SEO loop for one client."""
    from .data_collector import collect_performance_data, scan_page_inventory, load_latest_report
    from .brain import call_brain
    from .outcome_logger import (
        log_action, get_pending_followups, record_followup,
        get_action_history, get_outcome_patterns,
        get_week_action_counts, get_recent_keywords,
    )
    from .research.research_runner import run_research, load_research_cache

    name = client["name"]
    slug = client["slug"]
    print(f"\n{'='*60}")
    print(f"  SEO LOOP: {name}")
    print(f"  Mode: {'LIVE' if not dry_run else 'DRY RUN'}")
    print(f"  Date: {date.today()}")
    print(f"{'='*60}")

    # Get Supabase client ID
    client_id = get_client_id(slug)
    if not client_id:
        print(f"  Client '{slug}' not found in Supabase. Skipping.")
        return
    client["_supabase_id"] = client_id

    # ── Step 1: Collect data ──
    print(f"\n  [1/6] Collecting performance data...")
    try:
        perf_data = collect_performance_data(client)
    except Exception as e:
        print(f"  Data collection failed: {e}")
        # Fall back to latest saved report
        perf_data = load_latest_report(slug)
        if not perf_data:
            print(f"  No fallback data available. Skipping.")
            return

    # ── Step 2: Research (Saturday only) ──
    print(f"\n  [2/6] Research...")
    today = date.today()
    if today.weekday() == 5:  # Saturday
        research_data = run_research(client)
    else:
        research_data = load_research_cache(slug)
        if research_data:
            print(f"  Using cached research from {research_data.get('last_updated', '?')}")
        else:
            print(f"  No research cache available")

    # ── Step 3: Measure follow-ups ──
    print(f"\n  [3/6] Checking follow-up measurements...")
    pending = get_pending_followups()
    client_pending = [p for p in pending if p.get("seo_actions", {}).get("client_id") == client_id]
    if client_pending:
        print(f"  Found {len(client_pending)} pending follow-ups")
        for fu in client_pending:
            action = fu.get("seo_actions", {})
            fu_type = fu["followup_type"]
            target_kws = action.get("target_keywords", [])

            # Measure current metrics for the action's target keywords
            measured = _measure_keywords(client, perf_data, target_kws)
            record_followup(fu["id"], measured)
            print(f"    Recorded {fu_type} for: {action.get('description', '')[:50]}")
    else:
        print(f"  No pending follow-ups")

    # ── Step 4: Think ──
    print(f"\n  [4/6] Calling the brain...")
    action_history = get_action_history(client_id)
    outcome_patterns = get_outcome_patterns(client_id)
    week_counts = get_week_action_counts(client_id)
    recent_keywords = get_recent_keywords(client_id)

    keyword_rankings = perf_data.get("target_keyword_rankings", [])
    gsc_queries = perf_data.get("gsc", {}).get("top_queries", [])
    gbp_keywords = perf_data.get("gbp_keywords", [])

    website_path = client.get("website_local_path", "")
    page_inventory = scan_page_inventory(website_path) if website_path else []

    actions = call_brain(
        client_config=client,
        performance_data=perf_data,
        keyword_rankings=keyword_rankings,
        gbp_keywords=gbp_keywords,
        gsc_queries=gsc_queries,
        page_inventory=page_inventory,
        action_history=action_history,
        outcome_patterns=outcome_patterns,
        recent_keywords=recent_keywords,
        week_counts=week_counts,
        research_data=research_data,
        dry_run=dry_run,
    )

    if not actions:
        print(f"  No actions returned")
        return

    # ── Step 5: Execute (with rate limits) ──
    print(f"\n  [5/6] Executing {len(actions)} actions...")
    execution_log = []

    for action in sorted(actions, key=lambda a: a.get("priority", 5)):
        action_type = action.get("action_type", "")

        # Enforce rate limits
        used = week_counts.get(action_type, 0)
        limit = WEEKLY_LIMITS.get(action_type, 0)
        if used >= limit:
            print(f"  SKIPPED {action_type}: weekly limit reached ({used}/{limit})")
            execution_log.append({"action_type": action_type, "status": "rate_limited"})
            continue

        # Execute
        result = _execute_action(action, client, website_path, dry_run)
        execution_log.append({"action_type": action_type, "result": result})

        # ── Step 6: Log ──
        if result.get("status") not in ("blocked", "error"):
            baseline = _get_baseline_metrics(perf_data, action.get("target_keywords", []))
            action_id = log_action(
                client_id=client_id,
                action_type=action_type,
                description=action.get("reasoning", action_type),
                target_keywords=action.get("target_keywords", []),
                content_summary=_get_content_summary(action),
                metadata=result,
                baseline_metrics=baseline,
            )
            result["action_id"] = action_id

            # Update week counts for rate limiting within this run
            week_counts[action_type] = week_counts.get(action_type, 0) + 1

    # Print summary
    print(f"\n  [6/6] Summary:")
    for entry in execution_log:
        status = entry.get("result", {}).get("status", entry.get("status", "?"))
        print(f"    {entry['action_type']}: {status}")


def _execute_action(action, client, website_path, dry_run):
    """Dispatch an action to the appropriate module."""
    action_type = action.get("action_type", "")
    location_id = client.get("gbp_location", "")

    if action_type == "gbp_post":
        from .actions.gbp_posts import create_post
        return create_post(
            location_id=location_id,
            summary=action.get("summary", ""),
            cta_url=action.get("cta_url", client.get("website", "")),
            dry_run=dry_run,
        )

    elif action_type == "gbp_qanda":
        from .actions.gbp_qanda import seed_qa
        return seed_qa(
            location_id=location_id,
            question=action.get("question", ""),
            answer=action.get("answer", ""),
            dry_run=dry_run,
        )

    elif action_type == "blog_post":
        from .actions.blog_engine import generate_blog_post
        return generate_blog_post(
            title=action.get("title", ""),
            slug=action.get("slug", ""),
            meta_description=action.get("meta_description", ""),
            body_content=action.get("body_content", ""),
            website_path=website_path,
            dry_run=dry_run,
        )

    elif action_type == "page_edit":
        from .actions.page_optimizer import optimize_page
        return optimize_page(
            website_path=website_path,
            filename=action.get("filename", ""),
            edits=action.get("edits", []),
            dry_run=dry_run,
        )

    elif action_type == "location_page":
        from .actions.location_pages import create_location_page
        return create_location_page(
            city=action.get("city", ""),
            slug=action.get("slug", ""),
            title=action.get("title", ""),
            meta_description=action.get("meta_description", ""),
            body_content=action.get("body_content", ""),
            website_path=website_path,
            dry_run=dry_run,
        )

    else:
        print(f"  Unknown action type: {action_type}")
        return {"status": "error", "reason": f"unknown action_type: {action_type}"}


def _measure_keywords(client, perf_data, target_keywords):
    """Get current metrics for specific keywords from performance data."""
    rankings = perf_data.get("target_keyword_rankings", [])
    gsc = perf_data.get("gsc", {})
    gbp = perf_data.get("gbp", {})

    measured = {
        "impressions": gsc.get("impressions", 0),
        "clicks": gsc.get("clicks", 0),
        "gbp_impressions": gbp.get("total_impressions", 0) if gbp else 0,
    }

    # Find position for the first matching keyword
    for kw in target_keywords:
        for r in rankings:
            if r.get("keyword") == kw and r.get("position"):
                measured["position"] = r["position"]
                measured["keyword_impressions"] = r.get("impressions", 0)
                measured["keyword_clicks"] = r.get("clicks", 0)
                break
        if "position" in measured:
            break

    return measured


def _get_baseline_metrics(perf_data, target_keywords):
    """Extract baseline metrics for an action's target keywords."""
    return _measure_keywords({"target_keywords": target_keywords}, perf_data, target_keywords)


def _get_content_summary(action):
    """Extract a content preview from an action for logging."""
    for field in ("summary", "body_content", "answer", "question"):
        text = action.get(field, "")
        if text:
            return text[:500]
    return action.get("reasoning", "")[:500]


def main(client_slug=None, dry_run=True):
    """Main entry point."""
    print(f"SEO Engine Loop - {date.today()}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")

    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    for client in clients:
        slug = client["slug"]

        # Only run eligible clients
        if slug not in ELIGIBLE_SLUGS:
            continue

        # Filter by slug if specified
        if client_slug and slug != client_slug:
            continue

        run_client(client, dry_run=dry_run)

    print(f"\nSEO Engine Loop complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SEO Engine Loop")
    parser.add_argument("--live", action="store_true", help="Run in live mode (default is dry run)")
    parser.add_argument("--client", type=str, help="Run for a specific client slug only")
    args = parser.parse_args()

    main(client_slug=args.client, dry_run=not args.live)
