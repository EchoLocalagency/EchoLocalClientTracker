"""
Self-Improving SEO Engine
=========================
Weekly analysis script. Queries seo_actions with impact scores,
identifies patterns, and writes engine_tuning.json for the brain
and seo_loop to consume.

Run: python3 -m scripts.seo_engine.self_improve
Triggered: Sundays via seo-guardian.sh
"""

import json
import os
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
TUNING_FILE = BASE_DIR / "scripts" / "seo_engine" / "engine_tuning.json"
CLIENTS_FILE = BASE_DIR / "clients.json"

# Floor limits -- tuning can only increase, never go below these
from .seo_loop import WEEKLY_LIMITS, ELIGIBLE_SLUGS

# Thresholds
MIN_SCORED_ACTIONS = 3
SUPPRESS_AVG_THRESHOLD = -2.0
SUPPRESS_SUCCESS_THRESHOLD = 0.30
BOOST_AVG_THRESHOLD = 5.0
BOOST_SUCCESS_THRESHOLD = 0.70


def _get_sb():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def _get_client_id(slug):
    sb = _get_sb()
    resp = sb.table("clients").select("id").eq("slug", slug).execute()
    return resp.data[0]["id"] if resp.data else None


def analyze_patterns(client_id):
    """Query seo_actions with non-null impact_score, group by action_type."""
    sb = _get_sb()
    resp = (
        sb.table("seo_actions")
        .select("action_type, impact_score, target_keywords")
        .eq("client_id", client_id)
        .not_.is_("impact_score", "null")
        .execute()
    )
    if not resp.data:
        return None

    by_type = defaultdict(lambda: {"scores": [], "keywords": []})
    for a in resp.data:
        t = a["action_type"]
        score = a.get("impact_score", 0) or 0
        by_type[t]["scores"].append(score)
        by_type[t]["keywords"].extend(a.get("target_keywords") or [])

    patterns = {}
    for action_type, data in by_type.items():
        scores = data["scores"]
        avg = sum(scores) / len(scores)
        positive = sum(1 for s in scores if s > 0)
        success_rate = positive / len(scores)
        patterns[action_type] = {
            "avg_impact": round(avg, 2),
            "success_rate": round(success_rate, 2),
            "count": len(scores),
            "keywords": data["keywords"],
        }
    return patterns


def analyze_keywords(patterns):
    """Extract keyword themes from top-performing actions."""
    if not patterns:
        return []

    # Collect keywords from top 25% action types by avg_impact
    sorted_types = sorted(patterns.items(), key=lambda x: x[1]["avg_impact"], reverse=True)
    top_quarter = max(1, len(sorted_types) // 4)
    top_types = sorted_types[:top_quarter]

    keyword_counts = defaultdict(lambda: {"count": 0, "action_types": set()})
    for action_type, data in top_types:
        for kw in data["keywords"]:
            # Extract theme (first 2-3 words as a rough cluster)
            theme = " ".join(kw.lower().split()[:3])
            keyword_counts[theme]["count"] += 1
            keyword_counts[theme]["action_types"].add(action_type)

    insights = []
    for theme, info in sorted(keyword_counts.items(), key=lambda x: x[1]["count"], reverse=True)[:10]:
        insights.append({
            "theme": theme,
            "count": info["count"],
            "best_action_types": list(info["action_types"]),
        })
    return insights


def generate_tuning(slug, patterns, keyword_insights):
    """Generate tuning config for a single client."""
    if not patterns:
        return None

    # Action type rankings (sorted by avg_impact)
    rankings = sorted(
        [{"type": t, "avg_impact": d["avg_impact"], "success_rate": d["success_rate"], "count": d["count"]}
         for t, d in patterns.items() if d["count"] >= MIN_SCORED_ACTIONS],
        key=lambda x: x["avg_impact"],
        reverse=True,
    )

    # Suppressed types: bad avg + low success rate + enough data
    suppressed = [
        r["type"] for r in rankings
        if r["avg_impact"] < SUPPRESS_AVG_THRESHOLD and r["success_rate"] < SUPPRESS_SUCCESS_THRESHOLD
    ]

    # Rate limit overrides: boost types that perform well
    rate_overrides = {}
    for r in rankings:
        if r["avg_impact"] > BOOST_AVG_THRESHOLD and r["success_rate"] > BOOST_SUCCESS_THRESHOLD:
            base = WEEKLY_LIMITS.get(r["type"], 0)
            if base > 0:
                rate_overrides[r["type"]] = base + 1

    # Learned rules (natural language from patterns)
    learned = []
    if rankings:
        best = rankings[0]
        worst = rankings[-1] if len(rankings) > 1 else None
        learned.append(f"{best['type']} is the top performer (avg impact {best['avg_impact']:+.1f}, {best['success_rate']:.0%} success)")
        if worst and worst["avg_impact"] < 0:
            learned.append(f"{worst['type']} underperforms (avg impact {worst['avg_impact']:+.1f}, {worst['success_rate']:.0%} success)")
        for s in suppressed:
            learned.append(f"{s} suppressed: consistently negative impact, avoid unless strong reasoning")

    return {
        "last_updated": str(date.today()),
        "rate_limit_overrides": rate_overrides,
        "action_type_rankings": rankings,
        "learned_rules": learned,
        "suppressed_action_types": suppressed,
        "keyword_insights": keyword_insights,
    }


def main():
    """Run self-improvement analysis for all eligible clients."""
    print(f"Self-Improve: {date.today()}")

    # Load existing tuning
    if TUNING_FILE.exists():
        tuning = json.loads(TUNING_FILE.read_text())
    else:
        tuning = {}

    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    updated = False
    for client in clients:
        slug = client["slug"]
        if slug not in ELIGIBLE_SLUGS:
            continue

        client_id = _get_client_id(slug)
        if not client_id:
            print(f"  {slug}: not found in Supabase, skipping")
            continue

        patterns = analyze_patterns(client_id)
        if not patterns:
            print(f"  {slug}: no outcome data yet (expected until followups populate)")
            continue

        total_scored = sum(d["count"] for d in patterns.values())
        if total_scored < MIN_SCORED_ACTIONS:
            print(f"  {slug}: only {total_scored} scored actions, need {MIN_SCORED_ACTIONS}+")
            continue

        keyword_insights = analyze_keywords(patterns)
        client_tuning = generate_tuning(slug, patterns, keyword_insights)

        if client_tuning:
            tuning[slug] = client_tuning
            updated = True
            print(f"  {slug}: tuning updated ({len(client_tuning['action_type_rankings'])} ranked types, "
                  f"{len(client_tuning['suppressed_action_types'])} suppressed, "
                  f"{len(client_tuning['rate_limit_overrides'])} rate overrides)")

    if updated:
        TUNING_FILE.write_text(json.dumps(tuning, indent=2))
        print(f"Wrote {TUNING_FILE}")
    else:
        print("No updates to write.")


if __name__ == "__main__":
    main()
