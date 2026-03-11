"""
Seed Directories
================
One-time script: seeds 55 directories into the directories table in Supabase.
Mix of universal directories, trade-specific (turf, pressure washing, landscaping),
and industry aggregators.

Tier definitions (hybrid):
  Tier 1: DA 50+, requires verification/accreditation, manual-only
  Tier 2: DA 30-50, needs review/approval, semi-auto
  Tier 3: DA 10-30, open registration, full auto eligible

Usage:
    python3 -m scripts.seo_engine.seed_directories
"""

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def _get_supabase():
    """Returns a Supabase client using env vars."""
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


# fmt: off
DIRECTORIES = [
    # === TIER 1: DA 50+, manual-only premium (15 directories) ===
    {"name": "Google Business Profile", "domain": "google.com", "submission_url": "https://business.google.com/", "tier": 1, "trades": [], "da_score": 100, "submission_method": "manual"},
    {"name": "Yelp", "domain": "yelp.com", "submission_url": "https://biz.yelp.com/signup", "tier": 1, "trades": [], "da_score": 94, "submission_method": "web_form"},
    {"name": "Better Business Bureau", "domain": "bbb.org", "submission_url": "https://www.bbb.org/get-accredited", "tier": 1, "trades": [], "da_score": 91, "submission_method": "manual"},
    {"name": "Facebook", "domain": "facebook.com", "submission_url": "https://www.facebook.com/pages/create/", "tier": 1, "trades": [], "da_score": 96, "submission_method": "web_form"},
    {"name": "Instagram", "domain": "instagram.com", "submission_url": "https://www.instagram.com/accounts/emailsignup/", "tier": 1, "trades": [], "da_score": 95, "submission_method": "manual"},
    {"name": "LinkedIn", "domain": "linkedin.com", "submission_url": "https://www.linkedin.com/company/setup/new/", "tier": 1, "trades": [], "da_score": 98, "submission_method": "web_form"},
    {"name": "Apple Maps Connect", "domain": "mapsconnect.apple.com", "submission_url": "https://mapsconnect.apple.com/", "tier": 1, "trades": [], "da_score": 100, "submission_method": "manual"},
    {"name": "Bing Places", "domain": "bingplaces.com", "submission_url": "https://www.bingplaces.com/", "tier": 1, "trades": [], "da_score": 52, "submission_method": "web_form"},
    {"name": "Angi", "domain": "angi.com", "submission_url": "https://www.angi.com/pro/signup", "tier": 1, "trades": ["pressure_washing", "turf", "landscaping"], "da_score": 80, "submission_method": "web_form"},
    {"name": "HomeAdvisor", "domain": "homeadvisor.com", "submission_url": "https://pro.homeadvisor.com/", "tier": 1, "trades": ["pressure_washing", "turf", "landscaping"], "da_score": 78, "submission_method": "web_form"},
    {"name": "Houzz", "domain": "houzz.com", "submission_url": "https://www.houzz.com/professionals/signup", "tier": 1, "trades": ["pressure_washing", "turf", "landscaping"], "da_score": 89, "submission_method": "web_form"},
    {"name": "Thumbtack", "domain": "thumbtack.com", "submission_url": "https://www.thumbtack.com/pro/signup", "tier": 1, "trades": ["pressure_washing", "turf", "landscaping"], "da_score": 80, "submission_method": "web_form"},
    {"name": "Nextdoor", "domain": "nextdoor.com", "submission_url": "https://business.nextdoor.com/", "tier": 1, "trades": [], "da_score": 82, "submission_method": "web_form"},
    {"name": "Foursquare", "domain": "foursquare.com", "submission_url": "https://foursquare.com/business/listings", "tier": 1, "trades": [], "da_score": 90, "submission_method": "web_form"},
    {"name": "YellowPages", "domain": "yellowpages.com", "submission_url": "https://www.yellowpages.com/free-business-listing", "tier": 1, "trades": [], "da_score": 85, "submission_method": "web_form"},

    # === TIER 2: DA 30-50, semi-auto (20 directories) ===
    {"name": "Expertise.com", "domain": "expertise.com", "submission_url": "https://www.expertise.com/claim", "tier": 2, "trades": ["pressure_washing", "turf", "landscaping"], "da_score": 48, "submission_method": "web_form"},
    {"name": "UpCity", "domain": "upcity.com", "submission_url": "https://upcity.com/signup", "tier": 2, "trades": [], "da_score": 45, "submission_method": "web_form"},
    {"name": "Bark", "domain": "bark.com", "submission_url": "https://www.bark.com/en/us/register/pro/", "tier": 2, "trades": ["pressure_washing", "turf", "landscaping"], "da_score": 47, "submission_method": "web_form"},
    {"name": "Clutch", "domain": "clutch.co", "submission_url": "https://clutch.co/register", "tier": 2, "trades": [], "da_score": 62, "submission_method": "web_form"},
    {"name": "MapQuest", "domain": "mapquest.com", "submission_url": "https://www.mapquest.com/place/add", "tier": 2, "trades": [], "da_score": 72, "submission_method": "web_form"},
    {"name": "Superpages", "domain": "superpages.com", "submission_url": "https://www.superpages.com/free-business-listing", "tier": 2, "trades": [], "da_score": 55, "submission_method": "web_form"},
    {"name": "CitySearch", "domain": "citysearch.com", "submission_url": "https://www.citysearch.com/claim", "tier": 2, "trades": [], "da_score": 45, "submission_method": "web_form"},
    {"name": "Alignable", "domain": "alignable.com", "submission_url": "https://www.alignable.com/register", "tier": 2, "trades": [], "da_score": 42, "submission_method": "web_form"},
    {"name": "Merchant Circle", "domain": "merchantcircle.com", "submission_url": "https://www.merchantcircle.com/signup", "tier": 2, "trades": [], "da_score": 40, "submission_method": "web_form"},
    {"name": "Birdeye", "domain": "birdeye.com", "submission_url": "https://birdeye.com/signup", "tier": 2, "trades": [], "da_score": 48, "submission_method": "web_form"},
    {"name": "Podium", "domain": "podium.com", "submission_url": "https://www.podium.com/pricing/", "tier": 2, "trades": [], "da_score": 46, "submission_method": "web_form"},
    {"name": "NiceJob", "domain": "nicejob.com", "submission_url": "https://nicejob.com/signup", "tier": 2, "trades": [], "da_score": 32, "submission_method": "web_form"},
    {"name": "Crunchbase", "domain": "crunchbase.com", "submission_url": "https://www.crunchbase.com/register", "tier": 2, "trades": [], "da_score": 85, "submission_method": "web_form"},
    {"name": "DesignRush", "domain": "designrush.com", "submission_url": "https://www.designrush.com/agency/register", "tier": 2, "trades": [], "da_score": 42, "submission_method": "web_form"},
    {"name": "GoodFirms", "domain": "goodfirms.co", "submission_url": "https://www.goodfirms.co/signup", "tier": 2, "trades": [], "da_score": 45, "submission_method": "web_form"},
    {"name": "ProMatcher", "domain": "promatcher.com", "submission_url": "https://www.promatcher.com/contractors/signup", "tier": 2, "trades": ["pressure_washing", "turf", "landscaping"], "da_score": 34, "submission_method": "web_form"},
    {"name": "GuildQuality", "domain": "guildquality.com", "submission_url": "https://www.guildquality.com/get-started", "tier": 2, "trades": ["pressure_washing", "landscaping"], "da_score": 36, "submission_method": "web_form"},
    {"name": "FindAContractor", "domain": "findacontractor.com", "submission_url": "https://www.findacontractor.com/register", "tier": 2, "trades": ["pressure_washing", "landscaping"], "da_score": 30, "submission_method": "web_form"},
    {"name": "LawnStarter", "domain": "lawnstarter.com", "submission_url": "https://www.lawnstarter.com/pro", "tier": 2, "trades": ["turf", "landscaping"], "da_score": 42, "submission_method": "web_form"},
    {"name": "GreenPal", "domain": "yourgreenpal.com", "submission_url": "https://www.yourgreenpal.com/vendor/signup", "tier": 2, "trades": ["turf", "landscaping"], "da_score": 35, "submission_method": "web_form"},

    # === TIER 3: DA 10-30, auto-eligible (20 directories) ===
    {"name": "Manta", "domain": "manta.com", "submission_url": "https://www.manta.com/claim", "tier": 3, "trades": [], "da_score": 55, "submission_method": "web_form"},
    {"name": "Hotfrog", "domain": "hotfrog.com", "submission_url": "https://www.hotfrog.com/add-business", "tier": 3, "trades": [], "da_score": 50, "submission_method": "web_form"},
    {"name": "EZLocal", "domain": "ezlocal.com", "submission_url": "https://www.ezlocal.com/signup", "tier": 3, "trades": [], "da_score": 28, "submission_method": "web_form"},
    {"name": "Local.com", "domain": "local.com", "submission_url": "https://www.local.com/business/add", "tier": 3, "trades": [], "da_score": 42, "submission_method": "web_form"},
    {"name": "ShowMeLocal", "domain": "showmelocal.com", "submission_url": "https://www.showmelocal.com/Register.aspx", "tier": 3, "trades": [], "da_score": 25, "submission_method": "web_form"},
    {"name": "USCity.net", "domain": "uscity.net", "submission_url": "https://www.uscity.net/add-listing", "tier": 3, "trades": [], "da_score": 18, "submission_method": "web_form"},
    {"name": "BrownBook", "domain": "brownbook.net", "submission_url": "https://www.brownbook.net/account/add_business/", "tier": 3, "trades": [], "da_score": 42, "submission_method": "web_form"},
    {"name": "Spoke", "domain": "spoke.com", "submission_url": "https://www.spoke.com/company/add", "tier": 3, "trades": [], "da_score": 38, "submission_method": "web_form"},
    {"name": "Cylex", "domain": "cylex.us.com", "submission_url": "https://www.cylex.us.com/add-company.html", "tier": 3, "trades": [], "da_score": 24, "submission_method": "web_form"},
    {"name": "iBegin", "domain": "ibegin.com", "submission_url": "https://www.ibegin.com/directory/us/", "tier": 3, "trades": [], "da_score": 22, "submission_method": "web_form"},
    {"name": "Tupalo", "domain": "tupalo.co", "submission_url": "https://tupalo.co/signup", "tier": 3, "trades": [], "da_score": 24, "submission_method": "web_form"},
    {"name": "Fyple", "domain": "fyple.com", "submission_url": "https://www.fyple.com/add-business/", "tier": 3, "trades": [], "da_score": 20, "submission_method": "web_form"},
    {"name": "CitySquares", "domain": "citysquares.com", "submission_url": "https://www.citysquares.com/signup", "tier": 3, "trades": [], "da_score": 35, "submission_method": "web_form"},
    {"name": "Lawn Love", "domain": "lawnlove.com", "submission_url": "https://lawnlove.com/pro", "tier": 3, "trades": ["turf", "landscaping"], "da_score": 30, "submission_method": "web_form"},
    {"name": "TurfMutt", "domain": "turfmutt.com", "submission_url": "https://www.turfmutt.com/find-a-pro", "tier": 3, "trades": ["turf", "landscaping"], "da_score": 20, "submission_method": "web_form"},
    {"name": "PressureWashingResource", "domain": "pressurewashingresource.com", "submission_url": "https://www.pressurewashingresource.com/directory/add", "tier": 3, "trades": ["pressure_washing"], "da_score": 15, "submission_method": "web_form"},
    {"name": "PowerWashFinder", "domain": "powerwashfinder.com", "submission_url": "https://www.powerwashfinder.com/add-business", "tier": 3, "trades": ["pressure_washing"], "da_score": 12, "submission_method": "web_form"},
    {"name": "n49", "domain": "n49.com", "submission_url": "https://www.n49.com/add-business", "tier": 3, "trades": [], "da_score": 28, "submission_method": "web_form"},
    {"name": "Opendi", "domain": "opendi.us", "submission_url": "https://www.opendi.us/add-business/", "tier": 3, "trades": [], "da_score": 18, "submission_method": "web_form"},
    {"name": "Hub.biz", "domain": "hub.biz", "submission_url": "https://www.hub.biz/add-business", "tier": 3, "trades": [], "da_score": 15, "submission_method": "web_form"},
]
# fmt: on


def seed_directories():
    """Seed all directories into Supabase."""
    sb = _get_supabase()

    tier_counts = {1: 0, 2: 0, 3: 0}

    for d in DIRECTORIES:
        row = {
            "name": d["name"],
            "domain": d["domain"],
            "submission_url": d.get("submission_url"),
            "tier": d["tier"],
            "trades": d.get("trades", []),
            "da_score": d.get("da_score"),
            "submission_method": d.get("submission_method", "web_form"),
            "captcha_status": "unknown",
        }

        sb.table("directories").upsert(row, on_conflict="domain").execute()
        tier_counts[d["tier"]] += 1
        print(f"  [OK] {d['name']:<30} (Tier {d['tier']}, DA {d.get('da_score', '?')})")

    total = len(DIRECTORIES)
    print(f"\nSeeded {total} directories "
          f"(Tier 1: {tier_counts[1]}, Tier 2: {tier_counts[2]}, Tier 3: {tier_counts[3]})")
    return total


if __name__ == "__main__":
    print("=== Seeding Directories ===\n")
    count = seed_directories()
    print(f"\n=== Done: {count} directories seeded ===")
