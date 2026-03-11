# Feature Landscape: v1.2 Directory Submission & Tracking System

**Domain:** Automated local SEO citation building and directory submission tracking
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH

## Context

v1.0 shipped the SEO engine with GEO scoring, AI Overview tracking, and brain-driven content optimization. v1.1 added mention tracking and the GEO dashboard. v1.2 targets the next major backlink acquisition lever: submitting clients to 30+ niche directories that GHL/Yext does NOT cover, tracking those submissions, verifying listings, and surfacing coverage in the dashboard.

The directory master list (`.planning/research/find-a-pro-directory-master-list.md`) identifies 4 tiers of directories: manufacturer dealer locators (Tier 1), trade associations (Tier 2), home service directories (Tier 3), and government/utility directories (Tier 4). Each tier has different automation potential, cost structures, and link value.

Commercial citation building tools (BrightLocal, Whitespark, Citation Builder Pro) charge $20-$999 per submission round and focus on the ~150 directories that Yext/GHL already covers. The niche directories in our master list are NOT covered by any commercial tool -- that is the core differentiator.

## Table Stakes

Features the system is useless without. Missing any of these = might as well keep using a spreadsheet.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Client profile data store | Every submission requires NAP + descriptions + services + certifications. Without a structured profile, every submission is manual copy-paste. | LOW | Supabase table: `client_profiles` with business_name, address, city, state, zip, phone, email, website, description_short, description_long, services JSONB, certifications JSONB, year_established, license_number, service_areas JSONB. One row per client. Populated once, used for every submission. |
| Directory master list in Supabase | The master list exists in markdown but needs to be queryable -- which directories exist, what tier, what fields they need, what the submission URL is, which clients are already submitted. | LOW | Table: `directories` with name, url, submission_url, tier (1-4), category, cost, da_score, requires_client_input boolean, form_fields JSONB, notes. Seed from the existing markdown research. ~50 rows. |
| Submission tracking with status workflow | The core purpose. Without status tracking (pending/submitted/approved/rejected/verified), there is no system -- just a todo list. | MEDIUM | Table: `directory_submissions` with client_id, directory_id, status enum, submitted_at, approved_at, verified_at, live_url, notes, retry_count. Status enum: not_started, pending_client_input, submitted, pending_approval, approved, rejected, verified, delisted. |
| Per-client directory coverage view | Brian needs to see at a glance: "Mr. Green is on 18/35 directories, Integrity Pro is on 5/35." Without this, tracking is invisible. | LOW | Dashboard query: count submissions by status per client. Simple table + progress bar. Reads from `directory_submissions`. |
| Tier 1/2 recommendation surfacing | Tier 1 (manufacturer) and Tier 2 (trade association) directories require client action -- applications, membership fees, certifications. The system must surface these as actionable recommendations, not attempt to auto-submit. | LOW | Filter `directories` where requires_client_input = true. Display as checklist per client with notes on what the client needs to provide. Mark as "recommended" not "auto-submit." |

## Differentiators

Features that make this meaningfully better than a spreadsheet or manual BrightLocal workflow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Playwright auto-submission for Tier 3 directories | The single biggest time saver. Tier 3 directories (15-25 per client) are simple form fills with NAP data. Manual submission takes 5-10 min each (75-250 min per client). Playwright can submit all of them in one automated run. BrightLocal charges $2-5 per submission for this same work. | HIGH | Playwright scripts per directory. Each directory has unique form structure, so each needs a custom script (or at minimum a per-directory config). Estimate 2-4 hours to write scripts for 15-20 directories. Must handle: form field mapping, file uploads (logo), CAPTCHA detection (skip and flag for manual), confirmation page detection, error handling. Run as a Python script triggered manually or via the brain. |
| Google site: search verification | After 2-4 weeks, automatically check if submitted listings actually went live by running `site:directory.com "Business Name"`. Catches rejections and removes the need for manual checking. Zero API cost using SerpAPI or Brave. | MEDIUM | New verification module. For each submission in "submitted" or "pending_approval" status older than 14 days, run a Google site: search. If business name found on the directory domain, mark as "verified" and store the live_url. If not found after 28 days, flag for manual review. Run weekly on research days. |
| Auto-retry with escalation | Submissions that sit in "pending" for 7+ days get auto-retried. After 14 days still pending, alert Brian. Prevents submissions from silently falling through cracks -- which is the #1 failure mode of manual directory submission. | MEDIUM | Cron logic in seo_loop.py research cycle. Query submissions where status = "submitted" AND submitted_at > 7 days ago. Re-submit via Playwright. After second attempt, if still pending at 14 days, create an alert (dashboard notification or Supabase row Brian checks). |
| NAP consistency audit | Before submitting anywhere, verify the client's NAP is consistent across existing listings. Inconsistent NAP = wasted submissions (directories may reject or Google may not credit the backlink). BrightLocal charges $39+/mo for this as a separate feature. | MEDIUM | Use Brave Search or SerpAPI to search for business name + phone across known directory domains. Compare found NAP against client_profiles table. Flag mismatches. Run once during onboarding, re-run monthly. Store results in `nap_audit_results` table. |
| Backlink value tracking | Not all directory links are equal. Track DA score per directory and compute a "backlink portfolio score" showing the total and weighted link value a client has acquired. Proves ROI beyond just "you're on 25 directories." | LOW | DA scores already in the `directories` table (from master list research). Sum DA for verified submissions. Show as dashboard metric: "Total backlink value: X DA points across Y directories." Simple arithmetic on existing data. |
| Duplicate listing detection | Before submitting to a new directory, check if the client is already listed (possibly with old/wrong info). Prevents creating duplicate listings that hurt local SEO. | MEDIUM | For each directory in the master list, search for client's phone number or business name on the directory domain. If found, mark as "already_listed" with the existing URL. Offer to update rather than create new. Requires per-directory search logic. |
| Submission confirmation email processing | Many Tier 3 directories send confirmation emails that must be clicked to complete the listing. Without handling these, submissions stay in limbo. | HIGH | Would require access to a submission email inbox, parsing confirmation emails, and clicking verification links. Can use Google OAuth (already configured) with a dedicated submissions@ alias, or use Gmail API to search for confirmation patterns. Complex but high-value -- many manual citation builders cite this as their biggest time sink. |

## Anti-Features

Features to deliberately NOT build. Each represents a trap that would waste development time or create problems.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-submission to Tier 1/2 directories | Manufacturer dealer locators require real business relationships, product certifications, and sometimes fees. Auto-filling an application form is not the same as becoming a legitimate dealer. Could damage client reputation or get flagged as spam. | Surface as recommendations with clear instructions. Provide the client profile data to make manual application easier. Track submission status once client submits. |
| CAPTCHA solving service integration | Services like 2Captcha or Anti-Captcha cost money per solve, introduce a third-party dependency, and CAPTCHAs on directory forms usually indicate the directory actively fights automated submissions. Bypassing this is adversarial. | If Playwright encounters a CAPTCHA, skip that directory and flag it for manual submission. Most high-value Tier 3 directories do NOT have CAPTCHAs. |
| Mass submission to low-DA directories (DA < 10) | Submitting to hundreds of low-quality directories is a pre-2015 SEO tactic. Google has repeatedly penalized this pattern. It looks spammy and provides negligible link value. | Focus on the curated 35-50 directories in the master list. Quality over quantity. The master list already filters for DA 10+. |
| Real-time submission status dashboard | Submissions take days to weeks to process. Checking status in real-time provides zero additional value and creates false urgency. | Weekly batch verification via Google site: search. Dashboard shows last-known status, updated on research days. |
| Automatic NAP updates on third-party directories | Updating existing listings on directories we don't control requires login credentials, which we don't have. Attempting to "claim" or "update" listings programmatically is ToS-violating on most platforms. | Flag NAP inconsistencies for manual correction. Provide the correct NAP data and the URL to the incorrect listing. Brian or client fixes manually. |
| Yext/GHL directory overlap | The master list explicitly excludes directories Yext/GHL covers (Google, Facebook, Yelp, Apple Maps, etc.). Building submission automation for directories that are already managed by existing tools wastes effort and risks creating conflicts. | Trust GHL Listings for the 150+ directories it covers. This system handles only the gaps. |
| Full Playwright browser farm / parallel submission | Running 10+ browser instances in parallel to "speed up" submissions adds infrastructure complexity (headless browser management, proxy rotation, memory usage) for minimal gain. Submitting 15-25 directories sequentially takes under an hour. | Sequential submission with delays between directories (30-60 second waits). Looks more human, uses less resources, easier to debug. |

## Feature Dependencies

```
[Client Profile Store]
    └──required by──> [Playwright Auto-Submission]
    └──required by──> [NAP Consistency Audit]
    └──required by──> [Duplicate Listing Detection]
    └──required by──> [Tier 1/2 Recommendation Surfacing]

[Directory Master List in Supabase]
    └──required by──> [Submission Tracking]
    └──required by──> [Per-Client Coverage View]
    └──required by──> [Playwright Auto-Submission]
    └──required by──> [Backlink Value Tracking]

[Submission Tracking]
    └──required by──> [Auto-Retry with Escalation]
    └──required by──> [Google site: Verification]
    └──required by──> [Per-Client Coverage View]
    └──required by──> [Backlink Value Tracking]

[Playwright Auto-Submission]
    └──requires──> [Client Profile Store]
    └──requires──> [Directory Master List in Supabase]
    └──requires──> [Submission Tracking] (to record results)
    └──enhanced by──> [Duplicate Listing Detection] (check before submit)
    └──enhanced by──> [Confirmation Email Processing] (complete the loop)

[Google site: Verification]
    └──requires──> [Submission Tracking] (submissions to verify)
    └──uses──> Brave Search or SerpAPI (already available)

[NAP Consistency Audit]
    └──requires──> [Client Profile Store] (source of truth NAP)
    └──independent of submission workflow -- run during onboarding

[Backlink Value Tracking]
    └──requires──> [Directory Master List] (DA scores)
    └──requires──> [Submission Tracking] (verified submissions)
```

### Critical Path

The critical path for v1.2 is:
1. Client Profile Store + Directory Master List (data layer, no dependencies)
2. Submission Tracking (status workflow on top of data layer)
3. Playwright Auto-Submission (requires 1 + 2)
4. Google site: Verification (requires 2, runs independently after submissions)

Everything else is parallel or deferred.

## MVP Recommendation

### Phase 1: Data Foundation (2-3 days)

Prioritize -- nothing else works without this:
1. **Client Profile Store** -- Supabase table + populate for all 4 clients (Mr. Green, Integrity Pro, AZ Turf, SoCal Turfs)
2. **Directory Master List in Supabase** -- Seed from markdown research file (~50 directories)
3. **Submission Tracking table** -- Status workflow enum + timestamps

### Phase 2: Automation Core (3-5 days)

The value differentiator:
4. **Playwright auto-submission scripts** -- Start with 5-8 highest-DA Tier 3 directories, expand to full list
5. **Per-client directory coverage dashboard tab** -- Simple table showing submission status per directory per client

### Phase 3: Verification Loop (2-3 days)

Close the feedback loop:
6. **Google site: verification** -- Weekly batch check if listings went live
7. **Auto-retry with escalation** -- Re-submit after 7 days, alert Brian after 14

### Phase 4: Polish (1-2 days)

Nice-to-haves that prove ROI:
8. **Backlink value tracking** -- Weighted DA score per client
9. **NAP consistency audit** -- Pre-submission quality check
10. **Duplicate listing detection** -- Before submitting, check if already listed

### Defer

- **Confirmation email processing**: HIGH complexity, investigate feasibility in v1.3 after seeing how many directories actually require email confirmation
- **Sentiment/review tracking on directories**: Different problem domain, not needed for backlink acquisition

## Competitive Landscape

| Capability | BrightLocal ($39+/mo) | Whitespark ($20-999/submission) | Apify Citation Builder ($2.60/50 dirs) | This Build (v1.2) |
|------------|----------------------|-------------------------------|----------------------------------------|-------------------|
| Directories covered | 150+ (same ones Yext covers) | 300+ (mostly Yext overlap) | 50+ (general directories) | 35-50 niche directories GHL/Yext misses |
| Automation level | Managed service (humans submit) | Managed service (humans submit) | Full automation (Apify actor) | Playwright auto-submit + manual Tier 1/2 |
| Tracking | Citation Tracker (audit existing) | Citation Finder (discover opportunities) | Output report only | Full status workflow with auto-retry |
| Verification | NAP consistency check | NAP audit | None | Google site: search verification |
| Niche directories | Generic lists, not trade-specific | Better niche coverage | Generic lists | Curated per-trade: turf manufacturers, landscape associations, home service directories |
| Cost per client | $39+/mo ongoing | $100-500 per submission round | ~$3 per batch | $0 marginal cost (self-hosted Playwright) |
| Integration with SEO engine | None (separate tool) | None (separate tool) | Apify integration possible | Native -- same Supabase, same dashboard, brain-aware |

The key insight: commercial tools optimize for the directories Yext already covers. Our master list targets the directories nobody automates -- manufacturer dealer locators, trade associations, and niche home service directories. This is the gap.

## Sources

- [BrightLocal Citation Tracker](https://www.brightlocal.com/local-seo-tools/auditing/citation-tracker/) -- Citation tracking features, NAP consistency checking, competitor analysis (MEDIUM confidence)
- [Whitespark Listings Service](https://whitespark.ca/listings-service/) -- Citation building service packages, pricing, manual submission workflow (MEDIUM confidence)
- [Apify Citation Builder Actor](https://apify.com/alizarin_refrigerator-owner/citation-builder) -- Automated NAP submission to 50+ directories, $2.60/batch pricing (MEDIUM confidence)
- [Apify: Form Automation with Playwright](https://blog.apify.com/playwright-how-to-automate-forms/) -- Playwright form submission patterns, error handling, CAPTCHA detection (MEDIUM confidence)
- [Better Stack: Playwright Best Practices](https://betterstack.com/community/guides/testing/playwright-best-practices/) -- Locator strategies, wait handling, flaky test prevention (MEDIUM confidence)
- [FirstSiteGuide: Best Citation Management Tools 2026](https://firstsiteguide.com/best-local-citation-management-services/) -- Tool comparison, feature landscape (LOW confidence)
- [AutoSaaSLaunch: Automated Directory Submission Tools 2025](https://autosaaslaunch.com/blog/best-automated-directory-submission-tools-2025) -- Automation tool features, CAPTCHA handling approaches (LOW confidence)
- Existing codebase: `seo_loop.py`, `brand_mentions.py`, Supabase schema, Next.js dashboard, `clients.json` (HIGH confidence)
- Directory master list: `.planning/research/find-a-pro-directory-master-list.md` -- 50+ curated directories across 4 tiers (HIGH confidence)

---
*Feature research for: v1.2 Directory Submission & Tracking System*
*Researched: 2026-03-10*
