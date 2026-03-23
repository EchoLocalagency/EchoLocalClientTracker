---
phase: 19-core-update-adaptation
plan: 2
subsystem: seo-engine
tags: [pagespeed, inp, core-web-vitals, gbp, completeness-audit, rate-limits]

requires:
  - phase: 18-seo-engine-hardening
    provides: SEO engine brain prompt, seo_loop orchestration, data collection pipeline

provides:
  - INP (Interaction to Next Paint) tracking in daily reports
  - GBP completeness audit surfaced in brain prompt
  - GBP post weekly limit bumped to 3

affects: [seo-engine, daily-reports, brain-prompt]

tech-stack:
  added: []
  patterns:
    - "Graceful column fallback: try upsert with new columns, fall back if missing"
    - "GBP completeness audit as pre-brain data enrichment step"

key-files:
  created:
    - scripts/seo_engine/migrations/add_inp_columns.sql
  modified:
    - scripts/run_reports.py
    - scripts/seo_engine/seo_loop.py
    - scripts/seo_engine/brain.py

key-decisions:
  - "INP Supabase columns added via migration SQL rather than inline -- DB password not available, migration must be run manually or via MCP"
  - "GBP post limit bumped from 2 to 3 based on March 2026 core update emphasis on regular posting"

patterns-established:
  - "Graceful Supabase column handling: try upsert, catch column-not-found, retry without new columns"

requirements-completed: [CORE-05, CORE-06, CORE-07]

duration: 7min
completed: 2026-03-23
---

# Phase 19 Plan 2: INP Tracking + GBP Completeness Audit + Post Limit Bump Summary

**INP Core Web Vital added to PageSpeed collection with red flags, GBP profile gap audit surfaced in brain prompt, gbp_post limit bumped to 3/week**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-23T19:08:28Z
- **Completed:** 2026-03-23T19:15:47Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- INP (Interaction to Next Paint) extracted from Lighthouse audits for both mobile and desktop strategies
- Red flag triggers when mobile INP exceeds 200ms threshold (Core Web Vital)
- GBP completeness audit checks description length, business hours, service count, and photo count
- Brain prompt now includes GBP COMPLETENESS ISSUES section for prioritization
- GBP post weekly limit increased from 2 to 3 per core update guidance

## Task Commits

Each task was committed atomically:

1. **Task 1: Add INP to PageSpeed collection** - `8d104b0` (feat)
2. **Task 2: Add GBP completeness audit** - `ea1b6e2` (committed as part of parallel 19-03 execution)
3. **Task 3: Bump gbp_post weekly limit to 3** - `cf41985` (feat)

## Files Created/Modified

- `scripts/run_reports.py` - Added INP extraction from Lighthouse, red flag for INP > 200ms, Supabase upsert with graceful fallback
- `scripts/seo_engine/seo_loop.py` - Added _audit_gbp_completeness() function, bumped gbp_post from 2 to 3
- `scripts/seo_engine/brain.py` - Added GBP COMPLETENESS ISSUES section in brain prompt, new gbp_completeness_issues parameter
- `scripts/seo_engine/migrations/add_inp_columns.sql` - Migration to add psi_inp_mobile and psi_inp_desktop columns

## Decisions Made

- Used graceful column fallback for Supabase INP columns since DB password is not available for direct DDL execution -- migration SQL file created for manual execution
- GBP post limit bumped from 2 to 3 (conservative increase, some guides recommend daily)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supabase column migration could not be applied automatically**
- **Found during:** Task 1 (INP Supabase columns)
- **Issue:** No DB password or Supabase MCP connection available for DDL execution
- **Fix:** Created migration SQL file and added graceful fallback in upsert code (catches column-not-found error, retries without INP columns, prints migration instruction)
- **Files modified:** scripts/run_reports.py, scripts/seo_engine/migrations/add_inp_columns.sql
- **Verification:** Code handles both cases (columns exist or not)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Graceful fallback ensures no breakage. Migration must be run separately.

## Issues Encountered

- Task 2 changes were committed as part of a parallel 19-03 plan execution that included the same files in its commit. Changes are present and verified in HEAD.

## User Setup Required

Run the Supabase migration to add INP columns:
```sql
ALTER TABLE reports ADD COLUMN IF NOT EXISTS psi_inp_mobile REAL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS psi_inp_desktop REAL;
```
Execute via Supabase Dashboard SQL Editor or MCP.

## Next Phase Readiness

- INP data will begin appearing in daily reports once migration is applied
- GBP completeness issues will surface in next SEO engine run
- Post limit increase takes effect immediately

---
*Phase: 19-core-update-adaptation*
*Completed: 2026-03-23*
