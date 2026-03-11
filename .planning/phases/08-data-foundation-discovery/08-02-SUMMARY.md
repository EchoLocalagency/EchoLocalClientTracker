---
phase: 08-data-foundation-discovery
plan: 02
subsystem: ui
tags: [react, supabase, directories, client-profiles, crud, inline-styles]

requires:
  - phase: 08-01
    provides: Supabase tables (client_profiles, directories, submissions) and TypeScript interfaces
provides:
  - ClientProfileForm component for editing client canonical NAP/services data
  - DirectoryManager component with CAPTCHA badges, trade-based relevance filtering
  - DirectoryRow component with inline edit and enable/disable toggle
  - Directories sub-tab in SEO Engine page
  - Service-to-directory trade matching (client trades filter relevant directories)
affects: [09-submission-engine, 10-verification, 11-brain-integration]

tech-stack:
  added: []
  patterns:
    - "Trade-based directory filtering: universal (trades=[]) shown to all, trade-specific filtered by client"
    - "CLIENT_TRADE_MAP in page.tsx maps client slugs to directory trade tags"

key-files:
  created:
    - src/components/directories/ClientProfileForm.tsx
    - src/components/directories/DirectoryManager.tsx
    - src/components/directories/DirectoryRow.tsx
  modified:
    - src/app/seo-engine/page.tsx
    - src/lib/types.ts
    - src/components/seo-engine/SeoTabNav.tsx
    - scripts/seo_engine/seed_directories.py
    - scripts/seo_engine/seed_client_profiles.py

key-decisions:
  - "Trade tags refined: pressure_washing, turf, landscaping, home_services, seo_agency -- each directory tagged to match actual client services"
  - "Agency directories (Clutch, DesignRush) tagged seo_agency so only Echo Local sees them"
  - "Irrelevant directories (Birdeye, Podium, NiceJob, Crunchbase, GoodFirms) disabled rather than deleted"
  - "Added Relevant/All toggle to DirectoryManager -- defaults to showing only matching trades + universal"
  - "Client services seeded from CLIENT_SERVICES map (seed_client_profiles.py) with proper descriptions"

patterns-established:
  - "Inline styles with CSS variables pattern: var(--bg-surface), var(--border), var(--accent), hover via onMouseEnter/Leave"
  - "Tag input pattern: type + Enter to add, X to remove, reusable TagInput sub-component"
  - "Trade filtering: directories with empty trades array are universal; non-empty trades require overlap with client trades"

requirements-completed: [DATA-01, DATA-02, DATA-05]

duration: 5min
completed: 2026-03-11
---

# Phase 8 Plan 2: Directory UI Summary

**Client profile editor and directory management UI with CAPTCHA badges, trade-based relevance filtering, and service-matched seed data for 4 active clients**

## Performance

- **Duration:** 5 min (continuation from checkpoint)
- **Started:** 2026-03-11T15:25:28Z
- **Completed:** 2026-03-11T15:31:16Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- ClientProfileForm with NAP, services, hours, social links, descriptions -- all editable and saving to Supabase
- DirectoryManager showing 55 directories with tier badges, CAPTCHA status badges, add/edit/disable, and trade-based relevance filter
- Seed data properly matched: Integrity Pro gets pressure washing directories, Mr Green gets turf directories, AZ Turf gets turf+landscaping, Echo Local gets SEO agency directories
- All clients get universal directories (Google, Yelp, BBB, Facebook, etc.) plus trade-specific ones

## Task Commits

Each task was committed atomically:

1. **Task 1: Build ClientProfileForm and DirectoryManager components** - `62ceb22` (feat)
2. **Task 2: Wire directory components into SEO Engine page as sub-tab** - `5067188` (feat)
3. **Task 3: Verify directory UI + fix service-to-directory matching** - `6043319` (fix)

## Files Created/Modified

- `src/components/directories/ClientProfileForm.tsx` - Editable client profile form (NAP, services, hours, social, descriptions)
- `src/components/directories/DirectoryManager.tsx` - Directory list with filters, add form, trade relevance toggle
- `src/components/directories/DirectoryRow.tsx` - Single directory row with CAPTCHA badge, inline edit, enable toggle
- `src/app/seo-engine/page.tsx` - Added Directories sub-tab with CLIENT_TRADE_MAP for trade filtering
- `src/lib/types.ts` - Added ClientProfile and Directory interfaces, SeoEngineTabId union
- `src/components/seo-engine/SeoTabNav.tsx` - Added Directories tab button
- `scripts/seo_engine/seed_directories.py` - Refined 55 directories with proper trade tags per service category
- `scripts/seo_engine/seed_client_profiles.py` - Added CLIENT_SERVICES map with services, descriptions, trades per client

## Decisions Made

- Trade tags refined to 5 categories: pressure_washing, turf, landscaping, home_services, seo_agency
- Agency-only directories (Clutch, DesignRush) tagged seo_agency so only Echo Local sees them as relevant
- Irrelevant directories disabled in Supabase rather than deleted (preserves any existing submission records)
- Added 3 new pressure washing directories (UAMCC, PWNA, SoftWashSystems) and moved Lawn Love to Tier 2
- CLIENT_TRADE_MAP kept in page.tsx rather than database column -- simple, no migration needed, 4 clients

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Service-to-directory trade mismatch in seed data**
- **Found during:** Task 3 (human verification checkpoint)
- **Issue:** Brian reported directories not matching client services -- pressurewashingresource.com showing for turf clients, agency directories showing for all clients
- **Fix:** Refined all 55 directory trade tags, seeded client services/descriptions, added Relevant/All filter toggle, disabled 5 irrelevant directories
- **Files modified:** seed_directories.py, seed_client_profiles.py, DirectoryManager.tsx, page.tsx
- **Verification:** npm run build passes, seed scripts run successfully
- **Committed in:** 6043319

---

**Total deviations:** 1 auto-fixed (1 bug -- data quality)
**Impact on plan:** Essential fix for data correctness. Added trade filtering UI is minor scope addition that makes the feature usable.

## Issues Encountered

None beyond the seed data mismatch caught during human verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Client profiles and directory data in Supabase, editable via dashboard
- Trade-based filtering ensures each client sees relevant directories
- Ready for Phase 9 (submission engine) to automate directory submissions
- CAPTCHA audit script (08-03) should be run to populate captcha_status before Phase 9

---
*Phase: 08-data-foundation-discovery*
*Completed: 2026-03-11*
