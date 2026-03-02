"""
Drive Auth
==========
One-time script to get a refresh token with Google Drive scope.
Run this, visit the URL in your browser, paste the auth code back.

Usage:
    python3 -m scripts.seo_engine.auth_drive
"""

import os
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# All scopes we need across the SEO engine
SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",       # GSC
    "https://www.googleapis.com/auth/analytics.readonly",        # GA4
    "https://www.googleapis.com/auth/business.manage",           # GBP
    "https://www.googleapis.com/auth/drive.readonly",            # Drive (new)
]

client_config = {
    "installed": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost:8085"],
    }
}

flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES)
creds = flow.run_local_server(port=8085, prompt="consent", access_type="offline")

print("\n--- New refresh token (copy this into your .env) ---")
print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
print("\nThis token covers: GSC, GA4, GBP, and Drive (read-only).")
print("Replace the GOOGLE_REFRESH_TOKEN line in your .env file.")
