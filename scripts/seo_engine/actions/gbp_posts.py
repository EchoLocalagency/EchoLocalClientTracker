"""
GBP Post Engine
===============
Creates Google Business Profile posts via raw REST API.
Uses the same auth pattern as tag_review_campaign.py.
"""

import os
import requests
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

load_dotenv()

GBP_ACCOUNT = "accounts/104544307189514761238"


def _get_gbp_token():
    """Get a fresh GBP access token."""
    creds = Credentials(
        token=None,
        refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/business.manage"],
    )
    creds.refresh(Request())
    return creds.token


def create_post(location_id, summary, cta_url, dry_run=True):
    """Create a GBP local post.

    Args:
        location_id: e.g. "locations/5141565760909944493"
        summary: Post text (100-300 words)
        cta_url: URL for the "Learn More" button
        dry_run: If True, logs content but doesn't publish

    Returns:
        dict with post_name (if published) or dry_run status
    """
    if dry_run:
        print(f"  [gbp_posts] DRY RUN - would post:")
        print(f"    Location: {location_id}")
        print(f"    Summary: {summary[:100]}...")
        print(f"    CTA: {cta_url}")
        return {"status": "dry_run", "post_name": None, "summary_preview": summary[:100]}

    token = _get_gbp_token()
    url = f"https://mybusiness.googleapis.com/v4/{GBP_ACCOUNT}/{location_id}/localPosts"

    payload = {
        "languageCode": "en",
        "summary": summary,
        "callToAction": {
            "actionType": "LEARN_MORE",
            "url": cta_url,
        },
        "topicType": "STANDARD",
    }

    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )

    if resp.status_code in (200, 201):
        data = resp.json()
        post_name = data.get("name", "")
        print(f"  [gbp_posts] Published: {post_name}")
        return {"status": "published", "post_name": post_name}
    else:
        print(f"  [gbp_posts] Failed: {resp.status_code} - {resp.text[:200]}")
        return {"status": "error", "error": resp.text[:200]}


def delete_post(location_id, post_name):
    """Delete a GBP post (for rollback)."""
    token = _get_gbp_token()
    url = f"https://mybusiness.googleapis.com/v4/{post_name}"

    resp = requests.delete(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    return resp.status_code == 200
