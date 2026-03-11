# Phase 12: Directory Dashboard - Research

**Researched:** 2026-03-11
**Domain:** Next.js React dashboard UI -- read-only Supabase data display
**Confidence:** HIGH

## Summary

Phase 12 is purely a frontend display phase. All the data already exists in Supabase (`directories`, `submissions` tables with `status`, `da_score`, `tier`, `live_url` columns). The task is to surface that data in a new "Directories" tab in the existing dashboard following the exact same patterns already used by GeoTab, SeoEngineTab, and the other existing tabs.

The project uses Next.js 16 with React 19, inline CSS styles (no Tailwind utility classes in components -- Tailwind is imported globally but components use `style={{}}` props), Recharts for charts, and Supabase JS client for data fetching. No new libraries are needed. No new migrations are needed. Everything the dashboard needs is already in the DB schema from Phases 8-10.

The four requirements map cleanly to four UI sections: (1) a directory status grid with color-coded badges, (2) tier progress bars, (3) a Tier 1/2 recommendation checklist, and (4) a DA-weighted backlink value score. All four are computed client-side from two Supabase queries (one join of submissions + directories for the active client).

**Primary recommendation:** Build a single `DirectoriesTab.tsx` component that fetches submissions joined with directories for the active client, then renders all four sections. Model it after `GeoTab.tsx` -- same data-fetching hook in page.tsx, same prop-passing pattern, same inline CSS style system.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Directories tab shows per-client directory status grid with color-coded badges (verified=green, submitted=yellow, pending=grey, rejected=red, skipped=muted) | Submissions table has `status` column with these exact values; Directory type already defined in types.ts; CAPTCHA_COLORS pattern in DirectoryRow.tsx shows badge implementation pattern |
| DASH-02 | Tier progress bars show X/Y submitted and X/Y verified per tier per client | Directories have `tier` column (1/2/3); group submissions by directory.tier, count statuses; HTML progress bar (no library needed) following existing `--accent` CSS var |
| DASH-03 | Tier 1/2 directories displayed as actionable recommendation checklist requiring client input (not automated) | Filter submissions where tier IN (1,2) and status = 'pending'; display as checklist with explanatory copy; no mutations needed (display-only) |
| DASH-04 | Backlink value score per client = DA-weighted sum of verified directory listings | Filter submissions where status = 'verified', sum da_score values from joined directory records; render as single stat card |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App framework | Already in project |
| React | 19.2.3 | UI layer | Already in project |
| @supabase/supabase-js | ^2.97.0 | DB client | Already in project, all tables exist |
| Recharts | ^3.7.0 | Charts (optional for progress) | Already in project -- but plain HTML/CSS progress bar is simpler for tier bars |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | ^5 | Type safety | Already configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline CSS styles | Tailwind utility classes | Project convention is inline CSS -- do NOT use Tailwind classes in components |
| Client-side DA sum | Server-side computed view | Client-side is fine at ~55 directories per client, matches existing patterns |
| Recharts progress bar | Plain HTML progress element | HTML `<div>` with width % is simpler and consistent with existing metric displays |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── directories/
│   │   └── DirectoriesTab.tsx    # NEW: main tab component
│   └── tabs/
│       └── (existing tabs)
├── lib/
│   └── types.ts                   # ADD: DirectoryWithSubmission interface
└── app/
    └── page.tsx                   # ADD: state + data fetch + tab render
```

Note: `DirectoriesTab.tsx` goes in `src/components/tabs/` to match the pattern of `GeoTab.tsx`, `SeoEngineTab.tsx`, etc. The existing `src/components/directories/` folder contains the admin management components (DirectoryManager, DirectoryRow) which are separate from the client-facing display tab.

### Pattern 1: Data Fetch in page.tsx useEffect

**What:** Each tab's data is fetched in a `useEffect` in page.tsx, stored in state, then passed as props to the tab component. This is the established pattern for all 6 existing tabs.

**When to use:** Always -- do not put Supabase fetches inside tab components.

**Example (from existing GEO data fetch in page.tsx):**
```typescript
// Source: /Users/brianegan/EchoLocalClientTracker/src/app/page.tsx
useEffect(() => {
  if (!activeClient) return;

  async function loadDirectoryData() {
    // Join submissions with directories via Supabase select
    const { data, error } = await supabase
      .from('submissions')
      .select('*, directories(*)')
      .eq('client_id', activeClient!.id);

    if (error) {
      console.error('Directory fetch error:', error);
      setDirectorySubmissions([]);
    } else {
      setDirectorySubmissions(data || []);
    }
  }

  loadDirectoryData();
}, [activeClient]);
```

### Pattern 2: Supabase Relational Query with Embedded Select

**What:** Supabase JS client supports `select('*, related_table(*)')` to join related records in a single query. This avoids a second round-trip for directory details.

**When to use:** When you need columns from both submissions AND directories tables.

**Example:**
```typescript
// Source: Supabase JS v2 embedded select pattern (verified in project)
const { data } = await supabase
  .from('submissions')
  .select(`
    id, status, live_url, submitted_at, verified_at,
    directories (id, name, domain, tier, da_score, trades, submission_url)
  `)
  .eq('client_id', clientId);
```

Result shape: each row has `status`, `live_url`, etc. plus a `directories` object with the joined directory fields.

### Pattern 3: Color-Coded Status Badge (inline CSS)

**What:** Inline style objects map status string to color values. Established in DirectoryRow.tsx with CAPTCHA_COLORS pattern.

**When to use:** Any status badge display.

**Example:**
```typescript
// Source: /Users/brianegan/EchoLocalClientTracker/src/components/directories/DirectoryRow.tsx
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  verified:  { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },   // green
  submitted: { bg: 'rgba(245, 158, 11, 0.15)',  color: '#F59E0B' },   // yellow
  pending:   { bg: 'rgba(148, 163, 184, 0.1)',  color: 'var(--text-secondary)' }, // grey
  rejected:  { bg: 'rgba(255, 61, 87, 0.15)',   color: '#FF3D57' },   // red
  skipped:   { bg: 'rgba(148, 163, 184, 0.05)', color: 'rgba(148,163,184,0.4)' }, // muted
  approved:  { bg: 'rgba(16, 185, 129, 0.1)',   color: '#10B981' },   // treat same as verified
};
```

### Pattern 4: TabId Extension for New Tab

**What:** `TabId` type in `types.ts` is a union string literal. Adding 'directories' requires updating the type AND the tabs array in TabNav AND the render switch in page.tsx.

**When to use:** Adding any new top-level tab.

**Example:**
```typescript
// Source: /Users/brianegan/EchoLocalClientTracker/src/lib/types.ts (current)
export type TabId = 'overview' | 'seo' | 'conversions' | 'gbp' | 'seo-engine' | 'geo';
// MUST become:
export type TabId = 'overview' | 'seo' | 'conversions' | 'gbp' | 'seo-engine' | 'geo' | 'directories';
```

### Pattern 5: Admin-only vs All-users Tab Visibility

**What:** TabNav filters tabs by `isAdmin` flag. The GEO tab is admin-only (visible to admin but not client users). The Directories tab should be visible to all users (clients want to see their backlink portfolio).

**When to use:** When deciding tab visibility.

**Example (from TabNav.tsx):**
```typescript
// Source: /Users/brianegan/EchoLocalClientTracker/src/components/TabNav.tsx
const visibleTabs = isAdmin ? tabs : tabs.filter(t => t.id !== 'seo-engine' && t.id !== 'geo');
// Directories tab: DO NOT exclude for non-admin -- clients see their own backlink value
```

### Pattern 6: DA-Weighted Backlink Value Score (Client-Side Computation)

**What:** Filter verified submissions, sum their directory DA scores. Pure JavaScript, no library needed.

**When to use:** DASH-04 implementation.

**Example:**
```typescript
// Computed from submissions data already in component state
const backlinkScore = submissions
  .filter(s => s.status === 'verified' && s.directories?.da_score)
  .reduce((sum, s) => sum + (s.directories?.da_score ?? 0), 0);
```

### Pattern 7: Tier Progress Bar (Plain HTML)

**What:** Group submissions by directory tier, count submitted and verified, render as labeled progress bar. Use a simple `<div>` with percentage width rather than Recharts -- matches existing metric display style.

**When to use:** DASH-02 implementation.

**Example:**
```typescript
// Group by tier
const tierStats = [1, 2, 3].map(tier => {
  const tierSubs = submissions.filter(s => s.directories?.tier === tier);
  const submitted = tierSubs.filter(s => ['submitted','approved','verified'].includes(s.status)).length;
  const verified = tierSubs.filter(s => s.status === 'verified').length;
  const total = tierSubs.length;
  return { tier, submitted, verified, total };
});
```

### Anti-Patterns to Avoid

- **Fetching in tab component:** Do not put `useEffect` + Supabase calls inside `DirectoriesTab.tsx`. Fetch in `page.tsx` and pass as props. Every other tab follows this pattern.
- **Two separate queries:** Do not query `submissions` then `directories` separately. Use the embedded select to get both in one round-trip.
- **Using Tailwind utility classes in component JSX:** The project uses inline `style={{}}` props exclusively in component files. Tailwind is only used in `globals.css`.
- **Treating 'approved' as not-submitted:** The submission status workflow is `pending -> submitted -> approved -> verified`. Both `approved` and `verified` count as "submitted" for progress calculations (confirmed in STATE.md decisions: "Used .in_() for submitted count to include submitted/approved/verified statuses").
- **Putting DirectoriesTab in wrong folder:** It belongs in `src/components/tabs/` not `src/components/directories/` (which is for admin management UI).
- **Making Tier 1/2 checklist interactive:** DASH-03 is display-only. No checkboxes that write to DB, no mutation logic. These are "requires client input" notes, not action items Brian clicks in the UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress bar component | Custom animated component | Plain `<div>` with `width: X%` styling | 3 lines of CSS, no dependency, matches existing metric display style |
| DA score aggregation | Server-side computed column/view | Client-side `.reduce()` on fetched data | Only ~55 rows per client, negligible compute |
| Status badge | Custom badge library | Inline style object with color map | Already established in DirectoryRow.tsx -- copy the pattern |
| Tab routing | React Router or Next.js pages | Existing `activeTab` state in page.tsx | Established pattern for all 6 current tabs |

**Key insight:** This phase is 100% display. The data model, DB schema, and data pipeline are all complete. The entire implementation is TypeScript/React UI code following existing patterns.

## Common Pitfalls

### Pitfall 1: Forgetting approved Status in Submitted Count
**What goes wrong:** Progress bar shows "0/4 submitted" even though directories are `approved` (meaning submitted and being processed).
**Why it happens:** Assuming status='submitted' is the only "submitted" state. The workflow is pending -> submitted -> approved -> verified.
**How to avoid:** Use `.filter(s => ['submitted','approved','verified'].includes(s.status))` for the submitted count. Confirmed by STATE.md decision: "Used .in_() for submitted count to include submitted/approved/verified statuses."
**Warning signs:** Progress bar shows lower numbers than expected during testing.

### Pitfall 2: Missing TabId Type Update
**What goes wrong:** TypeScript build error when adding 'directories' to tabs array.
**Why it happens:** `TabId` is a union type -- adding a new value to the tabs array without updating the type breaks TypeScript.
**How to avoid:** Update `TabId` in `types.ts` FIRST, then update `TabNav.tsx` and `page.tsx`. Three files must change together.
**Warning signs:** `Type '"directories"' is not assignable to type 'TabId'` TypeScript error.

### Pitfall 3: Supabase Embedded Select Type Mismatch
**What goes wrong:** TypeScript doesn't know the shape of the `directories` object nested inside a submission row.
**Why it happens:** Supabase JS returns `unknown` type for embedded selects unless you define an interface.
**How to avoid:** Define a `SubmissionWithDirectory` interface in `types.ts`:
```typescript
export interface SubmissionWithDirectory extends Submission {
  directories: Pick<Directory, 'id' | 'name' | 'domain' | 'tier' | 'da_score' | 'trades' | 'submission_url'> | null;
}
```
**Warning signs:** TypeScript errors on `s.directories?.tier` or `s.directories?.da_score`.

### Pitfall 4: Directories Tab Visibility (Admin vs Client)
**What goes wrong:** Clients can't see their directory portfolio, defeating the client-facing value proposition.
**Why it happens:** Copying the GEO tab pattern which is admin-only, forgetting that Directories tab should be visible to all users.
**How to avoid:** In TabNav's `visibleTabs` filter: do NOT exclude 'directories' for non-admin users. Clients should see their backlink value score.
**Warning signs:** Client login doesn't show Directories tab.

### Pitfall 5: Missing seo_engine_enabled Guard
**What goes wrong:** Clients without seo_engine_enabled see an empty Directories tab with no explanation.
**Why it happens:** The directory system runs for clients with SEO engine enabled only.
**How to avoid:** In `DirectoriesTab`, check if `seoEngineEnabled` is false and render a "Directory submissions are available with SEO Engine" message (same pattern as GeoTab's not-enabled check).
**Warning signs:** Empty tab with no data and no explanation for clients not on the SEO engine.

### Pitfall 6: Netlify Build Failure After TabId Change
**What goes wrong:** Build succeeds locally but Netlify deploy fails.
**Why it happens:** TypeScript strict mode on build -- if any component passes a string literal 'directories' to a TabId-typed function, it fails unless the type is updated.
**How to avoid:** Run `npm run build` locally before committing. Fix all TypeScript errors before pushing.
**Warning signs:** Netlify build log shows TS2322 errors.

## Code Examples

### Full Supabase Query for Directories Tab Data
```typescript
// Source: Pattern verified against existing submissions/directories schema
// In page.tsx useEffect, called when activeClient changes

const { data, error } = await supabase
  .from('submissions')
  .select(`
    id,
    status,
    live_url,
    submitted_at,
    verified_at,
    directories (
      id,
      name,
      domain,
      tier,
      da_score,
      trades,
      submission_url,
      enabled
    )
  `)
  .eq('client_id', activeClient.id)
  .order('created_at', { ascending: true });
```

### SubmissionWithDirectory Type Definition
```typescript
// Add to src/lib/types.ts
export interface SubmissionWithDirectory {
  id: string;
  status: string;
  live_url: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  directories: {
    id: string;
    name: string;
    domain: string;
    tier: number;
    da_score: number | null;
    trades: string[];
    submission_url: string | null;
    enabled: boolean;
  } | null;
}
```

### Tier Progress Computation
```typescript
// Pure JS, no library needed
const SUBMITTED_STATUSES = ['submitted', 'approved', 'verified'];

function getTierStats(submissions: SubmissionWithDirectory[], tier: number) {
  const tierSubs = submissions.filter(s => s.directories?.tier === tier);
  return {
    tier,
    total: tierSubs.length,
    submitted: tierSubs.filter(s => SUBMITTED_STATUSES.includes(s.status)).length,
    verified: tierSubs.filter(s => s.status === 'verified').length,
  };
}
```

### Backlink Value Score
```typescript
// Source: DASH-04 requirement -- DA-weighted sum of verified listings
const backlinkScore = submissions
  .filter(s => s.status === 'verified' && s.directories?.da_score != null)
  .reduce((sum, s) => sum + (s.directories!.da_score ?? 0), 0);
```

### Status Badge Inline Style
```typescript
// Source: Pattern from DirectoryRow.tsx CAPTCHA_COLORS -- adapt for submission statuses
const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  verified:  { bg: 'rgba(16,185,129,0.15)', color: '#10B981',               label: 'Verified' },
  submitted: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B',               label: 'Submitted' },
  approved:  { bg: 'rgba(16,185,129,0.10)', color: '#10B981',               label: 'Approved' },
  pending:   { bg: 'rgba(148,163,184,0.1)', color: 'var(--text-secondary)', label: 'Pending' },
  rejected:  { bg: 'rgba(255,61,87,0.15)', color: '#FF3D57',               label: 'Rejected' },
  skipped:   { bg: 'rgba(148,163,184,0.05)', color: 'rgba(148,163,184,0.4)', label: 'Skipped' },
  failed:    { bg: 'rgba(255,61,87,0.10)', color: '#FF3D57',               label: 'Failed' },
};

// Render badge:
const cfg = STATUS_CONFIG[submission.status] ?? STATUS_CONFIG.pending;
<span style={{
  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
  background: cfg.bg, color: cfg.color,
  textTransform: 'uppercase', letterSpacing: '0.03em',
}}>
  {cfg.label}
</span>
```

### Tier Progress Bar (Plain HTML)
```typescript
// No Recharts needed -- a simple width-based div
function TierProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-depth)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}
```

### Tab Integration Touch Points
```typescript
// 1. types.ts -- add 'directories' to TabId union
export type TabId = 'overview' | 'seo' | 'conversions' | 'gbp' | 'seo-engine' | 'geo' | 'directories';

// 2. TabNav.tsx -- add to tabs array
const tabs: Tab[] = [
  // ... existing tabs ...
  { id: 'directories', label: 'Directories' },
];
// Also: do NOT add 'directories' to the isAdmin filter

// 3. page.tsx -- add state + useEffect + render case
const [directorySubmissions, setDirectorySubmissions] = useState<SubmissionWithDirectory[]>([]);

// In render:
{activeTab === 'directories' && (
  <DirectoriesTab
    submissions={directorySubmissions}
    seoEngineEnabled={activeClient?.seo_engine_enabled ?? false}
    isAdmin={isAdmin}
  />
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate queries for submissions + directories | Supabase embedded select (`select('*, directories(*)')`) | Phase 8 (schema design) | One round-trip instead of N+1 |
| Custom animation libraries for progress bars | Plain CSS width % with transition | Established pattern | No extra dependencies |

**Deprecated/outdated:**
- None -- this phase uses only established project patterns.

## Open Questions

1. **Where exactly in the tab order should 'Directories' appear?**
   - What we know: Current tabs are: Overview, SEO Performance, Conversions, GBP, GEO, SEO Engine
   - What's unclear: Whether Brian prefers Directories before or after GEO
   - Recommendation: Put it between GEO and SEO Engine. GEO and Directories are both "under the hood" SEO work tabs, so grouping them makes sense. Final tab order: Overview, SEO Performance, Conversions, GBP, GEO, Directories, SEO Engine.

2. **Should the directory grid show disabled directories?**
   - What we know: Directories table has `enabled` boolean; disabled directories still have submission records (existing_needs_review, failed, etc.)
   - What's unclear: Whether Brian wants disabled directories greyed out or hidden
   - Recommendation: Show all directories that have a submission record regardless of enabled status. The submission record is what matters for the dashboard -- the directory master list admin view (existing DirectoryManager) is where enabled/disabled is managed.

3. **Does the DA-weighted score need a "what this means" tooltip or explanation?**
   - What we know: DA scores range roughly 10-80 in the directories table; a perfect score would be sum of all DA scores for verified directories
   - What's unclear: Whether Brian needs benchmark context ("is 250 a good score?")
   - Recommendation: Display raw score for now. Add a secondary label "DA-weighted backlink authority" and show verified count alongside score. Keep it simple for v1.2.

## Sources

### Primary (HIGH confidence)
- `/Users/brianegan/EchoLocalClientTracker/src/lib/types.ts` -- All existing types including Directory, Submission, TabId
- `/Users/brianegan/EchoLocalClientTracker/src/app/page.tsx` -- Data fetch patterns, state management, tab rendering
- `/Users/brianegan/EchoLocalClientTracker/src/components/TabNav.tsx` -- Tab registration pattern, admin filtering
- `/Users/brianegan/EchoLocalClientTracker/src/components/directories/DirectoryRow.tsx` -- Badge color pattern
- `/Users/brianegan/EchoLocalClientTracker/src/components/directories/DirectoryManager.tsx` -- Supabase query pattern for directories table
- `/Users/brianegan/EchoLocalClientTracker/supabase/migrations/add_directory_system_tables.sql` -- Actual DB schema (columns, types, constraints)
- `/Users/brianegan/EchoLocalClientTracker/src/app/globals.css` -- CSS variables (--accent, --success, --danger, etc.)
- `/Users/brianegan/EchoLocalClientTracker/.planning/STATE.md` -- Confirmed "approved" counts as submitted (decision log)
- `/Users/brianegan/EchoLocalClientTracker/.planning/REQUIREMENTS.md` -- Exact DASH-01 through DASH-04 specs

### Secondary (MEDIUM confidence)
- Supabase JS v2 embedded select documented at https://supabase.com/docs/reference/javascript/select -- `select('*, related_table(*)')` returns nested objects. Consistent with existing usage in this project.

### Tertiary (LOW confidence)
- None -- all findings are from the project codebase itself.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in package.json, no new dependencies
- Architecture: HIGH -- patterns copied from existing tabs in this codebase
- Pitfalls: HIGH -- confirmed from codebase reading + STATE.md decision log

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable -- no fast-moving external dependencies)
