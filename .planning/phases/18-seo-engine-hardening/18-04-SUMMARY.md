---
phase: 18-seo-engine-hardening
plan: 04
subsystem: seo-engine
tags: [gbp-reviews, competitor-tracking, cluster-health, gsc, serpapi, brain-prompt]

# Dependency graph
requires:
  - phase: 18-01
    provides: engine tuning with manual overrides and suppression
  - phase: 18-02
    provides: brain retry logic for suppressed actions
  - phase: 18-03
    provides: GEO brain integration and impact scoring
provides:
  - review velocity tracking in daily reports and brain context
  - competitor position storage in keyword_snapshots
  - competitor movement alerts in brain prompt
  - cluster health scoring against GSC data
  - underperforming cluster flagging in brain prompt
affects: [seo-engine, brain-prompt, data-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [review-velocity-from-report-history, competitor-position-diffing, cluster-health-scoring]

key-files:
  modified:
    - scripts/run_reports.py
    - scripts/seo_engine/brain.py
    - scripts/seo_engine/keyword_tracker.py
    - scripts/seo_engine/cluster_manager.py
    - scripts/seo_engine/seo_loop.py

key-decisions:
  - "Review velocity computed from local JSON report history (7-day lookback with fallback) rather than Supabase query"
  - "Competitor positions stored as JSONB in existing keyword_snapshots table rather than new table"
  - "Cluster health scored via gsc_queries keyword matching rather than page-level GSC API calls"

patterns-established:
  - "Review data piggybacked on existing GBP section of run_reports.py"
  - "Competitor alerts use snapshot diffing pattern (compare last 2 SerpAPI check dates)"

requirements-completed: [HARD-06, HARD-08, HARD-09, HARD-10]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 18 Plan 04: Review Tracking + Competitor Positions + Cluster Health Summary

**Review velocity tracking, competitor position storage with movement alerts, and GSC-backed cluster health scoring -- all surfaced in brain prompt**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T21:34:56Z
- **Completed:** 2026-03-20T22:24:41Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Daily review count, rating, and weekly velocity tracked from GBP API and stored in reports + Supabase
- Brain gets review health warning when velocity drops below 1/week
- Top-3 competitor domains stored per keyword in keyword_snapshots JSONB
- Competitor movement alerts (3+ position gains) detected and shown in brain prompt
- Cluster health scored (healthy/growing/underperforming/nascent) from gsc_queries data
- Underperforming clusters flagged in brain with remediation suggestions

## Task Commits

Each task was committed atomically:

1. **Task 1: Review velocity tracking** - `3535343` (feat)
2. **Task 2: Competitor positions + alerts** - `06312ec` (feat)
3. **Task 3: Cluster health scoring** - `3968b0b` (feat)

## Files Created/Modified
- `scripts/run_reports.py` - Added pull_gbp_reviews(), compute_review_velocity(), review data in report pipeline + Supabase upsert
- `scripts/seo_engine/brain.py` - Sections 2b (review health), 2c (competitor alerts), 14b2 (cluster health); new params competitor_alerts and cluster_health
- `scripts/seo_engine/keyword_tracker.py` - Competitor position extraction from organic results; get_competitor_alerts() snapshot diffing function
- `scripts/seo_engine/cluster_manager.py` - score_cluster_health() with GSC keyword matching and health categorization
- `scripts/seo_engine/seo_loop.py` - Wired competitor alerts and cluster health into both brain call sites

## Decisions Made
- Review velocity computed from local JSON report history (7-day lookback with date fuzzing) -- avoids extra Supabase query and works offline
- Competitor positions stored as JSONB in existing keyword_snapshots rather than creating a new table -- keeps schema simple
- Cluster health scored via gsc_queries keyword matching rather than page-level GSC API calls -- avoids additional API quota usage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The `health` column on `seo_content_clusters` and `review_*` columns on `reports` will be created automatically on first write if using Supabase's flexible column policy, or may need a migration if strict schema is enforced.

## Next Phase Readiness
- All new brain sections are additive (no breaking changes)
- Plan 18-05 can proceed with the enriched brain context
- Review data, competitor alerts, and cluster health all flow into brain on next SEO engine run

---
*Phase: 18-seo-engine-hardening*
*Completed: 2026-03-20*
