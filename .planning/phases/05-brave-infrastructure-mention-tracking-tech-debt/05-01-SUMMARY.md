---
phase: 05-brave-infrastructure-mention-tracking-tech-debt
plan: 01
subsystem: infra
tags: [brave-search, supabase, budget-gating, schema-injection, content-validation]

# Dependency graph
requires:
  - phase: 04-geo-optimization
    provides: "schema_injector.py inject_organization_on_all_pages function"
provides:
  - "brave_client.py budget-gated Brave Search wrapper"
  - "brave_usage Supabase table for query tracking"
  - "Fixed 40-60 word capsule validation in content_validator.py"
  - "Organization schema injection wired into seo_loop.py"
  - "Populated same_as_urls for mr-green-turf-clean and integrity-pro-washers"
  - "brand_mentions.py refactored to use centralized brave_client"
affects: [05-02-mention-tracking, 06-geo-dashboard]

# Tech tracking
tech-stack:
  added: [brave-search-api]
  patterns: [budget-gated-api-client, supabase-usage-tracking]

key-files:
  created:
    - scripts/seo_engine/brave_client.py
  modified:
    - scripts/seo_engine/content_validator.py
    - scripts/seo_engine/seo_loop.py
    - scripts/seo_engine/research/brand_mentions.py
    - clients.json

key-decisions:
  - "GLOBAL_MONTHLY_LIMIT set to 800 (conservative, $5 credit = ~1k queries)"
  - "GBP URLs use google.com/maps?cid= format derived from GBP location IDs"
  - "brand_mentions.py uses hardcoded Echo Local Supabase UUID for budget tracking"

patterns-established:
  - "Budget-gated API client: check_budget() -> API call -> log usage (mirrors serpapi_client.py)"
  - "Brave usage table schema: client_id, query, search_type, searched_at (mirrors serpapi_usage)"

requirements-completed: [INFRA-01, INFRA-02, DEBT-01, DEBT-02, DEBT-03]

# Metrics
duration: 127min
completed: 2026-03-11
---

# Phase 5 Plan 1: Brave Infrastructure + Tech Debt Summary

**Budget-gated Brave Search client mirroring serpapi_client.py, brave_usage Supabase table, 40-60 word capsule validation fix, org schema injection wired into daily loop, same_as_urls populated for active clients**

## Performance

- **Duration:** 127 min (includes checkpoint wait for URL verification)
- **Started:** 2026-03-10T23:24:51Z
- **Completed:** 2026-03-11T01:32:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created brave_client.py with search_brave() and check_budget() functions, CLIENT_MONTHLY_LIMIT=200 and GLOBAL_MONTHLY_LIMIT=800, 1s rate limit for free tier
- Created brave_usage Supabase table via Management API with indexes on client_id+searched_at and searched_at
- Fixed DEBT-01: content_validator capsule word count changed from 50-150 to 40-60
- Wired DEBT-02: inject_organization_on_all_pages() runs in seo_loop after GEO scoring step, wrapped in try/except
- Fixed DEBT-03: Populated same_as_urls for integrity-pro-washers (GBP, Yelp, Facebook, Instagram) and mr-green-turf-clean (GBP, Yelp, Facebook)
- Refactored brand_mentions.py to use search_brave() -- removed raw BRAVE_API_KEY/headers/requests calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Create brave_client.py + Supabase table + fix tech debt** - `f94f6fa` (feat)
2. **Task 2: Populate same_as_urls and refactor brand_mentions.py** - `6f642ca` (feat)

## Files Created/Modified
- `scripts/seo_engine/brave_client.py` - Budget-gated Brave Search wrapper with search_brave() and check_budget()
- `scripts/seo_engine/content_validator.py` - Fixed capsule word count from 50-150 to 40-60
- `scripts/seo_engine/seo_loop.py` - Wired inject_organization_on_all_pages() as Step 1b2
- `scripts/seo_engine/research/brand_mentions.py` - Refactored to use brave_client.search_brave()
- `clients.json` - Populated same_as_urls for mr-green-turf-clean and integrity-pro-washers

## Decisions Made
- Set GLOBAL_MONTHLY_LIMIT to 800 (conservative under $5/1k pricing) vs serpapi's 950
- Used google.com/maps?cid= URL format for GBP sameAs links (derived from existing gbp_location IDs in clients.json)
- Hardcoded Echo Local's Supabase UUID in brand_mentions.py for budget tracking (ccb14e38-cd5f-4517-a24f-3f156bcd6b9d)
- Mr Green Instagram left empty -- no verified profile found via Brave Search
- Integrity Pro BBB left empty -- no San Diego BBB listing found

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Supabase table creation required Management API (SUPABASE_ACCESS_TOKEN) since no psql/CLI/service-role-key available. The /v1/projects/{ref}/database/query endpoint worked with 201 response.
- Mr Green Turf Clean Instagram search returned unrelated accounts (mrcleanturf2024, mr.cleannturf) -- none matched the actual business. Left empty rather than guessing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- brave_client.py is ready for Plan 02's mention tracking modules to import
- brave_usage table exists and is queryable
- All three tech debt items resolved
- same_as_urls populated enables Organization schema injection on next seo_loop run

## Self-Check: PASSED

All 5 created/modified files verified on disk. Both task commits (f94f6fa, 6f642ca) verified in git log.

---
*Phase: 05-brave-infrastructure-mention-tracking-tech-debt*
*Completed: 2026-03-11*
