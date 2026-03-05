"""
GBP Media Uploader
==================
Uploads photos to Google Business Profile via the My Business API v1.
Slow-drip strategy: 2-3 photos per cycle, rate limited to 3/week.

Auth: existing business.manage scope covers media uploads.
"""

import json
import os
import requests
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

load_dotenv()


def _get_access_token():
    """Get a fresh access token using the stored refresh token."""
    creds = Credentials(
        token=None,
        refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        token_uri="https://oauth2.googleapis.com/token",
    )
    creds.refresh(Request())
    return creds.token


def _find_account_for_location(token, location_id):
    """Find the account that owns a location.

    The v1 media endpoint requires the full resource path:
    accounts/{accountId}/locations/{locationId}/media

    Args:
        token: OAuth access token
        location_id: Just the numeric location ID

    Returns:
        Full resource name like "accounts/123/locations/456" or None
    """
    headers = {"Authorization": f"Bearer {token}"}

    # List accounts
    resp = requests.get(
        "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
        headers=headers,
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"  [gbp_media] Failed to list accounts ({resp.status_code}): {resp.text[:200]}")
        return None

    accounts = resp.json().get("accounts", [])
    if not accounts:
        print("  [gbp_media] No GBP accounts found")
        return None

    # Check each account for the location
    for account in accounts:
        account_name = account["name"]  # e.g. "accounts/123456"
        loc_resp = requests.get(
            f"https://mybusinessbusinessinformation.googleapis.com/v1/{account_name}/locations",
            headers=headers,
            params={"readMask": "name"},
            timeout=30,
        )
        if loc_resp.status_code != 200:
            continue

        locations = loc_resp.json().get("locations", [])
        for loc in locations:
            # loc["name"] is like "locations/456" or the full path
            loc_name = loc.get("name", "")
            if location_id in loc_name:
                return f"{account_name}/{loc_name}"

    print(f"  [gbp_media] Could not find location {location_id} in any account")
    return None


def upload_photo(location_id, photo_path, category="EXTERIOR",
                 description="", dry_run=True):
    """Upload a photo to GBP.

    Args:
        location_id: GBP location ID (e.g. "locations/381063877...")
        photo_path: Local path to the photo file
        category: Media category - EXTERIOR, INTERIOR, PRODUCT, AT_WORK, TEAMS
        description: Photo description
        dry_run: If True, skips the actual upload

    Returns:
        dict with status and media_name (GBP's ID for the uploaded media)
    """
    photo_path = Path(photo_path)
    if not photo_path.exists():
        return {"status": "error", "reason": f"Photo not found: {photo_path}"}

    if dry_run:
        print(f"  [gbp_media] DRY RUN: Would upload {photo_path.name} to {location_id}")
        return {"status": "dry_run", "photo": photo_path.name}

    token = _get_access_token()

    # Extract numeric location ID
    loc_num = location_id.replace("locations/", "")

    # Find the full account/location resource path
    full_resource = _find_account_for_location(token, loc_num)
    if not full_resource:
        return {"status": "error", "reason": f"Could not resolve account for {location_id}"}

    # Read photo bytes
    photo_bytes = photo_path.read_bytes()

    try:
        # GBP Media API v1 endpoint
        url = f"https://mybusiness.googleapis.com/v1/{full_resource}/media"

        create_payload = {
            "mediaFormat": "PHOTO",
            "locationAssociation": {
                "category": category,
            },
        }

        # Upload using multipart: metadata + photo bytes
        boundary = "----GBPMediaBoundary"
        body = (
            f"--{boundary}\r\n"
            f"Content-Type: application/json\r\n\r\n"
            f"{json.dumps(create_payload)}\r\n"
            f"--{boundary}\r\n"
            f"Content-Type: image/jpeg\r\n\r\n"
        ).encode("utf-8") + photo_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

        upload_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/related; boundary={boundary}",
        }

        resp = requests.post(url, headers=upload_headers, data=body, timeout=60)

        if resp.status_code in (200, 201):
            data = resp.json()
            media_name = data.get("name", "")
            print(f"  [gbp_media] Uploaded {photo_path.name}: {media_name}")
            return {
                "status": "uploaded",
                "media_name": media_name,
                "photo": photo_path.name,
            }
        else:
            print(f"  [gbp_media] Upload failed ({resp.status_code}): {resp.text[:200]}")
            return {
                "status": "error",
                "reason": f"API error {resp.status_code}: {resp.text[:200]}",
            }

    except Exception as e:
        print(f"  [gbp_media] Upload error: {e}")
        return {"status": "error", "reason": str(e)}


def execute_gbp_photo(action, client, website_path, dry_run=True):
    """Execute a gbp_photo action from the brain.

    Args:
        action: Brain action dict with filename, category, description
        client: Client config dict
        website_path: Path to website root
        dry_run: If True, skips actual upload

    Returns:
        Result dict with status and media_name
    """
    location_id = client.get("gbp_location", "")
    if not location_id:
        return {"status": "error", "reason": "No GBP location configured"}

    filename = action.get("filename", "")
    if not filename:
        return {"status": "error", "reason": "No filename specified"}

    # Find the photo in the website's blog/images directory
    website_path = Path(website_path)
    images_dir = website_path / "blog" / "images"
    photo_path = images_dir / filename

    if not photo_path.exists():
        # Try fuzzy match: brain may reference a filename that differs
        # from disk due to manifest/rename desync (e.g. with/without "img-")
        stem_nums = "".join(c for c in Path(filename).stem if c.isdigit())
        if stem_nums and images_dir.exists():
            candidates = [f for f in images_dir.iterdir()
                          if f.suffix == ".jpg" and stem_nums in f.stem]
            if len(candidates) == 1:
                photo_path = candidates[0]
                print(f"  [gbp_media] Fuzzy matched {filename} -> {photo_path.name}")

    if not photo_path.exists():
        return {"status": "error", "reason": f"Photo not found: {photo_path}"}

    category = action.get("category", "AT_WORK")
    description = action.get("description", "")

    result = upload_photo(
        location_id=location_id,
        photo_path=photo_path,
        category=category,
        description=description,
        dry_run=dry_run,
    )

    # Mark as uploaded in manifest if successful
    if result.get("status") == "uploaded":
        from ..photo_manager import mark_as_gbp_uploaded
        # Find the drive_id from the manifest by filename
        drive_id = action.get("drive_id", "")
        if drive_id:
            mark_as_gbp_uploaded(client["slug"], drive_id)

    return result
