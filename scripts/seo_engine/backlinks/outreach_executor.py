"""
Outreach Executor
=================
Orchestrates the backlink outreach cycle:
1. Check for replies to previous emails
2. Send follow-ups (7d and 14d spacing)
3. Process new opportunities from research cache
4. Dedup via backlink_targets table
"""

import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
from supabase import create_client

from .gmail_sender import send_email, check_replies, can_send
from .email_templates import TEMPLATES

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

MAX_FOLLOWUPS = 2
FOLLOWUP_1_DAYS = 7
FOLLOWUP_2_DAYS = 14


def _get_sb():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def run_outreach_cycle(client_id, creds, research_cache, dry_run=True):
    """Run one outreach cycle: replies, follow-ups, new pitches.

    Args:
        client_id: Supabase client UUID
        creds: Google OAuth credentials
        research_cache: Dict with backlink research data
        dry_run: If True, log but don't send

    Returns:
        dict with cycle summary
    """
    summary = {"replies": 0, "followups_sent": 0, "new_pitches": 0, "rate_limited": False}

    # Step 1: Check replies
    print(f"  [outreach] Checking for replies...")
    try:
        replies = check_replies(client_id, creds)
        summary["replies"] = len(replies)
        if replies:
            print(f"  [outreach] Found {len(replies)} replies")
    except Exception as e:
        print(f"  [outreach] Reply check failed: {e}")

    # Step 2: Send follow-ups
    if can_send(client_id):
        print(f"  [outreach] Processing follow-ups...")
        followups_sent = _send_pending_followups(client_id, creds, dry_run)
        summary["followups_sent"] = followups_sent
    else:
        summary["rate_limited"] = True
        print(f"  [outreach] Rate limit reached, skipping follow-ups")
        return summary

    # Step 3: Process new opportunities
    if can_send(client_id):
        print(f"  [outreach] Processing new opportunities...")
        new_sent = _process_new_opportunities(client_id, creds, research_cache, dry_run)
        summary["new_pitches"] = new_sent
    else:
        summary["rate_limited"] = True

    return summary


def _send_pending_followups(client_id, creds, dry_run):
    """Send follow-ups for emails that haven't gotten replies."""
    sb = _get_sb()
    sent_count = 0

    # Get outreach that needs follow-up:
    # - No reply received
    # - followup_number < MAX_FOLLOWUPS
    # - Enough time has passed since last email
    outreach = (
        sb.table("backlink_outreach")
        .select("id, target_id, subject, followup_number, sent_at, template_type")
        .eq("client_id", str(client_id))
        .eq("reply_received", False)
        .lt("followup_number", MAX_FOLLOWUPS)
        .order("sent_at")
        .execute()
    ).data or []

    now = datetime.utcnow()

    for o in outreach:
        if not can_send(client_id):
            break

        sent_at = datetime.fromisoformat(o["sent_at"].replace("Z", "+00:00").replace("+00:00", ""))
        next_followup = o["followup_number"] + 1
        wait_days = FOLLOWUP_1_DAYS if next_followup == 1 else FOLLOWUP_2_DAYS

        if (now - sent_at).days < wait_days:
            continue

        # Get target info
        target = None
        if o.get("target_id"):
            target_resp = (
                sb.table("backlink_targets")
                .select("contact_email, contact_name, status")
                .eq("id", o["target_id"])
                .execute()
            )
            if target_resp.data:
                target = target_resp.data[0]
                if target.get("status") in ("replied", "won", "lost", "skipped"):
                    continue

        if not target or not target.get("contact_email"):
            continue

        subject, body = TEMPLATES["followup"](
            contact_name=target.get("contact_name"),
            original_subject=o["subject"],
            followup_number=next_followup,
        )

        result = send_email(
            client_id=client_id,
            creds=creds,
            to_email=target["contact_email"],
            subject=subject,
            body=body,
            target_id=o["target_id"],
            template_type="followup",
            followup_number=next_followup,
            dry_run=dry_run,
        )

        if result.get("status") in ("sent", "dry_run"):
            sent_count += 1

    if sent_count:
        print(f"  [outreach] Sent {sent_count} follow-ups")
    return sent_count


def _process_new_opportunities(client_id, creds, research_cache, dry_run):
    """Ingest new opportunities from research cache and send initial pitches."""
    sb = _get_sb()
    sent_count = 0

    if not research_cache:
        return 0

    # Ingest broken link opportunities
    broken = research_cache.get("broken_link_opportunities", [])
    for opp in broken:
        if not can_send(client_id):
            break
        sent = _ingest_and_pitch(
            sb, client_id, creds, opp,
            opportunity_type="broken_link",
            template_type="broken_link",
            dry_run=dry_run,
        )
        if sent:
            sent_count += 1

    # Ingest brand mention opportunities
    mentions = research_cache.get("brand_mentions", [])
    for opp in mentions:
        if not can_send(client_id):
            break
        sent = _ingest_and_pitch(
            sb, client_id, creds, opp,
            opportunity_type="brand_mention",
            template_type="brand_mention",
            dry_run=dry_run,
        )
        if sent:
            sent_count += 1

    # Ingest competitor gap opportunities
    gaps = research_cache.get("backlink_prospects", [])
    for opp in gaps:
        if not can_send(client_id):
            break
        sent = _ingest_and_pitch(
            sb, client_id, creds, opp,
            opportunity_type="competitor_gap",
            template_type="broken_link",  # reuse broken_link template as general pitch
            dry_run=dry_run,
        )
        if sent:
            sent_count += 1

    # Ingest journalist opportunities
    journalists = research_cache.get("journalist_opportunities", [])
    for opp in journalists:
        if not can_send(client_id):
            break
        sent = _ingest_and_pitch(
            sb, client_id, creds, opp,
            opportunity_type="journalist",
            template_type="haro_pitch",
            dry_run=dry_run,
        )
        if sent:
            sent_count += 1

    if sent_count:
        print(f"  [outreach] Sent {sent_count} new pitches")
    return sent_count


def _ingest_and_pitch(sb, client_id, creds, opp, opportunity_type, template_type, dry_run):
    """Insert a target (dedup by client_id + target_url), then send initial pitch if new."""
    target_url = opp.get("page_url") or opp.get("url") or ""
    if not target_url:
        return False

    contact_email = opp.get("contact_email") or opp.get("email")
    if not contact_email:
        return False

    # Dedup: try insert, skip if already exists
    target_row = {
        "client_id": str(client_id),
        "target_url": target_url,
        "target_domain": _extract_domain(target_url),
        "opportunity_type": opportunity_type,
        "contact_email": contact_email,
        "contact_name": opp.get("contact_name") or opp.get("name"),
        "relevance_score": opp.get("relevance_score", 5),
        "context": opp.get("context") or opp.get("reason", "")[:500],
        "status": "new",
    }

    try:
        resp = sb.table("backlink_targets").upsert(
            target_row, on_conflict="client_id,target_url"
        ).execute()
        if not resp.data:
            return False
        target_id = resp.data[0]["id"]
        status = resp.data[0].get("status", "new")
    except Exception as e:
        print(f"  [outreach] Target insert failed: {e}")
        return False

    # Only pitch if status is "new" (not already contacted)
    if status != "new":
        return False

    # Build email from template
    contact_name = opp.get("contact_name") or opp.get("name")
    our_url = "https://echolocalagency.com"

    if template_type == "broken_link":
        subject, body = TEMPLATES["broken_link"](
            contact_name=contact_name,
            contact_url=target_url,
            broken_url=opp.get("broken_url", target_url),
            our_url=our_url,
            our_title="Echo Local - SEO for Home Service Businesses",
        )
    elif template_type == "brand_mention":
        subject, body = TEMPLATES["brand_mention"](
            contact_name=contact_name,
            contact_url=target_url,
            mention_context=opp.get("context", ""),
            our_url=our_url,
        )
    elif template_type == "haro_pitch":
        subject, body = TEMPLATES["haro_pitch"](
            journalist_name=contact_name,
            query_topic=opp.get("topic") or opp.get("query", "local SEO"),
            pitch_body=opp.get("pitch", "We build automated SEO systems for home service businesses in San Diego. Happy to share data and results."),
        )
    else:
        return False

    result = send_email(
        client_id=client_id,
        creds=creds,
        to_email=contact_email,
        subject=subject,
        body=body,
        target_id=target_id,
        template_type=template_type,
        followup_number=0,
        dry_run=dry_run,
    )

    if result.get("status") in ("sent", "dry_run"):
        # Update target status
        try:
            sb.table("backlink_targets").update(
                {"status": "contacted"}
            ).eq("id", target_id).execute()
        except Exception:
            pass
        return True

    return False


def _extract_domain(url):
    """Extract domain from URL."""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc or url
    except Exception:
        return url
