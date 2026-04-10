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
    "socal-artificial-turfs",
    "arcadian-landscape",
    "top-tier-custom-floors",
]

# Map same_as_urls keys to directory domains for submission matching
SAME_AS_DOMAIN_MAP = {
    "yelp": "yelp.com",
    "bbb": "bbb.org",
    "facebook": "facebook.com",
    "instagram": "instagram.com",
    "gbp": "google.com",
}

# Service definitions per client slug -- these populate the client_profiles.services
# array AND determine which directory trades are relevant.
#
# Trade mapping:
#   integrity-pro-washers -> pressure_washing, home_services
#   mr-green-turf-clean   -> turf, home_services
#   az-turf-cleaning      -> turf, landscaping, home_services
#   echo-local            -> seo_agency
CLIENT_SERVICES = {
    "integrity-pro-washers": {
        "services": [
            "Pressure Washing",
            "Soft Washing",
            "House Washing",
            "Roof Cleaning",
            "Driveway Cleaning",
            "Solar Panel Cleaning",
            "Gutter Cleaning",
            "Window Cleaning",
            "Window Washing",
            "Deck Cleaning",
            "Fence Cleaning",
            "Patio Cleaning",
            "Commercial Pressure Washing",
        ],
        "trades": ["pressure_washing", "home_services"],
        "description": "Professional pressure washing and soft washing services in San Diego. We specialize in house washing, roof cleaning, driveway cleaning, solar panel cleaning, gutter cleaning, and window washing. Serving North Park, Hillcrest, La Mesa, and surrounding areas.",
        "short_description": "San Diego's trusted pressure washing and soft washing professionals.",
    },
    "mr-green-turf-clean": {
        "services": [
            "Artificial Turf Cleaning",
            "Synthetic Grass Cleaning",
            "Pet Turf Cleaning",
            "Dog Turf Sanitizing",
            "Turf Deodorizing",
            "Turf Maintenance",
            "Artificial Grass Maintenance",
        ],
        "trades": ["turf", "home_services"],
        "description": "Professional artificial turf cleaning and sanitizing services in Poway and San Diego County. We clean, deodorize, and maintain synthetic grass for residential and commercial properties. Specializing in pet turf cleaning and odor removal.",
        "short_description": "Poway's artificial turf cleaning and pet turf sanitizing experts.",
    },
    "az-turf-cleaning": {
        "services": [
            "Artificial Turf Cleaning",
            "Turf Installation",
            "Paver Installation",
            "Landscape Remodel",
            "Pergola Installation",
            "Synthetic Grass Cleaning",
            "Pet Turf Cleaning",
            "Hardscaping",
            "Outdoor Living Design",
        ],
        "trades": ["turf", "landscaping", "home_services"],
        "description": "Full-service turf cleaning, installation, and landscaping company in Mesa, AZ. We handle artificial turf cleaning, turf installation, paver installation, pergolas, and complete landscape remodels for residential and commercial properties.",
        "short_description": "Mesa AZ turf cleaning, installation, and landscaping services.",
    },
    "socal-artificial-turfs": {
        "services": [
            "Artificial Turf Installation",
            "Synthetic Grass Installation",
            "Putting Green Installation",
            "Paver Installation",
            "Pergola Installation",
            "Landscape Design",
            "Pet Turf Installation",
            "Playground Turf Installation",
        ],
        "trades": ["turf", "landscaping", "home_services"],
        "description": "SoCal Artificial Turfs provides professional artificial turf installation, paver installation, and landscape design services in San Jacinto and the Inland Empire. Serving residential and commercial properties with putting greens, pet turf, pergolas, and complete outdoor living solutions.",
        "short_description": "San Jacinto artificial turf installation and landscaping experts.",
    },
    "top-tier-custom-floors": {
        "services": [
            "Hardwood Flooring Installation",
            "Herringbone Pattern Flooring",
            "Metallic Epoxy Floors",
            "Polished Concrete",
            "Floor Sanding & Refinishing",
            "Stair Installation",
            "Laminate & Vinyl Flooring",
            "Custom Pattern Flooring",
        ],
        "trades": ["flooring", "home_services"],
        "description": "Top Tier Custom Floors provides premium custom flooring installation in San Diego County and North Orange County. Specializing in hardwood, herringbone, metallic epoxy, polished concrete, and stair installation.",
        "short_description": "Custom flooring installation in San Diego and Orange County.",
    },
    "arcadian-landscape": {
        "services": [
            "Landscape Design",
            "Landscape Construction",
            "Landscape Renovation",
            "Hardscape",
            "Paver Installation",
            "BBQ Island Installation",
            "Water Features",
            "Landscape Lighting",
            "Irrigation",
            "Artificial Grass Installation",
            "Patios & Decks",
            "Commercial Planting",
            "New Construction Landscaping",
        ],
        "trades": ["landscaping", "home_services"],
        "description": "Arcadian Landscape provides premium landscape design and construction in San Diego and North County. Over 10 years of experience, BBB A+ rated. Specializing in hardscape, water features, BBQ islands, landscape lighting, irrigation, and artificial grass installation.",
        "short_description": "San Diego landscape design, construction, and hardscape experts.",
    },
    "echo-local": {
        "services": [
            "Local SEO",
            "Google Business Profile Optimization",
            "Website Design",
            "AI Automation",
            "Content Marketing",
            "Directory Management",
            "Citation Building",
            "Review Management",
        ],
        "trades": ["seo_agency"],
        "description": "Echo Local is a San Diego SEO agency specializing in home service businesses. We build compounding systems that drive organic traffic, manage Google Business Profiles, and automate digital marketing for contractors, landscapers, and service providers.",
        "short_description": "SEO and AI automation for home service businesses in San Diego.",
    },
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

        # Get service/trade metadata for this client
        client_meta = CLIENT_SERVICES.get(slug, {})

        profile = {
            "client_id": client_id,
            "business_name": client["name"],
            "phone": client.get("phone") or None,
            "address_city": city,
            "address_state": state,
            "website": client.get("website") or None,
            "services": client_meta.get("services", []),
            "description": client_meta.get("description"),
            "short_description": client_meta.get("short_description"),
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
