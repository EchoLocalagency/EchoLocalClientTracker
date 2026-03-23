---
phase: 19-core-update-adaptation
plan: 03
subsystem: seo-engine
tags: [entity-signals, geo-scoring, brain-rules, sameAs, schema]

requires:
  - phase: 18-seo-engine-hardening
    provides: GEO scorer, brain prompt, geo_data formatting
provides:
  - sameAs profile URLs for AZ Turf and SoCal in clients.json
  - Brain rules for review quality, entity consistency, AI Overview, posting frequency
  - entity_completeness as 6th GEO scoring factor (max score now 6)
affects: [seo-engine, geo-scorer, brain-prompt, organization-schema]

tech-stack:
  added: []
  patterns: [entity-signal-scoring, sameAs-verification-before-adding]

key-files:
  created: []
  modified:
    - clients.json
    - scripts/seo_engine/brain.py
    - scripts/seo_engine/geo_scorer.py
    - scripts/seo_engine/geo_data.py
    - scripts/seo_engine/seo_loop.py

key-decisions:
  - "Only add verified sameAs URLs -- curl-checked Facebook/Instagram/GBP before adding"
  - "AZ Turf Instagram left empty (no confirmed handle found)"
  - "Yelp/BBB left empty for both clients (cannot verify existence without login)"
  - "Entity completeness checks sameAs array first, falls back to schema type presence"

patterns-established:
  - "sameAs verification: curl + og:title check before adding profile URLs to clients.json"

requirements-completed: [CORE-08, CORE-09, CORE-10]

duration: 4min
completed: 2026-03-23
---

# Phase 19 Plan 03: Entity Consistency + Brain Update Rules Summary

**sameAs profiles for AZ Turf/SoCal, 4 new brain rules (review quality, entity, AI Overview, posting), and entity_completeness as 6th GEO factor (max 6)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T19:08:40Z
- **Completed:** 2026-03-23T19:12:22Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- AZ Turf and SoCal now have verified sameAs URLs (GBP, Facebook, Instagram where confirmed)
- Brain rules 43-46 added: review quality, entity consistency, AI Overview priority, posting frequency
- GEO scorer expanded to 6 factors with entity_completeness checking for Organization/LocalBusiness schema + sameAs

## Task Commits

Each task was committed atomically:

1. **Task 1: Fill sameAs profiles for AZ Turf and SoCal** - `c5293d8` (feat)
2. **Task 2: Update brain rules for March 2026 priorities** - `d1dccf0` (feat)
3. **Task 3: Add entity_completeness to GEO scorer** - `e2a3aff` (feat)

## Files Created/Modified
- `clients.json` - Added sameAs URLs for az-turf-cleaning and socal-artificial-turfs
- `scripts/seo_engine/brain.py` - Rules 43-46 added, GEO score references updated to /6
- `scripts/seo_engine/geo_scorer.py` - New _check_entity_signals factor, docstring updated to 0-6
- `scripts/seo_engine/geo_data.py` - GEO section header and score display updated to /6
- `scripts/seo_engine/seo_loop.py` - GEO avg score print updated to /6

## Decisions Made
- Verified sameAs URLs via HTTP requests before adding (curl + og:title)
- AZ Turf: confirmed GBP CID + Facebook; Instagram not found under obvious handles, left empty
- SoCal: confirmed GBP CID + Facebook + Instagram (og:title showed "William Borger" = Bill Borger)
- Yelp pages for both returned 403 (login wall) -- left empty rather than guess

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Entity signals now tracked in GEO scorer for all clients
- Brain will prioritize entity-reinforcing content in future cycles
- Organization schema on client pages will now improve GEO scores via entity_completeness factor

---
*Phase: 19-core-update-adaptation*
*Completed: 2026-03-23*
