"""
Sales Call Analyzer
====================
Pulls unanalyzed calls from Supabase, runs each through Claude,
stores analysis, and generates an end-of-day coaching report.

Usage:
    python3 -m scripts.sales_engine.analyze_calls          # dry run
    python3 -m scripts.sales_engine.analyze_calls --live    # real analysis
"""

import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")


def get_unanalyzed_calls(sb):
    """Pull calls that haven't been analyzed yet."""
    resp = sb.table("sales_calls") \
        .select("*") \
        .eq("analyzed", False) \
        .order("created_at") \
        .execute()
    return resp.data or []


def get_todays_calls(sb):
    """Pull all calls from today."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    resp = sb.table("sales_calls") \
        .select("*") \
        .gte("created_at", today_start) \
        .order("created_at") \
        .execute()
    return resp.data or []


def get_recent_analyses(sb, limit=5):
    """Pull the most recent analyses for pattern context."""
    resp = sb.table("call_analyses") \
        .select("outcome, score, objections, talk_ratio, energy_score") \
        .order("analyzed_at", desc=True) \
        .limit(limit) \
        .execute()
    return resp.data or []


def get_todays_analyses(sb):
    """Pull all analyses from today."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    resp = sb.table("call_analyses") \
        .select("*") \
        .gte("analyzed_at", today_start) \
        .order("analyzed_at") \
        .execute()
    return resp.data or []


def store_analysis(sb, call_id, analysis):
    """Store Claude's analysis in Supabase."""
    row = {
        "call_id": call_id,
        "outcome": analysis.get("outcome", "unknown"),
        "objections": analysis.get("objections", []),
        "score": analysis.get("score"),
        "talk_ratio": analysis.get("talk_ratio"),
        "energy_score": analysis.get("energy_score"),
        "opener_used": analysis.get("opener_used"),
        "strengths": analysis.get("strengths", []),
        "improvements": analysis.get("improvements", []),
        "coaching_notes": analysis.get("coaching_notes"),
        "key_moments": analysis.get("key_moments", []),
    }

    sb.table("call_analyses").insert(row).execute()
    sb.table("sales_calls").update({"analyzed": True}).eq("id", call_id).execute()


def store_daily_report(sb, report, todays_calls, todays_analyses):
    """Store the end-of-day coaching report."""
    scores = [a["score"] for a in todays_analyses if a.get("score")]
    ratios = [a["talk_ratio"] for a in todays_analyses if a.get("talk_ratio")]
    energies = [a["energy_score"] for a in todays_analyses if a.get("energy_score")]

    outcomes = {}
    for a in todays_analyses:
        o = a.get("outcome", "unknown")
        outcomes[o] = outcomes.get(o, 0) + 1

    row = {
        "report_date": str(date.today()),
        "total_dials": len(todays_calls),
        "conversations": outcomes.get("conversation", 0)
                        + outcomes.get("follow_up", 0)
                        + outcomes.get("meeting_booked", 0)
                        + outcomes.get("closed", 0),
        "meetings_booked": outcomes.get("meeting_booked", 0)
                          + outcomes.get("closed", 0),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        "avg_talk_ratio": round(sum(ratios) / len(ratios), 2) if ratios else None,
        "avg_energy": round(sum(energies) / len(energies), 1) if energies else None,
        "top_objections": report.get("top_objections", []),
        "objection_counts": {o.get("type", "other"): o.get("count", 0)
                            for o in report.get("top_objections", [])},
        "win_patterns": report.get("win_patterns"),
        "loss_patterns": report.get("loss_patterns"),
        "daily_coaching": report.get("daily_coaching"),
        "call_ids": [c["id"] for c in todays_calls],
    }

    sb.table("daily_call_reports") \
        .upsert(row, on_conflict="report_date") \
        .execute()


def main():
    live = "--live" in sys.argv
    mode = "LIVE" if live else "DRY RUN"

    print(f"\n{'='*60}")
    print(f"  Sales Call Analyzer  [{mode}]  {date.today()}")
    print(f"{'='*60}\n")

    # Import here to avoid circular issues
    from .sales_brain import analyze_call, generate_daily_report

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Step 1: Analyze unanalyzed calls
    calls = get_unanalyzed_calls(sb)
    print(f"Unanalyzed calls: {len(calls)}")

    if not calls and not live:
        print("No calls to analyze. Checking for daily report...\n")

    recent = get_recent_analyses(sb)

    for call in calls:
        contact = call.get("contact_name") or call.get("call_to") or "Unknown"
        status = call.get("call_status", "?")
        has_transcript = bool(call.get("call_transcript"))
        print(f"\n  Analyzing: {contact} ({status})"
              f" {'[has transcript]' if has_transcript else '[no transcript]'}")

        analysis = analyze_call(call, recent, dry_run=not live)

        if analysis and live:
            store_analysis(sb, call["id"], analysis)
            outcome = analysis.get("outcome", "?")
            score = analysis.get("score", "?")
            print(f"    -> {outcome} | score: {score}/10")

            # Add to recent for next call's context
            recent.insert(0, analysis)
            recent = recent[:5]
        elif analysis:
            print(f"    [DRY RUN] Would store: {analysis.get('outcome', '?')}"
                  f" | score: {analysis.get('score', '?')}/10")

    # Step 2: Generate daily report if we have today's calls
    todays_calls = get_todays_calls(sb) if live else calls
    todays_analyses = get_todays_analyses(sb) if live else []

    if not todays_calls:
        print("\nNo calls today. Skipping daily report.")
        print("\nDone.")
        return

    # Only generate daily report if we have analyzed calls
    analyzed_today = [a for a in todays_analyses if a.get("outcome")]
    if not analyzed_today and live:
        print(f"\n{len(todays_calls)} calls today but none analyzed yet.")
        print("Run again after analysis completes.")
        print("\nDone.")
        return

    print(f"\n{'='*60}")
    print(f"  Daily Report  |  {len(todays_calls)} calls today")
    print(f"{'='*60}\n")

    report = generate_daily_report(
        todays_calls,
        analyzed_today if live else [{"outcome": "dry_run", "score": 5}] * len(calls),
        dry_run=not live,
    )

    if report and live:
        store_daily_report(sb, report, todays_calls, analyzed_today)
        print("\nDaily coaching report stored.")
        if report.get("daily_coaching"):
            print(f"\n--- COACHING ---\n{report['daily_coaching']}\n")
        if report.get("tomorrow_focus"):
            print(f"TOMORROW'S FOCUS: {report['tomorrow_focus']}\n")
    elif report:
        print(f"  [DRY RUN] Would generate daily report")

    print("Done.")


if __name__ == "__main__":
    main()
