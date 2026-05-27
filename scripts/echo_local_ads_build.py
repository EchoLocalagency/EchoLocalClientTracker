#!/usr/bin/env python3
"""Build the Echo Local hyperlocal SEO Search campaign.

Creates:
- 1 shared budget ($9/day, ~$270/mo)
- 1 Search campaign (PAUSED)
- 6 ad groups, 1 per /audit/ landing page
- ~50 keywords (EXACT + PHRASE, no broad)
- 6 responsive search ads
- Geo: San Diego County (1014073)
- Lang: English (1000)
- Ad schedule: Mon-Sat 7am-8pm PT
- Sitewide negative keywords
- Conversion goal: AW form submit (already on customer level)

Customer: 8746975501 (Echo Local)
"""
from pathlib import Path
import sys

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

# ===== Step 1: Shared Budget (find existing or create) =====
print("Step 1: Setting up shared budget...")
ga_svc_b = client.get_service("GoogleAdsService")
BUDGET_RN = None
q = "SELECT campaign_budget.resource_name, campaign_budget.name FROM campaign_budget WHERE campaign_budget.name = 'Echo Local Hyperlocal SEO - Shared Budget'"
for b in ga_svc_b.search_stream(customer_id=CUSTOMER_ID, query=q):
    for r in b.results:
        BUDGET_RN = r.campaign_budget.resource_name
        print(f"  reusing existing budget: {BUDGET_RN}")
        break
    if BUDGET_RN: break
if not BUDGET_RN:
    budget_svc = client.get_service("CampaignBudgetService")
    budget_op = client.get_type("CampaignBudgetOperation")
    budget = budget_op.create
    budget.name = "Echo Local Hyperlocal SEO - Shared Budget"
    budget.amount_micros = 9_000_000
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget.explicitly_shared = False
    resp = budget_svc.mutate_campaign_budgets(customer_id=CUSTOMER_ID, operations=[budget_op])
    BUDGET_RN = resp.results[0].resource_name
    print(f"  new budget: {BUDGET_RN}")

# ===== Step 2: Search Campaign (PAUSED) =====
print("Step 2: Creating Search campaign (paused)...")
camp_svc = client.get_service("CampaignService")
camp_op = client.get_type("CampaignOperation")
camp = camp_op.create
camp.name = "Echo Local - Hyperlocal SEO - San Diego"
camp.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
camp.status = client.enums.CampaignStatusEnum.PAUSED
camp.manual_cpc.enhanced_cpc_enabled = False
camp.campaign_budget = BUDGET_RN
# Use Search network only, exclude Display + Search Partners
camp.network_settings.target_google_search = True
camp.network_settings.target_search_network = False
camp.network_settings.target_content_network = False
camp.network_settings.target_partner_search_network = False
# Geo target type: presence only, not "interest"
camp.geo_target_type_setting.positive_geo_target_type = client.enums.PositiveGeoTargetTypeEnum.PRESENCE
camp.geo_target_type_setting.negative_geo_target_type = client.enums.NegativeGeoTargetTypeEnum.PRESENCE
camp.contains_eu_political_advertising = client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
resp = camp_svc.mutate_campaigns(customer_id=CUSTOMER_ID, operations=[camp_op])
CAMP_RN = resp.results[0].resource_name
CAMP_ID = CAMP_RN.split("/")[-1]
print(f"  campaign: {CAMP_RN}")

# ===== Step 3: Geo + Language criteria =====
print("Step 3: Adding geo (San Diego County) + language (English)...")
cc_svc = client.get_service("CampaignCriterionService")
ops = []
# San Diego County geo target constant: 1014073
geo_op = client.get_type("CampaignCriterionOperation")
geo_op.create.campaign = CAMP_RN
geo_op.create.location.geo_target_constant = "geoTargetConstants/1014073"
ops.append(geo_op)
# English language: 1000
lang_op = client.get_type("CampaignCriterionOperation")
lang_op.create.campaign = CAMP_RN
lang_op.create.language.language_constant = "languageConstants/1000"
ops.append(lang_op)
# Ad schedule: Mon-Sat 7am-8pm PT
days = [
    client.enums.DayOfWeekEnum.MONDAY,
    client.enums.DayOfWeekEnum.TUESDAY,
    client.enums.DayOfWeekEnum.WEDNESDAY,
    client.enums.DayOfWeekEnum.THURSDAY,
    client.enums.DayOfWeekEnum.FRIDAY,
    client.enums.DayOfWeekEnum.SATURDAY,
]
for d in days:
    sched_op = client.get_type("CampaignCriterionOperation")
    sched_op.create.campaign = CAMP_RN
    sched_op.create.ad_schedule.day_of_week = d
    sched_op.create.ad_schedule.start_hour = 7
    sched_op.create.ad_schedule.start_minute = client.enums.MinuteOfHourEnum.ZERO
    sched_op.create.ad_schedule.end_hour = 20
    sched_op.create.ad_schedule.end_minute = client.enums.MinuteOfHourEnum.ZERO
    ops.append(sched_op)

# Negative keywords (campaign-level)
NEG_KW = [
    "jobs", "job", "career", "careers", "salary", "course", "courses",
    "training", "certification", "certified", "tutorial", "tutorials",
    "learn", "how to learn", "free seo tool", "free seo audit tool",
    "diy", "ecommerce", "shopify", "saas", "amazon", "ebay",
    "restaurant", "lawyer", "attorney", "dentist", "doctor",
    "real estate", "realtor", "wordpress plugin", "youtube",
    "tiktok", "instagram only", "facebook only",
]
for kw in NEG_KW:
    neg_op = client.get_type("CampaignCriterionOperation")
    neg_op.create.campaign = CAMP_RN
    neg_op.create.negative = True
    neg_op.create.keyword.text = kw
    neg_op.create.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
    ops.append(neg_op)

resp = cc_svc.mutate_campaign_criteria(customer_id=CUSTOMER_ID, operations=ops)
print(f"  added {len(resp.results)} criteria (1 geo, 1 lang, 6 schedule, {len(NEG_KW)} negs)")

# ===== Step 4: Ad Groups =====
print("Step 4: Creating 6 ad groups...")
AD_GROUPS = [
    # (name, slug, max_cpc_micros)
    ("Pressure Washing SEO",     "pressure-washing", 2_000_000),
    ("Landscaping SEO",          "landscaping",      2_000_000),
    ("Turf SEO",                 "turf",             1_500_000),
    ("GBP Help",                 "gbp-help",         2_000_000),
    ("Hyperlocal San Diego",     "san-diego",        1_500_000),
    ("Google Rankings (Why-Not)","google-rankings",  1_500_000),
]
ag_svc = client.get_service("AdGroupService")
ops = []
for name, slug, cpc in AD_GROUPS:
    op = client.get_type("AdGroupOperation")
    op.create.name = name
    op.create.campaign = CAMP_RN
    op.create.status = client.enums.AdGroupStatusEnum.ENABLED
    op.create.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    op.create.cpc_bid_micros = cpc
    ops.append(op)
resp = ag_svc.mutate_ad_groups(customer_id=CUSTOMER_ID, operations=ops)
AG_RN_BY_SLUG = {AD_GROUPS[i][1]: r.resource_name for i, r in enumerate(resp.results)}
for slug, rn in AG_RN_BY_SLUG.items():
    print(f"  {slug:20} -> {rn.split('/')[-1]}")

# ===== Step 5: Keywords per ad group =====
print("Step 5: Adding keywords...")
EXACT = client.enums.KeywordMatchTypeEnum.EXACT
PHRASE = client.enums.KeywordMatchTypeEnum.PHRASE
KEYWORDS = {
    "pressure-washing": [
        (EXACT,  "seo for pressure washers"),
        (EXACT,  "seo for pressure washing companies"),
        (EXACT,  "pressure washing seo"),
        (EXACT,  "pressure washing marketing"),
        (EXACT,  "marketing for pressure washing business"),
        (PHRASE, "pressure washing lead generation"),
        (PHRASE, "marketing for pressure washers"),
        (PHRASE, "pressure washing seo company"),
    ],
    "landscaping": [
        (EXACT,  "seo for landscapers"),
        (EXACT,  "seo for landscape designers"),
        (EXACT,  "landscaping marketing agency"),
        (EXACT,  "marketing for landscapers"),
        (EXACT,  "landscape design marketing"),
        (PHRASE, "marketing for landscape companies"),
        (PHRASE, "hardscape marketing"),
        (PHRASE, "landscape contractor marketing"),
    ],
    "turf": [
        (EXACT,  "seo for artificial turf installers"),
        (EXACT,  "seo for turf installers"),
        (EXACT,  "artificial turf marketing"),
        (EXACT,  "marketing for turf companies"),
        (PHRASE, "artificial turf cleaning marketing"),
        (PHRASE, "marketing for artificial turf"),
        (PHRASE, "synthetic grass installer marketing"),
    ],
    "gbp-help": [
        (EXACT,  "google business profile suspended"),
        (EXACT,  "gbp suspended help"),
        (EXACT,  "how to reinstate google business profile"),
        (EXACT,  "google business profile suspended help"),
        (PHRASE, "google business profile expert"),
        (PHRASE, "fix my google business listing"),
        (PHRASE, "gbp reinstatement"),
        (PHRASE, "google maps suspended"),
    ],
    "san-diego": [
        (EXACT,  "oceanside seo"),
        (EXACT,  "carlsbad seo"),
        (EXACT,  "encinitas seo"),
        (EXACT,  "vista seo"),
        (EXACT,  "escondido seo"),
        (EXACT,  "san marcos seo"),
        (EXACT,  "poway seo"),
        (EXACT,  "seo for san diego contractors"),
        (EXACT,  "san diego contractor marketing"),
        (PHRASE, "north county san diego seo"),
        (PHRASE, "seo agency oceanside"),
        (PHRASE, "san diego home service marketing"),
    ],
    "google-rankings": [
        (EXACT,  "why is my business not on google"),
        (EXACT,  "how to rank on google maps"),
        (EXACT,  "why am i not getting calls from google"),
        (EXACT,  "how to get my business on google"),
        (PHRASE, "how to rank higher on google"),
        (PHRASE, "google maps ranking help"),
        (PHRASE, "how to get more contractor leads from google"),
    ],
}
agc_svc = client.get_service("AdGroupCriterionService")
ops = []
for slug, kws in KEYWORDS.items():
    ag_rn = AG_RN_BY_SLUG[slug]
    for match_type, text in kws:
        op = client.get_type("AdGroupCriterionOperation")
        op.create.ad_group = ag_rn
        op.create.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        op.create.keyword.text = text
        op.create.keyword.match_type = match_type
        ops.append(op)
resp = agc_svc.mutate_ad_group_criteria(customer_id=CUSTOMER_ID, operations=ops)
print(f"  added {len(resp.results)} keywords")

# ===== Step 6: Responsive Search Ads =====
print("Step 6: Creating Responsive Search Ads...")
RSA_HEADLINES = {
    "pressure-washing": [
        "SEO for Pressure Washers",
        "Free Audit for SD Pressure Pros",
        "Local SEO for Home Service Trades",
        "First Month Free, No Contracts",
        "Get Found by SD Homeowners",
        "Pressure Washing SEO, Done Right",
        "San Diego Pressure Washing SEO",
        "Rank Page 1 on Google",
        "A Compounding SEO System",
        "Only Home Service Businesses",
        "Brian Egan, Oceanside Based",
        "Live Dashboard. Real Data.",
        "Same System As Integrity Pro",
        "No Account Managers, Just Brian",
        "See Where You Rank on Google",
    ],
    "landscaping": [
        "SEO for Landscapers in SD",
        "Free Audit, 24-Hour Turnaround",
        "Local SEO for Landscape Pros",
        "First Month Free, No Contracts",
        "Get Found by SD Homeowners",
        "Landscape Marketing, Done Right",
        "La Jolla, Del Mar, Rancho Santa Fe",
        "Rank Page 1 on Google",
        "Compounding Landscape SEO",
        "Only Home Service Businesses",
        "Brian Egan, Oceanside Based",
        "Live Dashboard. Real Data.",
        "Same System As Arcadian",
        "No Account Managers, Just Brian",
        "See Where You Rank on Google",
    ],
    "turf": [
        "SEO for Turf Installers",
        "SEO for Turf Cleaners Too",
        "Free Audit, 24-Hour Turnaround",
        "First Month Free, No Contracts",
        "Rank Page 1 for Turf Searches",
        "Synthetic Grass SEO Experts",
        "San Diego + Inland Empire",
        "Compounding SEO for Turf Pros",
        "Same System As Mr Green",
        "Same System As SoCal Turfs",
        "Only Home Service Businesses",
        "Brian Egan, Oceanside Based",
        "Live Dashboard. Real Data.",
        "No Account Managers, Just Brian",
        "See Where You Rank on Google",
    ],
    "gbp-help": [
        "GBP Suspended? Get It Back",
        "San Diego GBP Reinstatement",
        "Google Business Profile Help",
        "Reinstated in Under 24 Hours",
        "Real San Diego Case Study",
        "Free GBP Audit, 24-Hour Reply",
        "Know the Docs Google Wants",
        "Brian Egan, Oceanside Based",
        "No Account Managers, Just Brian",
        "Ongoing GBP Management Too",
        "Stop the Re-Suspension Cycle",
        "First Month Free if You Stay On",
        "CSLB + COI + CP-575 Stack",
        "Direct Cell Phone Access",
        "GBP Help for SD Contractors",
    ],
    "san-diego": [
        "Local SEO for SD Contractors",
        "Built in Oceanside, By Brian",
        "Free Audit, 24-Hour Turnaround",
        "First Month Free, No Contracts",
        "Home Service Trades Only",
        "6 Clients Across SD County",
        "Compounding SEO System",
        "Carlsbad, Vista, Encinitas, Poway",
        "Oceanside, Escondido, San Marcos",
        "Rank Page 1 on Google",
        "Live Dashboard. Real Data.",
        "No Account Managers, Just Brian",
        "Same System Our Clients Use",
        "See Where You Rank on Google",
        "Local SEO Done Right",
    ],
    "google-rankings": [
        "Why You're Not on Google",
        "Find Out in 24 Hours",
        "Free Google Visibility Audit",
        "Honest Diagnosis, No Sales Push",
        "Five Reasons SD Pros Don't Rank",
        "From Page 3 to Page 1, 8 Weeks",
        "Same System As Mr Green",
        "Built for Home Service Trades",
        "Brian Egan, Oceanside Based",
        "No Contracts, First Month Free",
        "Live Dashboard. Real Data.",
        "Stop Guessing. Get the Audit.",
        "What's Actually Broken Today",
        "What Would Actually Fix It",
        "Get Real Answers in 24 Hours",
    ],
}
RSA_DESCRIPTIONS = {
    "pressure-washing": [
        "Free SEO audit for SD pressure washers. 24-hour turnaround, no obligation. First month free.",
        "Same system that took Integrity Pro to page 1 for pressure washing San Diego. Real data, no fluff.",
        "Built by a finance grad in Oceanside who only works with home service trades. No agency overhead.",
        "You see every metric I see. Live dashboard from Google Search Console + your Business Profile.",
    ],
    "landscaping": [
        "Free SEO audit for SD landscapers and hardscapers. 24-hour turnaround. First month free.",
        "Same system Arcadian uses to rank #1 for landscaper in la jolla. La Jolla, Del Mar, RSF.",
        "Built by a finance grad in Oceanside who only works with home service trades. Talk to me directly.",
        "You see every metric I see. Live dashboard from Google Search Console + your Business Profile.",
    ],
    "turf": [
        "Free SEO audit for turf installers and cleaners. 24-hour turnaround. First month free, no contracts.",
        "Mr Green ranks #1 for turf cleaner. SoCal Turfs ranks #1 for synthetic grass. Same playbook works for you.",
        "Built by a finance grad in Oceanside who only works with home service trades. No account managers.",
        "You see every metric I see. Live dashboard from Google Search Console + your Business Profile.",
    ],
    "gbp-help": [
        "GBP suspended? Free review of your situation in 24 hours. Reinstatement support if you stay on.",
        "Real case study: Arcadian Landscape, reinstated in under 24 hours with the right document package.",
        "I know which docs Google actually wants for contractor appeals. CSLB, COI, CP-575. Most miss this.",
        "Ongoing GBP management included with SEO retainer. Stop the suspension-reinstatement cycle.",
    ],
    "san-diego": [
        "Free SEO audit for SD home service businesses. 24-hour turnaround. First month free, no contracts.",
        "I'm based in Oceanside. Six paying clients across SD County. I only work with home service trades.",
        "No account managers, no handoffs. Your contact is my cell phone. Live dashboard, real data.",
        "Same system my clients use to rank page 1. See exactly where you stand and what's possible.",
    ],
    "google-rankings": [
        "Free audit shows the exact reasons your business isn't ranking. 24-hour turnaround, no obligation.",
        "Mr Green was page 2-3 for everything. Eight weeks later, ranking #1. Real San Diego case study.",
        "Honest diagnosis: service area pages, GBP completeness, reviews, schema, citations. What's broken.",
        "If you become a client, first month is free. No contracts. You see every metric I see.",
    ],
}
PATHS_BY_SLUG = {
    "pressure-washing": ("pressure-washing", "audit"),
    "landscaping":      ("landscaping", "audit"),
    "turf":             ("turf", "audit"),
    "gbp-help":         ("gbp", "help"),
    "san-diego":        ("san-diego", "audit"),
    "google-rankings":  ("rankings", "audit"),
}
ad_svc = client.get_service("AdGroupAdService")
ops = []
for slug in KEYWORDS.keys():
    ag_rn = AG_RN_BY_SLUG[slug]
    op = client.get_type("AdGroupAdOperation")
    op.create.ad_group = ag_rn
    op.create.status = client.enums.AdGroupAdStatusEnum.ENABLED
    op.create.ad.final_urls.append(f"https://echolocalagency.com/audit/{slug}")
    rsa = op.create.ad.responsive_search_ad
    for h in RSA_HEADLINES[slug]:
        asset = client.get_type("AdTextAsset")
        asset.text = h
        rsa.headlines.append(asset)
    for d in RSA_DESCRIPTIONS[slug]:
        asset = client.get_type("AdTextAsset")
        asset.text = d
        rsa.descriptions.append(asset)
    p1, p2 = PATHS_BY_SLUG[slug]
    rsa.path1 = p1
    rsa.path2 = p2
    ops.append(op)
resp = ad_svc.mutate_ad_group_ads(customer_id=CUSTOMER_ID, operations=ops)
print(f"  created {len(resp.results)} RSAs")

# ===== Step 7: Link Conversion Goal =====
print("Step 7: Conversion goals (campaign-level inherit from customer)...")
# By default campaigns inherit account-level conversion actions. Form Submit + Phone Click
# already configured at customer level (see reference_echo_local_ads_infra). No-op here.

print("\n========================================")
print("BUILD COMPLETE -- CAMPAIGN IS PAUSED")
print("========================================")
print(f"Campaign ID: {CAMP_ID}")
print(f"Budget: $9/day shared (~$270/mo)")
print(f"Ad groups: 6")
print(f"Keywords: ~55 exact + phrase")
print(f"RSAs: 6")
print(f"Status: PAUSED (review in UI then enable)")
print(f"UI link: https://ads.google.com/aw/campaigns?ocid=8746975501&campaignId={CAMP_ID}")
