---
phase: 10-verification-loop
plan: 01
subsystem: seo-engine
tags: [brave-search, supabase, directory-verification, escalation, cli]

requires:
  - phase: 08-directory-infrastructure
    provides: directories and submissions tables, seed data
  - phase: 09-submission-engine
    provides: submitted directory listings to verify
provides:
  - verify_submissions.py script for checking submitted listings via Brave Search
  - Escalation workflow at 14-day (alert) and 21-day (needs_review) thresholds
  - Dedup via metadata.last_verification_check to avoid redundant API calls
affects: [11-brain-integration, 12-dashboard-display]

tech-stack:
  added: []
  patterns: [verification-loop, escalation-thresholds, metadata-read-then-merge]

key-files:
  created:
    - scripts/seo_engine/verify_submissions.py
  modified: []

key-decisions:
  - "Used named constants (MIN_AGE_DAYS, ALERT_DAYS, NEEDS_REVIEW_DAYS) instead of inline timedelta values for readability"
  - "Process 21-day escalation before 14-day alerts to avoid alerting on rows already marked needs_review"
  - "All-clients mode queries distinct client_ids from submitted submissions rather than iterating all clients"

patterns-established:
  - "Verification loop pattern: query eligible submissions, Brave site: search, update status, escalate stale"
  - "Escalation pattern: 21-day needs_review before 14-day alert to prevent double-processing"

requirements-completed: [VER-01, VER-02, VER-03, VER-04]

duration: 2min
completed: 2026-03-11
---

# Phase 10 Plan 01: Verification Loop Summary

**Brave Search verification loop for submitted directory listings with 7/14/21-day escalation thresholds and budget-gated API calls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T17:06:23Z
- **Completed:** 2026-03-11T17:08:50Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Built verify_submissions.py following discovery.py patterns with full CLI support
- Brave Search site: queries verify submitted listings older than 7 days
- Verified listings update to status='verified' with live_url and verified_at
- 14-day unverified submissions print alert, 21-day escalate to needs_review
- Budget exhaustion and dedup (7-day recheck window) handled gracefully
- Dry-run mode confirmed working for both all-clients and single-client modes

## Task Commits

Each task was committed atomically:

1. **Task 1: Build verify_submissions.py with Brave Search verification and escalation** - `feba9d6` (feat)
2. **Task 2: Validate all escalation paths with dry-run output** - No file changes (validation only)

## Files Created/Modified
- `scripts/seo_engine/verify_submissions.py` - Verification loop script with Brave Search checking, escalation, and CLI

## Decisions Made
- Used named constants for threshold days instead of inline magic numbers
- Process 21-day escalation before 14-day alerts to prevent double-processing
- All-clients mode fetches distinct client_ids from submissions table rather than loading all clients
- Timestamp parsing strips timezone info for consistent comparison with utcnow()

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all verification checks passed on first run.

## User Setup Required

None - no external service configuration required. Script uses existing Brave API key and Supabase credentials.

## Next Phase Readiness
- Verification loop ready to run once submissions move to 'submitted' status (currently all 7 submissions are 'existing_needs_review' from discovery phase)
- Brain integration (Phase 11) can use verify_submissions as part of the automated pipeline
- Dashboard display (Phase 12) can show verified/needs_review status from submission records

---
*Phase: 10-verification-loop*
*Completed: 2026-03-11*
