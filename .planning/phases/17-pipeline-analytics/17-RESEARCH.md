# Phase 17: Pipeline Analytics - Research

**Researched:** 2026-03-13
**Domain:** Recharts data visualization, Supabase aggregate queries, pipeline stage history SQL, overdue detection UI
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANAL-01 | Conversion funnel chart showing lead counts progressing through each stage | `pipeline_stage_history` table has `previous_stage`, `new_stage`, `transitioned_at` -- funnel built from history transitions, not current stage counts. Recharts `BarChart` renders horizontal funnel bars. |
| ANAL-02 | Average days per stage metric | Computed from consecutive `transitioned_at` timestamps in `pipeline_stage_history`. Each stage duration = next transition timestamp minus entry timestamp. Leads still in a stage use `NOW()` as the exit. |
| ANAL-03 | Source/channel breakdown chart showing where leads originate | `pipeline_leads.source` column contains source values (referral, cold email, website, sales_engine, etc.). Group by source client-side. Recharts `BarChart` or `PieChart`. |
| ANAL-04 | Leads with no communication in 7+ days visually highlighted as overdue | `pipeline_comms.occurred_at` already fetched on the pipeline page. Leads where `lastContact[id]` is more than 7 days ago (or never contacted) get a row background highlight and badge. |
</phase_requirements>

---

## Summary

Phase 17 adds an analytics section to the existing pipeline page at `/pipeline`. The four requirements call for two charts (conversion funnel and source breakdown), one metric display (avg days per stage), and one table enhancement (overdue row highlighting). All data already exists in the database from Phases 14-16 -- no schema changes are needed.

The most complex requirement is ANAL-01+ANAL-02: funnel and avg-days metrics both need to be derived from `pipeline_stage_history`, not from current lead stages. The decision logged in STATE.md ("Analytics query stage history, not COUNT current_stage") is already established. The stage history table has `previous_stage`, `new_stage`, and `transitioned_at`. From this, you can reconstruct how many leads ever passed through each stage and how long they spent there.

The overdue feature (ANAL-04) does not require new data fetching -- `lastContact` is already computed on the pipeline page. It only requires a visual change to the table row rendering: a red-tinted row background and optional "overdue" badge when the last contact was 7+ days ago or absent entirely.

**Primary recommendation:** Add an Analytics section above or below the pipeline table in `pipeline/page.tsx`. Fetch `pipeline_stage_history` once on mount alongside existing data. Compute funnel and avg-days client-side in `useMemo`. Render charts using existing Recharts (v3.7.0 is installed). Use `BarChart` for both funnel and source breakdown -- simpler and more readable than Recharts `FunnelChart` on a dark background. Highlight overdue rows by checking `lastContact` against a 7-day threshold.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | 3.7.0 | Bar charts for funnel and source breakdown | Already installed; used in CitationTrendChart, SeoTab |
| `react` | 19.2.3 | `useMemo` for derived analytics state | Already installed |
| `@supabase/supabase-js` | 2.97.0 | Fetch `pipeline_stage_history` | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/pipeline-constants.ts` | exists | `PIPELINE_STAGES` for stage order in funnel | Import for canonical stage ordering |
| `src/lib/types.ts` | exists | `PipelineStageHistory` type | Import for type safety |
| `src/components/ChartTooltip.tsx` | exists | Consistent tooltip styling on all charts | Pass as `content` prop to Recharts `Tooltip` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `BarChart` for funnel | Recharts `FunnelChart` | `FunnelChart` is available in Recharts 3.7.0 but requires trapezoid shapes that look awkward on dark theme; horizontal `BarChart` with a single bar per stage is cleaner and more readable |
| `BarChart` for source breakdown | `PieChart` | Both work; `BarChart` is easier to label and compare on a dark background; `PieChart` slices are hard to read when counts are similar |
| Separate `/pipeline/analytics` route | Analytics section on existing `/pipeline` page | Project has only standalone pages; tabs or sub-sections within a page are how other pages (SEO Engine) handle this; separate route adds unnecessary navigation |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/app/
  pipeline/
    page.tsx              # MODIFY: Add analytics section + overdue highlighting

src/components/
  pipeline/
    PipelineAnalytics.tsx  # NEW: analytics section component (funnel + avg days + source chart)
```

Note: The analytics section could live entirely in `pipeline/page.tsx` (project convention for single-file standalone pages), but the analytics section is complex enough to warrant extraction into a dedicated component under `src/components/pipeline/`. Both approaches are valid. The prior pipeline phase components (LeadDrawer, CommsLog, etc.) are already in `src/components/pipeline/` so this follows the established sub-component pattern.

### Pattern 1: Fetch Stage History on Mount
**What:** Fetch all `pipeline_stage_history` rows alongside existing leads/comms queries in `fetchData()`.
**When to use:** ANAL-01 and ANAL-02 both require stage history.
**Example:**
```typescript
// Add to the existing Promise.all in pipeline/page.tsx fetchData()
const [leadsRes, checklistRes, commsRes, historyRes] = await Promise.all([
  supabase.from('pipeline_leads').select('*').order('created_at', { ascending: false }),
  supabase.from('pipeline_checklist_items').select('lead_id, completed'),
  supabase.from('pipeline_comms').select('lead_id, occurred_at').order('occurred_at', { ascending: false }),
  supabase.from('pipeline_stage_history').select('lead_id, previous_stage, new_stage, transitioned_at').order('transitioned_at', { ascending: true }),
]);

const stageHistory = (historyRes.data || []) as PipelineStageHistory[];
```

### Pattern 2: Funnel Data from Stage History
**What:** Count how many unique leads ever entered each stage by examining `new_stage` values in history.
**When to use:** ANAL-01 conversion funnel.
**Example:**
```typescript
// Source: derived from pipeline_stage_history schema in types.ts
const funnelData = useMemo(() => {
  // Count unique leads that ever appeared in each stage
  const leadsByStage: Record<string, Set<string>> = {};
  for (const stage of PIPELINE_STAGES) {
    leadsByStage[stage] = new Set();
  }

  // Every lead starts in 'Lead' stage -- count all leads
  for (const lead of leads) {
    leadsByStage['Lead'].add(lead.id);
  }

  // Add leads that transitioned into each subsequent stage
  for (const entry of stageHistory) {
    if (leadsByStage[entry.new_stage]) {
      leadsByStage[entry.new_stage].add(entry.lead_id);
    }
  }

  return PIPELINE_STAGES.map((stage, i) => {
    const count = leadsByStage[stage].size;
    const prevCount = i > 0 ? leadsByStage[PIPELINE_STAGES[i - 1]].size : count;
    const dropoff = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0;
    return { stage, count, dropoff };
  });
}, [leads, stageHistory]);
```

### Pattern 3: Average Days Per Stage from History
**What:** For each stage transition, compute duration = (next_transition.transitioned_at - this_transition.transitioned_at). Average across all leads.
**When to use:** ANAL-02 avg days per stage metric display.
**Example:**
```typescript
const avgDaysPerStage = useMemo(() => {
  // Group history entries by lead, sorted by transitioned_at (already ordered asc)
  const byLead: Record<string, PipelineStageHistory[]> = {};
  for (const entry of stageHistory) {
    if (!byLead[entry.lead_id]) byLead[entry.lead_id] = [];
    byLead[entry.lead_id].push(entry);
  }

  const stageDurations: Record<string, number[]> = {};
  for (const stage of PIPELINE_STAGES) stageDurations[stage] = [];

  for (const leadEntries of Object.values(byLead)) {
    for (let i = 0; i < leadEntries.length; i++) {
      const entry = leadEntries[i];
      const stage = entry.new_stage;
      const enteredAt = new Date(entry.transitioned_at).getTime();
      const exitedAt = i + 1 < leadEntries.length
        ? new Date(leadEntries[i + 1].transitioned_at).getTime()
        : Date.now(); // still in this stage

      const days = (exitedAt - enteredAt) / 86400000;
      if (stageDurations[stage]) stageDurations[stage].push(days);
    }
  }

  // Also account for leads that never had a history entry (they're still in Lead)
  for (const lead of leads) {
    const hasHistory = byLead[lead.id] && byLead[lead.id].length > 0;
    if (!hasHistory) {
      const days = (Date.now() - new Date(lead.stage_entered_at).getTime()) / 86400000;
      stageDurations['Lead'].push(days);
    }
  }

  return PIPELINE_STAGES.map(stage => {
    const durations = stageDurations[stage];
    const avg = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;
    return { stage, avgDays: avg != null ? Math.round(avg * 10) / 10 : null, sampleSize: durations.length };
  });
}, [leads, stageHistory]);
```

### Pattern 4: Source Breakdown from Leads
**What:** Group leads by `source` field. Count per source. Render as horizontal bar chart.
**When to use:** ANAL-03 source/channel breakdown.
**Example:**
```typescript
const sourceData = useMemo(() => {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    const src = lead.source || 'unknown';
    counts[src] = (counts[src] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}, [leads]);
```

### Pattern 5: Overdue Row Highlighting
**What:** In the pipeline table row render, check `lastContact[lead.id]` against a 7-day threshold. If no contact in 7+ days (or never), apply a red-tinted background and a small "OVERDUE" badge.
**When to use:** ANAL-04 overdue follow-up highlighting.
**Example:**
```typescript
function isOverdue(leadId: string, lastContact: Record<string, string>): boolean {
  const lastTs = lastContact[leadId];
  if (!lastTs) return true; // never contacted = overdue
  const daysSince = (Date.now() - new Date(lastTs).getTime()) / 86400000;
  return daysSince >= 7;
}

// In table row:
const overdue = isOverdue(lead.id, lastContact);
<tr
  style={{
    background: overdue
      ? 'rgba(255, 61, 87, 0.04)'
      : hoveredRow === lead.id
      ? 'rgba(255,255,255,0.02)'
      : 'transparent',
    cursor: 'pointer',
  }}
>
  {/* In the Last Contact column: */}
  <td style={{ ...tdStyle }}>
    {lastContact[lead.id]
      ? (
        <span>
          {new Date(lastContact[lead.id]).toLocaleDateString()}
          {overdue && (
            <span style={{
              marginLeft: 8,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--danger)',
              background: 'rgba(255,61,87,0.12)',
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              overdue
            </span>
          )}
        </span>
      )
      : (
        <span style={{ color: 'var(--danger)' }}>
          No contact
          <span style={{
            marginLeft: 8,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--danger)',
            background: 'rgba(255,61,87,0.12)',
            padding: '2px 6px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}>
            overdue
          </span>
        </span>
      )}
  </td>
```

### Pattern 6: Recharts BarChart in Project Style
**What:** Horizontal `BarChart` using CSS custom properties for colors, `ChartTooltip` for tooltip, no axis lines (border-less style).
**When to use:** Funnel bar chart and source breakdown chart.
**Example:**
```typescript
// Source: CitationTrendChart.tsx + ChartTooltip.tsx patterns
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import ChartTooltip from '@/components/ChartTooltip';

<ResponsiveContainer width="100%" height={220}>
  <BarChart data={funnelData} layout="vertical">
    <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} />
    <YAxis dataKey="stage" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={80} />
    <Tooltip content={<ChartTooltip />} />
    <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]}>
      {funnelData.map((entry, index) => (
        <Cell
          key={entry.stage}
          fill={`rgba(6, 182, 212, ${1 - index * 0.12})`}
        />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

### Pattern 7: Avg Days Metric Cards
**What:** A row of 6 small metric cards (one per stage) showing average days. Uses existing `var()` tokens. No library needed.
**When to use:** ANAL-02 avg days per stage display.
**Example:**
```typescript
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  {avgDaysPerStage.map(({ stage, avgDays, sampleSize }) => (
    <div key={stage} style={{
      flex: 1,
      minWidth: 100,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '12px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {stage}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
        {avgDays != null ? `${avgDays}d` : '--'}
      </div>
      {sampleSize > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
          {sampleSize} lead{sampleSize !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  ))}
</div>
```

### Anti-Patterns to Avoid
- **Computing funnel from current stage counts:** `COUNT(*) GROUP BY stage` gives only current distribution, not historical progression. Leads that churned out of Proposal would disappear from the count. Always derive from `pipeline_stage_history`.
- **Including Churned in overdue logic:** Churned leads don't need follow-up. Apply overdue highlighting only to active stages (Lead, Demo, Proposal, Onboarding, Active).
- **Fetching stage history in a separate `useEffect`:** The existing page already has a `fetchData()` function inside a `useEffect`. Add `pipeline_stage_history` to the existing `Promise.all` -- don't create a second `useEffect` that causes a second render.
- **Using Tailwind classes:** Project uses inline `style={{}}` exclusively. All analytics UI follows the same pattern.
- **Putting analytics data in separate API routes:** All other pages query Supabase directly via the browser client. Follow that pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bar charts | Custom SVG or canvas bars | `BarChart` from Recharts 3.7.0 | Already installed, handles responsive sizing, tooltips, animations |
| Tooltip styling | Raw Recharts default tooltip | `ChartTooltip` component | Project already has a styled tooltip; reuse it |
| Stage ordering | Alphabetical sort | `PIPELINE_STAGES` constant | Canonical stage order must match workflow order (Lead -> Demo -> Proposal -> Onboarding -> Active -> Churned) |
| Date arithmetic | Moment.js or date-fns | Native `Date.getTime()` arithmetic | No date library in project; simple subtraction is sufficient for days calculations |

**Key insight:** All analytics computation is pure JavaScript -- no server-side aggregation needed at 5-15 leads scale. Everything computes in `useMemo` from client-fetched data.

---

## Common Pitfalls

### Pitfall 1: Funnel Counts Lead Count Instead of Historical Passage Count
**What goes wrong:** Funnel shows current stage distribution (3 in Lead, 1 in Demo, etc.) rather than cumulative leads that ever passed through each stage.
**Why it happens:** It's tempting to derive funnel from `stageCounts` (already computed) rather than querying history.
**How to avoid:** Build funnel by scanning `pipeline_stage_history.new_stage` values. Every unique `lead_id` that appears with `new_stage = 'Demo'` means one lead reached Demo. Also seed 'Lead' with all lead IDs since every lead starts there.
**Warning signs:** Funnel numbers only match current stage summary cards; Active=Churned=0 because no leads are currently there.

### Pitfall 2: Avg Days Double-Counts Leads Without History
**What goes wrong:** Leads created in Phase 14 or 15 that have never had a stage transition may not appear in `pipeline_stage_history` at all. Their time in the Lead stage is invisible.
**Why it happens:** `pipeline_stage_history` only records transitions. A lead that was created and never moved has no history rows.
**How to avoid:** For leads with no history rows, compute Lead stage duration from `lead.stage_entered_at` to now and include in the Lead average.
**Warning signs:** Lead stage avg shows '--' despite having leads; sample size = 0 for Lead.

### Pitfall 3: Overdue Logic Flags Churned Leads
**What goes wrong:** Churned leads with no recent contact appear as overdue, cluttering the view.
**Why it happens:** Overdue check runs on all leads regardless of stage.
**How to avoid:** In `isOverdue()`, return `false` immediately if `lead.stage === 'Churned'`. Optionally also skip 'Active' if the operator prefers not to see those flagged.
**Warning signs:** Churned leads rows have red tint.

### Pitfall 4: Analytics Section Causes Layout Overflow on Small Viewports
**What goes wrong:** Six avg-days cards + two charts + the existing pipeline table all stack vertically and make the page very long.
**Why it happens:** No consideration of section layout.
**How to avoid:** Wrap charts side-by-side in a two-column grid when viewport is wide enough (use flexbox with `minWidth` on each chart card). Stack vertically on mobile naturally.
**Warning signs:** Horizontal scroll appears on `/pipeline`.

### Pitfall 5: Recharts ResponsiveContainer Width at 100% Inside Flex Child
**What goes wrong:** Chart renders with zero width or incorrect width when placed inside a flex child.
**Why it happens:** `ResponsiveContainer width="100%"` requires a parent element with a defined width. Inside some flex layouts, the parent has no explicit width.
**How to avoid:** Wrap each chart in a `div` with explicit `width: '100%'` or use a grid layout with defined column widths. Set `minWidth` on the parent card.
**Warning signs:** Chart is invisible or renders as a 0px-wide element.

---

## Code Examples

Verified patterns from the existing codebase:

### Existing Chart Import Pattern
```typescript
// Source: src/components/geo/CitationTrendChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import ChartTooltip from '@/components/ChartTooltip';
```

### Card Container Pattern (reused from existing components)
```typescript
// Source: CitationTrendChart.tsx -- chart wrapper pattern
<div style={{
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  padding: 24,
}}>
  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
    Chart Title
  </div>
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
    Subtitle / description
  </div>
  {/* chart content */}
</div>
```

### Two-Column Chart Layout
```typescript
// Side-by-side charts with fallback to single column
<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24 }}>
  <div style={{ flex: 1, minWidth: 300 }}>
    {/* Funnel chart */}
  </div>
  <div style={{ flex: 1, minWidth: 300 }}>
    {/* Source breakdown chart */}
  </div>
</div>
```

### Drop-off Percentage Display in Funnel
```typescript
// Display drop-off between stages as a label
{funnelData.map((item, i) => (
  <div key={item.stage}>
    {/* stage bar */}
    {i > 0 && item.dropoff > 0 && (
      <div style={{
        fontSize: 11,
        color: 'var(--danger)',
        fontFamily: 'var(--font-mono)',
        textAlign: 'right',
        paddingRight: 8,
        marginTop: 2,
      }}>
        -{item.dropoff}%
      </div>
    )}
  </div>
))}
```

### Recharts Horizontal Bar (layout="vertical")
```typescript
// Source: Recharts 3.7.0 -- layout="vertical" puts categories on Y axis
<BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
  <XAxis type="number" hide />
  <YAxis
    dataKey="stage"
    type="category"
    tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
    axisLine={false}
    tickLine={false}
    width={90}
  />
  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
  <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
</BarChart>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Compute funnel from current stage counts | Compute from `pipeline_stage_history` | Decision locked in STATE.md | Accurate historical funnel rather than snapshot |
| Recharts 2.x `FunnelChart` | `BarChart` with `layout="vertical"` | Recharts 3.x supports both; project aesthetic prefers bars | Consistent visual style; simpler implementation |

**No deprecations relevant to this phase** -- Recharts 3.7.0 is current; all used components (`BarChart`, `Bar`, `Cell`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`) are stable non-deprecated API.

---

## Open Questions

1. **Should the analytics section appear above or below the pipeline table?**
   - What we know: The pipeline table is the primary workhorse; analytics is secondary context.
   - What's unclear: Brian's preference for placement.
   - Recommendation: Place analytics below the stage summary cards but above the pipeline table, with a clear section heading. This makes the page scannable top-to-bottom: summary -> analytics -> detail table.

2. **Should Churned leads be excluded from the funnel?**
   - What we know: ANAL-01 says "lead counts progressing through each stage." Churned is the 6th stage and represents failure to convert.
   - What's unclear: Whether Brian wants to see the Churned bar as a "leak" in the funnel or omit it.
   - Recommendation: Include Churned in the funnel -- it shows how many dropped off. This is standard funnel analytics.

3. **What sources are expected in the data?**
   - What we know: `pipeline_leads.source` stores values like "referral", "cold email", "website", "sales_engine". INT-02 sets `source = 'sales_engine'` for auto-created leads. No enum constraint on the column.
   - What's unclear: Other source values Brian may have entered manually.
   - Recommendation: The source chart renders whatever values are present -- no hardcoded list needed. Sort by count descending.

---

## Validation Architecture

> Skipped -- `workflow.nyquist_validation` is not present in `.planning/config.json` (not set to true).

---

## Sources

### Primary (HIGH confidence)
- `/Users/brianegan/EchoLocalClientTracker/src/app/pipeline/page.tsx` -- existing data fetch, lastContact pattern, table row render
- `/Users/brianegan/EchoLocalClientTracker/src/lib/types.ts` -- `PipelineStageHistory`, `PipelineLead`, `PipelineComm` type definitions
- `/Users/brianegan/EchoLocalClientTracker/src/lib/pipeline-constants.ts` -- `PIPELINE_STAGES` canonical order
- `/Users/brianegan/EchoLocalClientTracker/src/components/geo/CitationTrendChart.tsx` -- Recharts usage pattern, `ResponsiveContainer`, styling convention
- `/Users/brianegan/EchoLocalClientTracker/src/components/ChartTooltip.tsx` -- reusable tooltip component API
- `/Users/brianegan/EchoLocalClientTracker/src/app/globals.css` -- CSS custom properties (--accent, --danger, --success, --bg-surface, etc.)
- `/Users/brianegan/EchoLocalClientTracker/.planning/STATE.md` -- locked decision: analytics query stage history, not current stage counts
- `/Users/brianegan/EchoLocalClientTracker/package.json` -- Recharts 3.7.0 confirmed installed
- `node_modules/recharts` introspection -- confirmed `BarChart`, `Bar`, `Cell`, `FunnelChart`, `PieChart` all available in 3.7.0

### Secondary (MEDIUM confidence)
- Recharts 3.x documentation (BarChart layout="vertical" for horizontal bar charts -- confirmed by library export inspection)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, no new dependencies
- Architecture: HIGH -- directly follows established project patterns; all data already available
- SQL/data derivation: HIGH -- `pipeline_stage_history` schema is concrete and well-understood from Phase 14-15 decisions
- Pitfalls: HIGH -- identified from reading actual codebase and locked decisions in STATE.md
- Chart implementation: HIGH -- Recharts usage verified from CitationTrendChart.tsx; same patterns apply

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain -- Recharts 3.x and Supabase client API are well-established)
