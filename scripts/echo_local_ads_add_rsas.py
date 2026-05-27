#!/usr/bin/env python3
"""Add RSAs to the already-created Echo Local campaign.

Headline max 30 chars, description max 90 chars. Strict.
"""
from pathlib import Path

def load_env(p):
    e = {}
    for line in p.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            e[k.strip()] = v.strip().strip('"').strip("'")
    return e

env = load_env(Path.home() / "EchoLocalClientTracker" / ".env")
from google.ads.googleads.client import GoogleAdsClient

CFG = {
    "developer_token": env["GOOGLE_ADS_DEVELOPER_TOKEN"],
    "client_id": env["GOOGLE_CLIENT_ID"],
    "client_secret": env["GOOGLE_CLIENT_SECRET"],
    "refresh_token": env["GOOGLE_ADS_REFRESH_TOKEN"],
    "login_customer_id": "9350510225",
    "use_proto_plus": True,
}
CUSTOMER_ID = "8746975501"
client = GoogleAdsClient.load_from_dict(CFG)

# Get ad group resource names by name match
ga_svc = client.get_service("GoogleAdsService")
q = """SELECT ad_group.id, ad_group.name, ad_group.resource_name, campaign.name
FROM ad_group WHERE campaign.name = 'Echo Local - Hyperlocal SEO - San Diego'"""
AG_RN = {}
for batch in ga_svc.search_stream(customer_id=CUSTOMER_ID, query=q):
    for r in batch.results:
        AG_RN[r.ad_group.name] = r.ad_group.resource_name
print("Found ad groups:")
for name, rn in AG_RN.items():
    print(f"  {name} -> {rn}")

NAME_TO_SLUG = {
    "Pressure Washing SEO": "pressure-washing",
    "Landscaping SEO": "landscaping",
    "Turf SEO": "turf",
    "GBP Help": "gbp-help",
    "Hyperlocal San Diego": "san-diego",
    "Google Rankings (Why-Not)": "google-rankings",
}

# Headlines (max 30 chars each, 3-15 per ad)
HEADLINES = {
    "pressure-washing": [
        "SEO for Pressure Washers",       # 24
        "Free SD Pressure Audit",         # 22
        "Local SEO for SD Trades",        # 23
        "First Month Free",               # 16
        "Get Found by SD Homeowners",     # 26
        "Pressure Washing SEO",           # 20
        "San Diego Pressure SEO",         # 22
        "Rank Page 1 on Google",          # 21
        "Compounding SEO System",         # 22
        "Home Service Trades Only",       # 24
        "Brian Egan, Oceanside",          # 22
        "Live Dashboard. Real Data.",     # 26
        "Same System As Integrity Pro",   # 28
        "Just Brian, No Handoffs",        # 23
        "See Where You Rank",             # 19
    ],
    "landscaping": [
        "SEO for SD Landscapers",         # 22
        "Free Landscape SEO Audit",       # 24
        "La Jolla, Del Mar, RSF",         # 22
        "First Month Free",               # 16
        "Get Found by SD Homeowners",     # 26
        "Landscape Marketing",            # 19
        "San Diego Landscape SEO",        # 23
        "Rank Page 1 on Google",          # 21
        "Compounding SEO System",         # 22
        "Home Service Trades Only",       # 24
        "Brian Egan, Oceanside",          # 22
        "Live Dashboard. Real Data.",     # 26
        "Same System As Arcadian",        # 23
        "Just Brian, No Handoffs",        # 23
        "See Where You Rank",             # 19
    ],
    "turf": [
        "SEO for Turf Installers",        # 23
        "SEO for Turf Cleaners Too",      # 25
        "Free Turf SEO Audit",            # 20
        "First Month Free",               # 16
        "Rank Page 1 for Turf",           # 20
        "Synthetic Grass SEO",            # 19
        "San Diego + Inland Empire",      # 25
        "Compounding SEO for Turf",       # 24
        "Same System As Mr Green",        # 23
        "Same System As SoCal Turfs",     # 26
        "Home Service Trades Only",       # 24
        "Brian Egan, Oceanside",          # 22
        "Live Dashboard. Real Data.",     # 26
        "Just Brian, No Handoffs",        # 23
        "See Where You Rank",             # 19
    ],
    "gbp-help": [
        "GBP Suspended? Get It Back",     # 26
        "SD GBP Reinstatement",           # 20
        "Google Business Profile Help",   # 28
        "Reinstated in 24 Hours",         # 22
        "Real SD Case Study",             # 18
        "Free GBP Audit",                 # 14
        "Know What Google Wants",         # 22
        "Brian Egan, Oceanside",          # 22
        "Just Brian, No Handoffs",        # 23
        "Ongoing GBP Management",         # 22
        "Stop Re-Suspensions",            # 19
        "First Month Free",               # 16
        "CSLB + COI + CP-575 Stack",      # 25
        "Direct Cell Access",             # 18
        "GBP Help for SD Pros",           # 20
    ],
    "san-diego": [
        "Local SEO for SD Pros",          # 21
        "Built in Oceanside",             # 19
        "Free SD SEO Audit",              # 18
        "First Month Free",               # 16
        "Home Service Trades Only",       # 24
        "6 Clients in SD County",         # 22
        "Compounding SEO System",         # 22
        "Carlsbad, Vista, Encinitas",     # 26
        "Oceanside, Escondido, Poway",    # 27
        "Rank Page 1 on Google",          # 21
        "Live Dashboard. Real Data.",     # 26
        "Just Brian, No Handoffs",        # 23
        "Local SEO Done Right",           # 20
        "See Where You Rank",             # 19
        "Free Audit in 24 Hours",         # 22
    ],
    "google-rankings": [
        "Why You're Not on Google",       # 23 (apostrophe counts)
        "Find Out in 24 Hours",           # 20
        "Free Visibility Audit",          # 21
        "Honest Diagnosis",               # 17
        "5 Reasons SD Pros Don't Rank",   # 28
        "Page 3 to Page 1 in 8 Weeks",    # 27
        "Same System As Mr Green",        # 23
        "Home Service Trades Only",       # 24
        "Brian Egan, Oceanside",          # 22
        "No Contracts, First Free",       # 24
        "Live Dashboard. Real Data.",     # 26
        "Stop Guessing About SEO",        # 23
        "What's Actually Broken",         # 22
        "What Would Actually Fix It",     # 26
        "Real Answers in 24 Hours",       # 24
    ],
}

# Descriptions (max 90 chars each, 2-4 per ad)
DESCRIPTIONS = {
    "pressure-washing": [
        "Free SEO audit for SD pressure washers. 24-hour turnaround. First month free.",   # 78
        "Same system that took Integrity Pro to page 1 for pressure washing San Diego.",   # 79
        "Built in Oceanside. Home service trades only. No agency overhead.",                # 66
        "Live dashboard pulls from Google Search Console + your Business Profile.",        # 73
    ],
    "landscaping": [
        "Free SEO audit for SD landscapers and hardscapers. First month free, no contracts.", # 83
        "Same system Arcadian uses to rank #1 for landscaper in la jolla.",                # 65
        "Built in Oceanside. Home service trades only. Talk to me directly.",              # 68
        "Live dashboard pulls from Google Search Console + your Business Profile.",        # 73
    ],
    "turf": [
        "Free SEO audit for turf installers and cleaners. First month free.",              # 67
        "Mr Green ranks #1 for turf cleaner. SoCal Turfs ranks #1 for synthetic grass.",   # 79
        "Built in Oceanside. Home service trades only. No account managers.",              # 68
        "Live dashboard pulls from Google Search Console + your Business Profile.",        # 73
    ],
    "gbp-help": [
        "GBP suspended? Free review in 24 hours. Reinstatement support included.",         # 73
        "Arcadian was reinstated in under 24 hours with the right document package.",      # 77
        "I know the docs Google wants for contractor appeals. CSLB, COI, CP-575.",         # 73
        "Ongoing GBP management included with the SEO retainer.",                          # 55
    ],
    "san-diego": [
        "Free SEO audit for SD home service businesses. 24-hour turnaround.",              # 67
        "Based in Oceanside. 6 paying clients across SD County. Trades only.",             # 68
        "No account managers, no handoffs. My cell phone is your contact.",                # 66
        "Same system my clients use to rank page 1. See where you stand.",                 # 65
    ],
    "google-rankings": [
        "Free audit shows the exact reasons your business is not ranking.",                # 65
        "Mr Green was page 2-3 for everything. 8 weeks later, ranking #1.",                # 65
        "Honest diagnosis. Service area pages, GBP, reviews, schema, citations.",          # 72
        "If you become a client, first month is free. No contracts.",                      # 59
    ],
}

PATHS = {
    "pressure-washing": ("pressure", "audit"),
    "landscaping":      ("landscaping", "audit"),
    "turf":             ("turf", "audit"),
    "gbp-help":         ("gbp", "help"),
    "san-diego":        ("san-diego", "audit"),
    "google-rankings":  ("rankings", "audit"),
}

# Validate lengths client-side
problems = []
for slug, hs in HEADLINES.items():
    for h in hs:
        if len(h) > 30:
            problems.append(f"  headline too long ({len(h)}): {slug} -> {h}")
for slug, ds in DESCRIPTIONS.items():
    for d in ds:
        if len(d) > 90:
            problems.append(f"  description too long ({len(d)}): {slug} -> {d}")
if problems:
    print("CHAR LIMIT VIOLATIONS:")
    for p in problems: print(p)
    raise SystemExit(1)
print("All text within limits. Building RSAs...")

ad_svc = client.get_service("AdGroupAdService")
ops = []
for ag_name, slug in NAME_TO_SLUG.items():
    if ag_name not in AG_RN:
        print(f"  WARN: ad group '{ag_name}' not found, skipping")
        continue
    ag_rn = AG_RN[ag_name]
    op = client.get_type("AdGroupAdOperation")
    op.create.ad_group = ag_rn
    op.create.status = client.enums.AdGroupAdStatusEnum.ENABLED
    op.create.ad.final_urls.append(f"https://echolocalagency.com/audit/{slug}")
    rsa = op.create.ad.responsive_search_ad
    for h in HEADLINES[slug]:
        a = client.get_type("AdTextAsset")
        a.text = h
        rsa.headlines.append(a)
    for d in DESCRIPTIONS[slug]:
        a = client.get_type("AdTextAsset")
        a.text = d
        rsa.descriptions.append(a)
    p1, p2 = PATHS[slug]
    rsa.path1 = p1
    rsa.path2 = p2
    ops.append(op)

resp = ad_svc.mutate_ad_group_ads(customer_id=CUSTOMER_ID, operations=ops)
print(f"Created {len(resp.results)} RSAs")
for r in resp.results:
    print(f"  {r.resource_name}")
