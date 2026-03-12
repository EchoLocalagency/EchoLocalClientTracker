# Feature Research: v1.4 Client Pipeline Tracker

**Domain:** Internal CRM / client pipeline tracker embedded in existing Next.js + Supabase admin dashboard
**Researched:** 2026-03-12
**Confidence:** HIGH

## Context

This is a SUBSEQUENT MILESTONE. The dashboard already has: Supabase auth with admin roles, client profiles (directory submission context), SEO tab, GEO tab, keyword tracking, directory submission tracker, Recharts for data visualization. The pipeline tracker adds an admin-only CRM view to the existing sidebar navigation.

The use case is a single operator (Brian) tracking 5-15 clients through a defined sales and onboarding lifecycle. This is NOT a multi-user sales team CRM. Complexity should be calibrated to that reality.

Pipeline stages defined: Lead -> Demo -> Proposal -> Onboarding -> Active -> Churned

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the system is useless without. Missing any means Brian keeps using sticky notes and memory.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pipeline stage column view | The core mental model of any pipeline. Need to see all clients grouped by stage at a glance. Kanban OR table both work -- table is faster to build and sufficient for 5-15 clients. | LOW | Single table with stage column. Filter/group by stage. No drag-and-drop required at this scale. |
| Client record with contact info | Name, business name, phone, email, trade/industry, source channel (referral, cold email, demo request, etc.), notes. Without this it is just a list of names. | LOW | Supabase table `pipeline_clients`. Many fields already exist in `client_profiles` for directory clients -- extend or link, do not duplicate. |
| Stage transitions with timestamps | When a client moves to a new stage, record when. This is the foundation for all analytics. Without timestamps, "avg time in stage" is impossible. | LOW | `stage_history` table: client_id, stage, entered_at, exited_at. Or simpler: `current_stage` + `stage_entered_at` columns on client record plus a separate history log. |
| Per-stage predefined checklists | Every stage has standard tasks. Without a checklist, the operator must remember what to do next for every client in every stage. Standard industry practice. | MEDIUM | `checklist_items` table: stage, item_text, sort_order. `client_checklist_completions`: client_id, checklist_item_id, completed_at, completed_by. Predefined items per stage -- not per-client custom tasks (see anti-features). |
| Communication log | Record calls, emails, and texts per client with date, type, and notes. Without this the history lives in Brian's head and is lost when clients churn and re-engage. | MEDIUM | `communication_log` table: client_id, type (call/email/text/meeting), direction (inbound/outbound), logged_at, notes, follow_up_date. Manual entry only -- no email sync needed at this scale. |
| Days in current stage counter | Surfaces clients that are stalled. "This lead has been in Demo stage for 14 days" is a signal to follow up. Universal in pipeline tools. | LOW | Computed: `NOW() - stage_entered_at`. Display in pipeline view alongside client name. |
| Stage count summary | How many clients in each stage right now. The highest-value single metric for a solo operator. | LOW | Simple count query grouped by stage. Display as badge counts or summary row at top of pipeline view. |

### Differentiators (Competitive Advantage)

Features that make this better than a spreadsheet or a generic CRM that does not know the SEO context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Context-aware onboarding checklist | The Onboarding stage checklist can include items specific to Echo Local's workflow: "GBP connected," "SEO tags done," "Drive folder shared," "Site published to Netlify." No generic CRM knows this. | LOW | Hard-code the onboarding checklist items based on the actual Echo Local workflow (documented in MEMORY.md active context). These items are already in Brian's head -- just formalize them. |
| SEO client linkage | Active clients in the pipeline are the same clients in `clients.json` and the SEO engine. The pipeline view should link directly to that client's SEO dashboard tab. One click from pipeline record to SEO performance. | LOW | Store a `client_slug` or `client_id` foreign key that matches the existing dashboard client identifier. Render a link to `/dashboard?client=mr-green-turf-clean` from the pipeline record. |
| Pipeline conversion funnel chart | Stage count + conversion rate between stages in a single Recharts visualization. Shows where leads are falling off (e.g., "80% of demos never become proposals"). Recharts is already installed and used in the dashboard. | MEDIUM | Funnel chart or bar chart: count per stage + percentage conversion Lead->Demo, Demo->Proposal, etc. Computed from `stage_history` data. Recharts BarChart or custom funnel shape. |
| Avg time per stage analytics | "Demos are sitting 11 days on average before becoming proposals." Flags process bottlenecks that cost revenue. Stage timestamp data enables this with no additional data collection. | LOW | Query: AVG(exited_at - entered_at) grouped by stage. Display as a simple stats row. Only meaningful once there are 5+ transitions per stage, but the data model supports it from day one. |
| Follow-up date tracking on communication logs | After each communication, set a follow-up date. Surface overdue follow-ups as a highlighted row in the pipeline view. Prevents the #1 failure mode for solo operators: forgetting to follow up. | LOW | `follow_up_date` column on `communication_log`. Dashboard query: fetch clients where any communication has `follow_up_date < NOW()`. Highlight row red or surface in a "needs attention" section. |
| Source/channel attribution | Track where each client came from (cold email, referral, demo request, Thumbtack, etc.). Over time this shows which channels produce clients that actually convert and retain. | LOW | `source` enum/text field on client record. No additional complexity -- just consistent data entry. Display in analytics as simple breakdown by source. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-client custom checklist items | "Every client is unique, I need custom tasks." | Creates an unbounded data model. Custom items per client multiply complexity: now you need a task editor UI, custom ordering, and the system becomes a full project management tool. At 5-15 clients, the operator is better served by notes. | Use the notes field on the client record for client-specific reminders. Predefined stage checklists cover 90% of recurring tasks. |
| Email/SMS integration (auto-log from Gmail/GHL) | "Log communications automatically without manual entry." | OAuth email sync is a separate engineering project (2-5 days). Gmail API parsing is fragile. GHL webhook setup requires per-client sub-account tokens. The value at 5-15 clients does not justify the complexity. | Manual communication log entry. 30 seconds to log a call note. Already documented in the Google Auth pattern -- revisit in v1.5 if log entry becomes a real pain point. |
| Kanban drag-and-drop board | Looks great in demos. Drag-and-drop is the first thing developers add to pipeline tools. | At 5-15 clients, a table view with a "move to stage" dropdown is faster to use and requires 1/10th the implementation effort. Kanban adds real value when you have 50+ deals and need visual density. | Table view with stage filter. "Move to stage" action via a simple dropdown select. |
| AI lead scoring / priority ranking | "Automatically score which leads are hottest." | Requires training data (historical conversions) and an inference model. No historical data exists yet. Would produce meaningless scores for the first 6 months. | Manual notes + days-in-stage counter surfaces stalled clients just as effectively at this scale. Add AI scoring in v2 once 50+ pipeline transitions exist. |
| Reminder notifications / alerts system | "Ping me when a follow-up is due." | Push notifications require a notification infrastructure (email queue, browser push, or SMS). Dashboard-based follow-up highlighting achieves 80% of the value: Brian sees overdue follow-ups every time he opens the dashboard. | Red-highlight overdue follow-up dates in the pipeline view. Brian checks the dashboard daily -- that is sufficient. |
| Deal value / revenue forecasting | "Show me projected MRR from the pipeline." | Adds a dollar field to every client record and a weighted probability model. Useful for sales teams forecasting against quota. For a solo operator with a $500/mo service, the mental math is trivial. | Notes field. Add revenue tracking in v2 if client count grows past 20. |
| Custom pipeline stages per user | "Let me define my own stage names." | Adds a stage configuration UI, a dynamic enum, and migration complexity. Echo Local's stages are fixed and known. | Hard-code the 6 stages as a PostgreSQL enum: lead, demo, proposal, onboarding, active, churned. Changing stages requires a migration, which is appropriate -- stage definitions should be stable. |

---

## Feature Dependencies

```
[Pipeline Client Record]
    └──required by──> [Stage Transitions + Timestamps]
    └──required by──> [Communication Log]
    └──required by──> [Per-Stage Checklists (completions)]
    └──required by──> [Days in Stage Counter]
    └──required by──> [SEO Client Linkage]

[Stage Transitions + Timestamps]
    └──required by──> [Days in Stage Counter]
    └──required by──> [Avg Time Per Stage Analytics]
    └──required by──> [Pipeline Conversion Funnel Chart]

[Predefined Checklist Items (stage config)]
    └──required by──> [Per-Stage Checklist Completions]

[Communication Log]
    └──required by──> [Follow-Up Date Tracking]
    └──enhanced by──> [Overdue Follow-Up Highlighting] (reads follow_up_date)

[Stage Count Summary]
    └──enhanced by──> [Pipeline Conversion Funnel Chart] (same data, richer view)

[Existing: Supabase auth + admin roles]
    └──required by──> ALL pipeline features (admin-only gate)

[Existing: client_profiles table (directory submission)]
    └──can share──> [Pipeline Client Record] (or extend with FK -- evaluate at implementation)
```

### Dependency Notes

- **Stage transitions require client record:** Cannot record when a client entered Demo if the client record does not exist. Client table is created first.
- **Checklist completions require predefined items:** The `checklist_items` seed data (which items belong to which stage) must exist before the UI can render checkboxes. Seed at migration time.
- **Analytics require stage history:** Avg time per stage and conversion funnel are only meaningful once stage transitions are being logged. The data model must be correct from day one even if the analytics are built later.
- **Existing `client_profiles` table overlap:** The directory submission module already has a `client_profiles` table for NAP data (business name, address, services). The pipeline clients table is a different concept (sales contacts, not operational profiles), but they may share a client. Evaluate at implementation: either use a FK relationship or keep them separate with a shared `client_slug` identifier.

---

## MVP Definition

### Launch With (v1 -- the full v1.4 milestone)

All of these are required for the pipeline tracker to replace Brian's current mental-model/notes system:

- [ ] Pipeline client records with contact info, trade, source, notes
- [ ] Stage assignment + stage_entered_at timestamp
- [ ] Stage history log (append-only: client_id, stage, entered_at, exited_at)
- [ ] Days in current stage display
- [ ] Pipeline table view (all clients, sortable by stage / days in stage)
- [ ] Stage count summary (badge counts per stage)
- [ ] Move-to-stage action (dropdown, records transition to stage_history)
- [ ] Predefined per-stage checklists with check/uncheck
- [ ] Communication log (manual entry: type, direction, date, notes, follow_up_date)
- [ ] Overdue follow-up highlighting in pipeline view
- [ ] Admin-only sidebar navigation entry

### Add After Validation (v1.x -- once pipeline has real data)

- [ ] Pipeline conversion funnel chart -- add once 10+ stage transitions exist
- [ ] Avg time per stage stats -- meaningful once 5+ clients have moved through a stage
- [ ] Source/channel attribution breakdown chart -- useful once 10+ clients are logged
- [ ] SEO client linkage (link from pipeline record to SEO dashboard) -- quick win, add when convenient

### Future Consideration (v2+)

- [ ] Email/SMS auto-logging via Gmail API or GHL webhooks -- add if manual logging becomes friction at 20+ clients
- [ ] AI-assisted next action suggestions -- add once 50+ historical pipeline transitions exist
- [ ] Revenue / MRR tracking fields -- add when client count makes mental math insufficient
- [ ] Multi-user pipeline (other team members) -- add if Echo Local grows to a team

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Client record + stage assignment | HIGH | LOW | P1 |
| Stage history + timestamps | HIGH | LOW | P1 |
| Pipeline table view | HIGH | LOW | P1 |
| Stage count summary | HIGH | LOW | P1 |
| Per-stage checklists | HIGH | MEDIUM | P1 |
| Communication log | HIGH | MEDIUM | P1 |
| Overdue follow-up highlighting | HIGH | LOW | P1 |
| Days in stage counter | MEDIUM | LOW | P1 |
| Move-to-stage action | HIGH | LOW | P1 |
| Admin sidebar nav entry | HIGH | LOW | P1 |
| Pipeline conversion funnel chart | MEDIUM | MEDIUM | P2 |
| Avg time per stage analytics | MEDIUM | LOW | P2 |
| Source attribution breakdown | LOW | LOW | P2 |
| SEO client linkage | MEDIUM | LOW | P2 |
| Follow-up date on comms log | HIGH | LOW | P1 |

**Priority key:**
- P1: Must have for v1.4 launch
- P2: Add when analytics data is meaningful (post-launch)
- P3: Future milestone

---

## Competitor Feature Analysis

Included to clarify what Echo Local does NOT need to replicate -- this is an internal tool for one operator, not a product.

| Feature | HubSpot CRM (free) | Pipedrive ($14/mo) | Our Approach |
|---------|--------------------|--------------------|--------------|
| Pipeline stages | Customizable, unlimited | Customizable, unlimited | Hard-coded 6 stages as enum -- correct for this use case |
| Checklists per stage | Via "Playbooks" (paid) | Via "Smart Docs" (paid) | Native predefined items seeded at migration -- simpler |
| Communication log | Auto-log from Gmail/Outlook | Email sync + manual | Manual entry only -- sufficient at this scale |
| Analytics | Full funnel, forecasting, AI | Visual pipeline, revenue | Stage counts + conversion rates + avg time -- sufficient |
| Kanban vs table | Kanban default | Kanban default | Table view -- faster for 5-15 clients |
| SEO integration | None | None | Direct link to existing SEO dashboard tab -- unique |
| Admin roles | Team-based permissions | Team-based permissions | Existing Supabase admin role gates the entire pipeline section |

---

## Sources

- [7 Main Stages of Sales Pipeline - Cirrus Insight](https://www.cirrusinsight.com/blog/sales-pipeline-stages) -- Standard pipeline stage patterns, entry/exit criteria (MEDIUM confidence)
- [Sales Pipeline Best Practices 2026 - Outreach.io](https://www.outreach.io/resources/blog/sales-pipeline-management-best-practices) -- Stage management, checklist patterns, follow-up workflow (MEDIUM confidence)
- [HubSpot: Note-Taking and Activity Logging](https://www.signitysolutions.com/hubspot-knowledge-base/note-taking-and-activity-logging-hubspot) -- Communication log UX patterns, activity timeline structure (MEDIUM confidence)
- [15 Essential Sales Pipeline Metrics - CaptivateIQ](https://www.captivateiq.com/blog/sales-pipeline-metrics) -- Conversion rate by stage, avg time in stage, pipeline velocity (MEDIUM confidence)
- [33 CRM Features Your Small Business Needs - OnePage CRM](https://www.onepagecrm.com/blog/crm-features/) -- Small business CRM table stakes (MEDIUM confidence)
- [Why CRM Projects Fail 2025 - Atyantik](https://atyantik.com/why-crm-projects-fail-in-2025/) -- Over-engineering pitfalls, complexity anti-patterns (MEDIUM confidence)
- [CRM Problems Sabotaging Sales - Scratchpad](https://www.scratchpad.com/blog/crm-problems) -- Common pitfalls, what causes low CRM adoption (MEDIUM confidence)
- Existing codebase: Supabase schema, Next.js dashboard, `client_profiles` table, admin role auth pattern (HIGH confidence)
- PROJECT.md milestone definition: target features, stage definitions, Supabase-backed data model requirement (HIGH confidence)

---
*Feature research for: v1.4 Client Pipeline Tracker*
*Researched: 2026-03-12*
