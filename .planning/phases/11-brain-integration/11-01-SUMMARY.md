---
phase: 11-brain-integration
plan: 01
subsystem: seo-engine
tags: [python, supabase, brain-prompt, directory-submission, seo-actions]

# Dependency graph
requires:
  - phase: 09-submission-engine
    provides: submission_engine.py with _submit_to_directory() and run_submission_engine()
  - phase: 08-directory-infrastructure
    provides: directories and submissions tables in Supabase
provides:
  - get_directory_summary() function returning submitted/verified/total_eligible counts
  - DIRECTORY COVERAGE section in brain prompt with submission stats
  - directory_submission action_type logged to seo_actions on successful submissions
affects: [12-dashboard-directory, seo-loop, brain-decisions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-fatal data fetch pattern: try/except returning safe defaults, never blocking main flow"
    - "Kwarg passthrough chain: outcome_logger -> seo_loop -> call_brain -> _build_prompt"

key-files:
  created: []
  modified:
    - scripts/seo_engine/outcome_logger.py
    - scripts/seo_engine/brain.py
    - scripts/seo_engine/seo_loop.py
    - scripts/seo_engine/submission_engine.py

key-decisions:
  - "Used .in_() for submitted count to include submitted/approved/verified statuses"
  - "Only log clean submissions to seo_actions (not post-submit-error or skipped/failed)"
  - "Brain prompt explicitly tells brain NOT to propose directory_submission actions"

patterns-established:
  - "Directory summary kwarg chain: fetched in seo_loop, passed through call_brain to _build_prompt"
  - "Action logging in submission_engine: import log_action inside try/except to avoid import-time failures"

requirements-completed: [BRAIN-01, BRAIN-02]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 11 Plan 01: Brain Integration Summary

**Directory submission data wired into brain prompt (coverage stats) and action log (seo_actions rows per submission)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T21:28:33Z
- **Completed:** 2026-03-11T21:30:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Brain prompt now includes DIRECTORY COVERAGE section showing submitted/verified counts per client
- Brain is explicitly told not to propose directory_submission actions (handled by submission_engine separately)
- Every successful auto-submission creates an seo_actions row with action_type='directory_submission'
- All new code is non-fatal (wrapped in try/except) so failures never break existing functionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Add get_directory_summary() and wire into brain prompt (BRAIN-01)** - `cc29d0a` (feat)
2. **Task 2: Log directory submissions to seo_actions (BRAIN-02)** - `fdeb1ea` (feat)

## Files Created/Modified
- `scripts/seo_engine/outcome_logger.py` - Added get_directory_summary() returning submitted/verified/total_eligible counts
- `scripts/seo_engine/brain.py` - Added DIRECTORY COVERAGE section to _build_prompt(), directory_summary kwarg to call_brain()
- `scripts/seo_engine/seo_loop.py` - Fetches directory_summary and passes it through to call_brain()
- `scripts/seo_engine/submission_engine.py` - Added client_id param to _submit_to_directory(), log_action() call on clean submissions

## Decisions Made
- Used `.in_("status", ["submitted", "approved", "verified"])` for submitted count instead of just `.eq("status", "submitted")` to avoid undercounting verified/approved submissions
- Only log clean submissions (not post-submit-error path at line ~391) to avoid misleading seo_actions entries
- Brain prompt explicitly instructs brain not to propose directory_submission actions since that is automated separately

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Brain integration complete, brain now has full visibility into directory submission state
- Ready for Phase 12 (Dashboard Directory tab) which will display submission data in the UI

---
*Phase: 11-brain-integration*
*Completed: 2026-03-11*
