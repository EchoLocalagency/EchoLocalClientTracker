"""
GBP Media Uploader
==================
Uploads photos to Google Business Profile via the My Business API v4 sourceUrl method.
Slow-drip strategy: 2-3 photos per cycle, rate limited to 3/week.

Flow: local photo -> Supabase storage (temp) -> GBP sourceUrl -> cleanup.
The v4 bytes upload (3-step) has a known Google bug (500 on create).
The sourceUrl method works reliably when hosted on Supabase storage.
"""

import json
import os
import requests
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from supabase import create_client

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


def _get_supabase():
    """Get a Supabase client for temp photo hosting."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


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


def upload_photo(location_id, photo_path, category="ADDITIONAL",
                 description="", dry_run=True, supabase_url=None):
    """Upload a photo to GBP via sourceUrl.

    If supabase_url is provided (pre-staged by sync_photos_to_supabase.py),
    uses it directly. Otherwise uploads to Supabase as a temp file.

    Args:
        location_id: GBP location ID (e.g. "locations/381063877...")
        photo_path: Local path to the photo file
        category: Media category - ADDITIONAL, INTERIOR, AT_WORK, TEAMS, etc.
        description: Photo description
        dry_run: If True, skips the actual upload
        supabase_url: Pre-staged public URL (from sync pipeline)

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

    temp_storage_name = None
    try:
        # Get a public URL for the photo
        if supabase_url:
            public_url = supabase_url
            print(f"  [gbp_media] Using pre-staged URL: {public_url}")
        else:
            # Temp upload to Supabase
            sb = _get_supabase()
            temp_storage_name = f"gbp-temp-{photo_path.stem}-{os.getpid()}.jpg"
            photo_bytes = photo_path.read_bytes()
            sb.storage.from_("gbp-photos").upload(
                temp_storage_name, photo_bytes, {"content-type": "image/jpeg"}
            )
            public_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/gbp-photos/{temp_storage_name}"
            print(f"  [gbp_media] Temp hosted at: {public_url}")

        # Create media item via sourceUrl
        base_url = "https://mybusiness.googleapis.com/v4"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        create_payload = {
            "mediaFormat": "PHOTO",
            "locationAssociation": {"category": category},
            "sourceUrl": public_url,
        }
        if description:
            create_payload["description"] = description

        create_resp = requests.post(
            f"{base_url}/{full_resource}/media",
            headers=headers, json=create_payload, timeout=30
        )

        # Clean up temp file (only if we created one)
        if temp_storage_name:
            try:
                sb.storage.from_("gbp-photos").remove([temp_storage_name])
            except Exception:
                pass

        if create_resp.status_code in (200, 201):
            data = create_resp.json()
            media_name = data.get("name", "")
            print(f"  [gbp_media] Uploaded {photo_path.name}: {media_name}")
            return {
                "status": "uploaded",
                "media_name": media_name,
                "photo": photo_path.name,
            }
        else:
            print(f"  [gbp_media] Create media failed ({create_resp.status_code}): {create_resp.text[:200]}")
            return {
                "status": "error",
                "reason": f"Create media error {create_resp.status_code}: {create_resp.text[:200]}",
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

    category = action.get("category", "ADDITIONAL")
    description = action.get("description", "")

    # Check manifest for pre-staged Supabase URL
    supabase_url = None
    manifest_path = Path("/Users/brianegan/EchoLocalClientTracker/assets") / client["slug"] / "photos.json"
    if manifest_path.exists():
        import json as _json
        manifest = _json.loads(manifest_path.read_text())
        for info in manifest.values():
            if info.get("local_filename") == photo_path.name:
                supabase_url = info.get("supabase_url")
                break

    result = upload_photo(
        location_id=location_id,
        photo_path=photo_path,
        category=category,
        description=description,
        dry_run=dry_run,
        supabase_url=supabase_url,
    )

    # Mark as uploaded in manifest if successful
    if result.get("status") == "uploaded":
        from ..photo_manager import mark_as_gbp_uploaded
        drive_id = action.get("drive_id", "")
        # Fallback: look up drive_id by filename if brain didn't include it
        if not drive_id and manifest_path.exists():
            import json as _json2
            manifest = _json2.loads(manifest_path.read_text())
            for did, info in manifest.items():
                if info.get("local_filename") == photo_path.name:
                    drive_id = did
                    break
        if drive_id:
            mark_as_gbp_uploaded(client["slug"], drive_id)

    return result
