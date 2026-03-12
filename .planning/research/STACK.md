# Technology Stack

**Project:** EchoLocal ClientTracker v1.4 -- Client Pipeline Tracker
**Researched:** 2026-03-12
**Confidence:** MEDIUM (drag-and-drop library has React 19 complications; see notes)

## Existing Stack (validated, NOT changing)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | Dashboard frontend |
| React | 19.2.3 | UI framework |
| Supabase JS | 2.97.0 | Browser client, Postgres, Auth |
| Tailwind CSS | 4.x | Styling |
| Recharts | 3.7.0 | Charts (pipeline analytics) |
| TypeScript | 5.x | Type safety |

## New Stack Additions

### 1. Drag-and-Drop: @atlaskit/pragmatic-drag-and-drop (CORE NEW DEP)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@atlaskit/pragmatic-drag-and-drop` | latest | Kanban column drag-and-drop | Framework-agnostic vanillaJS core -- zero React peer dependency, React 19 safe. Built by Atlassian to power Jira and Trello. Actively maintained with React 19 support added March 2025. |

**React 19 situation (verified via GitHub issues):**

Every major drag-and-drop library has React 19 friction:

- `@dnd-kit/core` 6.3.1 -- Last published ~1 year ago. TypeScript errors with React 19 ("cannot be used as JSX component"). Community workaround: `--legacy-peer-deps`. Unresolved as of Oct 2025.
- `@hello-pangea/dnd` -- Peer dep explicitly excludes React 19 (`^16.8.5 || ^17.0.0 || ^18.0.0`). Not officially supported.
- `@atlaskit/pragmatic-drag-and-drop` -- Core package has NO React peer dependency (vanillaJS). Optional React packages (`react-accessibility`, `react-drop-indicator`) were updated to allow `react@^19.0.0` in March 2025. Best available option for React 19.

**What to install:**

```bash
npm install @atlaskit/pragmatic-drag-and-drop
```

The core package alone is sufficient for kanban drag-and-drop. The optional `react-drop-indicator` package adds visual drop indicators -- install only if you want the polished drop line:

```bash
# Optional: adds visual drop indicator between cards
npm install @atlaskit/pragmatic-drag-and-drop-react-drop-indicator
```

**Why not skip drag-and-drop entirely:** The pipeline view is functional without it -- stage changes via a dropdown or click is viable. BUT the kanban column layout is the primary UX for pipeline stage management. Drag-and-drop is expected and easy to implement with the right lib.

**Risk mitigation:** All drag-and-drop logic goes in a dedicated `'use client'` component. The kanban board never renders server-side. If the library causes a problem, it's isolated to one component and can be swapped without touching the data layer.

### 2. Date Utilities: date-fns (LIGHTWEIGHT NEW DEP)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `date-fns` | 4.1.0 | "Days in current stage" calculation, stage entry timestamps, formatting comms log dates | Already the default in Next.js/React ecosystem. Full tree-shaking -- only the 3-4 functions we use get bundled. No wrapper objects, works directly with native Date. Supabase returns ISO strings; date-fns parses and diffs them without mutation. |

**Functions needed:**

- `formatDistanceToNow` -- "3 days in Demo stage"
- `differenceInDays` -- numeric days for analytics
- `format` -- log entry timestamps ("Mar 12")
- `parseISO` -- Supabase ISO string to Date

**Installation:**

```bash
npm install date-fns
```

**Why not dayjs:** dayjs is smaller (6KB vs 18KB gzip) but date-fns tree-shakes to under 5KB for our 4-function usage. No practical difference. date-fns has better TypeScript types and is more idiomatic in the Next.js ecosystem.

**Why not Temporal / native Date:** `Temporal` is not available in Next.js 16 without polyfills. Native `Date` has no `differenceInDays` -- you'd write it yourself. Not worth it.

### 3. No New UI Component Library

The pipeline UI builds entirely from Tailwind CSS utilities and existing patterns already in the codebase. No shadcn/ui, no headlessui, no radix-ui.

| UI Element | Implementation | Why No New Dep |
|------------|---------------|----------------|
| Stage columns (kanban) | Tailwind `flex gap-4 overflow-x-auto` | Simple column layout |
| Cards | `div` with existing card styling (`bg-[#0D1426] border border-[#1e2d4a] rounded-lg`) | Matches dashboard design system |
| Stage badge (Lead / Demo / etc.) | `span` with color map per stage | Tailwind color classes, 6 stages |
| Checklist items | `input[type=checkbox]` + label | Native HTML, no library needed |
| Communication log entries | Timeline list with icon per type | Icon from inline SVG or emoji -- no icon lib |
| Stage transition dropdown | Native `<select>` | Admin-only internal tool, no need for polished dropdown |
| Analytics charts | Recharts (existing) | Already installed -- `BarChart` for stage counts, `LineChart` for conversion trends |

### 4. Supabase: New Tables (No Library Changes)

Supabase JS client (already installed at `^2.97.0`) handles all queries. No ORM, no query builder library. Direct Supabase client calls match the existing codebase pattern throughout.

**New tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `pipeline_clients` | One row per prospect/client in pipeline | `id, name, contact_name, email, phone, trade, source_channel, current_stage, stage_entered_at, notes, created_at, updated_at` |
| `pipeline_stage_history` | Audit log of every stage transition | `id, pipeline_client_id, from_stage, to_stage, transitioned_at, transitioned_by` |
| `pipeline_checklist_items` | Per-stage predefined checklist definitions | `id, stage, item_text, sort_order` |
| `pipeline_checklist_completions` | Which items are checked for each client | `id, pipeline_client_id, checklist_item_id, completed_at, completed_by` |
| `pipeline_comms_log` | Communication history per client | `id, pipeline_client_id, comm_type (call/email/text/meeting), occurred_at, notes, logged_by` |

**Supabase integration pattern (matches existing codebase):**

```typescript
// Matches existing pattern in src/lib/supabase.ts
const { data, error } = await supabase
  .from('pipeline_clients')
  .select('*, pipeline_comms_log(*)')
  .eq('current_stage', 'demo')
  .order('stage_entered_at', { ascending: false })
```

Row Level Security: admin-only via existing `role = 'admin'` check. No new auth logic.

## Installation

```bash
# New npm packages (2 total)
npm install @atlaskit/pragmatic-drag-and-drop date-fns

# Optional: polished drag drop indicator visuals
npm install @atlaskit/pragmatic-drag-and-drop-react-drop-indicator
```

**Total new npm packages: 2 (plus 1 optional)**
**Total new Python packages: 0**
**Total new env vars: 0**

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Drag-and-drop | `@atlaskit/pragmatic-drag-and-drop` | `@dnd-kit/core` 6.3.1 | dnd-kit has unresolved TypeScript/JSX errors with React 19. Requires `--legacy-peer-deps`. Last published ~1 year ago, maintenance concerns. |
| Drag-and-drop | `@atlaskit/pragmatic-drag-and-drop` | `@hello-pangea/dnd` | Explicit React 19 exclusion in peerDependencies. Would install with `--force`. Risk of subtle runtime bugs. |
| Drag-and-drop | `@atlaskit/pragmatic-drag-and-drop` | No drag-and-drop (click-to-move) | Valid fallback if library causes problems. Stage select dropdown works fine. Defer to implementation phase decision. |
| Date utils | `date-fns` | `dayjs` | Both work. date-fns is more idiomatic in this codebase's ecosystem (no existing dayjs usage), better TypeScript types. |
| Date utils | `date-fns` | Native `Date` + custom math | Would write `differenceInDays` and `formatDistanceToNow` from scratch -- not worth it for a well-tested 18KB lib. |
| UI components | Tailwind only | shadcn/ui | Significant installation overhead (copy-in components, radix-ui deps, clsx, cva). Not justified for a simple admin-only CRUD interface. |
| Pipeline state | Supabase only | Local React state with sync | Supabase as single source of truth means no sync bugs. Pipeline data is low-write (a few stage changes per day). Direct client calls are sufficient. |
| Pipeline state | Supabase only | Zustand / Jotai | No client-side state library needed. React `useState` + `useEffect` + Supabase calls matches the existing dashboard pattern. Adding a state manager introduces unnecessary complexity. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` | Deprecated, unmaintained by Atlassian | `@atlaskit/pragmatic-drag-and-drop` |
| `@dnd-kit/react` (v0.3.x) | New experimental rewrite, unstable API, React 19 "use client" issues in active GitHub issues | `@atlaskit/pragmatic-drag-and-drop` core |
| `react-kanban` / any kanban component library | Pre-built kanban libs are opinionated about data shape; fighting the abstraction costs more than building columns from scratch | Build columns directly with Tailwind |
| `react-table` / `TanStack Table` | Pipeline view is a 6-column kanban + a list view, not a data grid | Direct map + Tailwind layout |
| `react-hook-form` | Checklist completions and comm log entries are simple form POST patterns, 2-3 fields each | Native `<form>` + Supabase client |
| Zustand / Jotai / Redux | Existing dashboard has zero state management libraries; all state is server-sourced via Supabase | `useState` + `useEffect` (existing pattern) |
| `moment.js` | Deprecated, large bundle, not tree-shakable | `date-fns` 4.x |
| Supabase Realtime subscriptions for pipeline | Pipeline is admin-only; no concurrent users racing to update the same cards. Realtime adds WebSocket complexity with no benefit. | Standard fetch-on-load with manual refresh |

## Version Compatibility

| Package | React Version | Notes |
|---------|--------------|-------|
| `@atlaskit/pragmatic-drag-and-drop` | No React peer dep (vanillaJS) | Safe with React 19.2.3 |
| `@atlaskit/pragmatic-drag-and-drop-react-drop-indicator` | `^19.0.0` now allowed (March 2025 update) | Should work; maintainers note "not tested against React 19 directly" |
| `date-fns` 4.1.0 | No React dependency | Framework-agnostic, works anywhere |
| `recharts` 3.7.0 | Already installed, already working | Use for analytics charts |

## Integration Points

```
src/app/pipeline/           (new route, admin-only)
  page.tsx                  -- server component, auth check, initial data fetch
  components/
    PipelineBoard.tsx        -- 'use client', kanban columns, pragmatic-dnd
    PipelineList.tsx         -- 'use client', table/list view alternative
    StageColumn.tsx          -- 'use client', single column + droppable
    ClientCard.tsx           -- 'use client', draggable card
    ClientDetailPanel.tsx    -- slide-over panel: checklist + comms log
    ChecklistSection.tsx     -- checklist items per stage
    CommsLogSection.tsx      -- communication log + add entry form
    PipelineAnalytics.tsx    -- Recharts charts, conversion rates

src/lib/types.ts            -- extend with PipelineClient, CommLog, ChecklistItem types
src/app/api/pipeline/       -- API routes for mutations (stage transitions, log entries)
```

Sidebar navigation entry added alongside existing "Sales Engine" / "SEO Engine" links. Admin role check matches existing `role === 'admin'` pattern.

## Sources

- [pragmatic-drag-and-drop GitHub -- React 19 issue #181](https://github.com/atlassian/pragmatic-drag-and-drop/issues/181) -- React 19 support status (MEDIUM confidence, no direct testing by maintainers)
- [Atlassian Design -- pragmatic-drag-and-drop core package](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/) -- vanillaJS, no React peer dep (HIGH confidence)
- [dnd-kit React 19 issue #1511](https://github.com/clauderic/dnd-kit/issues/1511) -- unresolved TypeScript JSX errors (HIGH confidence)
- [@hello-pangea/dnd React 19 discussion #810](https://github.com/hello-pangea/dnd/discussions/810) -- explicit peer dep exclusion of React 19 (HIGH confidence)
- [date-fns npm -- v4.1.0](https://www.npmjs.com/package/date-fns) -- latest version, ESM tree-shaking (HIGH confidence)
- [puckeditor.com -- Top 5 drag-and-drop libraries 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) -- ecosystem overview (MEDIUM confidence)
- Existing codebase: `src/lib/types.ts`, `src/lib/supabase.ts`, `package.json` -- established patterns (HIGH confidence)

---
*v1.4 stack additions -- Client Pipeline Tracker*
*Researched: 2026-03-12*
*Supersedes: v1.2 stack research covers directory submission; this file covers pipeline tracker only*
