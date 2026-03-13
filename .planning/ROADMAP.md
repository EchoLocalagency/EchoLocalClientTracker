# Roadmap: GEO Module for SEO Engine

## Overview

Add Generative Engine Optimization to the existing SEO engine. v1.0 built the data foundation (SerpAPI, GEO scoring, brain integration, entity building). v1.1 extends with mention tracking via Brave Search, surfaces all GEO data in the dashboard, and cleans up v1.0 tech debt. v1.2 adds automated directory submission and tracking -- submitting clients to 30+ niche directories GHL/Yext misses, verifying listings, and surfacing coverage in the dashboard. v1.3 expanded GSC keyword history to store all queries daily. v1.4 adds a client pipeline tracker -- an admin-only CRM view to track every prospect from first contact through active engagement or churn.

## Milestones

- v1.0 **GEO Module** -- Phases 1-4 (shipped 2026-03-10)
- v1.1 **Mention Tracking + GEO Dashboard** -- Phases 5-7 (shipped 2026-03-11)
- v1.2 **Directory Submission & Tracking** -- Phases 8-12 (shipped 2026-03-11)
- v1.3 **GSC Keyword History** -- Phase 13 (shipped 2026-03-12)
- v1.4 **Client Pipeline Tracker** -- Phases 14-17 (in progress)

## Phases

<details>
<summary>v1.0 GEO Module (Phases 1-4) -- SHIPPED 2026-03-10</summary>

- [x] Phase 1: SerpAPI Foundation (2/2 plans) -- completed 2026-03-10
- [x] Phase 2: GEO Scoring + AI Overview Detection (2/2 plans) -- completed 2026-03-10
- [x] Phase 3: Brain Integration + Content Upgrades (2/2 plans) -- completed 2026-03-10
- [x] Phase 4: Entity + Authority Building (2/2 plans) -- completed 2026-03-10

See: milestones/v1.0-ROADMAP.md for full details

</details>

<details>
<summary>v1.1 Mention Tracking + GEO Dashboard (Phases 5-7) -- SHIPPED 2026-03-11</summary>

- [x] **Phase 5: Brave Infrastructure + Mention Tracking + Tech Debt** - Brave client, Reddit mining, cross-platform mentions, competitor AIO monitoring, and v1.0 debt cleanup
- [x] **Phase 6: GEO Dashboard (Existing Data)** - GEO scores, citation status, budget gauge, and snippet tracker using data already in Supabase
- [x] **Phase 7: Trends + Source Diversity** - Citation trend charts and source diversity scoring/visualization using accumulated Phase 5 data

</details>

<details>
<summary>v1.2 Directory Submission & Tracking (Phases 8-12) -- SHIPPED 2026-03-11</summary>

- [x] **Phase 8: Data Foundation + Discovery** - Supabase tables, client profiles, directory master list, CAPTCHA audit, and pre-existing listing detection
- [x] **Phase 9: Submission Engine** - Playwright auto-submission for Tier 3 directories with rate limiting, state machine, NAP audit, and failure capture
- [x] **Phase 10: Verification Loop** - Brave Search site: verification at 7/14/21 day intervals with escalation to Brian
- [x] **Phase 11: Brain Integration** - Directory coverage summary in brain prompt and submission logging to seo_actions
- [x] **Phase 12: Directory Dashboard** - Directories tab with status grid, tier progress bars, Tier 1/2 recommendations, and backlink value score

</details>

<details>
<summary>v1.3 GSC Keyword History (Phase 13) -- SHIPPED 2026-03-12</summary>

- [x] **Phase 13: Full GSC Keyword History** - Store ALL GSC queries daily (not top 25), backfill from existing data, update dashboard sparklines/graphs to show full history

</details>

### v1.4 Client Pipeline Tracker

- [ ] **Phase 14: Database Foundation + Sales Engine Integration** - Supabase tables (pipeline_leads, pipeline_stage_history, pipeline_checklist_items, pipeline_comms), TypeScript types, RLS policies, checklist constants, auto-create leads from sales engine "meeting_booked" calls
- [ ] **Phase 15: Page Shell + Pipeline Table** - Admin-only /pipeline page, sidebar link, table view with stage/source/days-in-stage columns, filtering, sorting, stage summary cards, stage transition dropdown
- [ ] **Phase 16: Lead Detail Drawer** - Slide-out drawer with editable lead profile, stage-specific checklist with check/uncheck, communication log with typed entries
- [ ] **Phase 17: Pipeline Analytics** - Conversion funnel from stage history, average days per stage, source/channel breakdown chart, overdue follow-up highlighting

## Phase Details

### Phase 14: Database Foundation
**Goal**: All pipeline data structures exist in Supabase with correct table boundaries, RLS protection, and TypeScript types so every downstream component compiles against real schemas
**Depends on**: Phase 13 (v1.3 complete)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. Admin can insert a pipeline lead record with contact name, email, phone, trade, source/channel, and notes via the Supabase client, and the record persists with a stage and stage_entered_at timestamp
  2. Moving a lead to a new stage creates an append-only row in pipeline_stage_history with the previous stage, new stage, and transition timestamp
  3. Predefined checklist items for each stage are defined as a TypeScript constant (STAGE_CHECKLIST_DEFAULTS), and per-lead checklist completion is stored as individual queryable rows in pipeline_checklist_items (not JSONB)
  4. Communication log entries (call, email, text) with notes, direction, and occurred_at timestamp can be inserted into pipeline_comms per lead
  5. A non-admin user authenticated via Supabase cannot read any pipeline table -- RLS policies restrict all pipeline tables to admin users only
  6. When analyze_calls.py produces a "meeting_booked" or "closed" outcome, a pipeline lead is auto-created in the Lead stage with contact info from the call, source set to "sales_engine", and a reference to the call_analysis record
  7. If a lead already exists for the same phone number or company name, no duplicate is created
**Plans**: 2 plans
Plans:
- [ ] 14-01-PLAN.md -- SQL migration, TypeScript types, pipeline constants (DATA-01 through DATA-06)
- [ ] 14-02-PLAN.md -- Python sales engine integration + run migration (INT-01 through INT-03)

### Phase 15: Page Shell + Pipeline Table
**Goal**: Admin navigates to a dedicated /pipeline page and sees all leads in a sortable, filterable table with stage counts, days-in-stage tracking, and inline stage transitions
**Depends on**: Phase 14
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. A "Pipeline" link appears in the sidebar for admin users only, and clicking it navigates to /pipeline -- non-admin users do not see the link
  2. The pipeline table displays every lead with columns for name, stage, trade, source, days in current stage, checklist progress (X/Y), and last contact date
  3. Admin can filter the table by stage and sort by any column, and the view updates immediately
  4. Admin can change a lead's stage via a dropdown in the table row, which updates the lead record and creates a stage history entry in one operation
  5. Stage summary cards at the top of the page show the count of leads in each of the six stages (Lead, Demo, Proposal, Onboarding, Active, Churned)
**Plans**: 2 plans
Plans:
- [ ] 14-01-PLAN.md -- SQL migration, TypeScript types, pipeline constants (DATA-01 through DATA-06)
- [ ] 14-02-PLAN.md -- Python sales engine integration + run migration (INT-01 through INT-03)

### Phase 16: Lead Detail Drawer
**Goal**: Admin clicks any lead to open a slide-out drawer with the complete lead profile, stage-specific checklist, and communication timeline -- the daily workflow hub for managing each prospect
**Depends on**: Phase 15
**Requirements**: DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04
**Success Criteria** (what must be TRUE):
  1. Clicking a lead row in the pipeline table opens a slide-out drawer showing the full lead profile, stage history timeline, current stage checklist, and chronological communication log
  2. Admin can edit any lead profile field (name, email, phone, trade, source, notes) inline in the drawer, and changes save to Supabase without closing the drawer
  3. Admin can add a communication log entry from the drawer by selecting type (call/email/text), entering notes, and optionally adjusting the occurred_at timestamp -- the entry appears immediately in the timeline
  4. The drawer shows stage-specific checklist items that the admin can check/uncheck, with completion state persisted per-lead in pipeline_checklist_items
**Plans**: 2 plans
Plans:
- [ ] 14-01-PLAN.md -- SQL migration, TypeScript types, pipeline constants (DATA-01 through DATA-06)
- [ ] 14-02-PLAN.md -- Python sales engine integration + run migration (INT-01 through INT-03)

### Phase 17: Pipeline Analytics
**Goal**: Admin sees pipeline health at a glance -- where leads come from, how fast they move through stages, where they stall, and which prospects need immediate follow-up
**Depends on**: Phase 15 (needs leads data and stage history)
**Requirements**: ANAL-01, ANAL-02, ANAL-03, ANAL-04
**Success Criteria** (what must be TRUE):
  1. A conversion funnel chart shows lead counts at each stage with percentage drop-off between stages, computed from pipeline_stage_history (not current stage counts alone)
  2. Average days per stage is displayed as a metric for each of the six stages, computed from stage history transition timestamps
  3. A source/channel breakdown chart shows where leads originate (referral, cold email, website, etc.) with counts per source
  4. Leads with no communication logged in 7+ days are visually highlighted as overdue in the pipeline table, making stalled prospects immediately obvious
**Plans**: 2 plans
Plans:
- [ ] 14-01-PLAN.md -- SQL migration, TypeScript types, pipeline constants (DATA-01 through DATA-06)
- [ ] 14-02-PLAN.md -- Python sales engine integration + run migration (INT-01 through INT-03)

## Progress

**Execution Order:**
Phases 14-17 execute sequentially. Phase 17 can begin after Phase 15 (needs stage history data but not the drawer).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. SerpAPI Foundation | v1.0 | 2/2 | Complete | 2026-03-10 |
| 2. GEO Scoring + AI Overview Detection | v1.0 | 2/2 | Complete | 2026-03-10 |
| 3. Brain Integration + Content Upgrades | v1.0 | 2/2 | Complete | 2026-03-10 |
| 4. Entity + Authority Building | v1.0 | 2/2 | Complete | 2026-03-10 |
| 5. Brave Infra + Mention Tracking + Tech Debt | v1.1 | 2/2 | Complete | 2026-03-11 |
| 6. GEO Dashboard (Existing Data) | v1.1 | 2/2 | Complete | 2026-03-11 |
| 7. Trends + Source Diversity | v1.1 | 2/2 | Complete | 2026-03-11 |
| 8. Data Foundation + Discovery | v1.2 | 3/3 | Complete | 2026-03-11 |
| 9. Submission Engine | v1.2 | 2/2 | Complete | 2026-03-11 |
| 10. Verification Loop | v1.2 | 1/1 | Complete | 2026-03-11 |
| 11. Brain Integration | v1.2 | 1/1 | Complete | 2026-03-11 |
| 12. Directory Dashboard | v1.2 | 1/1 | Complete | 2026-03-11 |
| 13. Full GSC Keyword History | v1.3 | 2/2 | Complete | 2026-03-12 |
| 14. Database Foundation | v1.4 | 0/? | Not started | - |
| 15. Page Shell + Pipeline Table | v1.4 | 0/? | Not started | - |
| 16. Lead Detail Drawer | v1.4 | 0/? | Not started | - |
| 17. Pipeline Analytics | v1.4 | 0/? | Not started | - |
