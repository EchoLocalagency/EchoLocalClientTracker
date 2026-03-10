---
phase: 03-brain-integration-content-upgrades
plan: 01
subsystem: seo-engine
tags: [supabase, brain-prompt, geo-scoring, citation-readiness, ai-overview]

# Dependency graph
requires:
  - phase: 02-geo-scoring-ai-overview-detection
    provides: geo_scores and serp_features Supabase tables with scoring data
provides:
  - geo_data.py helper module for fetching and formatting GEO data
  - Brain prompt GEO CITATION-READINESS SCORES section
  - Brain prompt AI OVERVIEW + CITATION STATUS section
  - Rules 37-39 for geo_content_upgrade, striking-distance priority, citation-ready blogs
  - Updated answer capsule rule (40-60 words with class="answer-capsule")
affects: [03-02, 03-03, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GEO data formatted with char_budget enforcement for prompt sections"
    - "Lazy import of geo_data in seo_loop (matches existing non-fatal pattern)"

key-files:
  created:
    - scripts/seo_engine/geo_data.py
  modified:
    - scripts/seo_engine/brain.py
    - scripts/seo_engine/seo_loop.py

key-decisions:
  - "Separate geo_data.py module rather than inline in brain.py (cleaner separation, reusable)"
  - "3000-char budget with early-break loops (2947 chars with 20 pages + 15 keywords)"
  - "GEO scores sorted worst-first, SERP features sorted AIO=True first (actionable ordering)"

patterns-established:
  - "char_budget enforcement pattern for prompt sections (break early, leave room for footers)"
  - "geo_content_upgrade action type with upgrades array (answer_block, stats_injection, freshness_update)"

requirements-completed: [BRAIN-01, BRAIN-03, BRAIN-04, CONT-01, CONT-02]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 3 Plan 1: Brain GEO Integration Summary

**Brain prompt now includes GEO citation-readiness scores and AI Overview status tables, with rules 37-39 enforcing geo_content_upgrade actions, striking-distance + low-GEO prioritization, and citation-ready blog structure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T18:03:11Z
- **Completed:** 2026-03-10T18:06:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created geo_data.py with Supabase queries for geo_scores and serp_features, plus budget-controlled formatting (stays under 3000 chars even with 20 pages and 15 keywords)
- Brain prompt now shows GEO CITATION-READINESS SCORES table (worst-first) and AI OVERVIEW + CITATION STATUS table (AIO-first)
- Added geo_content_upgrade as new action type (Rule 37) with answer_block, stats_injection, freshness_update upgrade types
- Added HIGHEST ROI RULE (Rule 38): striking-distance + low GEO score pages get priority above all other actions
- Added CITATION-READY BLOG POSTS rule (Rule 39) enforcing answer capsule, comparison tables, stat density, freshness signals
- Updated answer capsule rule from 50-150 words to 40-60 words with class="answer-capsule"
- seo_loop.py fetches GEO data after scoring (Step 1c) and passes to call_brain

## Task Commits

Each task was committed atomically:

1. **Task 1: Create geo_data.py helper and wire into seo_loop** - `b56fe2f` (feat)
2. **Task 2: Add GEO sections and updated rules to brain prompt** - `4b0b6c2` (feat)

## Files Created/Modified
- `scripts/seo_engine/geo_data.py` - GEO data fetching from Supabase + compact prompt formatting with char_budget
- `scripts/seo_engine/brain.py` - New GEO sections in prompt, updated answer capsule rule, new rules 37-39, geo_content_upgrade example
- `scripts/seo_engine/seo_loop.py` - Step 1c fetches GEO data, passes geo_scores and serp_features to call_brain

## Decisions Made
- Separate geo_data.py module rather than inline in brain.py for cleaner separation and reusability
- 3000-char budget with early-break loops -- tested at 2947 chars with max data (20 pages + 15 keywords)
- GEO scores sorted worst-first (score ascending) so brain sees most urgent pages first
- SERP features sorted AIO=True first so brain sees AI Overview opportunities first
- Striking distance section now cross-references GEO scores when available

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- geo_content_upgrade action type is defined in brain rules but not yet dispatched in seo_loop _execute_action -- Plan 03-02 will add the execution pipeline
- Blog engine citation-ready defaults and FAQ schema expansion ready for Plan 03-03
- Brain now has full visibility into GEO data and will start recommending geo_content_upgrade actions

---
*Phase: 03-brain-integration-content-upgrades*
*Completed: 2026-03-10*
