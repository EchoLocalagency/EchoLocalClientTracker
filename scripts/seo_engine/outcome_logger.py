"""
Outcome Logger
==============
CRUD for seo_actions, seo_action_followups, and seo_brain_decisions tables.
Tracks every action the SEO engine takes, schedules follow-up measurements,
and computes impact scores to feed back into the brain.
"""

import os
from datetime import date, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


def _get_sb():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Actions ────────────────────────────────────────────────────────────

def log_action(client_id, action_type, description, target_keywords,
               content_summary, metadata, baseline_metrics):
    """Insert an seo_action row and create 3 scheduled followup rows.

    Follow-ups scheduled at +10d, +17d, +31d (accounts for GSC 3-day lag).
    """
    sb = _get_sb()
    today = date.today()

    row = {
        "client_id": client_id,
        "action_type": action_type,
        "action_date": str(today),
        "description": description,
        "target_keywords": target_keywords or [],
        "content_summary": (content_summary or "")[:500],
        "metadata": metadata or {},
        "baseline_position": baseline_metrics.get("position"),
        "baseline_impressions": baseline_metrics.get("impressions"),
        "baseline_clicks": baseline_metrics.get("clicks"),
        "baseline_gbp_impressions": baseline_metrics.get("gbp_impressions"),
        "status": "active",
    }

    resp = sb.table("seo_actions").insert(row).execute()
    if not resp.data:
        print(f"  [outcome_logger] Failed to insert action: {description}")
        return None

    action_id = resp.data[0]["id"]

    # Schedule follow-up measurements
    followups = [
        {"followup_type": "7d", "scheduled_date": str(today + timedelta(days=10))},
        {"followup_type": "14d", "scheduled_date": str(today + timedelta(days=17))},
        {"followup_type": "28d", "scheduled_date": str(today + timedelta(days=31))},
    ]
    for fu in followups:
        fu["action_id"] = action_id
    sb.table("seo_action_followups").insert(followups).execute()

    print(f"  [outcome_logger] Logged action: {action_type} - {description[:60]}")
    return action_id


def get_pending_followups(today=None):
    """Return followups where scheduled_date <= today and not yet completed."""
    sb = _get_sb()
    today = today or date.today()
    resp = (
        sb.table("seo_action_followups")
        .select("*, seo_actions(*)")
        .lte("scheduled_date", str(today))
        .eq("completed", False)
        .execute()
    )
    return resp.data or []


def record_followup(followup_id, measured_data):
    """Mark a followup as complete and update the parent action's followup JSONB."""
    sb = _get_sb()
    from datetime import datetime

    # Update the followup row
    sb.table("seo_action_followups").update({
        "completed": True,
        "measured_data": measured_data,
        "measured_at": datetime.utcnow().isoformat(),
    }).eq("id", followup_id).execute()

    # Get the followup to find parent action + type
    fu_resp = (
        sb.table("seo_action_followups")
        .select("action_id, followup_type")
        .eq("id", followup_id)
        .execute()
    )
    if not fu_resp.data:
        return

    action_id = fu_resp.data[0]["action_id"]
    fu_type = fu_resp.data[0]["followup_type"]

    # Update parent action's followup column
    col = f"followup_{fu_type}"
    sb.table("seo_actions").update({col: measured_data}).eq("id", action_id).execute()

    # If this is the 28d followup, compute impact score
    if fu_type == "28d":
        compute_impact_score(action_id)


def compute_impact_score(action_id):
    """Compute impact score from baseline vs 28d measurements.

    Score = weighted combination of position improvement + impression growth.
    Positive = good. Negative = action hurt or had no effect.
    """
    sb = _get_sb()
    resp = sb.table("seo_actions").select("*").eq("id", action_id).execute()
    if not resp.data:
        return

    action = resp.data[0]
    fu_28d = action.get("followup_28d") or {}

    baseline_pos = action.get("baseline_position")
    baseline_imp = action.get("baseline_impressions") or 0
    measured_pos = fu_28d.get("position")
    measured_imp = fu_28d.get("impressions") or 0

    score = 0.0

    # Position improvement (lower is better, so baseline - measured = positive if improved)
    if baseline_pos and measured_pos:
        pos_delta = baseline_pos - measured_pos
        score += pos_delta * 2.0  # Weight position heavily

    # Impression growth
    if baseline_imp > 0 and measured_imp > 0:
        imp_growth = (measured_imp - baseline_imp) / baseline_imp
        score += imp_growth * 10.0

    sb.table("seo_actions").update({
        "impact_score": round(score, 2)
    }).eq("id", action_id).execute()


# ── History & Patterns ─────────────────────────────────────────────────

def get_action_history(client_id, days=90):
    """Return recent actions for the brain's context window."""
    sb = _get_sb()
    cutoff = str(date.today() - timedelta(days=days))
    resp = (
        sb.table("seo_actions")
        .select("*")
        .eq("client_id", client_id)
        .gte("action_date", cutoff)
        .order("action_date", desc=True)
        .execute()
    )
    return resp.data or []


def get_outcome_patterns(client_id):
    """Aggregate outcome data for the brain.

    Returns summary like:
    - avg impact by action_type
    - best performing keywords
    - action types that consistently fail
    """
    sb = _get_sb()
    resp = (
        sb.table("seo_actions")
        .select("action_type, target_keywords, impact_score, followup_7d, followup_14d, followup_28d")
        .eq("client_id", client_id)
        .not_.is_("impact_score", "null")
        .execute()
    )

    if not resp.data:
        return {"summary": "No outcome data yet. System is still collecting baseline measurements."}

    actions = resp.data
    by_type = {}
    for a in actions:
        t = a["action_type"]
        if t not in by_type:
            by_type[t] = {"scores": [], "positive": 0, "negative": 0, "keywords": []}
        score = a.get("impact_score") or 0
        by_type[t]["scores"].append(score)
        if score > 0:
            by_type[t]["positive"] += 1
        else:
            by_type[t]["negative"] += 1
        by_type[t]["keywords"].extend(a.get("target_keywords") or [])

    patterns = []
    for action_type, data in by_type.items():
        avg_score = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
        total = data["positive"] + data["negative"]
        patterns.append({
            "action_type": action_type,
            "avg_impact": round(avg_score, 2),
            "total_actions": total,
            "positive_count": data["positive"],
            "negative_count": data["negative"],
            "top_keywords": list(set(data["keywords"]))[:10],
        })

    # Sort by avg impact descending
    patterns.sort(key=lambda x: x["avg_impact"], reverse=True)
    return {"patterns": patterns}


def get_week_action_counts(client_id):
    """Count actions in the current Mon-Sun window for rate limiting."""
    sb = _get_sb()
    today = date.today()
    # Monday of current week
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    resp = (
        sb.table("seo_actions")
        .select("action_type")
        .eq("client_id", client_id)
        .gte("action_date", str(monday))
        .lte("action_date", str(sunday))
        .execute()
    )

    counts = {}
    for row in (resp.data or []):
        t = row["action_type"]
        counts[t] = counts.get(t, 0) + 1
    return counts


def get_recent_keywords(client_id, days=14):
    """Get keywords targeted in the last N days for dedup checking."""
    sb = _get_sb()
    cutoff = str(date.today() - timedelta(days=days))
    resp = (
        sb.table("seo_actions")
        .select("action_type, target_keywords")
        .eq("client_id", client_id)
        .gte("action_date", cutoff)
        .execute()
    )
    recent = []
    for row in (resp.data or []):
        for kw in (row.get("target_keywords") or []):
            recent.append({"keyword": kw, "action_type": row["action_type"]})
    return recent


# ── Brain Decisions ────────────────────────────────────────────────────

def log_brain_decision(client_id, input_summary, raw_response, parsed_actions, execution_log):
    """Log a complete brain decision cycle for audit."""
    sb = _get_sb()
    sb.table("seo_brain_decisions").insert({
        "client_id": client_id,
        "decision_date": str(date.today()),
        "input_summary": input_summary,
        "raw_response": raw_response,
        "parsed_actions": parsed_actions,
        "execution_log": execution_log,
    }).execute()
