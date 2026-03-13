# Phase 15: Page Shell + Pipeline Table - Research

**Researched:** 2026-03-13
**Domain:** Next.js page routing, Supabase client-side queries, admin-only page protection, sortable/filterable table UI
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Pipeline page accessible via top-level sidebar link (admin-only) | Sidebar.tsx engine-links pattern; `useAuth()` provides `isAdmin`; Next.js App Router `/pipeline/page.tsx` |
| UI-02 | Pipeline table view shows all leads with stage, days-in-stage, source, checklist progress, and last contact date | `pipeline_leads` table has `stage`, `stage_entered_at`, `source`; checklist progress from `pipeline_checklist_items` count; last contact from `pipeline_comms` max `occurred_at` |
| UI-03 | Table is filterable by stage and sortable by any column | Client-side filter + sort on React state; `PIPELINE_STAGES` constant for filter options |
| UI-04 | Admin can move a lead to a different stage via dropdown, which creates a stage history entry | Two Supabase operations: UPDATE `pipeline_leads.stage` + `stage_entered_at`, INSERT into `pipeline_stage_history` |
| UI-05 | Stage summary cards at top of page show count per stage | Derive from loaded leads array grouped by `stage`; render 6 cards using `PIPELINE_STAGES` |
</phase_requirements>

---

## Summary

Phase 15 builds the pipeline page UI -- a standalone `/pipeline` route with an admin-only sidebar link, stage summary cards, and a sortable/filterable table of all pipeline leads. This is a pure frontend phase; all database tables and types already exist from Phase 14.

The project uses inline styles exclusively (no CSS modules, no Tailwind utility classes on elements despite Tailwind being imported for its reset). Every existing component -- Sidebar, TabNav, all tab components -- uses the `style={{}}` pattern with CSS custom properties (`var(--bg-surface)`, `var(--accent)`, etc.). The design system is dark-themed (Linear.app aesthetic) with Space Grotesk for text and JetBrains Mono for data/labels. The pipeline page must follow this exact pattern.

The existing Sidebar has an "engine links" section at the bottom with colored links to `/agents`, `/seo-engine`, and `/sales-engine`. The Pipeline link should be added here following the same pattern. Existing standalone pages (agents, sales-engine, seo-engine) do NOT have auth guards -- they are simply accessible to anyone who knows the URL. However, UI-01 requires admin-only visibility of the sidebar link. For consistency with how the main dashboard hides admin tabs (TabNav filters by `isAdmin`), the sidebar link should be conditionally rendered. The pipeline page itself should also guard with `useAuth()` and redirect non-admin users.

**Primary recommendation:** Create `src/app/pipeline/page.tsx` as a single-file page component (project convention for standalone pages). Add a Pipeline link to Sidebar.tsx in the engine-links section, conditionally rendered when user is admin. Fetch leads + checklist counts + last comms in parallel on mount. Implement sort/filter as client-side React state (appropriate at 5-15 leads scale). Stage changes use two sequential Supabase calls (update lead, insert history) with optimistic UI update.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.1.6 | App Router page at `/pipeline` | Already installed; all pages use App Router |
| `react` | 19.2.3 | Component state for sort/filter/stage changes | Already installed |
| `@supabase/ssr` | 0.9.0 | `createBrowserClient` for querying pipeline tables | Already installed; `src/lib/supabase.ts` exports the client |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/pipeline-constants.ts` | exists | `PIPELINE_STAGES` array for filter dropdown and summary cards | Import for stage list |
| `src/lib/types.ts` | exists | `PipelineLead`, `PipelineStageHistory`, `PipelineStage` types | Import for type safety |
| `src/lib/auth-context.tsx` | exists | `useAuth()` hook for `isAdmin` check | Import for admin guard |
| `src/lib/supabase.ts` | exists | `supabase` client instance | Import for DB queries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side sort/filter | Server-side with URL params | Over-engineered for 5-15 leads; client-side is instant and simpler |
| Single-file page component | Separate components directory | Existing standalone pages (agents, sales-engine) are single-file; follow the pattern |
| Inline styles | Tailwind utility classes | Project uses inline styles exclusively despite having Tailwind installed; follow the pattern |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/app/
  pipeline/
    page.tsx              # NEW: Pipeline page (single-file, self-contained)

src/components/
  Sidebar.tsx             # MODIFY: Add Pipeline link in engine-links section
```

### Pattern 1: Standalone Page with Auth Guard
**What:** A `'use client'` page that imports `useAuth()`, checks `isAdmin`, and redirects or shows access-denied for non-admins.
**When to use:** All admin-only standalone pages.
**Example:**
```typescript
// Source: Pattern derived from src/app/page.tsx (main dashboard)
'use client';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export default function PipelinePage() {
  const { profile, loading: authLoading, isAdmin } = useAuth();

  if (authLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  if (!isAdmin) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Access denied</div>;
  }

  // ... page content
}
```

### Pattern 2: Sidebar Engine Link (Existing Pattern)
**What:** Colored link in the Sidebar's bottom section with hover effect, uppercase mono font.
**When to use:** Adding top-level navigation items.
**Example:**
```typescript
// Source: src/components/Sidebar.tsx lines 171-249
// Each link follows this exact pattern:
<a
  href="/pipeline"
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: collapsed ? '12px 0' : '12px 24px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: '#A78BFA',  // Purple - distinct from existing colors
    textDecoration: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.15s ease',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = 'rgba(167, 139, 250, 0.08)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = 'transparent';
  }}
>
  {collapsed ? 'PL' : 'Pipeline \u203A'}
</a>
```
**Color choices for existing links:** Agents=#FF6B35 (orange), SEO Engine=var(--success) (green), Sales Engine=var(--accent) (teal). Pipeline should use a distinct color -- purple (#A78BFA) is unused and visible on the dark background.

### Pattern 3: Data Fetching on Mount
**What:** `useEffect` with async function that queries Supabase, sets state.
**When to use:** Every data load in this project.
**Example:**
```typescript
// Source: src/app/page.tsx lines 48-85 (client loading pattern)
const [leads, setLeads] = useState<PipelineLead[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!isAdmin) return;

  async function loadLeads() {
    setLoading(true);
    const { data, error } = await supabase
      .from('pipeline_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Pipeline leads fetch error:', error);
      setLeads([]);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  }

  loadLeads();
}, [isAdmin]);
```

### Pattern 4: Computed Columns (Days in Stage, Checklist Progress, Last Contact)
**What:** Derive display values from raw data rather than storing computed columns.
**When to use:** UI-02 requires days-in-stage, checklist progress (X/Y), and last contact date.
**Example:**
```typescript
// Days in current stage
function daysInStage(lead: PipelineLead): number {
  const entered = new Date(lead.stage_entered_at);
  const now = new Date();
  return Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
}

// Checklist progress: need to fetch checklist items and count completed
// Query: SELECT lead_id, COUNT(*) as total, COUNT(*) FILTER (WHERE completed) as done FROM pipeline_checklist_items GROUP BY lead_id
// Or fetch all items and compute client-side (fine at this scale)

// Last contact: need to fetch latest comm per lead
// Query: SELECT DISTINCT ON (lead_id) lead_id, occurred_at FROM pipeline_comms ORDER BY lead_id, occurred_at DESC
```

### Pattern 5: Stage Change with History Entry
**What:** Update lead's stage + stage_entered_at, then insert a history row. Two sequential calls.
**When to use:** UI-04 inline stage dropdown change.
**Example:**
```typescript
async function changeStage(leadId: string, currentStage: PipelineStage, newStage: PipelineStage) {
  // 1. Update the lead
  const { error: updateError } = await supabase
    .from('pipeline_leads')
    .update({
      stage: newStage,
      stage_entered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (updateError) {
    console.error('Stage update error:', updateError);
    return;
  }

  // 2. Insert history entry
  const { error: historyError } = await supabase
    .from('pipeline_stage_history')
    .insert({
      lead_id: leadId,
      previous_stage: currentStage,
      new_stage: newStage,
    });

  if (historyError) {
    console.error('Stage history insert error:', historyError);
  }

  // 3. Update local state (optimistic or refetch)
  setLeads(prev => prev.map(l =>
    l.id === leadId
      ? { ...l, stage: newStage, stage_entered_at: new Date().toISOString() }
      : l
  ));
}
```

### Pattern 6: Client-Side Sort and Filter
**What:** React state for `sortField`, `sortDirection`, `stageFilter`. Derive displayed rows from full list.
**When to use:** UI-03 table sorting/filtering.
**Example:**
```typescript
type SortField = 'contact_name' | 'stage' | 'trade' | 'source' | 'days_in_stage' | 'checklist' | 'last_contact';
type SortDir = 'asc' | 'desc';

const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all');
const [sortField, setSortField] = useState<SortField>('created_at');
const [sortDir, setSortDir] = useState<SortDir>('desc');

const displayedLeads = useMemo(() => {
  let filtered = stageFilter === 'all'
    ? leads
    : leads.filter(l => l.stage === stageFilter);

  return filtered.sort((a, b) => {
    // sort logic per field
    const dir = sortDir === 'asc' ? 1 : -1;
    // ... compare by sortField
    return 0;
  });
}, [leads, stageFilter, sortField, sortDir]);
```

### Anti-Patterns to Avoid
- **Using Tailwind utility classes on elements:** Project uses inline `style={{}}` exclusively. Follow the pattern.
- **Creating a separate components directory for pipeline:** Existing standalone pages (agents, sales-engine) are single-file. Keep it contained.
- **Fetching data without auth check:** Always guard with `if (!isAdmin) return` before querying pipeline tables. RLS will block anyway, but the guard prevents unnecessary requests.
- **Using `useRouter().push()` for sidebar links:** Existing sidebar links use plain `<a href="">` tags. Follow the pattern.
- **Forgetting `stage_entered_at` on stage change:** Phase 14 research (Pitfall 4) explicitly flagged this. Both `stage` and `stage_entered_at` must update together.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth guard | Custom middleware or route protection | `useAuth()` hook + conditional render | Established pattern in this project; no middleware auth exists |
| Stage options list | Hardcoded array in component | `PIPELINE_STAGES` from `pipeline-constants.ts` | Single source of truth; already created in Phase 14 |
| Date formatting | Manual date arithmetic | `new Date().toLocaleDateString()` or simple math for days | No date library in project; keep it native |
| Table sorting | External table library (react-table, tanstack) | `useMemo` with `.sort()` | 5-15 rows max; no library needed for this scale |
| Stage colors/badges | Ad-hoc color picking | Consistent map object `STAGE_COLORS: Record<PipelineStage, string>` | Define once, use for cards and table badges |

**Key insight:** At 5-15 leads, every UI feature can be client-side vanilla React. No table library, no virtual scrolling, no server-side pagination. Keep it simple.

---

## Common Pitfalls

### Pitfall 1: Sidebar Link Visible to Non-Admin
**What goes wrong:** Non-admin users see the Pipeline link and navigate to a page that shows "Access denied."
**Why it happens:** Sidebar currently receives no `isAdmin` prop -- it renders all engine links unconditionally.
**How to avoid:** Pass `isAdmin` to Sidebar (it's already available in the parent `page.tsx` where `useAuth()` is called). Conditionally render the Pipeline link.
**Warning signs:** Non-admin user sees "Pipeline" in sidebar.

### Pitfall 2: Missing Checklist/Comms Data for Table Columns
**What goes wrong:** Table shows "0/0" for checklist progress and empty last contact because those data points require joining additional tables.
**Why it happens:** `pipeline_leads` table alone doesn't have checklist progress or last contact date. These come from `pipeline_checklist_items` and `pipeline_comms` respectively.
**How to avoid:** Fetch checklist counts and last comm dates in parallel with leads. Either use Supabase's `select` with joins or make separate queries and merge client-side.
**Warning signs:** All rows show 0/0 checklist or empty last contact.

### Pitfall 3: Stage Change Doesn't Update `stage_entered_at`
**What goes wrong:** Days-in-stage shows wrong values after a stage change.
**Why it happens:** Developer updates `stage` but forgets `stage_entered_at` in the same UPDATE call.
**How to avoid:** Always update both fields together. The `changeStage` function must set both `stage` and `stage_entered_at`.
**Warning signs:** Days-in-stage doesn't reset to 0 after changing a lead's stage.

### Pitfall 4: Supabase RLS Blocks Frontend Queries
**What goes wrong:** Pipeline leads query returns empty array for admin user.
**Why it happens:** RLS policy checks `user_profiles.role = 'admin'` via `auth.uid()`. If the browser client's auth token is expired or user_profiles row is missing, the policy blocks.
**How to avoid:** Verify the RLS policy is using `FOR ALL` with both USING and WITH CHECK clauses. The admin user must have a `user_profiles` row with `role = 'admin'`. Test by querying from browser dev tools.
**Warning signs:** `supabase.from('pipeline_leads').select('*')` returns `{ data: [], error: null }` for admin.

### Pitfall 5: Sort Function Returns Inconsistent Results
**What goes wrong:** Table rows jump around or sort incorrectly.
**Why it happens:** Sort comparator doesn't handle null values (phone, company_name, trade can all be null). `null < 'string'` is `false` in JS.
**How to avoid:** Null-safe comparator: `(a ?? '') < (b ?? '')` or push nulls to the end.
**Warning signs:** Rows with null values appear randomly in sorted lists.

---

## Code Examples

### Supabase Join for Checklist Progress
```typescript
// Option A: Separate query for checklist counts (simpler, project convention)
async function loadChecklistProgress() {
  const { data, error } = await supabase
    .from('pipeline_checklist_items')
    .select('lead_id, completed');

  if (error || !data) return {};

  const progress: Record<string, { done: number; total: number }> = {};
  for (const item of data) {
    if (!progress[item.lead_id]) progress[item.lead_id] = { done: 0, total: 0 };
    progress[item.lead_id].total++;
    if (item.completed) progress[item.lead_id].done++;
  }
  return progress;
}
```

### Supabase Query for Last Contact Date
```typescript
// Fetch latest comm per lead
async function loadLastContact() {
  const { data, error } = await supabase
    .from('pipeline_comms')
    .select('lead_id, occurred_at')
    .order('occurred_at', { ascending: false });

  if (error || !data) return {};

  const lastContact: Record<string, string> = {};
  for (const comm of data) {
    if (!lastContact[comm.lead_id]) {
      lastContact[comm.lead_id] = comm.occurred_at;
    }
  }
  return lastContact;
}
```

### Stage Summary Cards
```typescript
// Derive counts from loaded leads
const stageCounts = useMemo(() => {
  const counts: Record<PipelineStage, number> = {
    Lead: 0, Demo: 0, Proposal: 0, Onboarding: 0, Active: 0, Churned: 0,
  };
  for (const lead of leads) {
    counts[lead.stage]++;
  }
  return counts;
}, [leads]);

// Render cards using PIPELINE_STAGES for consistent ordering
{PIPELINE_STAGES.map(stage => (
  <div key={stage} style={{
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)',
    padding: '16px 20px',
    flex: 1,
    minWidth: 120,
  }}>
    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {stage}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
      {stageCounts[stage]}
    </div>
  </div>
))}
```

### Stage Dropdown in Table Row
```typescript
<select
  value={lead.stage}
  onChange={(e) => changeStage(lead.id, lead.stage, e.target.value as PipelineStage)}
  style={{
    background: 'var(--bg-depth)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  }}
>
  {PIPELINE_STAGES.map(s => (
    <option key={s} value={s}>{s}</option>
  ))}
</select>
```

### Sortable Column Header
```typescript
function SortHeader({ field, label }: { field: SortField; label: string }) {
  const isActive = sortField === field;
  return (
    <th
      onClick={() => {
        if (isActive) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
      }}
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {label} {isActive ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
    </th>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External table libraries (react-table) | Vanilla React sort/filter with useMemo | N/A -- project convention | No new dependencies; simpler for small datasets |
| CSS modules or Tailwind classes | Inline `style={{}}` with CSS custom properties | Project inception | All components follow this pattern consistently |
| Route middleware for auth | Client-side `useAuth()` hook with conditional render | Project inception | Simple, no middleware configuration needed |

---

## Open Questions

1. **Should the Sidebar accept `isAdmin` as a prop or call `useAuth()` directly?**
   - What we know: Sidebar currently doesn't import `useAuth()`. It receives data via props from `page.tsx`. The parent page already has `isAdmin`.
   - What's unclear: Adding `useAuth()` to Sidebar creates a dependency; passing `isAdmin` as a prop follows the existing data-down pattern.
   - Recommendation: Pass `isAdmin` as a new prop to Sidebar. Cleaner, follows existing pattern, no new imports in Sidebar.

2. **Should checklist items be auto-created when a lead enters a stage, or only when viewing the detail drawer (Phase 16)?**
   - What we know: Phase 14 created `STAGE_CHECKLIST_DEFAULTS` and `pipeline_checklist_items` table. Phase 15 needs to show checklist progress (X/Y) in the table. If no items have been created yet, progress will show 0/0 for all leads.
   - What's unclear: Whether to auto-populate checklist items on lead creation / stage change (Phase 15) or defer to Phase 16.
   - Recommendation: Show progress based on existing checklist items. For leads with no items yet, show "--" or "0/N" where N comes from `STAGE_CHECKLIST_DEFAULTS[stage].length`. This way the denominator is always known even without DB rows.

---

## Sources

### Primary (HIGH confidence)
- `/Users/brianegan/EchoLocalClientTracker/src/components/Sidebar.tsx` -- Engine links pattern, inline styles, link structure
- `/Users/brianegan/EchoLocalClientTracker/src/app/page.tsx` -- Auth guard pattern, data fetching, Sidebar usage
- `/Users/brianegan/EchoLocalClientTracker/src/lib/auth-context.tsx` -- `useAuth()` hook, `isAdmin` boolean
- `/Users/brianegan/EchoLocalClientTracker/src/lib/types.ts` -- `PipelineLead`, `PipelineStage`, `PipelineStageHistory` types
- `/Users/brianegan/EchoLocalClientTracker/src/lib/pipeline-constants.ts` -- `PIPELINE_STAGES`, `STAGE_CHECKLIST_DEFAULTS`
- `/Users/brianegan/EchoLocalClientTracker/src/app/globals.css` -- CSS custom properties, design tokens
- `/Users/brianegan/EchoLocalClientTracker/src/components/TabNav.tsx` -- Admin-conditional rendering pattern
- `/Users/brianegan/EchoLocalClientTracker/.planning/phases/14-database-foundation/14-RESEARCH.md` -- Schema details, pitfalls carry-forward

### Secondary (MEDIUM confidence)
- Next.js App Router conventions for `/pipeline/page.tsx` file-based routing (well-established, stable API)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, no new dependencies
- Architecture: HIGH -- directly follows established project patterns (inline styles, single-file pages, useAuth hook, Supabase client queries)
- Pitfalls: HIGH -- identified from reading actual codebase (Sidebar prop gap, checklist data join, stage_entered_at from Phase 14 pitfall carry-forward)
- UI implementation: HIGH -- simple table with client-side sort/filter at 5-15 row scale; no edge cases

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain -- Next.js page patterns and Supabase client API are well-established)
