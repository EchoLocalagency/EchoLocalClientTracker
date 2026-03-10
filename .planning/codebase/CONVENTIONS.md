# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `StatCard.tsx`, `OverviewTab.tsx`, `SeoEngineLayout.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useFilteredReports.ts`)
- Utilities/lib: camelCase (e.g., `utils.ts`, `mock-data.ts`, `auth-context.tsx`)
- API routes: `route.ts` inside Next.js App Router directory convention
- Types: `types.ts` (single file for all shared types)

**Functions:**
- camelCase for all functions: `calcDelta`, `formatNumber`, `loadClients`, `rollingSum14`
- React components use PascalCase: `StatCard`, `OverviewTab`, `AlertBanner`
- Event handlers use `handle` prefix: `handleLogin`
- Async data loaders use `load` prefix: `loadClients`, `loadReports`, `loadQueries`

**Variables:**
- camelCase throughout: `activeClient`, `latestReport`, `sidebarCollapsed`
- Boolean state uses `is`/`has` prefix: `isAdmin`, `isActive`, `hasGbp`, `hasFormTracking`
- Constants use UPPER_SNAKE_CASE: `LOCATION_MAP`

**Types:**
- Interfaces use PascalCase: `Client`, `Report`, `GscQuery`, `StatCardProps`
- Props interfaces append `Props`: `StatCardProps`, `SidebarProps`, `OverviewTabProps`
- Union types use PascalCase: `TabId`, `TimeRange`, `Velocity`, `SeoEngineSubTab`
- Exported interfaces placed in `src/lib/types.ts` for shared domain types
- Component-local interfaces defined inline above the component

## Code Style

**Formatting:**
- No Prettier config detected; relies on editor defaults
- 2-space indentation in all TypeScript/TSX files
- Single quotes for string literals throughout
- Semicolons at end of statements
- Trailing commas in multi-line objects/arrays

**Linting:**
- ESLint 9 with flat config: `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- No custom rules defined beyond defaults
- Run via `npm run lint`

**TypeScript:**
- Strict mode enabled in `tsconfig.json`
- Non-null assertions used liberally with `!` (e.g., `process.env.NEXT_PUBLIC_SUPABASE_URL!`, `activeClient!.id`)
- Nullable fields modeled as `Type | null` (not `Type | undefined`)
- Path alias: `@/*` maps to `./src/*`

## Import Organization

**Order:**
1. React/Next.js framework imports (`react`, `next/server`, `next/navigation`)
2. Third-party libraries (`@supabase/ssr`, `recharts`)
3. Internal lib/types (`@/lib/types`, `@/lib/utils`, `@/lib/supabase`)
4. Internal components (`@/components/StatCard`, `@/components/tabs/OverviewTab`)
5. CSS imports last (`./globals.css`)

**Path Aliases:**
- `@/*` for all internal imports (maps to `src/*`)
- Never use relative paths like `../../lib/utils` -- always `@/lib/utils`

## Component Patterns

**Structure:**
- All client components explicitly marked with `'use client';` at top of file
- Server components (layout, metadata) do NOT include `'use client'`
- Default exports for all components: `export default function ComponentName()`
- Props interface defined directly above the component function
- No arrow function components; use `function` keyword for all components

**Styling:**
- Inline `style={}` objects used exclusively -- no CSS modules, no Tailwind utility classes in JSX
- CSS custom properties (CSS variables) used for theming: `var(--accent)`, `var(--bg-surface)`, `var(--border)`
- Design tokens defined in `src/app/globals.css` `:root` block
- Hover effects done via `onMouseEnter`/`onMouseLeave` manipulating `e.currentTarget.style`
- Tailwind CSS is installed and imported but only used for base reset (`@import "tailwindcss"`)
- Responsive grids via `gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'`

**Key design tokens (from `src/app/globals.css`):**
```css
--bg-primary: #0B1120;
--bg-surface: #111827;
--bg-depth: #1E293B;
--bg-sidebar: #070D1A;
--border: #1E293B;
--accent: #06B6D4;
--text-primary: #F1F5F9;
--text-secondary: #94A3B8;
--success: #10B981;
--danger: #FF3D57;
--font-sans: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--radius-card: 10px;
```

**When adding new components:**
- Use inline styles with CSS variables, not Tailwind classes
- Follow the dark theme palette above
- Use `var(--font-mono)` for numbers and data, `var(--font-sans)` for labels
- Apply hover glow effect via `var(--shadow-glow)` and `var(--accent-border)`

## State Management

**Pattern:** Local React state with `useState` + `useEffect` for data fetching
- No external state management library (no Redux, Zustand, Jotai)
- Auth state via React Context: `src/lib/auth-context.tsx` provides `useAuth()` hook
- Data fetching in `useEffect` with Supabase client calls, not React Query or SWR
- All client state is page-level in the root `Dashboard` component (`src/app/page.tsx`)
- Data passed down via props; no prop drilling deeper than 2 levels

**Data fetching pattern:**
```typescript
useEffect(() => {
  if (!dependency) return;
  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('field', value)
      .order('field', { ascending: true });
    if (error) {
      console.error('Descriptive error:', error);
      setState([]);
    } else {
      setState(data || []);
    }
    setLoading(false);
  }
  loadData();
}, [dependency]);
```

## Error Handling

**Client-side patterns:**
- `console.error('Descriptive label:', error)` for Supabase query failures
- Set state to empty array/null on error (graceful degradation)
- No user-facing error toasts or error boundaries
- Loading states shown as centered text: `<div>Loading...</div>`

**API route patterns:**
- Try/catch wrapping entire handler body
- Return `NextResponse.json({ error: 'message' }, { status: code })` on failure
- Log errors via `console.error('Context:', err)`
- Status codes: 400 for bad input, 404 for not found, 500 for internal errors

## Logging

**Framework:** `console.error` and `console.log` (no structured logging library)

**Patterns:**
- `console.error('Label:', error)` for failed queries
- `console.log('Description: ${variable}')` for webhook confirmations
- No debug-level or info-level logging conventions

## Comments

**When to Comment:**
- Section headers in large components: `{/* Hero chart: GSC impressions trend */}`
- Inline explanations for business logic: `// Fall back to most recent report with real PSI data`
- Weight/scoring explanations: `// Mobile speed (weight 25) -- treat 0 as missing`
- No JSDoc on functions except occasionally via `/** */` on utility functions in `src/lib/utils.ts`

**JSDoc/TSDoc:**
- Used sparingly on utility functions: `/** Normalize a count metric to a daily rate */`
- Not used on components or hooks

## Function Design

**Size:** Components can be large (300+ lines for tab components like `OverviewTab.tsx`). Utility functions are compact (under 20 lines each in `src/lib/utils.ts`).

**Parameters:** Props destructured in function signature. Utility functions use explicit typed parameters.

**Return Values:**
- `null` for missing/invalid data (not `undefined`)
- Empty arrays `[]` as fallback for list data
- Formatted strings with `'--'` for display when data is null

## Module Design

**Exports:**
- One default export per component file
- Named exports for utility functions, types, and interfaces
- Types co-exported from `src/lib/types.ts`

**Barrel Files:** Not used. Direct imports to specific files.

## API Route Conventions

**Location:** `src/app/api/[domain]/route.ts` following Next.js App Router convention

**Supabase client in API routes:**
- Server-side uses `createClient` from `@supabase/supabase-js` with service role key
- Pattern: `const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)`
- Client-side uses `createBrowserClient` from `@supabase/ssr` in `src/lib/supabase.ts`
- Middleware uses `createServerClient` from `@supabase/ssr` in `src/lib/supabase-middleware.ts`

**Response format:**
- Success: `Response.json({ data })` or `NextResponse.json({ ok: true })`
- Error: `Response.json({ error: 'message' }, { status: code })`

---

*Convention analysis: 2026-03-10*
