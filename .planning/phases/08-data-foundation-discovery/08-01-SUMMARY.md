---
phase: 08-data-foundation-discovery
plan: 01
subsystem: database
tags: [supabase, postgres, python, typescript, seed-data, directories]

# Dependency graph
requires: []
provides:
  - client_profiles table with NAP fields for 4 active clients
  - directories table with 55 directories (tier, trades, DA, submission URLs)
  - submissions table with UNIQUE(client_id, directory_id) dedup constraint
  - ClientProfile, Directory, Submission TypeScript interfaces
  - 7 existing_needs_review submission records from same_as_urls
affects: [08-02, 08-03, 09-submission-engine, 10-verification, 11-brain-integration, 12-dashboard]

# Tech tracking
tech-stack:
  added: [psycopg2-binary]
  patterns: [supabase-management-api-migration, idempotent-seed-scripts]

key-files:
  created:
    - supabase/migrations/add_directory_system_tables.sql
    - scripts/seo_engine/seed_client_profiles.py
    - scripts/seo_engine/seed_directories.py
  modified:
    - src/lib/types.ts

key-decisions:
  - "Hybrid tier system: Tier 1 = DA 50+ manual-only, Tier 2 = DA 30-50 semi-auto, Tier 3 = DA 10-30 auto-eligible"
  - "55 directories split 15/20/20 across tiers with trade tags for turf, pressure_washing, landscaping"
  - "same_as_urls from clients.json auto-create existing_needs_review submissions for known directories"
  - "Supabase Management API used for migration execution (no psql or CLI needed)"

patterns-established:
  - "Seed scripts use upsert with on_conflict for idempotency"
  - "Migration SQL uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS"
  - "Directory domains stored lowercase without protocol for matching"

requirements-completed: [DATA-01, DATA-02, DATA-03]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 8 Plan 1: Data Foundation Summary

**Three Supabase tables (client_profiles, directories, submissions) with 4 client profiles, 55 tiered directories, and 7 existing listing records seeded from clients.json**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T04:05:30Z
- **Completed:** 2026-03-11T04:11:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created client_profiles, directories, and submissions tables with proper FK constraints, UNIQUE dedup, and indexes
- Seeded 4 active client profiles (Integrity Pro Washers, Mr Green Turf Clean, Echo Local, AZ Turf Cleaning) from clients.json
- Seeded 55 directories across 3 tiers (15 Tier 1, 20 Tier 2, 20 Tier 3) with trade tags, DA scores, and submission URLs
- Auto-created 7 existing_needs_review submission records from clients.json same_as_urls (Yelp, GBP, Facebook, Instagram links)
- Added ClientProfile, Directory, Submission TypeScript interfaces to types.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL, run it, and add TypeScript interfaces** - `cfbae7f` (feat)
2. **Task 2: Create and run seed scripts for client profiles and 55 directories** - `d570356` (feat)

## Files Created/Modified
- `supabase/migrations/add_directory_system_tables.sql` - Schema for all three tables with indexes
- `scripts/seo_engine/seed_client_profiles.py` - Seeds profiles from clients.json, creates existing listing submissions
- `scripts/seo_engine/seed_directories.py` - Seeds 55 directories with tier/trade/DA metadata
- `src/lib/types.ts` - Added ClientProfile, Directory, Submission interfaces

## Decisions Made
- Hybrid tier system chosen: combines DA score, verification requirements, and automation eligibility into a single tier number
- 55 directories split into 15 Tier 1 (manual-only premium like Yelp, BBB, Angi), 20 Tier 2 (semi-auto like Expertise, Bark, LawnStarter), and 20 Tier 3 (auto-eligible like Manta, Hotfrog, EZLocal)
- Trade tags applied to relevant directories: pressure_washing, turf, landscaping -- universal directories have empty trades array
- Primal Plates excluded from seeding (not a home service business, no directory relevance)
- same_as_urls automatically mapped to directory domains to create pre-existing submission records
- Supabase Management API (via SUPABASE_ACCESS_TOKEN) used for migration execution since psql and Supabase CLI are not installed

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
- No psql or Supabase CLI available locally. Resolved by using Supabase Management API REST endpoint with SUPABASE_ACCESS_TOKEN for SQL execution.
- Installed psycopg2-binary during troubleshooting (ultimately used Management API instead, but psycopg2 may be useful for future phases).

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- All three tables populated and ready for Phase 8 Plan 2 (discovery via Brave Search) and Plan 3 (CAPTCHA audit)
- Submission engine (Phase 9) can query directories by tier and trade to determine which directories to submit each client to
- 7 existing_needs_review submissions give Brian a head start on verifying known listings

---
*Phase: 08-data-foundation-discovery*
*Completed: 2026-03-11*
