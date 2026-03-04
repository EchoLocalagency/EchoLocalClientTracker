"""
Send HTML email via Gmail API.

First run will open a browser to authorize the gmail.send scope.
Saves token to gmail_token.json (separate from the analytics token).

Usage:
    python3 scripts/send_email.py --to helixdreamscapes@gmail.com --subject "Following up" --html reports/emails/helix-dreamscapes-followup.html
    python3 scripts/send_email.py --to helixdreamscapes@gmail.com --subject "Following up" --html reports/emails/helix-dreamscapes-followup.html --dry-run
"""

import argparse
import base64
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
TOKEN_PATH = BASE_DIR / "gmail_token.json"
SENDER = "brian@echolocalagency.com"
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def get_gmail_creds():
    """Get Gmail OAuth credentials, prompting for auth if needed."""
    creds = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            client_config = {
                "installed": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost"],
                }
            }
            flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
            creds = flow.run_local_server(port=0)

        TOKEN_PATH.write_text(creds.to_json())
        print(f"  Token saved to {TOKEN_PATH}")

    return creds


def send_html_email(to_email, subject, html_content, dry_run=False):
    """Send an HTML email via Gmail API."""
    creds = get_gmail_creds()

    if dry_run:
        print(f"\n  DRY RUN")
        print(f"  From: {SENDER}")
        print(f"  To:   {to_email}")
        print(f"  Subject: {subject}")
        print(f"  HTML length: {len(html_content)} chars")
        return {"status": "dry_run"}

    msg = MIMEMultipart("alternative")
    msg["to"] = to_email
    msg["from"] = SENDER
    msg["subject"] = subject

    # Plain text fallback
    plain = "View this email in a browser that supports HTML."
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    sent = service.users().messages().send(
        userId="me",
        body={"raw": raw},
    ).execute()

    msg_id = sent.get("id", "")
    print(f"\n  Sent to {to_email}")
    print(f"  Message ID: {msg_id}")
    return {"status": "sent", "message_id": msg_id}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send HTML email via Gmail API")
    parser.add_argument("--to", required=True, help="Recipient email")
    parser.add_argument("--subject", required=True, help="Email subject")
    parser.add_argument("--html", required=True, help="Path to HTML file")
    parser.add_argument("--dry-run", action="store_true", help="Preview without sending")
    args = parser.parse_args()

    html_path = Path(args.html)
    if not html_path.is_absolute():
        html_path = BASE_DIR / html_path

    html_content = html_path.read_text()
    result = send_html_email(args.to, args.subject, html_content, dry_run=args.dry_run)
    print(f"\n  Result: {result['status']}")
