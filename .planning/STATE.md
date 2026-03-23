---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Client Pipeline Tracker
status: in-progress
last_updated: "2026-03-23T19:11:00Z"
progress:
  total_phases: 19
  completed_phases: 18
  total_plans: 34
  completed_plans: 34
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Fix all issues identified in the SEO engine audit -- protect manual tuning, prevent wasted brain cycles, add missing data signals, harden content quality gates.
**Current focus:** Phase 19 -- Core Update Adaptation

## Current Position

Phase: 19 of 19 (Core Update Adaptation)
Plan: 3 of 3 (completed)
Status: In Progress
Last activity: 2026-03-23 -- Completed 19-03 (Entity Consistency + Brain Update Rules)

Progress: [##########] 100%

## Performance Metrics

**Velocity (from v1.0-v1.3):**
- Total plans completed: 21 (v1.0: 8, v1.1: 6, v1.2: 7)
- Average duration: 3.1min per plan
- Total execution time: ~1.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-4 (v1.0) | 8 | ~25min | ~3.1min |
| 5-7 (v1.1) | 6 | ~19min | ~3.1min |
| 8-12 (v1.2) | 7 | ~22min | ~3.1min |
| Phase 15-page-shell-pipeline-table P01 | 1min | 1 tasks | 2 files |
| Phase 15-page-shell-pipeline-table P02 | 2min | 1 tasks | 1 files |
| Phase 16-lead-detail-drawer P01 | 2min | 2 tasks | 4 files |
| Phase 16-lead-detail-drawer P02 | 2min | 2 tasks | 3 files |
| Phase 17-pipeline-analytics P01 | 2min | 1 tasks | 2 files |
| Phase 17-pipeline-analytics P02 | 1min | 1 tasks | 1 files |
| Phase 18-seo-engine-hardening P01 | 2min | 2 tasks | 3 files |
| Phase 18-seo-engine-hardening P03 | 2min | 3 tasks | 3 files |
| Phase 18 P02 | 7min | 3 tasks | 6 files |
| Phase 18-seo-engine-hardening P04 | 3min | 3 tasks | 5 files |
| Phase 18-seo-engine-hardening P05 | 3min | 6 tasks | 7 files |
| Phase 19-core-update-adaptation P01 | 2min | 4 tasks | 7 files |
| Phase 19-core-update-adaptation P03 | 4min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent:
- v1.4 roadmap: 4 phases (14-17) derived from 19 requirements across 4 categories
- Separate pipeline_leads table (not bolting onto clients table) -- research pitfall #1
- Stage history as append-only table (not just current_stage) -- research pitfall #2
- Checklist items as queryable rows (not JSONB) -- research pitfall #4
- Analytics query stage history (not COUNT current_stage) -- research pitfall #6
- Standalone /pipeline page (not a tab in client-scoped dashboard) -- research pitfall #7
- No drag-and-drop for v1.4 -- dropdown stage selector is faster at 5-15 clients
- UNIQUE(lead_id, stage, item_key) constraint prevents duplicate checklist items on upsert
- stage_entered_at column must be updated alongside stage column on every stage change
- store_analysis() extended to 4-arg signature so call object is available for pipeline lead creation without a second DB fetch
- Duplicate detection checks phone (exact) first, then company_name (ilike) -- prevents duplicates without blocking re-contacts
- SQL migration applied via Supabase MCP (no Supabase CLI configured in this project)
- Pipeline link placed before Agents in sidebar, purple #A78BFA to distinguish from other engine links
- isAdmin prop added to Sidebar component for conditional admin-only link rendering
- Pipeline page: row hover via React state (inline styles can't use :hover), stage sort by workflow order not alpha, checklist denominator from STAGE_CHECKLIST_DEFAULTS when no DB items
- Portal drawer pattern: backdrop + panel via ReactDOM.createPortal, Escape/click-to-close, body scroll lock
- Inline edit pattern: click field -> input/textarea, blur/Enter saves, optimistic update with revert on error
- Drawer wired into pipeline page with row click and stopPropagation on stage select
- Synthetic IDs for checklist items not yet in DB, replaced on first toggle via upsert
- Comms form defaults to outbound direction, timeline sorted descending
- Funnel derived from stage history (not current stage counts) per research pitfall #6
- Leads with no history entries included in Lead stage avg days via stage_entered_at fallback
- isOverdue excludes Churned leads, flags never-contacted as overdue, uses 7-day threshold
- manual_overrides is a protected sub-object in engine_tuning.json that self_improve never writes to
- Suppressions union-merged (manual + auto) so both sources always apply; brain re-merges at load time as safety net
- GEO bottom-5 added as section 9c in brain prompt for gap prioritization
- Impact scoring branches on action_type: content (pos+imp+clicks), GBP (gbp_imp+calls), photo (views), fallback
- [Phase 18]: Brain retry on full suppression: pre-filter actions, retry once with available_types hint
- [Phase 18]: SoCal blog engine: SITE_CONFIG entry + custom template + blog index with existing posts
- [Phase 18-04]: Review velocity from local JSON history, competitor positions in keyword_snapshots JSONB, cluster health via GSC keyword matching
- [Phase 18]: Trigram Jaccard at 0.7 threshold for location page duplicate detection
- [Phase 18]: Image alt text issues as warnings, not blocking rejections
- [Phase 18]: Homepage internal link cap = 1 (vs 3 for other pages)
- [Phase 19-01]: HowTo detection: OL first, Step N H3 fallback; BreadcrumbList uses path-based detection
- [Phase 19-01]: Blog templates already had Last updated placeholder; page_optimizer refreshes date on edits
- [Phase 19-03]: Only add verified sameAs URLs -- curl-checked before adding to clients.json
- [Phase 19-03]: Entity completeness checks sameAs array first, falls back to schema type presence
- [Phase 19-03]: GEO score max updated from 5 to 6 across all references

### Pending Todos

None yet.

### Blockers/Concerns

- Instantly API key returned 401 on 2026-03-08 (unrelated to v1.4)

## Session Continuity

Last session: 2026-03-23
Stopped at: Completed 19-03-PLAN.md (Entity Consistency + Brain Update Rules)
Resume file: None
