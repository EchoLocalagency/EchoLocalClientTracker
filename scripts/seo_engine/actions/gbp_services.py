"""
GBP Service Updater
===================
Updates Google Business Profile services with keyword-optimized descriptions
via the My Business Business Information API.

Rate limit: 1 per week (services don't change often).
"""

import os
import requests

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

load_dotenv()

API_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1"


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


def get_current_services(location_id):
    """Fetch current services from GBP listing.

    Args:
        location_id: GBP location resource name (e.g. "locations/123456")

    Returns:
        dict with categories and services, or None on error
    """
    token = _get_access_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(
        f"{API_BASE}/{location_id}",
        headers=headers,
        params={"readMask": "categories,serviceItems"},
        timeout=30,
    )

    if resp.status_code != 200:
        print(f"  [gbp_services] Failed to fetch location ({resp.status_code}): {resp.text[:200]}")
        return None

    return resp.json()


def update_services(location_id, services, dry_run=True):
    """Update GBP services list with keyword-optimized descriptions.

    Args:
        location_id: GBP location resource name (e.g. "locations/123456")
        services: List of service dicts with keys:
            - service_name: Display name
            - description: Keyword-optimized description (max 300 chars)
        dry_run: If True, logs what would be done without making changes

    Returns:
        dict with status and details
    """
    if dry_run:
        print(f"  [gbp_services] DRY RUN: Would update {len(services)} services on {location_id}")
        for svc in services:
            print(f"    - {svc.get('service_name', '?')}: {svc.get('description', '')[:60]}...")
        return {"status": "dry_run", "service_count": len(services)}

    token = _get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Build serviceItems array in GBP format
    service_items = []
    for svc in services:
        item = {
            "freeFormServiceItem": {
                "category": "gcid:artificial_grass_installer",
                "label": {
                    "displayName": svc["service_name"],
                    "description": svc.get("description", ""),
                    "languageCode": "en",
                },
            },
        }
        service_items.append(item)

    body = {"serviceItems": service_items}

    resp = requests.patch(
        f"{API_BASE}/{location_id}",
        headers=headers,
        json=body,
        params={"updateMask": "serviceItems"},
        timeout=30,
    )

    if resp.status_code in (200, 201):
        print(f"  [gbp_services] Updated {len(services)} services on {location_id}")
        return {"status": "updated", "service_count": len(services)}
    else:
        print(f"  [gbp_services] Update failed ({resp.status_code}): {resp.text[:300]}")
        return {
            "status": "error",
            "reason": f"API error {resp.status_code}: {resp.text[:200]}",
        }


def execute_gbp_service_update(action, client, dry_run=True):
    """Execute a gbp_service_update action from the brain.

    Args:
        action: Brain action dict with services list
        client: Client config dict
        dry_run: If True, skips actual API call

    Returns:
        Result dict with status
    """
    location_id = client.get("gbp_location", "")
    if not location_id:
        return {"status": "error", "reason": "No GBP location configured"}

    services = action.get("services", [])
    if not services:
        return {"status": "error", "reason": "No services specified"}

    return update_services(location_id, services, dry_run=dry_run)
