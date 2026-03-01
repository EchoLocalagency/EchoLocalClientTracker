"""
GBP Q&A Seeder
==============
Seeds questions and answers on Google Business Profile.
Uses the mybusinessqanda API (confirmed enabled).
"""

import os
import time
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


def seed_qa(location_id, question, answer, dry_run=True):
    """Seed a Q&A pair on a GBP listing.

    Posts the question first, waits 2 seconds, then posts the answer.

    Args:
        location_id: e.g. "locations/5141565760909944493"
        question: The question text
        answer: The answer text
        dry_run: If True, logs but doesn't publish

    Returns:
        dict with question_name for rollback
    """
    if dry_run:
        print(f"  [gbp_qanda] DRY RUN - would seed Q&A:")
        print(f"    Q: {question}")
        print(f"    A: {answer[:100]}...")
        return {"status": "dry_run", "question_name": None}

    token = _get_gbp_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Post the question
    q_url = f"https://mybusiness.googleapis.com/v1/{location_id}/questions"
    q_resp = requests.post(
        q_url,
        headers=headers,
        json={"text": question},
        timeout=30,
    )

    if q_resp.status_code not in (200, 201):
        print(f"  [gbp_qanda] Question failed: {q_resp.status_code} - {q_resp.text[:200]}")
        return {"status": "error", "error": q_resp.text[:200]}

    question_data = q_resp.json()
    question_name = question_data.get("name", "")
    print(f"  [gbp_qanda] Question posted: {question_name}")

    # Wait before answering (avoid rate limits)
    time.sleep(2)

    # Post the answer
    a_url = f"https://mybusiness.googleapis.com/v1/{question_name}/answers"
    a_resp = requests.post(
        a_url,
        headers=headers,
        json={"text": answer},
        timeout=30,
    )

    if a_resp.status_code in (200, 201):
        print(f"  [gbp_qanda] Answer posted")
        return {"status": "published", "question_name": question_name}
    else:
        print(f"  [gbp_qanda] Answer failed: {a_resp.status_code} - {a_resp.text[:200]}")
        return {"status": "partial", "question_name": question_name, "error": a_resp.text[:200]}


def delete_question(question_name):
    """Delete a Q&A pair (for rollback)."""
    token = _get_gbp_token()
    resp = requests.delete(
        f"https://mybusiness.googleapis.com/v1/{question_name}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    return resp.status_code == 200
