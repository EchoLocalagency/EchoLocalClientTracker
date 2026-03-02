"""
Agency SEO Loop - Echo Local's Own SEO Engine
==============================================
Runs daily at 1 PM via launchd.
Simplified version of seo_loop.py -- no GBP, no photos.
Blog-heavy strategy: thought leadership, SEO guides, case studies.

Usage:
    python3 -m scripts.agency_engine.agency_loop                  # dry run
    python3 -m scripts.agency_engine.agency_loop --live           # live
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

AGENCY_SLUG = "echo-local"

# Weekly rate limits -- blog-heavy, no GBP
WEEKLY_LIMITS = {
    "blog_post": 3,
    "page_edit": 2,
    "schema_update": 2,
    "newsjack_post": 1,
    "backlink_outreach": 5,
}


def get_client_id(slug):
    """Look up Supabase client ID by slug."""
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    resp = sb.table("clients").select("id").eq("slug", slug).execute()
    if resp.data:
        return resp.data[0]["id"]
    return None


def run(dry_run=True):
    """Run the agency SEO loop."""
    from ..seo_engine.data_collector import collect_performance_data, scan_page_inventory, load_latest_report
    from .agency_brain import call_agency_brain
    from ..seo_engine.outcome_logger import (
        log_action, get_pending_followups, record_followup,
        get_action_history, get_outcome_patterns,
        get_week_action_counts, get_recent_keywords,
    )
    from ..seo_engine.research.research_runner import run_research, load_research_cache, run_fast_research

    print(f"\n{'='*60}")
    print(f"  AGENCY SEO LOOP: Echo Local")
    print(f"  Mode: {'LIVE' if not dry_run else 'DRY RUN'}")
    print(f"  Date: {date.today()}")
    print(f"{'='*60}")

    # Load client config
    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    client = None
    for c in clients:
        if c["slug"] == AGENCY_SLUG:
            client = c
            break

    if not client:
        print(f"  Client '{AGENCY_SLUG}' not found in clients.json. Aborting.")
        return

    # Get Supabase client ID
    client_id = get_client_id(AGENCY_SLUG)
    if not client_id:
        print(f"  Client '{AGENCY_SLUG}' not found in Supabase. Aborting.")
        return
    client["_supabase_id"] = client_id

    # -- Step 1: Collect data --
    print(f"\n  [1/5] Collecting performance data...")
    try:
        perf_data = collect_performance_data(client)
    except Exception as e:
        print(f"  Data collection failed: {e}")
        perf_data = load_latest_report(AGENCY_SLUG)
        if not perf_data:
            print(f"  No fallback data available. Aborting.")
            return

    # -- Step 2: Research (Wed + Sat full, otherwise cached) --
    print(f"\n  [2/5] Research...")
    today = date.today()
    research_data = None
    if today.weekday() in (2, 5):  # Wednesday + Saturday
        research_data = run_research(client)
    else:
        research_data = load_research_cache(AGENCY_SLUG)
        if research_data:
            print(f"  Using cached research from {research_data.get('last_updated', '?')}")
        else:
            print(f"  No research cache available")

    # Fast research (trends + news) every cycle for newsjacking
    try:
        fast_data = run_fast_research(client)
        newsjack_alerts = fast_data.get("newsjack_alerts", [])
        if newsjack_alerts:
            print(f"  Found {len(newsjack_alerts)} newsjack alerts")
        if research_data is None:
            research_data = {}
        research_data["newsjack_alerts"] = newsjack_alerts
    except Exception as e:
        print(f"  Fast research failed (non-fatal): {e}")

    # -- Step 3: Follow-up measurements --
    print(f"\n  [3/5] Checking follow-up measurements...")
    pending = get_pending_followups()
    client_pending = [p for p in pending if p.get("seo_actions", {}).get("client_id") == client_id]
    if client_pending:
        print(f"  Found {len(client_pending)} pending follow-ups")
        for fu in client_pending:
            action = fu.get("seo_actions", {})
            target_kws = action.get("target_keywords", [])
            measured = _measure_keywords(client, perf_data, target_kws)
            record_followup(fu["id"], measured)
            print(f"    Recorded {fu['followup_type']} for: {action.get('description', '')[:50]}")
    else:
        print(f"  No pending follow-ups")

    website_path = client.get("website_local_path", "")

    # -- Step 3.5: Backlink outreach cycle --
    print(f"\n  [3.5/6] Backlink outreach...")
    outreach_used = week_counts.get("backlink_outreach", 0)
    outreach_limit = WEEKLY_LIMITS.get("backlink_outreach", 5)
    if outreach_used < outreach_limit:
        try:
            from ..seo_engine.backlinks.outreach_executor import run_outreach_cycle
            import sys
            from pathlib import Path as _Path
            sys.path.insert(0, str(_Path(__file__).resolve().parent.parent))
            from run_reports import get_creds
            outreach_creds = get_creds()
            outreach_summary = run_outreach_cycle(
                client_id=client_id,
                creds=outreach_creds,
                research_cache=research_data or {},
                dry_run=dry_run,
            )
            print(f"  Outreach: {outreach_summary.get('new_pitches', 0)} new, "
                  f"{outreach_summary.get('followups_sent', 0)} follow-ups, "
                  f"{outreach_summary.get('replies', 0)} replies")
        except Exception as e:
            print(f"  Backlink outreach failed (non-fatal): {e}")
    else:
        print(f"  Backlink outreach: weekly limit reached ({outreach_used}/{outreach_limit})")

    # -- Step 4: Brain --
    print(f"\n  [4/6] Calling the agency brain...")
    action_history = get_action_history(client_id)
    outcome_patterns = get_outcome_patterns(client_id)
    week_counts = get_week_action_counts(client_id)
    recent_keywords = get_recent_keywords(client_id)

    keyword_rankings = perf_data.get("target_keyword_rankings", [])
    gsc_queries = perf_data.get("gsc", {}).get("top_queries", [])
    page_inventory = scan_page_inventory(website_path) if website_path else []

    # Keyword discovery
    keyword_opportunities = []
    try:
        from ..seo_engine.research.keyword_discovery import discover_keywords
        keyword_opportunities = discover_keywords(
            gsc_queries=gsc_queries,
            target_keywords=client.get("target_keywords", []),
            market=client.get("primary_market", "San Diego County"),
            client_name=client.get("name", ""),
        )
    except Exception as e:
        print(f"  Keyword discovery failed (non-fatal): {e}")

    # AEO opportunity extraction
    aeo_opportunities = []
    try:
        from ..seo_engine.research.aeo_opportunities import extract_aeo_opportunities
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

    # Schema audit
    schema_audit = []
    if website_path:
        try:
            from ..seo_engine.schema_injector import audit_page_schemas
            schema_audit = audit_page_schemas(website_path)
        except Exception as e:
            print(f"  Schema audit failed (non-fatal): {e}")

    # Content clusters
    clusters = []
    cluster_gaps = []
    try:
        from ..seo_engine.cluster_manager import get_clusters, suggest_cluster_gaps, create_cluster
        clusters = get_clusters(client_id)
        if not clusters:
            print(f"  No clusters found. Seeding agency clusters...")
            _seed_agency_clusters(client_id, create_cluster)
            clusters = get_clusters(client_id)
        cluster_gaps = suggest_cluster_gaps(client_id)
    except Exception as e:
        print(f"  Cluster load failed (non-fatal): {e}")

    actions = call_agency_brain(
        client_config=client,
        performance_data=perf_data,
        keyword_rankings=keyword_rankings,
        gsc_queries=gsc_queries,
        page_inventory=page_inventory,
        action_history=action_history,
        outcome_patterns=outcome_patterns,
        recent_keywords=recent_keywords,
        week_counts=week_counts,
        research_data=research_data,
        schema_audit=schema_audit,
        clusters=clusters,
        cluster_gaps=cluster_gaps,
        keyword_opportunities=keyword_opportunities,
        aeo_opportunities=aeo_opportunities,
        dry_run=dry_run,
    )

    if not actions:
        print(f"  No actions returned")
        return

    # -- Step 5: Execute (with rate limits) --
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

        # Log action
        if result.get("status") not in ("blocked", "error"):
            baseline = _get_baseline_metrics(perf_data, action.get("target_keywords", []))
            is_newsjack = action_type == "newsjack_post"
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
            )
            result["action_id"] = action_id

            # Post-action hooks
            _run_post_action_hooks(action, client, website_path, client_id, dry_run)

            week_counts[action_type] = week_counts.get(action_type, 0) + 1

    # Summary
    print(f"\n  Summary:")
    for entry in execution_log:
        status = entry.get("result", {}).get("status", entry.get("status", "?"))
        print(f"    {entry['action_type']}: {status}")


def _execute_action(action, client, website_path, dry_run):
    """Dispatch an action -- agency engine only supports blog/page/schema types."""
    action_type = action.get("action_type", "")
    slug = client["slug"]

    if action_type in ("blog_post", "newsjack_post"):
        from ..seo_engine.actions.blog_engine import generate_blog_post
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
        from ..seo_engine.actions.page_optimizer import optimize_page
        return optimize_page(
            website_path=website_path,
            filename=action.get("filename", ""),
            edits=action.get("edits", []),
            dry_run=dry_run,
        )

    elif action_type == "schema_update":
        return _execute_schema_update(action, client, website_path, dry_run)

    else:
        print(f"  Unknown action type: {action_type}")
        return {"status": "error", "reason": f"unknown action_type: {action_type}"}


def _execute_schema_update(action, client, website_path, dry_run):
    """Execute a schema_update action."""
    from ..seo_engine.schema_injector import inject_faq_schema, inject_service_schema

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
    elif schema_type == "service":
        area = action.get("area_served", "San Diego County")
        html = inject_service_schema(
            html, action.get("service_name", ""), action.get("description", ""),
            client["name"], client.get("website", ""), client.get("phone", ""), area,
        )

    if html == original:
        return {"status": "skipped", "reason": "Schema already present or no changes"}

    if not dry_run:
        page_path.write_text(html)
        print(f"  [schema] Injected {schema_type} schema into {filename}")

    return {"status": "generated" if dry_run else "published", "filename": filename, "schema_type": schema_type}


def _run_post_action_hooks(action, client, website_path, client_id, dry_run):
    """Run post-action hooks after successful execution."""
    action_type = action.get("action_type", "")
    target_keywords = action.get("target_keywords", [])

    # Internal linking after content creation
    if action_type in ("blog_post", "newsjack_post", "page_edit") and website_path:
        try:
            from ..seo_engine.internal_linker import inject_links
            target_url = ""
            if action_type in ("blog_post", "newsjack_post"):
                target_url = f"blog/{action.get('slug', '')}.html"

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

    # Update content clusters after blog posts
    if action_type in ("blog_post", "newsjack_post"):
        try:
            from ..seo_engine.cluster_manager import auto_update_cluster_after_post
            post_path = f"blog/{action.get('slug', '')}.html"
            auto_update_cluster_after_post(client_id, post_path, target_keywords)
        except Exception as e:
            print(f"  [post-hook] Cluster update failed (non-fatal): {e}")



def _seed_agency_clusters(client_id, create_cluster):
    """Seed initial content clusters for Echo Local agency site."""
    clusters = [
        {
            "name": "Local SEO for San Diego Contractors",
            "pillar": "services.html",
            "keywords": ["local SEO for contractors san diego", "contractor SEO san diego", "SEO for home service businesses san diego"],
            "gaps": [
                "Why local SEO matters more than ads for contractors",
                "How to rank in San Diego's map pack as a contractor",
                "The 5 biggest SEO mistakes San Diego contractors make",
                "Local SEO checklist for new home service businesses",
            ],
        },
        {
            "name": "GBP Optimization for Home Services",
            "pillar": "services.html",
            "keywords": ["Google Business Profile optimization san diego", "GBP optimization home services"],
            "gaps": [
                "How to optimize your Google Business Profile for more calls",
                "GBP posting strategy for home service businesses",
                "How GBP photos affect your local ranking",
                "Google Business Profile Q&A strategy for contractors",
            ],
        },
        {
            "name": "Echo Local Case Studies",
            "pillar": "results.html",
            "keywords": ["SEO case study home services", "local SEO results san diego"],
            "gaps": [
                "How we ranked a turf cleaning company #1 in San Diego",
                "Pressure washing SEO case study: 0 to 167 impressions in 30 days",
                "What compounding SEO looks like after 90 days",
            ],
        },
        {
            "name": "AI and SEO Automation",
            "pillar": "how-it-works.html",
            "keywords": ["automated SEO for contractors", "AI SEO for home services"],
            "gaps": [
                "How AI is changing local SEO for small businesses",
                "Automated content vs manual SEO: what actually works",
                "Building an SEO engine that runs while you work",
                "Why most SEO agencies are stuck in 2019",
            ],
        },
        {
            "name": "Trade-Specific SEO in San Diego",
            "pillar": "services.html",
            "keywords": ["SEO for plumbers san diego", "SEO for HVAC san diego", "SEO for landscapers san diego"],
            "gaps": [
                "SEO for plumbers: what keywords actually drive calls in San Diego",
                "HVAC SEO in San Diego: seasonal strategies that work",
                "Landscaping SEO: how to dominate your neighborhood on Google",
                "Pool service SEO: targeting the right keywords in Southern California",
            ],
        },
    ]
    for cluster in clusters:
        create_cluster(
            client_id=client_id,
            cluster_name=cluster["name"],
            pillar_page=cluster["pillar"],
            target_keywords=cluster["keywords"],
            gap_topics=cluster["gaps"],
        )
    print(f"  Seeded {len(clusters)} agency clusters")


def _measure_keywords(client, perf_data, target_keywords):
    """Get current metrics for specific keywords."""
    rankings = perf_data.get("target_keyword_rankings", [])
    gsc = perf_data.get("gsc", {})

    measured = {
        "impressions": gsc.get("impressions", 0),
        "clicks": gsc.get("clicks", 0),
    }

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
    """Extract baseline metrics for target keywords."""
    return _measure_keywords({}, perf_data, target_keywords)


def _get_content_summary(action):
    """Extract a content preview from an action for logging."""
    for field in ("summary", "body_content", "answer", "question"):
        text = action.get(field, "")
        if text:
            return text[:500]
    return action.get("reasoning", "")[:500]


def main(dry_run=True):
    """Main entry point."""
    print(f"Agency SEO Engine - {date.today()}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    run(dry_run=dry_run)
    print(f"\nAgency SEO Engine complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agency SEO Engine")
    parser.add_argument("--live", action="store_true", help="Run in live mode (default is dry run)")
    args = parser.parse_args()
    main(dry_run=not args.live)
