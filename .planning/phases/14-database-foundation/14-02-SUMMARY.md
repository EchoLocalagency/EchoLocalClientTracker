---
phase: 14-database-foundation
plan: 02
subsystem: database
tags: [python, supabase, postgres, sales-engine, pipeline, rls, migrations]

# Dependency graph
requires:
  - phase: 14-database-foundation (plan 01)
    provides: pipeline_leads and pipeline_stage_history tables in Supabase
provides:
  - Auto-creation of pipeline leads when analyze_calls.py detects "meeting_booked" or "closed" outcomes
  - Duplicate detection by phone (exact match) and company_name (case-insensitive ilike)
  - Initial stage history row inserted alongside every auto-created lead
  - Updated store_analysis() signature (4-arg) in both analyze_calls.py and call_watcher.py
  - All four pipeline tables live in Supabase with RLS enabled
affects:
  - 15-pipeline-api
  - 16-pipeline-ui
  - 17-pipeline-analytics

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sales engine writes to pipeline via Supabase service-role client (bypasses RLS)"
    - "Duplicate detection: phone exact match first, then company_name ilike fallback"
    - "Stage history seeded at lead creation (previous_stage=None, new_stage='Lead')"

key-files:
  created: []
  modified:
    - scripts/sales_engine/analyze_calls.py
    - scripts/sales_engine/call_watcher.py

key-decisions:
  - "store_analysis() extended to 4-arg signature (sb, call_id, call, analysis) so call object is available for lead creation"
  - "Duplicate detection checks phone first, then company_name -- prevents duplicate leads without blocking legitimate re-contacts"
  - "SQL migration applied via Supabase MCP (no Supabase CLI configured in this project)"

patterns-established:
  - "Pattern: create_pipeline_lead_from_call() is outcome-gated -- exits early for non-booking outcomes"
  - "Pattern: Both call sites (analyze_calls main() and call_watcher.py) must be updated together when store_analysis signature changes"

requirements-completed: [INT-01, INT-02, INT-03]

# Metrics
duration: ~15min
completed: 2026-03-12
---

# Phase 14 Plan 02: Database Foundation Summary

**Sales engine auto-creates pipeline leads (with duplicate detection and stage history) when analyze_calls.py detects "meeting_booked" or "closed" outcomes, and all four pipeline tables are live in Supabase with RLS enabled.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-12
- **Completed:** 2026-03-12
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- create_pipeline_lead_from_call() added to analyze_calls.py with outcome gating, duplicate detection, lead insert, and initial stage history insert
- store_analysis() signature updated to 4-arg form in analyze_calls.py and call_watcher.py
- All four pipeline tables (pipeline_leads, pipeline_stage_history, pipeline_checklist_items, pipeline_comms) applied to Supabase via MCP with RLS enabled on each

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pipeline lead auto-creation to sales engine** - `75d8445` (feat)
2. **Task 2: Run SQL migration in Supabase dashboard** - (applied via Supabase MCP, no git commit -- migration file already committed in 14-01)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `scripts/sales_engine/analyze_calls.py` - Added create_pipeline_lead_from_call(), updated store_analysis() to 4-arg signature, updated call in main()
- `scripts/sales_engine/call_watcher.py` - Updated store_analysis() call to 4-arg signature

## Decisions Made
- SQL migration applied via Supabase MCP instead of dashboard SQL editor -- same result, faster execution
- store_analysis() takes the full call object (not just call_id) so create_pipeline_lead_from_call() has access to phone, company_name, and contact_name without a second DB fetch

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - migration was applied directly via Supabase MCP. No additional manual steps required.

## Next Phase Readiness
- All four pipeline tables live in Supabase with admin-only RLS
- Sales engine will auto-populate pipeline_leads on "meeting_booked" or "closed" outcomes going forward
- Phase 15 (Pipeline API) can build CRUD endpoints against all four tables
- Phase 16 (Pipeline UI) can read pipeline_leads and pipeline_stage_history including auto-created leads
- Phase 17 (Pipeline Analytics) can query pipeline_stage_history for funnel metrics

---
*Phase: 14-database-foundation*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: scripts/sales_engine/analyze_calls.py (with create_pipeline_lead_from_call)
- FOUND: scripts/sales_engine/call_watcher.py (with 4-arg store_analysis call)
- FOUND: .planning/phases/14-database-foundation/14-02-SUMMARY.md
- FOUND: commit 75d8445 (feat: pipeline lead auto-creation)
- Migration confirmed applied via Supabase MCP (all 4 tables present, RLS enabled)
