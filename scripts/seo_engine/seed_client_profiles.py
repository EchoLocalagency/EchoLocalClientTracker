"""
Seed Client Profiles
====================
One-time script: reads clients.json and seeds client_profiles table in Supabase.
Also creates submission rows for any existing directory listings found in same_as_urls.

Usage:
    python3 -m scripts.seo_engine.seed_client_profiles
"""

import json
import os
import re

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Only seed home-service clients (skip Primal Plates -- no directory relevance)
ACTIVE_SLUGS = [
    "integrity-pro-washers",
    "mr-green-turf-clean",
    "echo-local",
    "az-turf-cleaning",
]

# Map same_as_urls keys to directory domains for submission matching
SAME_AS_DOMAIN_MAP = {
    "yelp": "yelp.com",
    "bbb": "bbb.org",
    "facebook": "facebook.com",
    "instagram": "instagram.com",
    "gbp": "google.com",
}


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def _parse_city_state(primary_market: str):
    """Parse 'City, ST' into (city, state) tuple."""
    if not primary_market:
        return None, None
    match = re.match(r"^(.+?),\s*(\w{2})$", primary_market.strip())
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return primary_market.strip(), None


def seed_profiles():
    """Seed client_profiles from clients.json."""
    sb = _get_supabase()

    clients_path = os.path.join(os.path.dirname(__file__), "..", "..", "clients.json")
    with open(clients_path, "r") as f:
        clients_json = json.load(f)

    # Get client IDs from Supabase
    db_clients = sb.table("clients").select("id, slug, name").execute()
    slug_to_id = {c["slug"]: c["id"] for c in db_clients.data}

    profiles_seeded = 0
    for client in clients_json:
        slug = client.get("slug", "")
        if slug not in ACTIVE_SLUGS:
            continue

        client_id = slug_to_id.get(slug)
        if not client_id:
            print(f"  [SKIP] {slug} -- not found in Supabase clients table")
            continue

        city, state = _parse_city_state(client.get("primary_market", ""))

        profile = {
            "client_id": client_id,
            "business_name": client["name"],
            "phone": client.get("phone") or None,
            "address_city": city,
            "address_state": state,
            "website": client.get("website") or None,
            "social_links": {},
        }

        # Build social_links from same_as_urls
        same_as = client.get("same_as_urls", {})
        for key, url in same_as.items():
            if url:
                profile["social_links"][key] = url

        sb.table("client_profiles").upsert(
            profile, on_conflict="client_id"
        ).execute()
        profiles_seeded += 1
        print(f"  [OK] Seeded profile: {client['name']}")

    print(f"\nSeeded {profiles_seeded} client profiles")
    return profiles_seeded


def seed_existing_listings():
    """Create submission rows for same_as_urls that match known directories."""
    sb = _get_supabase()

    clients_path = os.path.join(os.path.dirname(__file__), "..", "..", "clients.json")
    with open(clients_path, "r") as f:
        clients_json = json.load(f)

    # Get client IDs
    db_clients = sb.table("clients").select("id, slug").execute()
    slug_to_id = {c["slug"]: c["id"] for c in db_clients.data}

    # Get all directories indexed by domain
    dirs = sb.table("directories").select("id, domain").execute()
    domain_to_dir_id = {d["domain"]: d["id"] for d in dirs.data}

    submissions_created = 0
    for client in clients_json:
        slug = client.get("slug", "")
        if slug not in ACTIVE_SLUGS:
            continue

        client_id = slug_to_id.get(slug)
        if not client_id:
            continue

        same_as = client.get("same_as_urls", {})
        for key, url in same_as.items():
            if not url:
                continue

            # Find matching directory domain
            target_domain = SAME_AS_DOMAIN_MAP.get(key)
            if not target_domain:
                continue

            dir_id = domain_to_dir_id.get(target_domain)
            if not dir_id:
                continue

            sb.table("submissions").upsert(
                {
                    "client_id": client_id,
                    "directory_id": dir_id,
                    "status": "existing_needs_review",
                    "live_url": url,
                    "notes": f"Seeded from clients.json same_as_urls.{key}",
                },
                on_conflict="client_id,directory_id",
            ).execute()
            submissions_created += 1
            print(f"  [OK] Linked {client['name']} -> {target_domain}: {url}")

    print(f"\nCreated {submissions_created} existing listing records")
    return submissions_created


if __name__ == "__main__":
    print("=== Seeding Client Profiles ===")
    profiles = seed_profiles()
    print(f"\n=== Seeding Existing Listings ===")
    listings = seed_existing_listings()
    print(f"\n=== Done: {profiles} profiles, {listings} existing listings ===")
