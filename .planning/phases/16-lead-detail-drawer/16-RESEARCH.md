# Phase 16: Lead Detail Drawer - Research

**Researched:** 2026-03-12
**Domain:** React slide-out drawer, inline editing, Supabase upsert, optimistic UI
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DETAIL-01 | Clicking a lead opens a slide-out drawer with full profile, stage history timeline, checklist, and comms log | Drawer component pattern with React portal + fixed overlay; fetch four Supabase tables on open |
| DETAIL-02 | Admin can edit lead profile fields inline in the drawer without closing it | Controlled input pattern with field-level save; optimistic update + Supabase `.update()` |
| DETAIL-03 | Admin can add a communication log entry (type, notes, occurred_at) from the drawer; entry appears immediately in timeline | Insert into pipeline_comms with optimistic prepend to local comms array |
| DETAIL-04 | Checklist shows stage-specific items with check/uncheck persisted per-lead | Supabase upsert on UNIQUE(lead_id, stage, item_key) with optimistic toggle |
</phase_requirements>

---

## Summary

Phase 16 adds a slide-out drawer that is the daily workflow surface for every pipeline lead. The drawer is triggered by clicking any table row in the existing `/pipeline` page and renders as a fixed right-panel overlay over the table without navigating away. All four data domains (profile, stage history, checklist, comms) are fetched from Supabase when the drawer opens, and all writes use optimistic updates so the UI responds instantly.

The project uses pure inline styles against CSS custom properties -- no Tailwind utility classes in component files -- and no external component library. The drawer must follow this convention exactly: fixed panel, backdrop overlay, CSS transition for slide-in/out, keyboard Escape to close. No third-party drawer or modal library is needed or wanted.

Inline editing for DETAIL-02 follows the "click field to activate input" pattern with a blur-or-Enter save, calling `supabase.from('pipeline_leads').update()`. The comms log (DETAIL-03) uses a small form at the bottom of the drawer with comm_type select, notes textarea, and optional datetime override. Checklist toggling (DETAIL-04) uses `.upsert()` with `onConflict: 'lead_id,stage,item_key'` -- the same UNIQUE constraint already in the DB schema from Phase 14.

**Primary recommendation:** Build a single `LeadDrawer` client component that manages its own fetch/state internally, opened by passing a selected lead ID down from the pipeline page. Keep all drawer logic isolated from the table page component.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component, state, portal | Already in project |
| Next.js | 16.1.6 | App shell, routing | Already in project |
| @supabase/supabase-js | ^2.97.0 | DB reads/writes | Already in project, browser client configured |
| Tailwind CSS | ^4 | Global utility classes (minimal use in this project) | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ReactDOM.createPortal | built-in | Render drawer outside parent DOM tree | Prevents z-index and stacking context issues |
| CSS transitions | built-in | Slide-in/out animation | `transform: translateX(100%)` toggle -- no JS animation lib needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom portal drawer | Headless UI Dialog | Headless UI adds dependency; custom is ~50 lines and consistent with project style |
| Field-level blur save | Save button per section | Save button is cleaner for multi-field edits but friction is higher; blur-save is snappier for single-field |
| Supabase upsert for checklist | insert + update branching | Upsert on the existing UNIQUE constraint is cleaner and matches the Phase 14 schema decision |

**Installation:** No new packages needed. All required libraries are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   └── pipeline/
│       └── page.tsx          # Existing pipeline table -- add selectedLeadId state + onClick handler
└── components/
    └── pipeline/
        ├── LeadDrawer.tsx    # Main drawer shell (portal, overlay, panel, close on Escape)
        ├── LeadProfile.tsx   # Profile fields with inline edit (DETAIL-02)
        ├── StageTimeline.tsx # Stage history ordered list (DETAIL-01)
        ├── LeadChecklist.tsx # Stage checklist with toggle (DETAIL-04)
        └── CommsLog.tsx      # Communication log + add-entry form (DETAIL-03)
```

### Pattern 1: Drawer Shell with React Portal

**What:** Render a fixed overlay + sliding panel into `document.body` via `ReactDOM.createPortal`. The drawer is controlled by `selectedLeadId: string | null` in the parent page.

**When to use:** Any overlay that must sit above all page content regardless of parent z-index context.

**Example:**
```typescript
// Source: React docs https://react.dev/reference/react-dom/createPortal
// + project inline style convention

import { useEffect } from 'react';
import ReactDOM from 'react-dom';

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDrawer({ leadId, onClose }: LeadDrawerProps) {
  const isOpen = leadId !== null;

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 560,
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 101,
          overflowY: 'auto',
          padding: '24px 28px',
        }}
      >
        {/* content */}
      </div>
    </>,
    document.body
  );
}
```

### Pattern 2: Inline Field Edit (blur-save)

**What:** Field displays as styled text. On click it becomes a controlled `<input>` or `<textarea>`. On blur or Enter, it calls Supabase update and reverts to display mode.

**When to use:** Any profile field that changes rarely (name, email, phone, trade, source, notes).

**Example:**
```typescript
// Pattern established from project code in pipeline/page.tsx

const [editing, setEditing] = useState<keyof PipelineLead | null>(null);
const [draft, setDraft] = useState('');

function startEdit(field: keyof PipelineLead, current: string) {
  setEditing(field);
  setDraft(current ?? '');
}

async function saveField(field: keyof PipelineLead) {
  setEditing(null);
  // Optimistic: update local lead state immediately
  setLead(prev => prev ? { ...prev, [field]: draft } : prev);
  const { error } = await supabase
    .from('pipeline_leads')
    .update({ [field]: draft, updated_at: new Date().toISOString() })
    .eq('id', lead.id);
  if (error) {
    console.error('Failed to save field:', error);
    // Revert: re-fetch or restore previous value
  }
}
```

### Pattern 3: Checklist Upsert with Optimistic Toggle

**What:** Checkbox toggles optimistically in local state, then upserts to Supabase using the UNIQUE(lead_id, stage, item_key) constraint from Phase 14.

**When to use:** DETAIL-04 checklist items.

**Example:**
```typescript
// Source: Supabase JS docs https://supabase.com/docs/reference/javascript/upsert

async function toggleItem(item: PipelineChecklistItem) {
  const newCompleted = !item.completed;
  // Optimistic update
  setItems(prev => prev.map(i =>
    i.item_key === item.item_key ? { ...i, completed: newCompleted } : i
  ));

  const { error } = await supabase
    .from('pipeline_checklist_items')
    .upsert(
      {
        lead_id: item.lead_id,
        stage: item.stage,
        item_key: item.item_key,
        item_label: item.item_label,
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      },
      { onConflict: 'lead_id,stage,item_key' }
    );

  if (error) {
    console.error('Failed to toggle checklist item:', error);
    // Revert
    setItems(prev => prev.map(i =>
      i.item_key === item.item_key ? { ...i, completed: item.completed } : i
    ));
  }
}
```

### Pattern 4: Add Communication Log Entry

**What:** Form at bottom of comms section. Submit inserts to `pipeline_comms`, new entry is optimistically prepended to the local comms array.

**Example:**
```typescript
async function addComm(form: { comm_type: CommType; notes: string; occurred_at: string }) {
  const optimistic: PipelineComm = {
    id: crypto.randomUUID(),
    lead_id: leadId,
    comm_type: form.comm_type,
    direction: 'outbound',
    notes: form.notes,
    occurred_at: form.occurred_at,
    created_at: new Date().toISOString(),
  };
  // Optimistic prepend
  setComms(prev => [optimistic, ...prev]);
  resetForm();

  const { data, error } = await supabase
    .from('pipeline_comms')
    .insert({
      lead_id: leadId,
      comm_type: form.comm_type,
      direction: 'outbound',
      notes: form.notes || null,
      occurred_at: form.occurred_at,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert comm:', error);
    setComms(prev => prev.filter(c => c.id !== optimistic.id));
  } else {
    // Replace optimistic with real row (for correct id)
    setComms(prev => prev.map(c => c.id === optimistic.id ? data : c));
  }
}
```

### Pattern 5: Data Fetching on Drawer Open

**What:** When `leadId` changes to a non-null value, fetch all drawer data in parallel: lead profile, stage history, checklist items, comms. Use a single `useEffect` gated on `leadId`.

**Example:**
```typescript
useEffect(() => {
  if (!leadId) return;
  setLoading(true);
  Promise.all([
    supabase.from('pipeline_leads').select('*').eq('id', leadId).single(),
    supabase.from('pipeline_stage_history').select('*').eq('lead_id', leadId).order('transitioned_at', { ascending: true }),
    supabase.from('pipeline_checklist_items').select('*').eq('lead_id', leadId),
    supabase.from('pipeline_comms').select('*').eq('lead_id', leadId).order('occurred_at', { ascending: false }),
  ]).then(([leadRes, historyRes, checklistRes, commsRes]) => {
    setLead(leadRes.data);
    setHistory(historyRes.data ?? []);
    setItems(checklistRes.data ?? []);
    setComms(commsRes.data ?? []);
    setLoading(false);
  });
}, [leadId]);
```

### Anti-Patterns to Avoid

- **Fetching drawer data in the pipeline page:** The page already fetches leads, checklist progress, and last contact. The drawer should NOT reuse that data -- it needs more detail (full comms, full history). Fetch independently inside LeadDrawer.
- **Using `<dialog>` HTML element for the drawer:** Browser native dialog handles focus differently and is less flexible for this design. Use a div portal with `role="dialog"`.
- **Saving on every keystroke for inline edit:** Debouncing adds complexity. Blur-on-save or Enter-on-save is the correct pattern -- it matches how the existing stage dropdown in the table saves.
- **Storing drawer open state as a boolean:** Use `selectedLeadId: string | null` instead. A null value means closed; a string means open with that lead loaded. This avoids needing a separate `selectedLead` state and prevents stale data when switching between leads.
- **CSS animation via JS style toggle on mount:** Use a CSS class or `translate` with a CSS `transition` property. The panel should already be off-screen (`translateX(100%)`) before mount, and transitions to `translateX(0)` when open. React conditional render (`if (!isOpen) return null`) means the panel is only in the DOM when needed -- no animation needed for exit if acceptable for this admin tool.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checklist persistence | Custom insert/update branch logic | Supabase `.upsert()` with `onConflict` | The DB already has UNIQUE(lead_id, stage, item_key). Upsert handles both create and update in one call. |
| Date-time input formatting | Custom date string parser | Native `<input type="datetime-local">` + `.toISOString()` | Browser handles locale display; `.toISOString()` is what Supabase expects |
| Focus trapping | Custom tab-intercept logic | `useEffect` + `querySelectorAll` or accept no trap for admin tool | Full focus trap is ~30 lines; for an admin-only internal tool, Escape-to-close is sufficient |
| Parallel data fetching | Sequential awaits | `Promise.all([...])` | Four queries in serial adds ~300-600ms; parallel fetch takes max of all four |

**Key insight:** This phase is entirely CRUD UI. Every operation maps to an existing Supabase pattern. The complexity is in state coordination, not business logic.

---

## Common Pitfalls

### Pitfall 1: Checklist Items Not Seeded for New Stages

**What goes wrong:** A lead that just moved to a new stage has no rows in `pipeline_checklist_items` for that stage. The drawer checklist is empty instead of showing the default items unchecked.

**Why it happens:** Items are only created in the DB on first toggle. The template defaults live only in `STAGE_CHECKLIST_DEFAULTS` in the frontend.

**How to avoid:** When the drawer fetches checklist items for a lead, merge the fetched rows with `STAGE_CHECKLIST_DEFAULTS[lead.stage]`. For each default key not found in DB rows, synthesize a local item with `completed: false`. On first toggle of a synthesized item, the upsert will insert it.

**Warning signs:** Checklist section appears empty for recently stage-transitioned leads.

---

### Pitfall 2: Stale Lead Data After Inline Edit

**What goes wrong:** Admin edits the lead name in the drawer. The drawer state updates. But the pipeline table behind it still shows the old name because it has its own separate state.

**Why it happens:** Two independent React state trees hold copies of the same lead data.

**How to avoid:** When the drawer closes, call an `onLeadUpdated` callback prop that re-fetches or patches the pipeline page's `leads` state. The pipeline page already has `setLeads` -- pass a callback that does `setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))`.

**Warning signs:** Table shows stale data after closing drawer.

---

### Pitfall 3: Portal Renders Before `document` is Available

**What goes wrong:** `ReactDOM.createPortal(content, document.body)` throws during SSR because `document` is undefined on the server.

**Why it happens:** Next.js renders components on the server by default. The pipeline page is `'use client'` but the drawer must also be `'use client'`.

**How to avoid:** Ensure `LeadDrawer.tsx` has `'use client'` at the top. Also guard with `typeof document !== 'undefined'` if ever used outside a client component context. Since the pipeline page is already `'use client'`, and `LeadDrawer` will only be imported there, this is safe -- but mark the file explicitly.

**Warning signs:** Build error or hydration mismatch mentioning `document is not defined`.

---

### Pitfall 4: `occurred_at` Defaults to UTC Now, Not Local Time

**What goes wrong:** Admin adds a comm log entry. The `occurred_at` defaults to `new Date().toISOString()` which is UTC. When displayed in the timeline, timestamps appear off by the user's timezone offset.

**Why it happens:** `toISOString()` always returns UTC. Display code that uses `toLocaleDateString()` or `toLocaleTimeString()` will correctly convert -- but only if the full ISO string with `Z` suffix is stored.

**How to avoid:** Always store `occurred_at` as `new Date().toISOString()` (UTC with Z suffix). Display with `new Date(occurred_at).toLocaleString()` or `toLocaleDateString()` so the browser converts to local time for display. Do NOT store local time strings without timezone info.

**Warning signs:** Comm timestamps show up an hour or more off from expected.

---

### Pitfall 5: Row Click Conflicts with Stage Dropdown Click

**What goes wrong:** Clicking the stage `<select>` dropdown in the pipeline table also triggers the row's `onClick` handler, opening the drawer.

**Why it happens:** Click events bubble from the select up to the `<tr>` onClick.

**How to avoid:** Add `e.stopPropagation()` to the `onChange` handler of the stage select (or wrap the select's container `<td>` with `onClick={e => e.stopPropagation()}`).

**Warning signs:** Drawer opens unexpectedly when user tries to change stage from the table.

---

## Code Examples

### Drawer Trigger in pipeline/page.tsx

```typescript
// Add to pipeline page state
const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

// Add onClick to each <tr>
<tr
  key={lead.id}
  onClick={() => setSelectedLeadId(lead.id)}
  style={{ cursor: 'pointer', ... }}
>

// Add stage select stop-propagation
<td onClick={e => e.stopPropagation()} style={tdStyle}>
  <select onChange={e => changeStage(lead.id, lead.stage, e.target.value as PipelineStage)} ...>

// Add drawer below table
<LeadDrawer
  leadId={selectedLeadId}
  onClose={() => setSelectedLeadId(null)}
  onLeadUpdated={(updated) => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
/>
```

### Merging DB Checklist Items with Defaults

```typescript
// Source: project pipeline-constants.ts STAGE_CHECKLIST_DEFAULTS pattern

function mergeChecklistWithDefaults(
  dbItems: PipelineChecklistItem[],
  lead: PipelineLead
): PipelineChecklistItem[] {
  const defaults = STAGE_CHECKLIST_DEFAULTS[lead.stage];
  const dbByKey: Record<string, PipelineChecklistItem> = {};
  for (const item of dbItems) dbByKey[item.item_key] = item;

  return defaults.map(def => dbByKey[def.key] ?? {
    id: `synthetic-${def.key}`,
    lead_id: lead.id,
    stage: lead.stage,
    item_key: def.key,
    item_label: def.label,
    completed: false,
    completed_at: null,
    created_at: new Date().toISOString(),
  });
}
```

### Stage History Timeline Display

```typescript
// pipeline_stage_history rows ordered ascending by transitioned_at
{history.map((entry, i) => (
  <div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
        {entry.previous_stage ? `${entry.previous_stage} -> ${entry.new_stage}` : `Entered as ${entry.new_stage}`}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
        {new Date(entry.transitioned_at).toLocaleDateString()}
      </div>
    </div>
  </div>
))}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Navigate to detail page | Slide-out drawer overlay | Standard since ~2020 in CRM/admin tools | Zero navigation latency, table context stays visible |
| Save button per form | Blur-on-save inline edit | Popularized by Notion/Linear ~2021 | Lower friction for quick edits |
| Boolean `isOpen` + separate `selectedItem` state | `selectedId: string or null` | Common React pattern since hooks | Single state controls both open/close and which item loads |
| JS-controlled animation (Framer Motion) | CSS `transition` on `transform` | CSS transitions sufficient for simple slide | No dependency, same result |

**Deprecated/outdated:**
- Class components with `setState` for drawer: use functional component + `useState`/`useEffect`
- `document.querySelector` focus management: use `useRef` pointing to first focusable element in drawer

---

## Open Questions

1. **Drawer width on narrow viewports**
   - What we know: The panel is 560px wide on desktop. The existing pipeline page targets 1200px max-width.
   - What's unclear: No responsive breakpoints are defined in the project. No mobile use case stated.
   - Recommendation: Use `min(560px, 100vw)` as width. No further responsive work needed for an admin-only internal tool.

2. **Should inline edit support the `notes` textarea field?**
   - What we know: DETAIL-02 says "any lead profile field." Notes is multi-line.
   - What's unclear: Textarea requires larger hit area and different keyboard handling (Enter adds newline, not save).
   - Recommendation: Use `<textarea>` for notes field. Save on blur only (not Enter). Ctrl+Enter could save but is optional.

3. **Should the drawer update the pipeline table's checklist progress column in real time?**
   - What we know: The pipeline table shows checklist progress (done/total) from its own fetched state. Toggling in the drawer does not update the table's progress display.
   - What's unclear: Whether Brian needs live progress feedback in the table while the drawer is open.
   - Recommendation: On drawer close, re-fetch checklist progress for the affected lead and patch `checklistProgress` state in the pipeline page. Pass an `onChecklistChanged` callback from the page to the drawer for this.

---

## Sources

### Primary (HIGH confidence)

- React docs (https://react.dev/reference/react-dom/createPortal) - createPortal API, portal rendering into document.body
- Supabase JS docs (https://supabase.com/docs/reference/javascript/upsert) - upsert with onConflict pattern
- Project source: `/Users/brianegan/EchoLocalClientTracker/src/app/pipeline/page.tsx` - existing patterns for optimistic update, inline style convention, supabase client usage
- Project source: `/Users/brianegan/EchoLocalClientTracker/src/lib/types.ts` - PipelineLead, PipelineComm, PipelineChecklistItem, PipelineStageHistory interfaces
- Project source: `/Users/brianegan/EchoLocalClientTracker/src/lib/pipeline-constants.ts` - STAGE_CHECKLIST_DEFAULTS, PIPELINE_STAGES
- Project source: `/Users/brianegan/EchoLocalClientTracker/src/app/globals.css` - all CSS custom properties (design tokens)

### Secondary (MEDIUM confidence)

- WebSearch: React drawer without library patterns (2025) - confirmed portal + fixed positioning approach is standard
- WebSearch: Supabase optimistic update pattern - confirms useState optimistic + rollback on error approach matches project's existing stage-change pattern

### Tertiary (LOW confidence)

- WebSearch: React 19 useOptimistic hook - found as an option but project uses plain useState optimistic pattern already; consistency favored over adopting new hook

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - patterns directly derived from existing pipeline/page.tsx code; drawer is a well-understood component
- Pitfalls: HIGH - pitfalls 1 (checklist seeding), 3 (SSR portal), and 5 (click bubbling) are concrete and verifiable from project code; pitfalls 2 and 4 are MEDIUM (common but not project-specific)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable tech stack, no fast-moving dependencies)
