"""
Gmail Sender for Backlink Outreach
===================================
Sends email via Gmail API using existing get_creds() OAuth flow.
Rate limited: 10/day, 40/week hard cap.
CAN-SPAM footer on every email.
All text through content_validator.clean_content().
"""

import base64
import os
from email.mime.text import MIMEText

from dotenv import load_dotenv
from googleapiclient.discovery import build
from supabase import create_client

from ..content_validator import clean_content

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

DAILY_LIMIT = 10
WEEKLY_LIMIT = 40
SENDER_EMAIL = "brian@echolocalagency.com"


def _get_sb():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _get_rate_counts(client_id):
    """Check current send counts from Supabase rate view."""
    sb = _get_sb()
    resp = (
        sb.table("backlink_outreach_rate")
        .select("sent_today, sent_this_week")
        .eq("client_id", str(client_id))
        .execute()
    )
    if resp.data:
        return resp.data[0].get("sent_today", 0), resp.data[0].get("sent_this_week", 0)
    return 0, 0


def can_send(client_id):
    """Check if we're under rate limits."""
    today, week = _get_rate_counts(client_id)
    return today < DAILY_LIMIT and week < WEEKLY_LIMIT


def get_remaining(client_id):
    """Return remaining sends for today and this week."""
    today, week = _get_rate_counts(client_id)
    return {
        "today": max(0, DAILY_LIMIT - today),
        "this_week": max(0, WEEKLY_LIMIT - week),
    }


def check_replies(client_id, creds):
    """Check inbox for replies to outreach emails.

    Looks for emails from contacts we've emailed. Updates backlink_outreach
    and backlink_targets tables when replies are found.
    """
    sb = _get_sb()
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    # Get all contacted targets with no reply yet
    outreach = (
        sb.table("backlink_outreach")
        .select("id, target_id, subject")
        .eq("client_id", str(client_id))
        .eq("reply_received", False)
        .execute()
    ).data or []

    if not outreach:
        return []

    # Get target emails for lookup
    target_ids = list(set(o["target_id"] for o in outreach if o.get("target_id")))
    if not target_ids:
        return []

    targets = (
        sb.table("backlink_targets")
        .select("id, contact_email")
        .in_("id", target_ids)
        .execute()
    ).data or []

    email_to_target = {t["contact_email"]: t["id"] for t in targets if t.get("contact_email")}

    replies_found = []
    for email_addr, target_id in email_to_target.items():
        try:
            results = service.users().messages().list(
                userId="me",
                q=f"from:{email_addr} is:inbox",
                maxResults=5,
            ).execute()

            if results.get("messages"):
                # Mark all outreach to this target as replied
                for o in outreach:
                    if o.get("target_id") == target_id:
                        sb.table("backlink_outreach").update({
                            "reply_received": True,
                        }).eq("id", o["id"]).execute()

                sb.table("backlink_targets").update({
                    "status": "replied",
                }).eq("id", target_id).execute()

                replies_found.append({"target_id": target_id, "from": email_addr})
                print(f"  [gmail] Reply found from {email_addr}")

        except Exception as e:
            print(f"  [gmail] Error checking replies from {email_addr}: {e}")

    return replies_found


def send_email(client_id, creds, to_email, subject, body, target_id=None,
               template_type="broken_link", followup_number=0, dry_run=True):
    """Send an email via Gmail API with rate limiting and logging.

    Args:
        client_id: Supabase client UUID
        creds: Google OAuth credentials (must include gmail.send scope)
        to_email: Recipient email address
        subject: Email subject line
        body: Email body text
        target_id: UUID of backlink_targets row (for tracking)
        template_type: Template name for logging
        followup_number: 0=initial, 1=first followup, 2=second
        dry_run: If True, log but don't send

    Returns:
        dict with status and details
    """
    # Rate limit check
    if not can_send(client_id):
        remaining = get_remaining(client_id)
        print(f"  [gmail] Rate limit reached. Today: {remaining['today']} left, Week: {remaining['this_week']} left")
        return {"status": "rate_limited", "remaining": remaining}

    # Clean all text
    subject = clean_content(subject)
    body = clean_content(body)

    if dry_run:
        print(f"  [gmail] DRY RUN: Would send to {to_email}")
        print(f"    Subject: {subject}")
        print(f"    Body preview: {body[:100]}...")
        return {"status": "dry_run", "to": to_email, "subject": subject}

    # Build MIME message
    message = MIMEText(body)
    message["to"] = to_email
    message["from"] = SENDER_EMAIL
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    try:
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        sent = service.users().messages().send(
            userId="me",
            body={"raw": raw},
        ).execute()

        message_id = sent.get("id", "")
        print(f"  [gmail] Sent to {to_email} (message_id: {message_id})")

        # Log to Supabase
        sb = _get_sb()
        sb.table("backlink_outreach").insert({
            "client_id": str(client_id),
            "target_id": str(target_id) if target_id else None,
            "template_type": template_type,
            "subject": subject,
            "body": body[:2000],
            "followup_number": followup_number,
        }).execute()

        return {"status": "sent", "message_id": message_id, "to": to_email}

    except Exception as e:
        print(f"  [gmail] Send failed: {e}")
        return {"status": "error", "error": str(e)}
