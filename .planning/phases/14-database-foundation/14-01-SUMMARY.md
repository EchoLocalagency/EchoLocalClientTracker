---
phase: 14-database-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, typescript, rls, pipeline, migrations]

# Dependency graph
requires: []
provides:
  - SQL migration creating pipeline_leads, pipeline_stage_history, pipeline_checklist_items, pipeline_comms tables
  - Admin-only RLS policies on all four pipeline tables
  - PipelineLead, PipelineStageHistory, PipelineChecklistItem, PipelineComm TypeScript interfaces
  - PipelineStage, CommType, CommDirection type aliases
  - PIPELINE_STAGES array and STAGE_CHECKLIST_DEFAULTS constant map
affects:
  - 15-pipeline-api
  - 16-pipeline-ui
  - 17-pipeline-analytics

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase RLS with user_profiles role check for admin-only access"
    - "Append-only stage history table (not just current_stage column)"
    - "Checklist items as queryable rows with UNIQUE(lead_id, stage, item_key)"
    - "stage_entered_at column updated whenever stage changes"

key-files:
  created:
    - supabase/migrations/add_pipeline_tables.sql
    - src/lib/pipeline-constants.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "Separate pipeline_leads table (not bolting onto clients table) -- keeps pipeline standalone"
  - "Append-only pipeline_stage_history for full audit trail of stage transitions"
  - "Checklist items as rows not JSONB -- enables per-item queries and completion tracking"
  - "UNIQUE(lead_id, stage, item_key) prevents duplicate checklist items on upsert"

patterns-established:
  - "Pattern: RLS admin check via EXISTS(SELECT 1 FROM user_profiles WHERE role='admin')"
  - "Pattern: stage_entered_at must be updated alongside stage column on every stage change"
  - "Pattern: STAGE_CHECKLIST_DEFAULTS keyed by PipelineStage provides defaults for seeding"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 14 Plan 01: Database Foundation Summary

**Postgres migration with four pipeline tables (leads, stage history, checklist items, comms), admin-only RLS via user_profiles role check, and TypeScript types + stage checklist constants for all six pipeline stages.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T04:32:47Z
- **Completed:** 2026-03-13T04:34:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- SQL migration creating all four pipeline tables with correct columns, FK to call_analyses, indexes, and admin-only RLS policies
- TypeScript interfaces for PipelineLead, PipelineStageHistory, PipelineChecklistItem, PipelineComm appended to types.ts
- pipeline-constants.ts exporting PIPELINE_STAGES array and STAGE_CHECKLIST_DEFAULTS record covering all six stages with named checklist items

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL migration for pipeline tables** - `3eb4701` (feat)
2. **Task 2: Add TypeScript types and pipeline constants** - `fe787d2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/add_pipeline_tables.sql` - DDL for all four pipeline tables, indexes, RLS policies
- `src/lib/types.ts` - Appended PipelineLead, PipelineStageHistory, PipelineChecklistItem, PipelineComm interfaces plus type aliases
- `src/lib/pipeline-constants.ts` - PIPELINE_STAGES array and STAGE_CHECKLIST_DEFAULTS record

## Decisions Made
None - followed plan as specified. All design decisions were pre-resolved in research doc and STATE.md.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
**SQL migration must be applied to Supabase.** Run in Supabase dashboard SQL editor or via Supabase CLI:

```bash
supabase db push
# or apply manually via Supabase dashboard > SQL Editor
```

File: `supabase/migrations/add_pipeline_tables.sql`

## Next Phase Readiness
- All four pipeline tables defined with correct columns matching TypeScript interfaces
- TypeScript compiles without errors (npx tsc --noEmit)
- Phase 15 (Pipeline API) can now build CRUD endpoints and queries against these tables
- Phase 16 (Pipeline UI) can import types from src/lib/types.ts and constants from src/lib/pipeline-constants.ts
- Phase 17 (Pipeline Analytics) can query pipeline_stage_history for funnel metrics

---
*Phase: 14-database-foundation*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: supabase/migrations/add_pipeline_tables.sql
- FOUND: src/lib/types.ts (with Pipeline types appended)
- FOUND: src/lib/pipeline-constants.ts
- FOUND: .planning/phases/14-database-foundation/14-01-SUMMARY.md
- FOUND: commit 3eb4701 (feat: SQL migration)
- FOUND: commit fe787d2 (feat: TypeScript types and constants)
