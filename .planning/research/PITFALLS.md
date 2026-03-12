# Pitfalls Research: v1.4 Client Pipeline Tracker

**Domain:** CRM pipeline / sales tracking added to existing Next.js + Supabase dashboard
**Researched:** 2026-03-12
**Confidence:** HIGH (patterns drawn from codebase analysis + verified Supabase/Next.js docs + CRM design literature)

---

## Critical Pitfalls

### Pitfall 1: Pipeline Tables Collide With the Existing `clients` Table Role

**What goes wrong:**
The existing `clients` table is a technical config record -- it holds GA4 property IDs, GSC URLs, GHL tokens, website paths, and SEO flags. It is NOT a CRM contact record. When you add pipeline tracking, the temptation is to bolt `pipeline_stage`, `contact_name`, `contact_email`, `source_channel`, and similar fields directly onto `clients`. Within two months, `clients` becomes a 35-column god table with two completely different conceptual domains mixed in: operational SEO config and sales CRM data. Every Python script that queries `clients` for SEO engine config now pulls irrelevant CRM columns. Every CRM query joins against a table that was designed for a different purpose.

**Why it happens:**
`clients` is already the central foreign key anchor for all other tables (reports, seo_actions, directory_submissions, etc.). Adding CRM fields there feels natural -- one record per client, everything in one place. But "one record per business" and "one record per client config" are different conceptual models that happen to share the same entity right now.

**How to avoid:**
Create a separate `pipeline_leads` table for CRM tracking. Use `client_id` as a nullable foreign key (leads in early pipeline stages have no `clients` record yet -- they are prospects who have not onboarded). Leads become clients when they onboard. This separation also makes it trivial to track churned clients (they stay in `pipeline_leads` with stage = 'churned' but their `clients` config row can be disabled separately).

The correct schema: `pipeline_leads(id, client_id nullable, business_name, contact_name, contact_email, contact_phone, trade, source_channel, current_stage, stage_entered_at, created_at)`.

**Warning signs:**
You find yourself writing `ALTER TABLE clients ADD COLUMN pipeline_stage` in a migration. The Python SEO loop starts throwing KeyError on unexpected columns. `clients.json` grows to include contact names and deal sources.

**Phase to address:** Phase 1 (data model). The table boundary decision cannot be undone cheaply.

---

### Pitfall 2: Stage Transitions Have No History -- Only Current State

**What goes wrong:**
You store `current_stage text` and `stage_entered_at timestamptz` on the lead record. This tells you where a lead is now and when they arrived. It tells you nothing about where they came from, how long they spent in each prior stage, or whether they ever regressed (Demo -> back to Lead). After 3 months, you want to compute "average days from Demo to Proposal" -- this requires the transition history, which you never stored. You also cannot answer "how many leads regressed from Onboarding back to Demo" without history.

**Why it happens:**
Storing current stage is the obvious first-pass design. The history feels like over-engineering at MVP. But pipeline analytics -- conversion rates, avg time per stage, regression rates -- require transition logs, not just current snapshots. The existing `submissions` table in this codebase stores only `status` (current) without a history table, and this is the exact pattern that limits what you can analyze later.

**How to avoid:**
Build a `pipeline_stage_history` table from day one: `(id, lead_id, from_stage, to_stage, transitioned_at, note)`. Every stage change writes a row here. The analytics queries read from history, not from the current stage column. This is append-only and tiny (a lead moving through 6 stages generates 5 rows). The cost is near-zero; the analytical payoff is high.

Keep `current_stage` and `stage_entered_at` on the lead record for UI rendering. Keep `pipeline_stage_history` for analytics. Do not try to derive history from `stage_entered_at` timestamps alone -- you lose regression information.

**Warning signs:**
The analytics tab can only show current stage counts. "Average time in stage" queries return NULL or require reconstructing history from `updated_at` timestamps (which only store the last change). A lead mysteriously jumped from Lead to Active with no intermediate history.

**Phase to address:** Phase 1 (data model). Phase 3 (analytics) depends on this history existing.

---

### Pitfall 3: Checklists Hardcoded in the Frontend Instead of Database-Driven

**What goes wrong:**
You define the per-stage checklists as static arrays in React components: `const DEMO_CHECKLIST = ['Send calendar invite', 'Prepare case studies', ...]`. This works for the MVP but creates four problems: (1) updating a checklist item requires a code deploy; (2) you cannot track which specific item is checked per lead without a database table -- you end up storing the whole checked state as a JSONB blob on the lead record; (3) the checklist items cannot have completion timestamps (useful for spotting where leads stall within a stage); (4) you cannot add a new mandatory item retrospectively without writing migration code to backfill completion state on existing leads.

**Why it happens:**
Static array in a component is the fastest path to a visible checklist UI. It feels premature to create a `checklist_items` table for what seems like simple to-do lists. But the moment you want to know "what percentage of leads completed the 'Send proposal' item before advancing to Active," you need per-item per-lead rows.

**How to avoid:**
Two-table design: `checklist_templates(id, stage, label, sort_order, is_required)` for the master list, and `checklist_completions(id, lead_id, template_id, completed_at, completed_by)` for the per-lead state. Completion is tracked as presence of a row, not a boolean on the lead. Adding a new template item retrospectively does not break existing leads -- it just shows as incomplete.

If the full two-table design feels like over-engineering for MVP, the minimum viable version is: `checklist_completions(id, lead_id, stage, item_label, completed_at)` -- no foreign key to a template table, just raw label strings. This is worse for schema integrity but still better than a JSONB blob, because you can query it.

**Warning signs:**
Checklist state is stored as `jsonb` on the lead row. You cannot query "which leads have completed item X." Updating a checklist item label requires both a code change AND a data migration to rename old keys in the JSONB.

**Phase to address:** Phase 1 (data model) for the completions table. Phase 2 (UI) for rendering it.

---

### Pitfall 4: Communication Log Is a Notes Blob, Not Queryable Activity Records

**What goes wrong:**
You add a `notes text` column to `pipeline_leads`. Brian starts typing call summaries, email threads, and text conversations into it as free-form text. After 20 leads, the notes column looks like this: "Called 3/5, left VM. Emailed 3/7. Called again 3/9 spoke for 10 min, said he needs to think. Text 3/12 following up." This is unqueryable. You cannot filter "leads with no contact in 7 days." You cannot count "number of touchpoints before close." You cannot see a clean timeline of communications. You cannot distinguish a call from an email from a text.

**Why it happens:**
Free-form notes are the fastest thing to build. Every basic CRM tutorial starts with a notes field. The structured activity log feels like a bigger build. But the entire value of the communication log -- "who needs a follow-up?", "how many touchpoints until close?" -- requires structured records, not a text blob.

**How to avoid:**
Build `communication_log(id, lead_id, type enum('call','email','text','meeting','note'), direction enum('inbound','outbound'), occurred_at timestamptz, duration_seconds nullable, summary text, created_at)`. Keep a `notes text` field on `pipeline_leads` for brief unstructured context, but all timed interactions go in `communication_log`.

The UI for logging a touchpoint should be a quick-add form with: type selector, direction toggle, datetime (defaults to now), and a summary text field. Not a giant textarea. The log renders as a timeline sorted by `occurred_at`.

**Warning signs:**
Notes column contains timestamps and labels mixed in free-form text. You cannot query "leads with no outbound activity in the last 14 days." The comms section is just a textarea with an Edit button.

**Phase to address:** Phase 1 (data model). Phase 2 (UI) for the timeline renderer and quick-add form.

---

### Pitfall 5: RLS Not Applied to Pipeline Tables -- Admin-Only Is Not Enforced at the Database Level

**What goes wrong:**
The existing codebase uses `isAdmin` checks in React components to hide admin tabs. This is UI-level gating only -- it is not enforced at the database level via Supabase RLS. For the performance dashboard this is tolerable: a non-admin client user can only see their own client's data because all queries are filtered by `client_id`. But pipeline data contains contact names, deal sources, revenue context, and notes about prospects -- none of which should ever be visible to client-users at all. If RLS is not applied to pipeline tables, a savvy client could query the Supabase JS client directly from the browser console and read all lead data.

In January 2025, 83% of exposed Supabase databases involved RLS misconfigurations. New tables have RLS disabled by default. The risk is real.

**Why it happens:**
The existing app's API routes use the service role key (which bypasses RLS), and the frontend browser client uses the anon key. RLS is not currently enforced on the existing tables for the main dashboard. Adding pipeline tables in the same pattern inherits this gap. The developer enables RLS only when it breaks something, not proactively.

**How to avoid:**
Enable RLS on all pipeline tables immediately after creation. Write an admin-only policy:
```sql
CREATE POLICY "admin_only" ON pipeline_leads
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );
```
Test RLS through the Supabase JS client with a non-admin user session, NOT through the SQL editor (which runs as postgres superuser and bypasses all RLS). If a non-admin query returns empty results rather than an error, that is correct RLS behavior.

Crucially: create an index on `user_profiles(user_id)` if one does not exist. An RLS policy checking `auth.uid()` against an unindexed column does a sequential scan on every row access.

**Warning signs:**
New pipeline tables exist with no RLS policies. A browser console query to `supabase.from('pipeline_leads').select('*')` returns data when logged in as a non-admin. Test in devtools with a client user session.

**Phase to address:** Phase 1 (data model). Apply RLS in the same migration that creates the tables.

---

### Pitfall 6: Pipeline Analytics Use Current Stage Counts, Missing Churned/Skipped Leads

**What goes wrong:**
The analytics section shows "Leads: 4, Demo: 3, Proposal: 2, Onboarding: 3, Active: 8." These are current stage counts -- a point-in-time snapshot. This overstates conversion rates. If 20 leads entered the Demo stage and 3 are currently there, you do not know if 17 converted to Proposal or 17 churned after Demo. Conversion rate = "moved to next stage / entered this stage" not "currently in next stage / currently in this stage." Current-count analytics look meaningful but measure the wrong thing.

This problem compounds with the "days in stage" metric. If `stage_entered_at` is updated on every stage change and you only store current state, "avg days in Demo" computes only from leads currently in Demo -- excluding all leads who already passed through it.

**Why it happens:**
COUNT(stage = 'demo') is the obvious first query. The distinction between "currently in" and "transitioned through" is not obvious until you try to calculate a conversion funnel. Without the `pipeline_stage_history` table (Pitfall 2), accurate analytics are impossible even if you know what to query.

**How to avoid:**
Analytics queries must read from `pipeline_stage_history`, not from the current stage column. The correct conversion rate query: `leads who have a history row with to_stage = 'proposal'` divided by `leads who have a history row with to_stage = 'demo'` (or from_stage = 'lead'). This correctly accounts for churned leads who never advanced.

"Avg days in stage" = average of `(next_transition.transitioned_at - this_transition.transitioned_at)` grouped by `to_stage`, calculated from history rows -- NOT from current `stage_entered_at`.

Do not build the analytics tab until the history table exists and has at least 4-6 weeks of data. Charts showing "0 days avg in Demo" because no history exists yet are misleading. Show "Not enough data -- analytics require 30+ days of pipeline history" instead of an empty chart.

**Warning signs:**
Conversion rate queries use `COUNT(current_stage)` comparisons. "Avg days in stage" returns NULL because `stage_entered_at` was overwritten. Churned leads disappear from all analytics because they no longer appear in any active stage count.

**Phase to address:** Phase 3 (analytics). But it depends on Phase 1 correctly implementing `pipeline_stage_history`.

---

### Pitfall 7: The Pipeline Page Is a Client Dashboard Tab Instead of a Standalone Admin Page

**What goes wrong:**
You add a "Pipeline" tab to the existing dashboard tab system (`TabId` union type). The problem: the existing dashboard is client-scoped -- the sidebar selects a client and every tab shows that client's data. Pipeline data is not client-scoped; it shows ALL leads across ALL clients in a single view. Wiring a pipeline view into the client-scoped tab system requires either (a) ugly conditional logic that bypasses client context when pipeline tab is active, or (b) showing only the selected client's pipeline data (useless -- you want the full funnel view).

The existing architecture already has the correct pattern for admin-wide tools: standalone pages at `/seo-engine`, `/sales-engine`, `/agents`. Pipeline belongs in this category.

**Why it happens:**
Tabs are easy to add (`TabId` union, new case in the conditional render, sidebar link). The developer sees the existing pattern and follows it without thinking about whether the data model is client-scoped.

**How to avoid:**
Create `/pipeline` as a standalone Next.js App Router page at `src/app/pipeline/page.tsx`. Add it to the sidebar navigation under admin-only links alongside `/seo-engine` and `/sales-engine`. Do NOT add it to the `TabId` type or the client-scoped tab switcher. The page fetches all leads globally (no client_id filter at the page level, though individual lead records can link to a client_id).

The sidebar already has admin-only link logic. Pipeline is one more entry in that list.

**Warning signs:**
You add `'pipeline'` to the `TabId` union type. The pipeline component receives `selectedClient` as a prop. Changing the sidebar client selection changes which leads are visible.

**Phase to address:** Phase 2 (UI structure). Establish the standalone page pattern before building any pipeline components.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Stage as string enum, no history table | Simple schema, fast to query current state | Cannot compute conversion rates, avg time in stage, or regression patterns | Never -- history table is 5 extra minutes of schema work |
| JSONB blob for checklist completion state | No extra tables | Cannot query by item, cannot add required items retroactively, schema-less creep | Only for a 24-hour throwaway prototype |
| Free-form notes instead of typed communication log | One textarea, no form design needed | Unqueryable, no timeline, no follow-up detection | Acceptable for MVP only if the structured log is planned for Phase 2 |
| Hardcoded stage list in TypeScript | No migration needed to change stage names | Renaming a stage requires code deploy + data migration | Never -- store stage list in a config or as a Postgres enum |
| Bolt pipeline fields onto existing `clients` table | One table, one query | Conceptual collision, Python scripts break, god table anti-pattern | Never |
| Skip RLS on pipeline tables | Faster to develop | Client users can read prospect data through browser console | Never |
| Analytics from current stage counts | Trivial to compute | Overstates conversion rates, misses churned leads | Only for a rough "where are we right now" snapshot with a clear label |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Existing `clients` table | Adding pipeline fields directly to `clients` | Create `pipeline_leads` with nullable `client_id` FK; leads become clients at onboarding |
| Supabase RLS + admin check | Relying on React `isAdmin` boolean to hide data | Write explicit RLS policies on every pipeline table; test with anon client session |
| Next.js App Router + admin page | Adding pipeline as a tab in client-scoped dashboard | Standalone `/pipeline` page following existing `/seo-engine` pattern |
| Supabase browser client + pipeline | Testing queries in SQL editor and assuming RLS works | SQL editor bypasses RLS; test with actual Supabase JS client authenticated as non-admin |
| Stage transition mutations | Updating `current_stage` only | Write to both `pipeline_leads.current_stage` and `pipeline_stage_history` in the same operation |
| Communication log timestamps | Using `created_at` as the interaction timestamp | Use `occurred_at` as the interaction time, `created_at` as the record creation time. Calls logged later should show the time of the call, not when Brian typed the note |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `pipeline_leads.current_stage` | Slow stage count queries for analytics | Add index on `(current_stage)` at table creation time | Not noticeable at 20 leads; matters at 500+ |
| RLS policy checks unindexed `user_profiles.user_id` | Every pipeline query does a sequential scan on user_profiles | Add `CREATE INDEX ON user_profiles(user_id)` | Noticeable at any scale if user_profiles has more than 50 rows |
| Fetching full communication log on every pipeline page load | Slow initial render if a lead has 50+ log entries | Paginate or lazy-load the communication log; show last 5 entries by default with "load more" | Breaks at 30-50 entries per active lead |
| `pipeline_stage_history` with no index on `lead_id` | Analytics queries scan entire history table | Add index on `(lead_id)` and `(to_stage, transitioned_at)` at table creation | Not noticeable at 100 leads; matters for analytics |
| Loading all leads to compute pipeline analytics in JavaScript | N+1 computations in the browser, high memory for large datasets | Run aggregation in SQL (COUNT GROUP BY, AVG, etc.) -- Postgres does this in microseconds | Breaks at 50+ leads if done naively in React |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS disabled on pipeline tables (Supabase default for new tables) | Any authenticated user (including client users) can read all prospect data, contact info, deal notes | Enable RLS + admin-only policy in the same migration that creates the tables |
| Storing prospect email/phone in pipeline without considering data residency | Low risk for this use case but sets a precedent for insecure data handling | Fine for internal tool; document that pipeline tables contain PII so future devs treat them accordingly |
| Pipeline API routes using service role key without additional auth checks | Route is callable by anyone with the Netlify URL if misconfigured | Any API route that reads/writes pipeline data should verify admin session before using service role key |
| Logging sensitive deal context (price, client complaints) in communication log `summary` field | Low risk (admin-only access) but creates a discoverable record | Add a note in the schema comments that `summary` may contain sensitive context; keep RLS tight |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Drag-and-drop stage transitions with no confirmation | Brian accidentally drags a lead to Churned, no undo | Stage changes are one-click confirmed actions (select new stage from dropdown), not drag-and-drop. Drag-and-drop is satisfying to prototype but error-prone on a laptop trackpad |
| Pipeline page shows all data with no filtering | 20 leads visible at once becomes overwhelming; Active vs Churned are very different contexts | Default to showing only active leads (not Churned); add filter toggle for "show all including churned" |
| Checklist items show as unchecked with no context on why they exist | Brian doesn't know which checklist items are blocking vs informational | Mark required items visually. Show which items are required before advancing to the next stage |
| Communication log textarea with no timestamp | Brian adds a call note but the log shows `created_at` which may be hours after the actual call | Communication log entry form has an explicit `occurred_at` datetime field, defaulting to now() |
| Analytics visible before there is enough data | Empty bar charts with all zeros give a false impression of a broken feature | Hide analytics until 30+ days of data exist. Show a "Pipeline is new -- analytics will appear after 30 days of data" placeholder |

---

## "Looks Done But Isn't" Checklist

- [ ] **Stage transitions:** Stage change updates UI -- but did it write a row to `pipeline_stage_history`? Verify by querying history table after a transition.
- [ ] **Checklist completions:** Checkboxes save state -- but is the completion stored as a queryable row in `checklist_completions` or as a JSONB blob? Verify you can run `SELECT * FROM checklist_completions WHERE lead_id = X`.
- [ ] **Communication log timestamps:** Log entry saved -- but does `occurred_at` reflect the actual interaction time or just `now()`? Verify the form allows backdating.
- [ ] **RLS enforcement:** Pipeline page shows data for admin -- but is it blocked for non-admin? Test by querying `supabase.from('pipeline_leads').select('*')` with a client user session in browser devtools.
- [ ] **Analytics conversion rates:** Rates appear to compute -- but are they calculated from history rows (correct) or current stage counts (wrong)? Manually verify by checking a lead that churned after Demo is included in the denominator.
- [ ] **Churned leads:** Churned leads don't appear in the main pipeline board -- but are they preserved in the database and visible in a "show churned" filter? Verify data is not deleted on churn.
- [ ] **Admin navigation:** Pipeline page is accessible from the sidebar -- but is it gated to admin only? Verify that a client user session cannot navigate to `/pipeline` directly.
- [ ] **Days in stage accuracy:** "Days in current stage" displays a number -- but is it calculated from the correct `stage_entered_at` timestamp? Verify by manually setting a lead to a stage 5 days ago and checking the display.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Pipeline fields bolted onto `clients` table | HIGH | Write migration to extract pipeline columns into a new `pipeline_leads` table; update all TypeScript types; update all queries; risk of breaking Python scripts that query `clients` |
| No stage history table | MEDIUM | Create `pipeline_stage_history` retroactively; backfill using `current_stage` and `stage_entered_at` (partial data only -- cannot recover intermediate stages); accept analytics gaps for the initial period |
| Checklists stored as JSONB blob | MEDIUM | Write migration to extract JSONB entries into `checklist_completions` rows; data is recoverable but schema migration is tedious and item labels may be inconsistent |
| RLS not applied | LOW | Enable RLS and add policies via migration; zero data loss; requires testing to ensure no legitimate queries break |
| Communication log as free-form notes | LOW-MEDIUM | Migrate to `communication_log` table; parse existing notes text into log entries where possible; historical notes that are unparseable become a single `note` type entry with the original text |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pipeline/clients table collision (#1) | Phase 1: Data model | `pipeline_leads` is a separate table with nullable `client_id` FK; no pipeline columns on `clients` |
| No stage transition history (#2) | Phase 1: Data model | `pipeline_stage_history` table exists; every stage change in the UI writes a row there; confirmed via Supabase table inspector |
| Hardcoded checklists (#3) | Phase 1: Data model | `checklist_completions` table exists; UI reads/writes completion rows; no checklist state in JSONB on lead record |
| Communication log as text blob (#4) | Phase 1: Data model | `communication_log` table exists with typed `type` and `occurred_at` columns; log entries are queryable by `type` and date range |
| Missing RLS on pipeline tables (#5) | Phase 1: Data model | Non-admin Supabase JS client query returns zero rows (not an error) from pipeline tables; confirmed via devtools test |
| Analytics from current stage counts (#6) | Phase 3: Analytics | Conversion rate queries join `pipeline_stage_history`; manually verify a churned lead is counted in stage denominators |
| Pipeline as client-scoped tab (#7) | Phase 2: UI structure | `/pipeline` is a standalone page; `TabId` type does not include 'pipeline'; page does not receive `selectedClient` as prop |

---

## Sources

- Codebase analysis: `src/lib/types.ts`, `supabase/migrations/`, `.planning/codebase/ARCHITECTURE.md` -- existing table structure and patterns (HIGH confidence)
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) -- RLS disabled by default on new tables; testing through SQL editor bypasses RLS (HIGH confidence)
- [Supabase RLS performance guide](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- missing indexes on policy columns cause sequential scans (HIGH confidence)
- [Supabase audit log post](https://supabase.com/blog/postgres-audit) -- append-only audit tables for state transition history (HIGH confidence)
- [TanStack Query optimistic update race conditions](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query) -- concurrent mutations cause state conflicts without cancellation (MEDIUM confidence)
- CRM database design pattern: `pipeline_stage_history` as append-only log vs mutable current state -- standard event sourcing principle, widely documented (HIGH confidence)
- [GeeksforGeeks CRM relational design](https://www.geeksforgeeks.org/dbms/how-to-design-a-relational-database-for-customer-relationship-management-crm/) -- activity log as typed records, not free-form notes (MEDIUM confidence)
- January 2025 Supabase RLS exposure report -- 83% of exposed Supabase databases involved RLS misconfiguration (MEDIUM confidence, cited across multiple security publications)

---
*Pitfalls research for: v1.4 Client Pipeline Tracker (adding CRM pipeline to existing Next.js + Supabase dashboard)*
*Researched: 2026-03-12*
