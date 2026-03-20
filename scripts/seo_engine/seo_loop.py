"""
SEO Loop - Main Orchestrator
=============================
Runs daily at noon via launchd.
Collects data, calls the brain, executes actions, logs outcomes.

Usage:
    python3 -m scripts.seo_engine.seo_loop                          # all clients, dry run
    python3 -m scripts.seo_engine.seo_loop --live                   # all clients, live
    python3 -m scripts.seo_engine.seo_loop --client mr-green-turf-clean  # single client
    python3 -m scripts.seo_engine.seo_loop --live --client mr-green-turf-clean
"""

import argparse
import json
import socket
import subprocess
import sys
import time
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import create_client
import os

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
CLIENTS_FILE = BASE_DIR / "clients.json"

# Weekly rate limits (hard-coded, not relying on the brain)
# Updated 2026-03-02: tuned after SEO frequency audit
# - blog_post: 3->2 (SpamBrain tracks URL creation velocity on small sites)
# - gbp_post: 5->3 (diminishing returns past 3/week, avoids spam signal)
# - gbp_qanda: REMOVED (Google killed Q&A feature Dec 2025)
# - gbp_photo: 5->3 (no penalty risk but no benefit past 3)
# - location_page: 2->1 (doorway page penalties actively enforced)
# - schema_update: 2->4 (no velocity penalty, accuracy is all that matters)
# - newsjack_post: shares cap with blog_post (total content <= 3/week)
WEEKLY_LIMITS = {
    "gbp_post": 2,
    "blog_post": 2,
    "page_edit": 2,
    "location_page": 2,
    "gbp_photo": 3,
    "schema_update": 4,
    "newsjack_post": 1,
    "geo_content_upgrade": 2,
    "gbp_service_update": 1,
}

# Monthly rate limits (tracked over 30 days, not weekly)
MONTHLY_LIMITS = {
    "gbp_description_update": 1,
    "gbp_categories_update": 1,
}

# All GBP action types (used for inter-action throttling)
GBP_ACTION_TYPES = {
    "gbp_post", "gbp_photo", "gbp_service_update",
    "gbp_description_update", "gbp_categories_update",
}

# Max GBP actions per run (daily). Bulk GBP changes in a single day
# trigger Google's automated fraud detection and can cause "permanently
# closed" or suspension flags. SoCal Artificial Turfs was flagged on
# 2026-03-18 after 5 GBP actions in one run. Keep this at 2.
MAX_GBP_ACTIONS_PER_RUN = 2

# Clients eligible for the SEO engine
ELIGIBLE_SLUGS = {"mr-green-turf-clean", "integrity-pro-washers", "socal-artificial-turfs", "az-turf-cleaning"}


def get_client_id(slug, retries=3, delay=10):
    """Look up Supabase client ID by slug. Retries on transient network errors."""
    for attempt in range(retries):
        try:
            sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
            resp = sb.table("clients").select("id").eq("slug", slug).execute()
            if resp.data:
                return resp.data[0]["id"]
            return None
        except Exception as e:
            if attempt < retries - 1:
                print(f"  [retry] Supabase connection failed (attempt {attempt + 1}/{retries}): {e}")
                print(f"  [retry] Waiting {delay}s before retry...")
                time.sleep(delay)
                delay *= 2  # exponential backoff
            else:
                print(f"  [FATAL] Supabase connection failed after {retries} attempts: {e}")
                raise


def run_client(client, dry_run=True):
    """Run the full SEO loop for one client."""
    from .data_collector import collect_performance_data, scan_page_inventory, load_latest_report
    from .brain import call_brain
    from .outcome_logger import (
        log_action, get_pending_followups, record_followup,
        get_action_history, get_outcome_patterns,
        get_week_action_counts, get_month_action_counts, get_recent_keywords,
    )
    from .research.research_runner import run_research, load_research_cache, run_fast_research

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
    print(f"\n  [1/7] Collecting performance data...")
    try:
        perf_data = collect_performance_data(client)
    except Exception as e:
        print(f"  Data collection failed: {e}")
        # Fall back to latest saved report
        perf_data = load_latest_report(slug)
        if not perf_data:
            print(f"  No fallback data available. Skipping.")
            return

    # ── Step 1b: GEO scoring (daily, zero API cost) ──
    print(f"\n  [1b/7] Scoring pages for GEO citation-readiness...")
    try:
        from .geo_scorer import score_all_pages
        geo_results = score_all_pages(client)
        if geo_results:
            avg_score = sum(r["score"] for r in geo_results) / len(geo_results)
            print(f"  Scored {len(geo_results)} pages (avg GEO score: {avg_score:.1f}/5)")
        else:
            print(f"  No HTML pages found for GEO scoring")
    except Exception as e:
        print(f"  GEO scoring failed (non-fatal): {e}")

    # ── Step 1b2: Organization schema injection (daily, zero API cost) ──
    if client.get("website_local_path"):
        try:
            from .schema_injector import inject_organization_on_all_pages
            org_injected = inject_organization_on_all_pages(client)
            if org_injected:
                print(f"  Injected Organization schema on {len(org_injected)} pages")
            else:
                print(f"  Organization schema already present (or no same_as_urls)")
        except Exception as e:
            print(f"  Organization schema injection failed (non-fatal): {e}")

    # ── Step 1c: Fetch GEO data for brain ──
    geo_scores_data = []
    serp_features_data = []
    try:
        from .geo_data import get_latest_geo_scores, get_latest_serp_features
        geo_scores_data = get_latest_geo_scores(client_id)
        serp_features_data = get_latest_serp_features(client_id)
        print(f"  Loaded {len(geo_scores_data)} GEO scores, {len(serp_features_data)} SERP features for brain")
    except Exception as e:
        print(f"  GEO data fetch failed (non-fatal): {e}")

    # ── Step 2: Research ──
    print(f"\n  [2/7] Research...")
    today = date.today()
    if today.weekday() in (2, 5):  # Wednesday + Saturday: full research
        research_data = run_research(client)
    else:
        research_data = load_research_cache(slug)
        if research_data:
            print(f"  Using cached research from {research_data.get('last_updated', '?')}")
        else:
            print(f"  No research cache available")

    # ── Step 2b: Keyword rank tracking (research days only) ──
    if today.weekday() in (2, 5):  # Wednesday + Saturday
        print(f"\n  [2b/7] Checking tracked keyword ranks...")
        try:
            from .keyword_tracker import check_all_tracked_keywords
            kw_results = check_all_tracked_keywords(client, client_id)
            if kw_results:
                print(f"  Tracked {len(kw_results)} keyword positions")
        except Exception as e:
            print(f"  Keyword tracking failed (non-fatal): {e}")

    # Fast research (trends + news) runs every cycle for newsjacking
    try:
        fast_data = run_fast_research(client)
        newsjack_alerts = fast_data.get("newsjack_alerts", [])
        if newsjack_alerts:
            print(f"  Found {len(newsjack_alerts)} newsjack alerts (top urgency: {newsjack_alerts[0].get('urgency_score', 0)})")
        if research_data is None:
            research_data = {}
        research_data["newsjack_alerts"] = newsjack_alerts
    except Exception as e:
        print(f"  Fast research failed (non-fatal): {e}")
        newsjack_alerts = []

    # ── Step 3: Measure follow-ups ──
    print(f"\n  [3/7] Checking follow-up measurements...")
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

    # Resolve local website path
    website_path = client.get("website_local_path", "")

    # ── Step 4: Sync photos ──
    print(f"\n  [4/7] Syncing photos from Drive...")
    photo_manifest = []
    drive_folder_id = client.get("drive_folder_id")
    if drive_folder_id and website_path:
        try:
            from .photo_manager import sync_photos, get_photo_manifest
            sync_photos(slug, drive_folder_id, website_path)
            photo_manifest = get_photo_manifest(slug)
            print(f"  {len(photo_manifest)} photos available for the brain")
        except Exception as e:
            print(f"  Photo sync failed (non-fatal): {e}")
    else:
        print(f"  No Drive folder configured, skipping")

    # ── Step 5: Think ──
    print(f"\n  [5/7] Calling the brain...")
    action_history = get_action_history(client_id)
    outcome_patterns = get_outcome_patterns(client_id)
    week_counts = get_week_action_counts(client_id)
    month_counts = get_month_action_counts(client_id)
    recent_keywords = get_recent_keywords(client_id)

    keyword_rankings = perf_data.get("target_keyword_rankings", [])
    gsc_queries = perf_data.get("gsc", {}).get("top_queries", [])
    gbp_keywords = perf_data.get("gbp_keywords", [])

    page_inventory = scan_page_inventory(website_path) if website_path else []

    # Keyword discovery -- find opportunities outside the target list
    keyword_opportunities = []
    try:
        from .research.keyword_discovery import discover_keywords
        keyword_opportunities = discover_keywords(
            gsc_queries=gsc_queries,
            target_keywords=client.get("target_keywords", []),
            market=client.get("primary_market", "San Diego"),
            client_name=client.get("name", ""),
        )
    except Exception as e:
        print(f"  Keyword discovery failed (non-fatal): {e}")

    # AEO opportunity extraction (question queries from GSC)
    aeo_opportunities = []
    try:
        from .research.aeo_opportunities import extract_aeo_opportunities
        reddit_questions = (research_data or {}).get("reddit_questions", [])
        aeo_opportunities = extract_aeo_opportunities(
            gsc_queries=gsc_queries,
            reddit_questions=reddit_questions,
            target_keywords=client.get("target_keywords", []),
        )
        if aeo_opportunities:
            print(f"  Found {len(aeo_opportunities)} AEO opportunities")
    except Exception as e:
        print(f"  AEO extraction failed (non-fatal): {e}")

    # Schema audit for each page
    schema_audit = []
    if website_path:
        try:
            from .schema_injector import audit_page_schemas
            schema_audit = audit_page_schemas(website_path)
        except Exception as e:
            print(f"  Schema audit failed (non-fatal): {e}")

    # Content clusters (auto-seed if none exist)
    clusters = []
    cluster_gaps = []
    try:
        from .cluster_manager import get_clusters, suggest_cluster_gaps, create_cluster
        clusters = get_clusters(client_id)
        if not clusters:
            print(f"  No clusters found. Seeding initial clusters...")
            _seed_clusters(client_id, slug, create_cluster)
            clusters = get_clusters(client_id)
        cluster_gaps = suggest_cluster_gaps(client_id)
    except Exception as e:
        print(f"  Cluster load failed (non-fatal): {e}")

    # PAA question-to-content matching
    paa_gaps = []
    try:
        from .paa_matcher import match_paa_to_content, extract_page_headings
        from .geo_data import get_all_paa_questions
        paa_questions = get_all_paa_questions(client_id)
        if paa_questions and website_path:
            page_data = extract_page_headings(website_path)
            paa_result = match_paa_to_content(paa_questions, page_data)
            paa_gaps = paa_result.get("gaps", [])
            matched_count = len(paa_result.get("matched", []))
            print(f"  PAA matching: {matched_count} answered, {len(paa_gaps)} gaps")
        elif paa_questions:
            paa_gaps = paa_questions
            print(f"  PAA questions found: {len(paa_gaps)} (no website to match against)")
    except Exception as e:
        print(f"  PAA matching failed (non-fatal): {e}")

    # GBP upload candidates
    gbp_candidates = []
    try:
        from .photo_manager import get_gbp_upload_candidates
        gbp_candidates = get_gbp_upload_candidates(slug)
    except Exception as e:
        print(f"  GBP candidates failed (non-fatal): {e}")

    # Service area candidates (neighborhoods without dedicated pages)
    service_areas = client.get("service_areas", [])
    existing_area_pages = []
    if website_path:
        areas_dir = Path(website_path) / "areas"
        if areas_dir.exists():
            existing_area_pages = [f.stem for f in areas_dir.glob("*.html")]

    # GBP state (description, categories, services) for brain context
    gbp_state = {}
    location_id = client.get("gbp_location", "")
    if location_id:
        try:
            from .actions.gbp_services import get_current_services
            from .actions.gbp_description import get_current_description
            from .actions.gbp_categories import get_current_categories
            gbp_desc = get_current_description(location_id)
            gbp_cats = get_current_categories(location_id)
            gbp_svcs = get_current_services(location_id)
            gbp_state = {
                "description": gbp_desc or "",
                "categories": gbp_cats or {},
                "services": gbp_svcs.get("serviceItems", []) if gbp_svcs else [],
            }
            print(f"  Loaded GBP state: desc={len(gbp_state['description'])} chars, {len(gbp_state.get('categories', {}).get('additional', []))+1} categories")
        except Exception as e:
            print(f"  GBP state fetch failed (non-fatal): {e}")

    # Directory submission coverage for brain context
    directory_summary = None
    try:
        from .outcome_logger import get_directory_summary
        from .submission_engine import CLIENT_TRADE_MAP
        client_trades = CLIENT_TRADE_MAP.get(slug, [])
        directory_summary = get_directory_summary(client_id, client_trades=client_trades)
        ds_sub = directory_summary.get("submitted", 0)
        ds_total = directory_summary.get("total_eligible", 0)
        print(f"  Directory coverage: {ds_sub}/{ds_total} submitted")
    except Exception as e:
        print(f"  Directory summary failed (non-fatal): {e}")

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
        month_counts=month_counts,
        research_data=research_data,
        photo_manifest=photo_manifest,
        schema_audit=schema_audit,
        clusters=clusters,
        cluster_gaps=cluster_gaps,
        gbp_candidates=gbp_candidates,
        service_areas=service_areas,
        existing_area_pages=existing_area_pages,
        keyword_opportunities=keyword_opportunities,
        aeo_opportunities=aeo_opportunities,
        geo_scores=geo_scores_data,
        serp_features=serp_features_data,
        paa_gaps=paa_gaps,
        directory_summary=directory_summary,
        gbp_state=gbp_state,
        dry_run=dry_run,
    )

    if not actions:
        print(f"  No actions returned")
        return

    # ── Step 6: Execute (with rate limits) ──
    print(f"\n  [6/7] Executing {len(actions)} actions...")
    execution_log = []

    # Load tuning overrides (can only increase limits, never decrease)
    effective_limits = dict(WEEKLY_LIMITS)
    tuning_file = BASE_DIR / "scripts" / "seo_engine" / "engine_tuning.json"
    if tuning_file.exists():
        try:
            tuning_data = json.loads(tuning_file.read_text())
            overrides = tuning_data.get(slug, {}).get("rate_limit_overrides", {})
            for k, v in overrides.items():
                if k in effective_limits and v > effective_limits[k]:
                    effective_limits[k] = v
        except (json.JSONDecodeError, OSError):
            pass

    # Load suppressed action types (hard block -- brain guidance alone is not enough)
    suppressed_types = set()
    if tuning_file.exists():
        try:
            tuning_data = json.loads(tuning_file.read_text())
            suppressed_types = set(tuning_data.get(slug, {}).get("suppressed_action_types", []))
        except (json.JSONDecodeError, OSError):
            pass

    gbp_actions_this_run = 0

    # ── Pre-filter: check if ALL actions would be suppressed/rate-limited ──
    # If so, retry the brain once with explicit guidance about available types
    raw_brain_actions = list(actions)
    approved_any = False
    for action in raw_brain_actions:
        action_type = action.get("action_type", "")
        if action_type in suppressed_types:
            continue
        if action_type in GBP_ACTION_TYPES and gbp_actions_this_run >= MAX_GBP_ACTIONS_PER_RUN:
            continue
        if action_type in MONTHLY_LIMITS:
            if month_counts.get(action_type, 0) >= MONTHLY_LIMITS[action_type]:
                continue
        elif week_counts.get(action_type, 0) >= effective_limits.get(action_type, 0):
            continue
        approved_any = True
        break

    if not approved_any and raw_brain_actions:
        # All actions were suppressed/rate-limited -- retry once with available types
        all_limit_types = set(WEEKLY_LIMITS.keys()) | set(MONTHLY_LIMITS.keys())
        available_types = []
        for t in all_limit_types:
            if t in suppressed_types:
                continue
            if t in MONTHLY_LIMITS:
                if month_counts.get(t, 0) >= MONTHLY_LIMITS[t]:
                    continue
            elif week_counts.get(t, 0) >= effective_limits.get(t, 0):
                continue
            available_types.append(t)

        blocked_types = [a.get("action_type", "") for a in raw_brain_actions]
        if available_types:
            print(f"  [retry] All {len(raw_brain_actions)} actions suppressed/rate-limited. Retrying with available types: {available_types}")
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
                month_counts=month_counts,
                research_data=research_data,
                photo_manifest=photo_manifest,
                schema_audit=schema_audit,
                clusters=clusters,
                cluster_gaps=cluster_gaps,
                gbp_candidates=gbp_candidates,
                service_areas=service_areas,
                existing_area_pages=existing_area_pages,
                keyword_opportunities=keyword_opportunities,
                aeo_opportunities=aeo_opportunities,
                geo_scores=geo_scores_data,
                serp_features=serp_features_data,
                paa_gaps=paa_gaps,
                directory_summary=directory_summary,
                gbp_state=gbp_state,
                dry_run=dry_run,
                retry_hint=available_types,
                suppressed_hint=list(suppressed_types) + list(set(blocked_types) - set(available_types)),
            )
            if not actions:
                print(f"  [retry] Brain returned no actions on retry")
                actions = []
        else:
            print(f"  [retry] All {len(raw_brain_actions)} actions suppressed but NO available types remain. Skipping retry.")

    for action in sorted(actions, key=lambda a: a.get("priority", 5)):
        action_type = action.get("action_type", "")

        # Hard-block suppressed action types
        if action_type in suppressed_types:
            print(f"  BLOCKED {action_type}: suppressed via engine_tuning.json")
            execution_log.append({"action_type": action_type, "status": "suppressed"})
            continue

        # Daily GBP cap: max 2 GBP actions per run to avoid Google flagging
        if action_type in GBP_ACTION_TYPES and gbp_actions_this_run >= MAX_GBP_ACTIONS_PER_RUN:
            print(f"  SKIPPED {action_type}: daily GBP cap reached ({gbp_actions_this_run}/{MAX_GBP_ACTIONS_PER_RUN})")
            execution_log.append({"action_type": action_type, "status": "daily_gbp_cap"})
            continue

        # Enforce rate limits: weekly for most types, monthly for description/categories
        if action_type in MONTHLY_LIMITS:
            used = month_counts.get(action_type, 0)
            limit = MONTHLY_LIMITS[action_type]
            if used >= limit:
                print(f"  SKIPPED {action_type}: monthly limit reached ({used}/{limit})")
                execution_log.append({"action_type": action_type, "status": "rate_limited"})
                continue
        else:
            used = week_counts.get(action_type, 0)
            limit = effective_limits.get(action_type, 0)
            if used >= limit:
                print(f"  SKIPPED {action_type}: weekly limit reached ({used}/{limit})")
                execution_log.append({"action_type": action_type, "status": "rate_limited"})
                continue

        # Execute
        try:
            result = _execute_action(action, client, website_path, dry_run)
        except Exception as e:
            print(f"  ACTION CRASHED ({action_type}): {e}")
            result = {"status": "error", "reason": str(e)}

        # Log rejected duplicates so the brain knows on next run
        if result.get("status") == "rejected_duplicate":
            similar_to = result.get("similar_to", "unknown")
            similarity = result.get("similarity", 0)
            print(f"  [duplicate] Location page rejected: {similarity:.0%} similar to {similar_to}")

        execution_log.append({"action_type": action_type, "result": result})

        # GBP throttle: small delay between consecutive GBP API calls
        if action_type in GBP_ACTION_TYPES:
            gbp_actions_this_run += 1
            time.sleep(2)

        # Log action
        if result.get("status") not in ("blocked", "error"):
            baseline = _get_baseline_metrics(perf_data, action.get("target_keywords", []))
            is_newsjack = action_type == "newsjack_post"
            gbp_media_name = result.get("media_name")

            # newsjack_post is tracked separately but uses blog_post action type for logging
            log_type = "blog_post" if action_type == "newsjack_post" else action_type

            action_id = log_action(
                client_id=client_id,
                action_type=log_type,
                description=action.get("reasoning", action_type),
                target_keywords=action.get("target_keywords", []),
                content_summary=_get_content_summary(action),
                metadata=result,
                baseline_metrics=baseline,
                is_newsjack=is_newsjack,
                gbp_media_name=gbp_media_name,
            )
            result["action_id"] = action_id

            # Post-action hooks
            _run_post_action_hooks(action, client, website_path, client_id, dry_run)

            # Update counts for rate limiting within this run
            if action_type in MONTHLY_LIMITS:
                month_counts[action_type] = month_counts.get(action_type, 0) + 1
            else:
                week_counts[action_type] = week_counts.get(action_type, 0) + 1

    # Print summary
    print(f"\n  [7/7] Summary:")
    for entry in execution_log:
        status = entry.get("result", {}).get("status", entry.get("status", "?"))
        print(f"    {entry['action_type']}: {status}")


def _execute_action(action, client, website_path, dry_run):
    """Dispatch an action to the appropriate module."""
    action_type = action.get("action_type", "")
    location_id = client.get("gbp_location", "")
    slug = client["slug"]

    if action_type == "gbp_post":
        from .actions.gbp_posts import create_post
        return create_post(
            location_id=location_id,
            summary=action.get("summary", ""),
            cta_url=action.get("cta_url", client.get("website", "")),
            dry_run=dry_run,
        )

    elif action_type == "gbp_qanda":
        # Google discontinued GBP Q&A in December 2025. API is dead.
        print(f"  [SKIPPED] gbp_qanda -- Google killed this feature Dec 2025")
        return {"status": "skipped", "reason": "GBP Q&A discontinued Dec 2025"}

    elif action_type in ("blog_post", "newsjack_post"):
        from .actions.blog_engine import generate_blog_post
        return generate_blog_post(
            title=action.get("title", ""),
            slug=action.get("slug", ""),
            meta_description=action.get("meta_description", ""),
            body_content=action.get("body_content", ""),
            website_path=website_path,
            client_slug=slug,
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
        # Sanitize slug: brain sometimes includes path prefixes
        loc_slug = action.get("slug", "").replace("areas/", "").replace(".html", "").strip("/")
        action["slug"] = loc_slug
        return create_location_page(
            city=action.get("city", ""),
            slug=loc_slug,
            title=action.get("title", ""),
            meta_description=action.get("meta_description", ""),
            body_content=action.get("body_content", ""),
            website_path=website_path,
            client_slug=slug,
            dry_run=dry_run,
        )

    elif action_type == "gbp_photo":
        from .actions.gbp_media import execute_gbp_photo
        return execute_gbp_photo(action, client, website_path, dry_run=dry_run)

    elif action_type == "geo_content_upgrade":
        from .actions.geo_upgrade import execute_geo_upgrade
        return execute_geo_upgrade(
            website_path=website_path,
            filename=action.get("filename", ""),
            upgrades=action.get("upgrades", []),
            dry_run=dry_run,
        )

    elif action_type == "schema_update":
        return _execute_schema_update(action, client, website_path, dry_run)

    elif action_type == "gbp_service_update":
        from .actions.gbp_services import execute_gbp_service_update
        return execute_gbp_service_update(action, client, dry_run=dry_run)

    elif action_type == "gbp_description_update":
        from .actions.gbp_description import execute_gbp_description_update
        return execute_gbp_description_update(action, client, dry_run=dry_run)

    elif action_type == "gbp_categories_update":
        from .actions.gbp_categories import execute_gbp_categories_update
        return execute_gbp_categories_update(action, client, dry_run=dry_run)

    else:
        print(f"  Unknown action type: {action_type}")
        return {"status": "error", "reason": f"unknown action_type: {action_type}"}


def _execute_schema_update(action, client, website_path, dry_run):
    """Execute a schema_update action: inject schema markup into a page."""
    from .schema_injector import inject_faq_schema, inject_local_business_schema, inject_service_schema, inject_organization_schema

    filename = action.get("filename", "")
    schema_type = action.get("schema_type", "")

    if not filename or not website_path:
        return {"status": "error", "reason": "Missing filename or website_path"}

    page_path = Path(website_path) / filename
    if not page_path.exists():
        return {"status": "error", "reason": f"Page not found: {filename}"}

    html = page_path.read_text()
    original = html

    if schema_type == "faq":
        qa_pairs = action.get("qa_pairs", [])
        html = inject_faq_schema(html, qa_pairs)
    elif schema_type == "local_business":
        coords = {"mr-green-turf-clean": (32.9628, -117.0359), "integrity-pro-washers": (32.7157, -117.1611), "socal-artificial-turfs": (33.7839, -116.9581), "az-turf-cleaning": (33.4152, -111.8315)}
        lat, lng = coords.get(client["slug"], (32.7157, -117.1611))
        addresses = {
            "mr-green-turf-clean": {"addressLocality": "Poway", "addressRegion": "CA"},
            "integrity-pro-washers": {"streetAddress": "2962 Laurel St", "addressLocality": "San Diego", "addressRegion": "CA", "postalCode": "92104"},
            "socal-artificial-turfs": {"addressLocality": "San Jacinto", "addressRegion": "CA", "postalCode": "92582"},
            "az-turf-cleaning": {"streetAddress": "310 N Guthrie St", "addressLocality": "Mesa", "addressRegion": "AZ", "postalCode": "85203"},
        }
        html = inject_local_business_schema(
            html, client["name"], client.get("website", ""),
            client.get("phone", ""), addresses.get(client["slug"], {}), lat, lng,
        )
    elif schema_type == "service":
        area = action.get("area_served", "San Diego")
        html = inject_service_schema(
            html, action.get("service_name", ""), action.get("description", ""),
            client["name"], client.get("website", ""), client.get("phone", ""), area,
        )
    elif schema_type == "organization":
        same_as_urls = client.get("same_as_urls", {})
        html = inject_organization_schema(
            html, client["name"], client.get("website", ""),
            client.get("phone", ""), same_as_urls,
        )

    if html == original:
        return {"status": "skipped", "reason": "Schema already present or no changes"}

    if not dry_run:
        page_path.write_text(html)
        print(f"  [schema] Injected {schema_type} schema into {filename}")

        # Git commit + push (match pattern from other action modules)
        commit_sha = _git_commit_push_schema(
            website_path,
            f"[SEO-AUTO] Inject {schema_type} schema into {filename}",
        )
        return {"status": "published", "filename": filename, "schema_type": schema_type, "commit_sha": commit_sha}

    return {"status": "generated", "filename": filename, "schema_type": schema_type}


def _git_commit_push_schema(website_path, message):
    """Git add, commit, push for schema updates."""
    import re as _re
    import subprocess

    try:
        subprocess.run(["git", "add", "-A"], cwd=website_path, check=True, capture_output=True)
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=website_path, check=True, capture_output=True, text=True,
        )
        sha_match = _re.search(r"\[[\w/-]+ ([a-f0-9]+)\]", result.stdout)
        commit_sha = sha_match.group(1) if sha_match else ""

        subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=website_path, check=True, capture_output=True,
        )
        print(f"  [schema] Committed + pushed: {commit_sha}")
        return commit_sha
    except subprocess.CalledProcessError as e:
        print(f"  [schema] Git commit/push failed: {e}")
        return ""


def _run_post_action_hooks(action, client, website_path, client_id, dry_run):
    """Run post-action hooks after successful execution."""
    action_type = action.get("action_type", "")
    target_keywords = action.get("target_keywords", [])

    # Auto internal linking after content creation actions
    if action_type in ("blog_post", "newsjack_post", "location_page", "page_edit", "geo_content_upgrade") and website_path:
        try:
            from .internal_linker import inject_links
            target_url = ""
            if action_type in ("blog_post", "newsjack_post"):
                target_url = f"blog/{action.get('slug', '')}.html"
            elif action_type == "location_page":
                target_url = f"areas/{action.get('slug', '')}.html"

            if target_url and target_keywords:
                links = inject_links(
                    website_path=website_path,
                    target_url=target_url,
                    keywords=target_keywords,
                    dry_run=dry_run,
                    client_id=client_id,
                )
                if links:
                    print(f"  [post-hook] Internal linker: {len(links)} link opportunities")
        except Exception as e:
            print(f"  [post-hook] Internal linking failed (non-fatal): {e}")

    # Auto FAQ schema detection + injection
    if action_type in ("blog_post", "newsjack_post", "location_page", "geo_content_upgrade") and website_path:
        try:
            from .schema_injector import detect_faq_candidates, inject_faq_schema
            # Determine which file was created/modified
            if action_type in ("blog_post", "newsjack_post"):
                target_file = Path(website_path) / "blog" / f"{action.get('slug', '')}.html"
            elif action_type == "location_page":
                target_file = Path(website_path) / "areas" / f"{action.get('slug', '')}.html"
            elif action_type == "geo_content_upgrade":
                target_file = Path(website_path) / action.get("filename", "")
            else:
                target_file = None

            if target_file and target_file.exists():
                html = target_file.read_text()
                qa_pairs = detect_faq_candidates(html)
                if qa_pairs:
                    updated_html = inject_faq_schema(html, qa_pairs)
                    if updated_html != html and not dry_run:
                        target_file.write_text(updated_html)
                        print(f"  [faq-auto] Injected FAQ schema ({len(qa_pairs)} Q&As) into {target_file.name}")
                    elif updated_html != html:
                        print(f"  [faq-auto] Would inject FAQ schema ({len(qa_pairs)} Q&As) into {target_file.name}")
        except Exception as e:
            print(f"  [faq-auto] FAQ auto-detect failed (non-fatal): {e}")

    # Auto-update content clusters after blog posts
    if action_type in ("blog_post", "newsjack_post"):
        try:
            from .cluster_manager import auto_update_cluster_after_post
            post_path = f"blog/{action.get('slug', '')}.html"
            auto_update_cluster_after_post(client_id, post_path, target_keywords)
        except Exception as e:
            print(f"  [post-hook] Cluster update failed (non-fatal): {e}")


def _seed_clusters(client_id, slug, create_cluster):
    """Seed initial content clusters for a client if none exist."""
    SEED_CLUSTERS = {
        "mr-green-turf-clean": [
            {
                "name": "Turf Cleaning Basics",
                "pillar": "services.html",
                "keywords": ["turf cleaning", "artificial turf cleaning", "synthetic turf cleaning"],
                "gaps": [
                    "How often should you clean artificial turf",
                    "DIY vs professional turf cleaning",
                    "What happens if you dont clean artificial turf",
                    "Best turf cleaning products safe for pets",
                ],
            },
            {
                "name": "Pet Turf Care",
                "pillar": "services.html",
                "keywords": ["pet turf cleaning", "dog turf cleaning", "turf odor removal"],
                "gaps": [
                    "How to remove dog urine smell from artificial turf",
                    "Best artificial turf for dogs",
                    "Pet turf sanitizing frequency",
                    "Is artificial turf safe for dogs",
                ],
            },
            {
                "name": "San Diego Turf Guide",
                "pillar": "service-areas.html",
                "keywords": ["turf cleaning san diego", "artificial grass cleaning san diego"],
                "gaps": [
                    "Why San Diego homeowners choose artificial turf",
                    "San Diego turf maintenance schedule by season",
                    "HOA rules for artificial turf in San Diego",
                ],
            },
        ],
        "socal-artificial-turfs": [
            {
                "name": "Artificial Turf Installation",
                "pillar": "services/artificial-turf-installation.html",
                "keywords": ["artificial turf installation inland empire", "artificial turf san jacinto", "turf installation hemet"],
                "gaps": [
                    "How much does artificial turf cost in the Inland Empire",
                    "How long does artificial turf last in desert heat",
                    "Best artificial turf for Inland Empire yards",
                    "Artificial turf vs natural grass water savings",
                ],
            },
            {
                "name": "Pet Turf Guide",
                "pillar": "services/pet-friendly-turf.html",
                "keywords": ["pet turf inland empire", "dog turf installation", "pet-friendly artificial grass"],
                "gaps": [
                    "Best artificial turf for dogs in hot climates",
                    "How to clean pet turf in the Inland Empire",
                    "Pet turf drainage options for desert yards",
                ],
            },
            {
                "name": "Hardscaping & Pavers",
                "pillar": "services/paver-patios-driveways.html",
                "keywords": ["pavers inland empire", "paver installation san jacinto", "hardscaping temecula"],
                "gaps": [
                    "Paver vs concrete patio cost comparison",
                    "Best pavers for Inland Empire heat",
                    "How to maintain pavers in desert climate",
                ],
            },
        ],
        "az-turf-cleaning": [
            {
                "name": "Turf Cleaning & Maintenance",
                "pillar": "services/turf.html",
                "keywords": ["turf cleaning mesa az", "artificial turf cleaning mesa", "turf maintenance phoenix"],
                "gaps": [
                    "How to clean artificial turf in Arizona heat",
                    "Best turf cleaning schedule for Phoenix metro",
                    "Pet turf cleaning tips for Arizona homeowners",
                    "Does Arizona sun damage artificial turf",
                ],
            },
            {
                "name": "Hardscaping & Pavers",
                "pillar": "services/hardscaping.html",
                "keywords": ["paver installation mesa az", "hardscaping mesa", "paver patio chandler"],
                "gaps": [
                    "Best pavers for Arizona desert climate",
                    "Paver vs concrete cost in Mesa AZ",
                    "How to maintain pavers in extreme heat",
                ],
            },
            {
                "name": "Phoenix Metro Landscape Guide",
                "pillar": "service-areas.html",
                "keywords": ["landscaper mesa az", "landscape remodel mesa", "turf installation tempe"],
                "gaps": [
                    "Why Mesa homeowners are switching to artificial turf",
                    "Complete backyard remodel cost in Phoenix metro",
                    "Desert landscaping trends in Mesa and Gilbert",
                ],
            },
        ],
        "integrity-pro-washers": [
            {
                "name": "Pressure Washing Guide",
                "pillar": "services.html",
                "keywords": ["pressure washing san diego", "power washing san diego"],
                "gaps": [
                    "How often should you pressure wash your driveway",
                    "Pressure washing vs soft washing differences",
                    "Can pressure washing damage concrete",
                    "Best time of year for pressure washing in San Diego",
                ],
            },
            {
                "name": "Soft Washing Guide",
                "pillar": "services.html",
                "keywords": ["soft washing san diego", "roof cleaning san diego"],
                "gaps": [
                    "What is soft washing and when to use it",
                    "Soft washing for stucco homes",
                    "How soft washing protects your roof warranty",
                ],
            },
            {
                "name": "Solar Panel Cleaning",
                "pillar": "services.html",
                "keywords": ["solar panel cleaning san diego"],
                "gaps": [
                    "How dirty solar panels affect energy output",
                    "How often to clean solar panels in San Diego",
                    "DIY vs professional solar panel cleaning",
                ],
            },
        ],
    }

    seed_data = SEED_CLUSTERS.get(slug, [])
    for cluster in seed_data:
        create_cluster(
            client_id=client_id,
            cluster_name=cluster["name"],
            pillar_page=cluster["pillar"],
            target_keywords=cluster["keywords"],
            gap_topics=cluster["gaps"],
        )
    if seed_data:
        print(f"  Seeded {len(seed_data)} clusters for {slug}")


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


def _dns_preflight():
    """Verify Supabase hostname resolves. Flush DNS cache if needed."""
    supabase_url = os.getenv("SUPABASE_URL", "")
    hostname = urlparse(supabase_url).hostname
    if not hostname:
        return

    for attempt in range(3):
        try:
            socket.getaddrinfo(hostname, 443)
            return  # Success
        except socket.gaierror:
            if attempt == 0:
                print(f"  [preflight] DNS resolution failed for {hostname}, flushing cache...")
                subprocess.run(["dscacheutil", "-flushcache"], capture_output=True)
                time.sleep(2)
            elif attempt == 1:
                print(f"  [preflight] Retry {attempt + 1}...")
                time.sleep(5)

    print(f"  [preflight] WARNING: DNS still failing after 3 attempts. Proceeding anyway.")


def main(client_slug=None, dry_run=True):
    """Main entry point."""
    _dns_preflight()

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
