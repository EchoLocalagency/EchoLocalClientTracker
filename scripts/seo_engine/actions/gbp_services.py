"""
GBP Service Updater
===================
Updates ONE Google Business Profile service at a time, via the
My Business Business Information API.

Suspension-safety rule (added 2026-06-01 after Arcadian reinstatement):
ONE service write per action / per API call. Bulk service rewrites
(passing N services in a single update) look like a bot signature
to Google and are a known suspension trigger. The brain must propose
a separate gbp_service_update action for each service it wants to
edit. The seo_loop also throttles these so only one runs per day
per client, and there is a 2-day cooldown between consecutive
gbp_service_update calls on the same listing.

Rate limit: 1 per week (services don't change often).
"""

import os
import requests

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

load_dotenv()

API_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1"

MAX_SERVICE_NAME_LENGTH = 58
MAX_SERVICE_DESCRIPTION_LENGTH = 300

# Per-client primary GBP category (used when building freeFormServiceItem)
CATEGORY_MAP = {
    "mr-green-turf-clean": "gcid:lawn_care_service",
    "integrity-pro-washers": "gcid:pressure_washing_service",
    "socal-artificial-turfs": "gcid:landscaper",
    "az-turf-cleaning": "gcid:lawn_care_service",
}


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


def _truncate(text, limit, label=""):
    if text and len(text) > limit:
        print(f"  [gbp_services] WARNING: Truncating {label} from {len(text)} to {limit} chars")
        return text[:limit]
    return text


def update_single_service(location_id, service_name, description,
                          client_slug=None, dry_run=True):
    """Update or add ONE GBP service. Preserves all other existing services.

    This is the only sanctioned write path. Never call the underlying
    patch endpoint with more than one rewritten service in the same
    request -- bulk service edits are a known GBP suspension signal.

    Args:
        location_id: GBP location resource name (e.g. "locations/123456")
        service_name: Display name (max 58 chars)
        description: Keyword-optimized description (max 300 chars). Currently
                     stored only in metadata; Google's Label payload does not
                     accept description, but we keep it for our own logging.
        client_slug: Client slug for category lookup
        dry_run: If True, logs what would be done without making changes

    Returns:
        dict with status and details
    """
    service_name = _truncate(service_name, MAX_SERVICE_NAME_LENGTH, "service name")
    description = _truncate(description, MAX_SERVICE_DESCRIPTION_LENGTH, "service description")

    if not service_name:
        return {"status": "error", "reason": "No service_name provided"}

    if dry_run:
        print(f"  [gbp_services] DRY RUN: Would update ONE service '{service_name}' on {location_id}")
        if description:
            print(f"    description: {description[:80]}...")
        return {
            "status": "dry_run",
            "service_name": service_name,
            "service_count": 1,
        }

    # Look up category for this client
    category = CATEGORY_MAP.get(client_slug, "")
    if not category:
        current = get_current_services(location_id)
        if current:
            cat_data = current.get("categories", {}).get("primaryCategory", {})
            category = cat_data.get("name", "gcid:landscaper")
        else:
            category = "gcid:landscaper"
        print(f"  [gbp_services] Using dynamically resolved category: {category}")

    if category and not category.startswith("categories/"):
        category = f"categories/{category}"

    # Fetch the CURRENT service list so we can merge -- not replace
    current = get_current_services(location_id)
    if current is None:
        return {"status": "error", "reason": "Could not fetch current services for merge"}

    existing_items = current.get("serviceItems", []) or []

    # Find matching existing service (case-insensitive on displayName)
    target_lower = service_name.strip().lower()
    matched_index = None
    for idx, item in enumerate(existing_items):
        label = (
            item.get("freeFormServiceItem", {}).get("label", {})
            or item.get("free_form_service_item", {}).get("label", {})
        )
        existing_name = (
            label.get("displayName") or label.get("display_name") or ""
        ).strip().lower()
        if existing_name == target_lower:
            matched_index = idx
            break

    new_item = {
        "free_form_service_item": {
            "category": category,
            "label": {
                "display_name": service_name,
                "language_code": "en",
            },
        },
    }

    # Build the merged list preserving order: replace if match, else append.
    # Existing items come in TWO shapes:
    #   1. structuredServiceItem -- Google's predefined service types (e.g.
    #      job_type_id:artificial_turf_installation). Has no displayName/label.
    #   2. freeFormServiceItem -- custom services added by the owner. Has label.
    # When merging, preserve each entry's ORIGINAL structure. Previously this
    # loop force-converted everything into free_form_service_item with the
    # entry's displayName, which evaluated to empty string for structured
    # entries and caused the API to reject the whole PATCH with INVALID_ARGUMENT
    # on the new free-form slot. Bug surfaced 2026-06-03 on Ecosystem (24
    # structured services). The matched entry (if any) is replaced with
    # new_item, all others pass through untouched.
    merged = []
    for idx, item in enumerate(existing_items):
        if idx == matched_index:
            merged.append(new_item)
            continue

        if "structuredServiceItem" in item or "structured_service_item" in item:
            # Pass through unchanged. Preserve serviceTypeId so Google does
            # not see this as a different entry from what's already on file.
            merged.append(item)
            continue

        # free-form entry: re-emit with consistent snake_case payload format
        label = (
            item.get("freeFormServiceItem", {}).get("label", {})
            or item.get("free_form_service_item", {}).get("label", {})
        )
        existing_name_display = (
            label.get("displayName") or label.get("display_name") or ""
        )
        existing_cat = (
            item.get("freeFormServiceItem", {}).get("category")
            or item.get("free_form_service_item", {}).get("category")
            or category
        )
        if existing_cat and not str(existing_cat).startswith("categories/"):
            existing_cat = f"categories/{existing_cat}"

        merged.append({
            "free_form_service_item": {
                "category": existing_cat,
                "label": {
                    "display_name": existing_name_display,
                    "language_code": "en",
                },
            },
        })

    if matched_index is None:
        merged.append(new_item)
        action_label = "added"
    else:
        action_label = "replaced"

    token = _get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {"service_items": merged}

    resp = requests.patch(
        f"{API_BASE}/{location_id}",
        headers=headers,
        json=body,
        params={"updateMask": "serviceItems"},
        timeout=30,
    )

    if resp.status_code in (200, 201):
        print(f"  [gbp_services] {action_label.title()} 1 service '{service_name}' on {location_id} "
              f"(total list now {len(merged)} entries)")
        return {
            "status": "updated",
            "service_count": 1,
            "service_name": service_name,
            "merge_action": action_label,
            "total_services_after": len(merged),
        }
    else:
        print(f"  [gbp_services] Update failed ({resp.status_code}): {resp.text[:300]}")
        return {
            "status": "error",
            "reason": f"API error {resp.status_code}: {resp.text[:200]}",
        }


def execute_gbp_service_update(action, client, dry_run=True):
    """Execute a gbp_service_update action from the brain.

    NEW CONTRACT (2026-06-01): exactly ONE service per action.
    The action must specify either:
      - service_name + description (preferred), OR
      - a 'services' array with exactly one item (backwards-compat fallback).

    A 'services' array with >1 item is REJECTED. The brain must queue
    additional service edits as separate single-service actions on
    subsequent runs, throttled by the seo_loop's per-action-type
    weekly limit + per-action-type cooldown.

    Args:
        action: Brain action dict.
        client: Client config dict.
        dry_run: If True, skips actual API call.

    Returns:
        Result dict with status.
    """
    location_id = client.get("gbp_location", "")
    if not location_id:
        return {"status": "error", "reason": "No GBP location configured"}

    service_name = (action.get("service_name") or "").strip()
    description = (action.get("description") or "").strip()

    # Backwards-compat: if brain still sends 'services', it must be length 1.
    if not service_name:
        services = action.get("services", []) or []
        if len(services) == 0:
            return {"status": "error", "reason": "No service_name specified"}
        if len(services) > 1:
            print(f"  [gbp_services] BLOCKED: action proposed {len(services)} services in a single "
                  f"call. Bulk service rewrites are a GBP suspension signal. Only single-service "
                  f"updates are allowed -- the brain must queue these one at a time.")
            return {
                "status": "blocked",
                "reason": (
                    f"Bulk service rewrite blocked: {len(services)} services in one action. "
                    "Only ONE service per gbp_service_update is allowed (suspension-safety rule)."
                ),
            }
        service_name = (services[0].get("service_name") or "").strip()
        description = (services[0].get("description") or "").strip()

    if not service_name:
        return {"status": "error", "reason": "No service_name specified"}

    return update_single_service(
        location_id=location_id,
        service_name=service_name,
        description=description,
        client_slug=client.get("slug"),
        dry_run=dry_run,
    )


# ── Deprecated shim ────────────────────────────────────────────────────
def update_services(location_id, services, client_slug=None, dry_run=True):
    """DEPRECATED.

    Kept only so any stale caller fails loudly rather than silently
    issuing a bulk write. Bulk service rewrites are a GBP suspension
    signal as of 2026-06-01. Use update_single_service() instead.
    """
    print("  [gbp_services] BLOCKED: update_services() is deprecated. "
          "Bulk service rewrites are a GBP suspension signal. "
          "Use update_single_service() (one service per API call) instead.")
    return {
        "status": "blocked",
        "reason": "update_services() is deprecated -- use update_single_service() to avoid bulk-write suspension risk.",
    }
