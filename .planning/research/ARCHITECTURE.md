# Architecture Research

**Domain:** v1.4 Client Pipeline Tracker -- Integration with existing Next.js + Supabase dashboard
**Researched:** 2026-03-12
**Confidence:** HIGH (based on direct codebase review of all relevant files)

---

## Existing Architecture (Baseline for Integration)

```
Supabase (Postgres)
  |-- clients (uuid, name, slug, ga4_property, gsc_url, ...)
  |-- user_profiles (user_id, role: 'admin'|'client', client_id)
  |-- reports, gsc_queries, gbp_keywords
  |-- seo_actions, seo_brain_decisions
  |-- geo_scores, serp_features, serpapi_usage
  |-- tracked_keywords, keyword_snapshots
  |-- client_profiles, directories, submissions
  v
Next.js (src/app/)
  |-- page.tsx (main dashboard -- client-scoped tabs: overview/seo/conversions/gbp/geo/directories)
  |-- seo-engine/page.tsx (standalone admin tool -- seo tab nav)
  |-- sales-engine/page.tsx (standalone admin tool -- sales calls/analysis)
  |-- agents/page.tsx (standalone admin tool)
  v
Auth (src/lib/auth-context.tsx)
  |-- useAuth() -> { profile, isAdmin, loading }
  |-- role: 'admin' sees sidebar + admin-only tabs
  |-- role: 'client' sees no sidebar, only their data
```

**Key architecture patterns already established:**

1. Standalone admin pages (seo-engine, sales-engine) live at their own route with independent data loading. They do NOT use the main `page.tsx` client-switcher; they fetch all clients themselves.

2. Role-based access is enforced via `useAuth()` hook and `isAdmin` flag -- both at the sidebar rendering level and at the tab/page render level.

3. All data fetching uses `supabase` client from `@/lib/supabase` via `createClientComponentClient` pattern. Every page or tab that needs data does its own `useEffect` + Supabase query.

4. Types live in `src/lib/types.ts`. Every new table needs corresponding TypeScript interfaces added there.

5. The `Sidebar.tsx` has a fixed "Engine links" section at the bottom for admin nav items (`/agents`, `/seo-engine`, `/sales-engine`). New top-level admin tools are added here.

---

## System Overview -- v1.4 Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sidebar.tsx (admin-only)                      │
│  Clients list  |  Agents  |  SEO Engine  |  Sales  | PIPELINE   │
└────────────────────────────────────────────────────┬────────────┘
                                                     │ href="/pipeline"
┌────────────────────────────────────────────────────▼────────────┐
│            src/app/pipeline/page.tsx (NEW, admin-only)           │
│                                                                  │
│  PipelineLayout                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │  Board Tab   │ │  Table Tab   │ │ Analytics Tab │             │
│  └──────┬───────┘ └──────┬───────┘ └──────┬────────┘            │
│         │                │                │                      │
│  PipelineBoard    PipelineTable    PipelineAnalytics             │
│  (kanban view)    (list view)      (Recharts charts)            │
│                                                                  │
│  + StageChecklist overlay (per-record drawer/modal)             │
│  + CommunicationLog overlay (per-record drawer/modal)           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ supabase queries
┌──────────────────────────────▼──────────────────────────────────┐
│                        Supabase (Postgres)                       │
│                                                                  │
│  pipeline_leads (NEW)    pipeline_checklist_items (NEW)         │
│  pipeline_comms (NEW)    pipeline_stage_configs (NEW, optional) │
└─────────────────────────────────────────────────────────────────┘
```

---

## New vs Modified Components

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/app/pipeline/page.tsx` | Page | Admin-only pipeline tracker root page |
| `src/components/pipeline/PipelineBoard.tsx` | Component | Kanban-style view with stage columns |
| `src/components/pipeline/PipelineTable.tsx` | Component | Table view for dense scanning |
| `src/components/pipeline/PipelineAnalytics.tsx` | Component | Stage counts, conversion rates, avg days per stage |
| `src/components/pipeline/LeadCard.tsx` | Component | Single lead card for board view |
| `src/components/pipeline/LeadDrawer.tsx` | Component | Slide-in panel: edit lead, checklist, comms log |
| `src/components/pipeline/StageChecklist.tsx` | Component | Per-stage checklist within LeadDrawer |
| `src/components/pipeline/CommunicationLog.tsx` | Component | Per-lead comms log within LeadDrawer |
| `supabase/migrations/YYYYMMDD_pipeline.sql` | Migration | 3 new tables |

### Modified Files

| File | Change |
|------|--------|
| `src/components/Sidebar.tsx` | Add "Pipeline" link in Engine links section |
| `src/lib/types.ts` | Add PipelineLead, PipelineComm, ChecklistItem interfaces |

---

## New Supabase Tables

### TABLE: `pipeline_leads`

Central record per prospect/client through the pipeline.

```sql
CREATE TABLE pipeline_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,                    -- business or contact name
  contact_name text,                     -- owner/decision-maker
  phone text,
  email text,
  trade text,                            -- 'turf', 'pressure_washing', 'roofing', etc.
  source text,                           -- 'instagram_dm', 'referral', 'cold_email', 'inbound_call'
  stage text NOT NULL DEFAULT 'lead',   -- 'lead' | 'demo' | 'proposal' | 'onboarding' | 'active' | 'churned'
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  client_id uuid REFERENCES clients(id), -- set when lead becomes active client (links to SEO data)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pipeline_leads_stage ON pipeline_leads(stage);
CREATE INDEX idx_pipeline_leads_client ON pipeline_leads(client_id);
```

**Why `client_id` is nullable:** Leads and demos are not yet Supabase clients. Once onboarded, `client_id` is set to link the pipeline record to the existing `clients` table. This creates an explicit bridge between pipeline and client performance data without merging the two tables.

**Stage values:** `lead | demo | proposal | onboarding | active | churned` -- matches the PROJECT.md spec exactly. Stored as text (not enum) for easy addition of new stages later.

**`stage_entered_at`:** Updated every time the stage changes. Enables "days in current stage" calculation and average time per stage analytics.

---

### TABLE: `pipeline_checklist_items`

Per-lead checklist. Predefined items for each stage, checked off as completed.

```sql
CREATE TABLE pipeline_checklist_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES pipeline_leads(id) ON DELETE CASCADE NOT NULL,
  stage text NOT NULL,                   -- which stage this item belongs to
  label text NOT NULL,                   -- e.g. 'Demo scheduled', 'Proposal sent', 'GBP connected'
  is_done boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_checklist_lead ON pipeline_checklist_items(lead_id);
CREATE INDEX idx_checklist_stage ON pipeline_checklist_items(stage);
```

**Predefined items are seeded at insert time:** When a lead is created or advances to a new stage, the application inserts the standard checklist items for that stage. No separate "checklist template" table is needed at this scale -- the defaults are hardcoded in the application layer and inserted on stage transition.

**Why not a templates table:** There are only 6 stages with 3-6 items each (~25 total items). Hardcoding the defaults in a TypeScript constant is simpler and faster to change than a managed templates table. If items need to vary per trade, revisit.

---

### TABLE: `pipeline_comms`

Communication log per lead: calls, emails, texts.

```sql
CREATE TABLE pipeline_comms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES pipeline_leads(id) ON DELETE CASCADE NOT NULL,
  comm_type text NOT NULL,              -- 'call' | 'email' | 'text' | 'dm'
  direction text NOT NULL DEFAULT 'outbound', -- 'outbound' | 'inbound'
  summary text NOT NULL,               -- what was said / sent
  happened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_comms_lead ON pipeline_comms(lead_id);
CREATE INDEX idx_comms_happened ON pipeline_comms(happened_at DESC);
```

---

## Component Responsibilities

| Component | Responsibility | Pattern |
|-----------|----------------|---------|
| `pipeline/page.tsx` | Auth guard, data loading, view state | Same pattern as `seo-engine/page.tsx` |
| `PipelineBoard.tsx` | Renders one column per stage, receives leads grouped by stage | Props: `leads: PipelineLead[]`, `onOpenLead(id)` |
| `PipelineTable.tsx` | Dense sortable table of all leads | Props: same, sorted/filtered by stage or date |
| `PipelineAnalytics.tsx` | Stage funnel counts, conversion %, avg days | Props: same leads array, computed client-side |
| `LeadCard.tsx` | Single card in board view | Props: `lead: PipelineLead`, `onClick` |
| `LeadDrawer.tsx` | Full-screen overlay for editing lead, showing checklist + comms | Fetches checklist + comms when opened |
| `StageChecklist.tsx` | List of checkboxes for current stage | Props: `leadId`, `stage` -- fetches own data or receives from drawer |
| `CommunicationLog.tsx` | Chronological log + add entry form | Props: `leadId` -- fetches own data or receives from drawer |

---

## Data Flow

### Page Load

```
pipeline/page.tsx mounts
  |
  useAuth() -> confirm isAdmin, redirect to /login if not
  |
  useEffect: supabase.from('pipeline_leads').select('*').order('stage_entered_at')
  |
  setLeads(data) -> passed to all three view components
```

### Stage Advance

```
User clicks "Move to [next stage]" on LeadCard or LeadDrawer
  |
  supabase.from('pipeline_leads')
    .update({ stage: newStage, stage_entered_at: new Date().toISOString() })
    .eq('id', leadId)
  |
  On success: insert predefined checklist items for new stage
    supabase.from('pipeline_checklist_items').insert(STAGE_CHECKLIST_DEFAULTS[newStage].map(...))
  |
  Optimistic update: setLeads(leads.map(l => l.id === leadId ? {...l, stage: newStage} : l))
```

### LeadDrawer Open

```
User clicks lead card
  |
  setActiveLead(id) -> renders LeadDrawer
  |
  LeadDrawer useEffect:
    Promise.all([
      supabase.from('pipeline_checklist_items').select('*').eq('lead_id', id),
      supabase.from('pipeline_comms').select('*').eq('lead_id', id).order('happened_at', {ascending: false})
    ])
  |
  setChecklist(data[0]), setComms(data[1])
```

### New Communication Entry

```
User fills comm form in CommunicationLog and submits
  |
  supabase.from('pipeline_comms').insert({ lead_id, comm_type, direction, summary, happened_at })
  |
  On success: setComms([newComm, ...comms]) (prepend -- most recent first)
```

### Analytics Computation

```
PipelineAnalytics receives leads[] prop
  |
  Client-side computation (no extra DB queries):
    stageCounts = groupBy(leads, 'stage')
    conversionRate = stage[i+1].count / stage[i].count
    avgDaysInStage = mean(leads.filter(l => l.stage === s).map(l => daysSince(l.stage_entered_at)))
  |
  Recharts BarChart for stage counts
  Recharts LineChart or Funnel for conversion rates
```

**Analytics are computed client-side from the already-loaded leads array.** No extra queries needed. With 50-200 leads this is instantaneous.

---

## Integration Points

### 1. Sidebar Navigation

The `Sidebar.tsx` Engine links section currently has Agents, SEO Engine, Sales Engine. Add Pipeline link following the same anchor tag pattern:

```tsx
<a href="/pipeline" style={{ color: '#A78BFA', ... }}>
  {collapsed ? 'PL' : 'Pipeline \u203A'}
</a>
```

Color choice: purple (`#A78BFA`) differentiates from existing accent colors (orange=agents, green=seo, teal=sales).

### 2. Auth Pattern (No Changes Needed)

`pipeline/page.tsx` uses `useAuth()` exactly like `seo-engine/page.tsx`. If `!isAdmin`, redirect to `/`. No middleware changes needed -- the existing `middleware.ts` already handles auth redirects for all routes.

### 3. Link to Active Client SEO Data

When a pipeline lead has `client_id` set (i.e., they became an active client), the LeadDrawer can render a "View Dashboard" button that navigates to `/?client_id={client_id}` or simply opens the main dashboard with that client selected. This is a link, not a data join -- no architectural change required.

### 4. Types Extension

Add to `src/lib/types.ts`:

```typescript
export type PipelineStage = 'lead' | 'demo' | 'proposal' | 'onboarding' | 'active' | 'churned';

export interface PipelineLead {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  trade: string | null;
  source: string | null;
  stage: PipelineStage;
  stage_entered_at: string;
  notes: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  lead_id: string;
  stage: PipelineStage;
  label: string;
  is_done: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface PipelineComm {
  id: string;
  lead_id: string;
  comm_type: 'call' | 'email' | 'text' | 'dm';
  direction: 'outbound' | 'inbound';
  summary: string;
  happened_at: string;
  created_at: string;
}
```

---

## Recommended Project Structure

```
src/
  app/
    pipeline/
      page.tsx                    # NEW: data loading, view switcher, auth guard
  components/
    pipeline/                     # NEW directory
      PipelineBoard.tsx           # Kanban columns by stage
      PipelineTable.tsx           # Dense list/table view
      PipelineAnalytics.tsx       # Funnel charts, stage stats
      LeadCard.tsx                # Card for board view
      LeadDrawer.tsx              # Edit overlay (checklist + comms)
      StageChecklist.tsx          # Checklist within drawer
      CommunicationLog.tsx        # Comms log + add entry within drawer
    Sidebar.tsx                   # MODIFIED: add Pipeline link
  lib/
    types.ts                      # MODIFIED: add pipeline interfaces

supabase/
  migrations/
    YYYYMMDD_pipeline.sql         # NEW: 3 tables + indexes
```

---

## Architectural Patterns

### Pattern 1: Standalone Admin Page (Same as seo-engine)

**What:** Pipeline lives at `/pipeline` as its own Next.js page, independent of the main client dashboard at `/`. It loads all leads on mount and manages its own state.

**When to use:** When the feature is admin-only and conceptually separate from client performance reporting.

**Trade-offs:** No shared state with `page.tsx` -- but there is nothing to share. The pipeline has no dependency on report data or SEO data. Keeping it isolated avoids bloating the already-complex `page.tsx` state.

### Pattern 2: Lazy LeadDrawer Fetching

**What:** The page loads only `pipeline_leads` on mount (lightweight -- no joins). Checklist items and comms are fetched only when the user opens a specific lead's drawer.

**When to use:** When secondary data is accessed infrequently relative to the primary list.

**Trade-offs:** Small delay when opening drawer (one round-trip to Supabase). Acceptable because the drawer is an intentional user action. Eliminates loading hundreds of checklist rows + comms that the user never views.

**Example:**
```typescript
const [activeLead, setActiveLead] = useState<string | null>(null);
// Only fetch when drawer opens:
useEffect(() => {
  if (!activeLead) return;
  // fetch checklist + comms for activeLead
}, [activeLead]);
```

### Pattern 3: Client-Side Analytics Computation

**What:** Stage counts, conversion rates, and avg days are computed from the already-loaded leads array, not via DB aggregations.

**When to use:** When the dataset is small (under 500 rows) and analytics are derived directly from the primary list.

**Trade-offs:** Zero extra DB queries. If the pipeline grows to thousands of leads (unlikely -- Echo Local will have 50-100 leads max), move to DB views.

### Pattern 4: Seeded Checklist Defaults in Application Layer

**What:** Predefined checklist items per stage are defined as TypeScript constants. When a lead advances stages, the app inserts the defaults for the new stage.

```typescript
export const STAGE_CHECKLIST_DEFAULTS: Record<PipelineStage, string[]> = {
  lead:        ['Source confirmed', 'Contact info captured', 'Trade identified'],
  demo:        ['Demo scheduled', 'Demo completed', 'Pain points noted'],
  proposal:    ['Proposal drafted', 'Proposal sent', 'Follow-up scheduled'],
  onboarding:  ['Contract signed', 'GBP access received', 'Drive folder created',
                'Domain/site access confirmed', 'Assets received'],
  active:      ['Site live', 'SEO engine enabled', 'First report sent'],
  churned:     ['Reason documented', 'Offboarding complete'],
};
```

**When to use:** When checklist items are universal (same for every lead) and there are fewer than ~50 total items.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding Pipeline to page.tsx

**What people do:** Add pipeline as another tab inside the main dashboard page alongside Overview/SEO/GBP.

**Why it's wrong:** The main dashboard is client-scoped -- everything on it is filtered by `activeClient`. The pipeline is admin-scoped across ALL leads (most of whom are not yet clients). Mixing these contexts in the same page would require significant conditional logic and would break the clean client-switcher pattern.

**Do this instead:** Standalone `/pipeline` page, linked from the Sidebar Engine links section -- same pattern as `/seo-engine` and `/sales-engine`.

### Anti-Pattern 2: Joining leads with clients Table on Every Load

**What people do:** `SELECT pipeline_leads.*, clients.* FROM pipeline_leads LEFT JOIN clients ON pipeline_leads.client_id = clients.id`

**Why it's wrong:** Fetches all clients data with every pipeline load. Most leads do not have a `client_id` set. The join is almost always unnecessary for the list view.

**Do this instead:** Load leads separately. In the LeadDrawer, show a simple "View in Dashboard" link for leads with a `client_id`. Fetch client details only if needed (rarely needed for pipeline context).

### Anti-Pattern 3: Storing Stage History in pipeline_leads

**What people do:** Add `previous_stage`, `stage_history jsonb` columns to track how a lead moved through the funnel.

**Why it's wrong:** Premature. At current scale (50-100 leads), a simple `stage_entered_at` timestamp is sufficient for "days in stage" analytics. Full history adds complexity with no concrete use case yet.

**Do this instead:** Track `stage_entered_at` only. If full history is needed later, add an `pipeline_lead_history` event table at that point.

### Anti-Pattern 4: One Giant page.tsx for Pipeline

**What people do:** Build the entire pipeline view (board, table, analytics, drawer) in a single page component.

**Why it's wrong:** The sales-engine page already shows the cost of this pattern -- it is 76KB+ of TSX. Hard to navigate, impossible to split into phases.

**Do this instead:** `pipeline/page.tsx` is a thin orchestrator. Business logic and display live in the `components/pipeline/` directory. Each component is focused and independently readable.

---

## Build Order

```
Phase 1: Database Foundation
  1a. Write supabase/migrations/YYYYMMDD_pipeline.sql
      (pipeline_leads, pipeline_checklist_items, pipeline_comms + indexes)
  1b. Run migration against Supabase
  1c. Add TypeScript interfaces to src/lib/types.ts
      (PipelineLead, PipelineStage, ChecklistItem, PipelineComm)
  1d. Add STAGE_CHECKLIST_DEFAULTS constant (app layer, not DB)

Phase 2: Page Shell + Sidebar Link
  2a. Create src/app/pipeline/page.tsx with:
      - useAuth() guard (redirect if !isAdmin)
      - Load all pipeline_leads on mount
      - Tab switcher: Board | Table | Analytics
      - Empty state placeholder for each tab
  2b. Add "Pipeline" link to src/components/Sidebar.tsx Engine links section

  Deliverable: /pipeline route exists, auth-protected, loads leads, tabs visible

Phase 3: Board View
  3a. Build LeadCard.tsx (name, stage badge, trade, days in stage, comm count)
  3b. Build PipelineBoard.tsx (6 columns, leads grouped by stage, drag or button-advance)
  3c. Implement stage advance action (UPDATE + insert new checklist items)
  3d. Add "New Lead" button with inline form

  Deliverable: Kanban board fully functional -- add, view, move leads

Phase 4: Lead Drawer (Details + Checklist + Comms)
  4a. Build LeadDrawer.tsx (slide-in overlay, edit lead fields)
  4b. Build StageChecklist.tsx (fetch + render checkboxes, toggle done)
  4c. Build CommunicationLog.tsx (fetch + render log, add entry form)
  4d. Wire drawer open/close from LeadCard click

  Deliverable: Click any lead to view and edit full details, checklist, comms

Phase 5: Table View
  5a. Build PipelineTable.tsx (sortable columns: name, stage, trade, source, days, last comm)
  5b. Wire to same lead data from page.tsx (no new data fetching)
  5c. Add stage filter dropdown

  Deliverable: Dense table view as alternate to board view

Phase 6: Analytics
  6a. Build PipelineAnalytics.tsx
  6b. Stage funnel bar chart (Recharts BarChart) -- counts per stage
  6c. Avg days per stage stat cards
  6d. Conversion rate: lead -> demo -> proposal -> onboarding -> active
  6e. Source breakdown (where leads come from)

  Deliverable: Analytics tab with pipeline health metrics
```

**Why this order:**

- Phase 1 first: tables and types must exist before any component can compile. The STAGE_CHECKLIST_DEFAULTS constant is defined here too so it's available from Phase 3 onward.
- Phase 2 before Phase 3: the page shell and routing must exist before building components. The sidebar link lets Brian navigate to the page immediately after Phase 2 -- visible progress.
- Phase 3 before Phase 4: the board is the primary view. The drawer is a detail layer that sits on top of it. Building the board first lets Brian start using the pipeline (adding leads, moving stages) before the drawer is polished.
- Phase 4 before Phase 5: the table view is a UX convenience, not a new feature. It reuses the same data. Lower priority than completing the board + drawer workflow.
- Phase 6 last: analytics derive from data that will only exist after the pipeline has been in use. Building analytics before there are leads to analyze is testing with empty states.

---

## Integration Points Summary

| Touch Point | Change | Impact |
|-------------|--------|--------|
| `Sidebar.tsx` | Add Pipeline href link | Minor -- one new anchor block |
| `src/lib/types.ts` | Add 3 interfaces + 1 type | Additive -- no existing types changed |
| `supabase/migrations/` | New migration file | Additive -- 3 new tables, no existing table changes |
| `src/app/pipeline/page.tsx` | Create new page | New file -- no existing pages modified |
| `src/components/pipeline/` | Create 7 new components | New directory -- no existing components modified |
| `middleware.ts` | No change needed | Auth redirects already cover all routes |
| `page.tsx` (main dashboard) | No change needed | Pipeline is fully separate |

The pipeline tracker is a **purely additive integration**. No existing tables are altered, no existing components are modified except Sidebar and types.ts (both minor additions). The only risk surface is the Sidebar link addition and the types file, both of which are low-risk.

---

## Scalability Considerations

| Scale | Architecture |
|-------|-------------|
| 0-100 leads (current forecast) | Client-side analytics, single query load-all, no pagination needed |
| 100-500 leads | Add pagination to table view, analytics stay client-side |
| 500+ leads | Move analytics to Supabase views/materialized views, add server-side filtering |

**First bottleneck:** Loading all leads at once. At 100-200 leads (realistic max for Echo Local), the full load is fast (~5KB JSON). Pagination is not needed until 500+ leads.

**Second bottleneck:** None. The pipeline is write-light (leads advance stages slowly, comms are added manually). Read performance is the only concern and it is not a concern at this scale.

---

## Sources

- `src/app/page.tsx` -- HIGH confidence (direct review, main dashboard patterns)
- `src/app/seo-engine/page.tsx` -- HIGH confidence (direct review, standalone page pattern to replicate)
- `src/components/Sidebar.tsx` -- HIGH confidence (direct review, Engine links section)
- `src/lib/types.ts` -- HIGH confidence (direct review, full type catalog)
- `src/lib/auth-context.tsx` -- HIGH confidence (direct review, auth pattern)
- `supabase/migrations/add_directory_system_tables.sql` -- HIGH confidence (direct review, migration pattern to replicate)
- `.planning/PROJECT.md` v1.4 milestone spec -- HIGH confidence

---
*Architecture research for v1.4 Client Pipeline Tracker*
*Researched: 2026-03-12*
