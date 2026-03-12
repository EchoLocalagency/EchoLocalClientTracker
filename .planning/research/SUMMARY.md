# Project Research Summary

**Project:** EchoLocal ClientTracker v1.4 -- Client Pipeline Tracker
**Domain:** Admin-only CRM pipeline tracker embedded in existing Next.js + Supabase dashboard
**Researched:** 2026-03-12
**Confidence:** HIGH (architecture from direct codebase review; stack MEDIUM on drag-and-drop library only)

## Executive Summary

This is a purely additive feature milestone: a lightweight CRM pipeline tracker bolted onto an existing Next.js + Supabase admin dashboard. The product is an internal tool for a single operator tracking 5-15 clients through a fixed six-stage lifecycle (Lead -> Demo -> Proposal -> Onboarding -> Active -> Churned). Research is unanimous that the right approach here is deliberate under-engineering. Established CRM tools like HubSpot and Pipedrive default to kanban drag-and-drop, unlimited custom stages, email sync, and AI scoring -- none of which serves a solo operator at this scale. The winning approach is a table view, hardcoded stages, manual communication logging, and predefined per-stage checklists. The entire feature should be buildable in a focused sprint with only two new npm packages.

The recommended architecture follows the established pattern in this codebase: a standalone admin page at `/pipeline` (identical to how `/seo-engine` and `/sales-engine` are built), three new Supabase tables, seven new components, and minor additions to `Sidebar.tsx` and `types.ts`. Nothing about the existing dashboard is changed. The data model is the most consequential decision in this build -- getting the schema right (separate `pipeline_leads` table, stage history log, typed comms table, RLS policies applied immediately) makes every phase that follows clean and fast.

The single highest-risk area is the data model design, not the UI. Research identified seven critical pitfalls, six of which are data model decisions that must be correct in Phase 1 or the recovery cost is high. The pitfall list is explicit: do not bolt pipeline fields onto the existing `clients` table, do not skip the stage history log, do not store checklist state as JSONB, do not omit RLS. If Phase 1 gets these right, Phases 2-6 are largely mechanical UI work with no novel unknowns.

## Key Findings

### Recommended Stack

The existing stack (Next.js, React 19, Supabase JS, Tailwind CSS, Recharts, TypeScript) handles everything except drag-and-drop and date calculations. Only two new packages are needed. The drag-and-drop library question required the most research effort -- every major React DnD library has React 19 friction. `@atlaskit/pragmatic-drag-and-drop` is the only option with a vanillaJS core (no React peer dependency) and confirmed React 19 compatibility as of March 2025. No new UI component libraries are justified; Tailwind utilities and existing card patterns are sufficient throughout. A dropdown-based stage selector is explicitly designed as the fallback if DnD causes issues.

See [STACK.md](.planning/research/STACK.md) for full library comparison, React 19 compatibility notes, and installation commands.

**Core technologies:**
- `@atlaskit/pragmatic-drag-and-drop`: kanban drag-and-drop -- only React 19-safe option; vanillaJS core isolates any issues to a single `'use client'` component
- `date-fns` 4.1.0: date calculations for "days in stage" display -- tree-shakes to under 5KB for the 4 functions needed; no React dependency
- Supabase JS (existing): all data operations -- direct client calls match every existing pattern in the codebase; no ORM added
- Recharts (existing): pipeline funnel and analytics charts -- already installed and working
- Tailwind CSS (existing): all UI layout and card styles -- no new component library justified for an admin-only CRUD interface

**Critical version note:** `@dnd-kit/core` and `@hello-pangea/dnd` both have unresolved React 19 issues. Do not substitute.

### Expected Features

Research calibrated the feature set to the actual use case: one operator, 5-15 clients, internal tool. The feature list is intentionally lean.

See [FEATURES.md](.planning/research/FEATURES.md) for the full prioritization matrix, dependency graph, and competitor comparison.

**Must have (table stakes):**
- Pipeline client records with contact info, trade, source, notes -- the system is useless without this
- Stage assignment + `stage_entered_at` timestamp -- foundation for all analytics
- Stage history log (append-only `pipeline_stage_history`) -- required for accurate conversion rates that account for churned leads
- Pipeline table view with stage count summary -- the primary interface at this scale
- Move-to-stage action (dropdown, records transition to history) -- core interaction
- Per-stage predefined checklists with check/uncheck -- replaces the mental "what to do next" load
- Communication log (typed: call/email/text/meeting with `occurred_at`) -- queryable activity record, not a text blob
- Overdue follow-up highlighting -- surfaces the #1 failure mode for solo operators
- Days in current stage counter -- surfaces stalled leads
- Admin-only sidebar navigation entry

**Should have (add once real data exists post-launch):**
- Pipeline conversion funnel chart via Recharts -- meaningful after 10+ stage transitions
- Avg time per stage stats -- meaningful after 5+ clients per stage
- Source/channel attribution breakdown -- meaningful after 10+ clients logged
- SEO client linkage (link from pipeline record to existing SEO dashboard) -- quick win, low effort

**Defer to v2+:**
- Email/SMS auto-logging via Gmail API or GHL webhooks
- AI-assisted next action suggestions (requires 50+ historical transitions to be non-trivial)
- Revenue/MRR tracking fields
- Multi-user pipeline access

**Anti-features (do not build for v1.4):**
- Kanban drag-and-drop is optional -- a dropdown stage selector is faster to use at 5-15 clients and costs 10x less to build
- Custom per-client checklist items -- creates unbounded data model; the notes field handles client-specific reminders
- Reminder push notifications -- dashboard follow-up highlighting achieves 80% of the value without notification infrastructure
- Custom pipeline stages -- hard-code the 6 stages as a text column; changing stages requires a migration, which is appropriate

### Architecture Approach

The pipeline tracker is a standalone admin page at `/pipeline`, matching the established pattern of `/seo-engine` and `/sales-engine`. It is not a tab in the existing client-scoped dashboard. The page loads all pipeline leads on mount, passes them as props to three view components (Board, Table, Analytics), and fetches checklist and comms data lazily only when a lead's detail drawer opens. Analytics are computed client-side from the already-loaded leads array -- no extra DB queries needed at this scale (50-100 leads max). Three new Supabase tables handle all data; two existing files (Sidebar, types.ts) get minor additive changes; nothing else in the existing codebase is modified.

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for exact SQL schemas, data flow diagrams, component interface specs, anti-patterns to avoid, and the six-phase build order.

**Major components:**
1. `pipeline/page.tsx` -- auth guard, loads all leads on mount, tab switcher (Board/Table/Analytics); identical pattern to `seo-engine/page.tsx`
2. `PipelineBoard.tsx` + `PipelineTable.tsx` -- two views of the same leads array; board groups by stage, table sorts and filters
3. `LeadDrawer.tsx` -- slide-in overlay with editable lead fields, `StageChecklist.tsx`, and `CommunicationLog.tsx`; checklist and comms fetched lazily on drawer open
4. `PipelineAnalytics.tsx` -- stage funnel, avg days per stage, conversion rates; computed client-side from leads prop; built last when real data exists

**New Supabase tables:**
- `pipeline_leads` -- central record per prospect, nullable `client_id` FK to existing `clients` table (set when lead becomes an active onboarded client)
- `pipeline_checklist_items` -- per-lead checklist rows, seeded at stage transition from TypeScript `STAGE_CHECKLIST_DEFAULTS` constant
- `pipeline_comms` -- typed communication log with `comm_type`, `direction`, and `occurred_at` columns

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for full prevention strategies, recovery costs, "looks done but isn't" checklist, and phase-to-pitfall mapping.

1. **Bolting pipeline fields onto the existing `clients` table** -- `clients` is an SEO config record (GA4 IDs, GSC URLs, GHL tokens), not a CRM contact. Adding pipeline fields here creates a god table and risks breaking Python SEO scripts. Create a separate `pipeline_leads` table with nullable `client_id` FK. This decision cannot be undone cheaply.

2. **No stage transition history** -- Storing only `current_stage` and `stage_entered_at` makes conversion rate and avg-time-per-stage analytics impossible. A `pipeline_stage_history` append-only table (5 rows per lead moving through 6 stages) costs near-zero to build and is the only way to correctly compute conversion rates that account for churned leads.

3. **RLS not applied to pipeline tables** -- New Supabase tables have RLS disabled by default. Pipeline data contains prospect names, phone numbers, deal notes, and contact info. A non-admin client user can query `supabase.from('pipeline_leads').select('*')` from the browser console and read everything unless RLS is explicitly enabled with an admin-only policy. Apply RLS in the same migration that creates the tables.

4. **Checklists stored as JSONB on the lead record** -- The fast path (store checked state as a JSON blob) makes completion state unqueryable. Per-lead per-item rows in `pipeline_checklist_items` allow querying which items are blocking leads and adding required items retroactively.

5. **Communication log as free-form text notes** -- A `notes text` column becomes unqueryable. The typed `pipeline_comms` table with `comm_type`, `direction`, and `occurred_at` columns provides the filtering and timeline needed. The `occurred_at` field is critical -- communications logged retroactively must show when the interaction happened, not when Brian typed the note.

6. **Analytics using current stage counts** -- `COUNT(current_stage)` overstates conversion rates and misses churned leads. Conversion funnel queries must read from `pipeline_stage_history`. Do not build analytics until history has 4-6 weeks of data; show a "not enough data yet" placeholder instead of misleading empty charts.

7. **Pipeline added as a tab inside the client-scoped dashboard** -- The existing `page.tsx` is filtered by `activeClient`. Pipeline is a global admin view across all leads. Adding it as a tab requires ugly conditional logic or shows only one client's pipeline (useless). Follow the established `/seo-engine` standalone page pattern.

## Implications for Roadmap

The combined research strongly suggests a six-phase build order. The ordering is driven by hard data model dependencies (no component can compile without tables), the pitfall map (six of seven critical pitfalls are Phase 1 decisions), and the principle that Brian should be able to add real leads and move them through stages before the UI is fully polished. Real usage data is required for Phase 6 analytics to be meaningful.

### Phase 1: Database Foundation

**Rationale:** Every other phase depends on correct tables and types. Six of seven critical pitfalls are data model decisions -- getting this right is worth more than rushing to visible UI. The table boundary decision (separate `pipeline_leads` vs. bolting onto `clients`) and RLS application cannot be undone cheaply once data exists.

**Delivers:** Three new Supabase tables (`pipeline_leads`, `pipeline_checklist_items`, `pipeline_comms`) with indexes and RLS policies applied; TypeScript interfaces added to `types.ts`; `STAGE_CHECKLIST_DEFAULTS` TypeScript constant defined; migration file committed and run against Supabase.

**Addresses:** All P1 features that require a data model (client records, stage timestamps, checklists, comms log)

**Avoids:** Pitfalls 1 (clients table collision), 2 (no history -- add `pipeline_stage_history` here), 3 (JSONB checklists), 4 (text blob comms), 5 (missing RLS)

**Research flag:** No additional research needed. Schema is fully specified in ARCHITECTURE.md with exact SQL. RLS policy pattern is in PITFALLS.md. Follow precisely.

### Phase 2: Page Shell + Sidebar Navigation

**Rationale:** Routing and auth guard must exist before any component can be rendered at the route. The sidebar link gives immediate visible progress -- Brian can navigate to `/pipeline` after this phase even though it shows only empty states. The standalone page pattern must be established here, before any pipeline components are built.

**Delivers:** `src/app/pipeline/page.tsx` with `useAuth()` guard (redirect if not admin), leads load on mount, Board/Table/Analytics tab switcher with empty state placeholders; "Pipeline" link added to Sidebar Engine links section in purple.

**Avoids:** Pitfall 7 (pipeline as a client-scoped tab -- the standalone page pattern is established in this phase, not as an afterthought)

**Research flag:** No additional research needed. Pattern is identical to `seo-engine/page.tsx` -- directly replicable in 30 minutes.

### Phase 3: Board View + Stage Transitions

**Rationale:** The board is the primary user-facing view. Building it before the table or analytics means Brian can start adding real leads and moving them through stages -- which generates the `pipeline_stage_history` data that all Phase 6 analytics depend on. Every stage transition must write to both `pipeline_leads` (current state) and `pipeline_stage_history` (audit log) in the same operation.

**Delivers:** `LeadCard.tsx`, `PipelineBoard.tsx` with six stage columns, "New Lead" inline form, move-to-stage dropdown action (UPDATE lead + INSERT history row + INSERT new stage checklist items), days-in-stage display via `date-fns`.

**Uses:** `@atlaskit/pragmatic-drag-and-drop` (isolated to `'use client'` component); `date-fns` `formatDistanceToNow` and `differenceInDays`

**Avoids:** Pitfall 2 verification -- stage advance action writes to `pipeline_stage_history` atomically with the `pipeline_leads` update

**Research flag:** Drag-and-drop is the only technically uncertain area. Install `@atlaskit/pragmatic-drag-and-drop` at Phase 3 start and run `npm run build`. If TypeScript or JSX errors appear, use the dropdown-only fallback -- it is fully designed in STACK.md and requires no library. Decide at implementation time; do not pre-assume either path.

### Phase 4: Lead Drawer (Details + Checklist + Comms)

**Rationale:** The drawer is the depth layer on top of the board. It enables the full daily workflow: edit lead fields, check off stage tasks, log calls and emails. This is where most time in the app is spent after initial lead entry. Completing the board + drawer workflow before the table view means Brian has a fully functional tool after Phase 4.

**Delivers:** `LeadDrawer.tsx` with editable lead fields; `StageChecklist.tsx` with per-stage checkbox completions stored as queryable `pipeline_checklist_items` rows; `CommunicationLog.tsx` with chronological timeline sorted by `occurred_at` and quick-add form (type selector, direction toggle, `occurred_at` datetime defaulting to now, summary field).

**Avoids:** Pitfall 4 -- typed comm form with explicit `occurred_at` field, not a textarea with `created_at` as the interaction time

**Research flag:** No additional research needed. Data model and component structure fully specified in ARCHITECTURE.md.

### Phase 5: Table View

**Rationale:** The table view is a UX convenience, not new functionality. It reuses the leads array already loaded by `pipeline/page.tsx` in Phase 2 with no new data fetching. It is lower priority than the board + drawer workflow and can be skipped in the initial sprint if timeline is tight.

**Delivers:** `PipelineTable.tsx` with sortable columns (name, stage, trade, source, days in stage, last comm date), stage filter dropdown, overdue follow-up row highlighting in red.

**Research flag:** Standard Tailwind + React state implementation. No research needed.

### Phase 6: Analytics

**Rationale:** Analytics are built last because they require real data to be meaningful. Building analytics before leads exist produces empty charts that look broken. The "not enough data" placeholder is the correct default -- show it until 30+ days of stage history exist. Conversion rates must query `pipeline_stage_history`, not current stage counts.

**Delivers:** `PipelineAnalytics.tsx` with stage count bar chart (Recharts `BarChart`), conversion funnel (Lead -> Demo -> Proposal -> Onboarding -> Active with % between each), avg days per stage stat cards, source attribution breakdown; all computed client-side from the already-loaded leads prop.

**Avoids:** Pitfall 6 -- conversion rate logic reads from `pipeline_stage_history` rows, not `COUNT(current_stage)`; placeholder displayed until sufficient history exists

**Research flag:** No additional research needed. Recharts `BarChart` is established in the codebase. Analytics computation logic is specified in ARCHITECTURE.md with the exact query approach.

### Phase Ordering Rationale

- Phase 1 first: tables and TypeScript types must exist before any component can compile. RLS must be applied before any non-admin user can potentially access the Supabase client.
- Phase 2 before Phase 3: the page route must exist before components can render at it; the standalone page pattern must be established before any pipeline component is built.
- Phase 3 before Phase 4: the board generates real stage history data; the drawer is a detail layer that sits on top. Brian can use the pipeline (add leads, advance stages) after Phase 3 -- before Phase 4 is polished.
- Phase 4 before Phase 5: completing the core workflow before adding the table view convenience. If only one could ship, Phase 4 delivers more value.
- Phase 6 last: analytics are only honest once `pipeline_stage_history` has weeks of real data. Placeholder is the correct output until then.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (drag-and-drop):** `@atlaskit/pragmatic-drag-and-drop` React 19 compatibility is confirmed for the core package but the optional React packages are not directly tested by maintainers against React 19. Test at implementation time; fallback path (dropdown-only stage selector) is fully designed and requires zero library. This is the only technical uncertainty in the entire build.

Phases with standard patterns (skip research):
- **Phase 1:** Schema fully specified in ARCHITECTURE.md with exact SQL. RLS policy from PITFALLS.md. No unknowns.
- **Phase 2:** Identical to `seo-engine/page.tsx` pattern -- directly replicable.
- **Phase 4:** Data model specified, component structure specified, no novel patterns.
- **Phase 5:** Standard Tailwind + React state table. No research needed.
- **Phase 6:** Recharts `BarChart` is already in the codebase. Analytics computation fully specified in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Existing stack is HIGH confidence. Drag-and-drop library is MEDIUM -- core package React 19-safe confirmed, optional React packages "should work" per maintainers but not directly tested. Fallback option fully designed. date-fns is HIGH confidence. |
| Features | HIGH | Based on direct codebase review + PROJECT.md milestone spec + validated against CRM design literature from multiple sources. Single-operator use case is well-understood. Feature scope is appropriately constrained to the actual scale. |
| Architecture | HIGH | Based on direct review of `seo-engine/page.tsx`, `Sidebar.tsx`, `types.ts`, `auth-context.tsx`, and existing migration files. All patterns are established in the codebase -- this is replication and extension, not invention. |
| Pitfalls | HIGH | Based on direct codebase analysis (identified existing `clients` table structure, existing RLS gap), Supabase official RLS docs, and CRM database design literature. Seven critical pitfalls are concrete and actionable with specified recovery costs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Drag-and-drop React 19 compatibility:** Verify at Phase 3 start by installing `@atlaskit/pragmatic-drag-and-drop` and running `npm run build`. If TypeScript or JSX errors appear, switch to dropdown-only stage advance before writing any DnD-dependent code. Do not block Phase 3 planning on this -- the fallback is fully designed.

- **RLS verification method:** SQL editor in Supabase bypasses RLS (runs as postgres superuser). RLS must be tested via the Supabase JS client authenticated as a non-admin user in browser devtools. This is not an unknown -- it is a specific test step that must be executed after Phase 1, not assumed to work.

- **`client_profiles` table overlap:** The existing `client_profiles` table (directory submission context) may share entities with `pipeline_leads` for clients who are already active. Evaluate at Phase 1: either use a FK from `pipeline_leads` to `client_profiles` for active clients, or keep `pipeline_leads.client_id` as the only bridge to the `clients` table. Low-stakes decision at 5-15 clients; document whichever path is chosen.

- **Analytics data readiness:** Phase 6 analytics are only meaningful after 4-6 weeks of pipeline use. The "not enough data" placeholder state is a UX decision that must be explicitly implemented, not skipped. Define the threshold (30 stage transitions? 30 days of history?) during Phase 6 planning.

## Sources

### Primary (HIGH confidence)
- Direct codebase review: `src/app/seo-engine/page.tsx`, `src/components/Sidebar.tsx`, `src/lib/types.ts`, `src/lib/auth-context.tsx`, `supabase/migrations/add_directory_system_tables.sql` -- established patterns
- `.planning/PROJECT.md` v1.4 milestone spec -- feature scope and stage definitions
- Supabase RLS documentation -- RLS disabled by default on new tables; SQL editor bypasses RLS
- Supabase RLS performance guide -- index requirements for policy columns (user_profiles.user_id)
- Atlassian Design: pragmatic-drag-and-drop core package -- vanillaJS, no React peer dependency confirmed

### Secondary (MEDIUM confidence)
- pragmatic-drag-and-drop GitHub issue #181 -- React 19 support status, maintainer notes
- dnd-kit GitHub issue #1511 -- unresolved TypeScript JSX errors with React 19 (reason for exclusion)
- @hello-pangea/dnd GitHub discussion #810 -- explicit React 19 peer dep exclusion (reason for exclusion)
- date-fns npm v4.1.0 -- ESM tree-shaking, TypeScript types confirmed
- CRM pipeline design literature (Cirrus Insight, Outreach.io, CaptivateIQ, OnePage CRM, Scratchpad) -- stage patterns, analytics metrics, communication log UX, common failure modes
- January 2025 Supabase RLS exposure report -- 83% of exposed databases involved RLS misconfiguration

### Tertiary (LOW confidence)
- puckeditor.com drag-and-drop library comparison 2026 -- ecosystem overview, used for corroboration only

---
*Research completed: 2026-03-12*
*Supersedes v1.2 research summary (Directory Submission)*
*Ready for roadmap: yes*
