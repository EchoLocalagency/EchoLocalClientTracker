---
phase: 18-seo-engine-hardening
plan: 03
subsystem: seo-engine
tags: [python, brain-prompt, impact-scoring, geo-scorer, supabase]

# Dependency graph
requires:
  - phase: 18-seo-engine-hardening
    provides: GEO scoring infrastructure (geo_scorer.py, geo_data.py)
provides:
  - Bottom-5 GEO gaps fed into brain prompt for prioritization
  - Per-action-type impact scoring (content vs GBP vs photo)
  - Dynamic year freshness detection in geo_scorer
affects: [seo-engine, brain-prompt, outcome-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [action-type-aware scoring, dynamic date-based detection]

key-files:
  created: []
  modified:
    - scripts/seo_engine/brain.py
    - scripts/seo_engine/outcome_logger.py
    - scripts/seo_engine/geo_scorer.py

key-decisions:
  - "GEO bottom-5 added as section 9c (after engine tuning, before rate limits) to give brain immediate visibility into weakest pages"
  - "Impact scoring branches on action_type categories: content, GBP, photo, fallback -- each using its natural metrics"

patterns-established:
  - "Action-type-aware scoring: different action categories measured against different metric sets"

requirements-completed: [HARD-05, HARD-07, HARD-14]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 18 Plan 03: GEO Brain Integration + Impact Score Per Action Type Summary

**Bottom-5 GEO gaps injected into brain prompt section 9c, impact scoring differentiated by action type (content/GBP/photo), hardcoded year replaced with dynamic date**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T21:22:27Z
- **Completed:** 2026-03-20T21:24:25Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Brain now sees the 5 lowest-scoring GEO pages with specific missing factors, enabling prioritization of geo_content_upgrade actions
- Impact scoring uses natural metrics per action type: content actions get position + impressions + click growth, GBP actions get GBP impressions + calls, photo actions get views
- Freshness detection in geo_scorer uses date.today().year instead of hardcoded 2025/2026

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GEO scores to brain prompt** - `e43e1ac` (feat)
2. **Task 2: Per-action-type impact scoring** - `2522d5d` (feat)
3. **Task 3: Fix hardcoded year in geo_scorer** - `0be66ef` (fix)

## Files Created/Modified
- `scripts/seo_engine/brain.py` - Added section 9c with bottom-5 GEO citation-readiness gaps
- `scripts/seo_engine/outcome_logger.py` - Replaced single formula with action-type-aware impact scoring
- `scripts/seo_engine/geo_scorer.py` - Dynamic year in _check_freshness()

## Decisions Made
- GEO bottom-5 inserted as section 9c between engine tuning (9b) and rate limits (10) -- brain sees gaps before deciding what actions to take
- Impact scoring uses 4 branches: content types, GBP types, photo type, fallback -- each with metrics natural to that action category

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Brain now has GEO gap visibility and differentiated impact feedback
- Ready for remaining Phase 18 plans (wave 1 and wave 2)

---
*Phase: 18-seo-engine-hardening*
*Completed: 2026-03-20*
