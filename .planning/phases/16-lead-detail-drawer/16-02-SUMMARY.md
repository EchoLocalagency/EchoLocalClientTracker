---
phase: 16-lead-detail-drawer
plan: 02
subsystem: ui
tags: [react, supabase, checklist, comms-log, pipeline]

requires:
  - phase: 16-lead-detail-drawer
    plan: 01
    provides: LeadDrawer shell with profile edit and stage timeline
provides:
  - Interactive stage-specific checklist with Supabase upsert persistence
  - Communication log with add-entry form and optimistic timeline
  - Fully functional lead detail drawer integrated into pipeline page
affects:
  - src/components/pipeline/LeadDrawer.tsx (placeholder sections replaced)

tech-stack:
  patterns:
    - Optimistic UI with rollback on Supabase error
    - Merge DB rows with stage defaults for checklist display
    - Upsert with onConflict for idempotent checklist toggle
    - Optimistic insert with UUID replacement on comms log

key-files:
  created:
    - src/components/pipeline/LeadChecklist.tsx
    - src/components/pipeline/CommsLog.tsx
  modified:
    - src/components/pipeline/LeadDrawer.tsx

decisions:
  - Synthetic IDs (synthetic-{key}) for checklist items not yet in DB, replaced on first toggle
  - Comms form defaults to outbound direction (admin is always the sender)
  - Timeline sorted descending by occurred_at (newest first)

metrics:
  duration: 2min
  completed: "2026-03-13T05:22:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 16 Plan 02: Checklist and CommsLog Drawer Sections Summary

Stage-specific checklist with optimistic toggle via Supabase upsert, and communication log with add-entry form using optimistic insert and UUID replacement.

## What Was Built

### LeadChecklist Component
- Merges DB `pipeline_checklist_items` rows with `STAGE_CHECKLIST_DEFAULTS` for current stage
- Items not yet in DB get synthetic IDs and render as unchecked
- Toggle handler does optimistic flip then Supabase upsert with `onConflict: 'lead_id,stage,item_key'`
- Shows "{done}/{total} complete" progress text
- Reverts on error

### CommsLog Component
- Add-entry form: comm_type select (call/email/text), notes textarea, datetime-local input
- Submit creates optimistic entry with `crypto.randomUUID()`, prepends to array, resets form
- On DB success, replaces optimistic entry with real row (correct id)
- On error, removes optimistic entry
- Timeline renders each comm with type badge, notes, and formatted date

### Drawer Integration
- Replaced placeholder divs in LeadDrawer with real `<LeadChecklist>` and `<CommsLog>` components
- Pipeline page already had row click, stopPropagation, and LeadDrawer wiring from 16-01

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 65e36cc | Create LeadChecklist and CommsLog components |
| 2 | 2601948 | Wire components into LeadDrawer, replacing placeholders |

## Deviations from Plan

None - plan executed exactly as written. Pipeline page wiring (selectedLeadId, row onClick, stopPropagation, LeadDrawer render) was already completed in plan 16-01, so Task 2 only needed the drawer file update.

## Verification

- TypeScript compiles with no errors
- Production build succeeds
- All component files exist under src/components/pipeline/
