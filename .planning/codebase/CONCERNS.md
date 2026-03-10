# Codebase Concerns

**Analysis Date:** 2026-03-10

## Tech Debt

**Massive Page Components:**
- Issue: `src/app/sales-engine/page.tsx` (1539 lines) and `src/app/agents/page.tsx` (1430 lines) are monolithic client components with inline styles, data fetching, state management, and UI all in one file.
- Files: `src/app/sales-engine/page.tsx`, `src/app/agents/page.tsx`
- Impact: Extremely difficult to maintain, test, or refactor. Any change risks breaking the entire page. No code reuse possible.
- Fix approach: Extract into smaller components, custom hooks for data fetching (e.g., `useSalesCalls`, `useAgentRuns`), and shared style objects or CSS modules. The main page should orchestrate components, not contain all logic.

**Duplicated Client Data Sources:**
- Issue: `clients.json` in project root duplicates data stored in Supabase `clients` table. Contains hardcoded GHL tokens and location IDs. Python scripts read from this file while the dashboard reads from Supabase.
- Files: `clients.json`, `scripts/run_reports.py`, `scripts/tag_db_reactivation.py`, `scripts/tag_review_campaign.py`
- Impact: Data gets out of sync between `clients.json` and Supabase. Adding a new client requires updating two places. GHL tokens in the JSON file may go stale.
- Fix approach: Have Python scripts read client config from Supabase instead of `clients.json`. Eliminate the JSON file entirely.

**Mock Data Still Present:**
- Issue: `src/lib/mock-data.ts` (210 lines) contains hardcoded mock clients and reports. It appears unused in production but is still shipped.
- Files: `src/lib/mock-data.ts`
- Impact: Dead code increases bundle size and confusion. Contains real client details (GA4 property IDs, GSC URLs, phone numbers).
- Fix approach: Delete the file if confirmed unused. If needed for development, move to a `__mocks__` or `__fixtures__` directory.

**Pervasive `select('*')` Queries:**
- Issue: 21 instances of `.select('*')` across the codebase. Every Supabase query fetches all columns regardless of what the component needs.
- Files: `src/app/page.tsx` (7 instances), `src/app/seo-engine/page.tsx` (4 instances), `src/app/sales-engine/page.tsx` (3 instances), `src/components/tabs/AgentsTab.tsx`, `src/app/api/agents/chat/route.ts`, `src/app/api/agents/linkedin-drafts/route.ts`
- Impact: Transfers unnecessary data over the wire. As tables grow (especially `sales_calls` with `ghl_payload` JSONB and `call_transcript` text), this causes performance degradation. Also exposes sensitive fields like `ghl_token` from the `clients` table to the browser.
- Fix approach: Replace every `select('*')` with explicit column lists matching what each component actually renders.

**Inline Styles Everywhere:**
- Issue: All components use inline `style={{}}` objects instead of CSS modules, Tailwind utility classes, or any styling system. Login page alone has 15+ inline style blocks.
- Files: Every file in `src/components/` and `src/app/`
- Impact: No style reuse, no responsive breakpoints, no hover/focus states (inline styles cannot handle pseudo-classes), duplicated color values across files. Makes the UI rigid and hard to theme.
- Fix approach: Adopt Tailwind CSS (already installed as a devDependency) for utility styling, or extract shared style objects into a design token file.

**No Input Validation on API Routes:**
- Issue: API routes accept and process request bodies without any schema validation. The tasks route (`POST`) trusts `action`, `agent_name`, `title`, etc. directly from the request body. The GHL webhook route trusts `location_id` mapping without verifying payload structure.
- Files: `src/app/api/agents/tasks/route.ts`, `src/app/api/webhook/ghl-form/route.ts`, `src/app/api/agents/chat/route.ts`
- Impact: Malformed payloads could cause runtime errors or inject unexpected data into Supabase.
- Fix approach: Add Zod schema validation to all API route handlers. Validate required fields, types, and allowed values.

## Known Bugs

**Rolling Sum Time Range Bug:**
- Symptoms: Dashboard shows incorrect aggregation when switching between 4w and 3m time ranges. Referenced in MEMORY.md as a known TODO.
- Files: `src/hooks/useFilteredReports.ts`, `src/app/page.tsx`
- Trigger: Switch time range filter between 4w and 3m.
- Workaround: None documented.

**Instantly API Key Expired:**
- Symptoms: Instantly stats endpoint returns 401. Key expired as of 2026-03-08 per MEMORY.md.
- Files: `src/app/api/agents/instantly-stats/route.ts`
- Trigger: Any request to `/api/agents/instantly-stats`.
- Workaround: Regenerate key from app.instantly.ai/settings/api and update the hardcoded value (which itself is a security concern -- see below).

## Security Considerations

**CRITICAL: Secrets Committed to Git (Public Repository):**
- Risk: Multiple secrets are committed to the public GitHub repository (https://github.com/EchoLocalagency/EchoLocalClientTracker). This is an active security incident.
- Files:
  - `netlify.toml` -- Contains `SUPABASE_SERVICE_ROLE_KEY` (full admin access to Supabase, bypasses RLS) and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `src/app/api/agents/instantly-stats/route.ts` -- Contains hardcoded Instantly API key in source code (line 1)
  - `clients.json` -- Contains GHL API tokens for client sub-accounts (lines 12, 56)
- Current mitigation: None. These files are tracked by git and pushed to a public repo.
- Recommendations:
  1. **Immediately rotate all exposed keys**: Supabase service role key, Instantly API key, all GHL tokens.
  2. Move `SUPABASE_SERVICE_ROLE_KEY` to Netlify environment variables (dashboard settings), remove from `netlify.toml`.
  3. Move Instantly API key to an environment variable (`INSTANTLY_API_KEY`), reference via `process.env.INSTANTLY_API_KEY`.
  4. Remove `clients.json` from git tracking. Store sensitive client config only in Supabase.
  5. Add `netlify.toml` to `.gitignore` or strip secrets from it (keep only build config, set env vars in Netlify dashboard).
  6. Run `git filter-branch` or BFG Repo Cleaner to purge secrets from git history.

**No Auth on Admin API Routes:**
- Risk: API routes at `/api/agents/*` are excluded from middleware auth (matcher pattern: `api/agents`). Anyone can read agent run data, create/update/delete tasks, and fetch Instantly campaign analytics without authentication.
- Files: `src/middleware.ts` (line 17), `src/app/api/agents/tasks/route.ts`, `src/app/api/agents/chat/route.ts`, `src/app/api/agents/instantly-stats/route.ts`
- Current mitigation: None.
- Recommendations: Either remove `api/agents` from the middleware exclusion, or add per-route auth checks using `getUser()` from a server-side Supabase client.

**No Role-Based Access Control on Admin Pages:**
- Risk: Pages at `/seo-engine`, `/agents`, and `/sales-engine` are accessible to any authenticated user (including client-role users). These pages expose internal business data, sales call transcripts, agent configurations, and client management forms.
- Files: `src/app/seo-engine/page.tsx`, `src/app/agents/page.tsx`, `src/app/sales-engine/page.tsx`
- Current mitigation: The main dashboard (`src/app/page.tsx`) checks `isAdmin` to conditionally show sidebar and admin tabs, but the standalone routes have no such checks.
- Recommendations: Add `useAuth()` hook to each admin page and redirect non-admin users. Better yet, implement middleware-level role checks for `/seo-engine/*`, `/agents/*`, and `/sales-engine/*` paths.

**No RLS Policies Detected:**
- Risk: No Supabase Row Level Security policies found in any migration files. If RLS is not enabled on Supabase tables, the anon key (exposed in the browser) grants read/write access to all data.
- Files: `supabase/migrations/add_seo_engine_columns.sql` (no RLS statements)
- Current mitigation: Unknown -- RLS may be configured directly in the Supabase dashboard but not captured in migrations.
- Recommendations: Verify RLS status on all tables. Enable RLS with policies that restrict client users to their own `client_id` data. Add migration files to capture policies in version control.

**GHL Webhook Has No Request Verification:**
- Risk: The GHL form webhook at `/api/webhook/ghl-form` accepts any POST request. There is no HMAC signature verification or shared secret check.
- Files: `src/app/api/webhook/ghl-form/route.ts`
- Current mitigation: None. The endpoint uses `SUPABASE_SERVICE_ROLE_KEY` to write directly to the database.
- Recommendations: Add a webhook secret header check, or verify the request IP against GHL's known IP ranges.

**Service Role Key Fallback Pattern:**
- Risk: Two API routes use `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!` as a fallback. If the service role key is missing, the route silently downgrades to the anon key, which may expose different data or fail silently.
- Files: `src/app/api/agents/chat/route.ts` (line 5), `src/app/api/agents/tasks/route.ts` (line 5)
- Recommendations: Require `SUPABASE_SERVICE_ROLE_KEY` explicitly. Throw a clear error if it is missing rather than falling back.

## Performance Bottlenecks

**Waterfall Data Loading on Dashboard:**
- Problem: The main dashboard page (`src/app/page.tsx`) loads data in a waterfall: auth check -> load clients -> load reports -> load queries + GBP keywords -> load SEO data. Each step waits for the previous one.
- Files: `src/app/page.tsx` (lines 37-216, five sequential `useEffect` chains)
- Cause: Cascading `useEffect` hooks that depend on state set by previous effects. No parallel fetching, no server-side data loading.
- Improvement path: Use Next.js Server Components or `Promise.all` for parallel fetching. Move data loading to server-side where possible. Consider React Query or SWR for client-side caching and deduplication.

**No Pagination on Large Tables:**
- Problem: Multiple queries fetch up to 100 rows with no user-facing pagination. As data grows, response times and memory usage increase.
- Files: `src/app/page.tsx` (reports, queries), `src/app/sales-engine/page.tsx` (100 calls, 100 analyses, 90 reports), `src/components/tabs/AgentsTab.tsx` (100 runs)
- Cause: Hard-coded `.limit(100)` without offset or cursor-based pagination.
- Improvement path: Add pagination UI. Use cursor-based pagination for time-series data.

**Full Report History Loaded Every Time:**
- Problem: All reports for a client are fetched ascending by date with no limit. For a client with years of daily reports, this could be thousands of rows.
- Files: `src/app/page.tsx` (line 83-87)
- Cause: No date range filter applied at the query level. The `useFilteredReports` hook filters client-side after fetching all data.
- Improvement path: Apply the time range filter in the Supabase query. Only fetch reports within the selected range plus a small buffer.

## Fragile Areas

**Main Dashboard Page (`src/app/page.tsx`):**
- Files: `src/app/page.tsx`
- Why fragile: 348 lines with 11 useState hooks, 5 useEffect chains, and interleaved data loading. Any change to one data source (e.g., reports schema) ripples through the entire component. State dependencies between effects are implicit and easy to break.
- Safe modification: Only change one data source at a time. Trace the full effect chain before modifying. Consider extracting each data-loading concern into a custom hook.
- Test coverage: Zero tests.

**Sales Engine Page (`src/app/sales-engine/page.tsx`):**
- Files: `src/app/sales-engine/page.tsx`
- Why fragile: 1539 lines in a single file. Contains inline interface definitions, data fetching, UI rendering, delete logic with cascading table updates, and callback handlers. The `deleteCalls` function (lines 927-958) modifies three tables in sequence without a transaction.
- Safe modification: Extremely difficult. Extract sub-components and hooks before making changes.
- Test coverage: Zero tests.

**GHL Location Mapping:**
- Files: `src/app/api/webhook/ghl-form/route.ts` (lines 10-13)
- Why fragile: Hardcoded `LOCATION_MAP` maps GHL location IDs to client slugs. Adding a new client with GHL integration requires a code change and redeploy.
- Safe modification: Move the mapping to Supabase (clients already have `ghl_location_id`). Look up the client by `ghl_location_id` instead of maintaining a separate map.
- Test coverage: Zero tests.

## Scaling Limits

**Client-Side Data Processing:**
- Current capacity: Works with 2-3 clients and ~100 reports each.
- Limit: All data processing (filtering, sorting, deduplication) happens in the browser. With 10+ clients and thousands of reports, the dashboard will slow noticeably.
- Scaling path: Move filtering and aggregation to Supabase queries or API routes. Use server components for initial data loading.

## Dependencies at Risk

**No Lock on Major Versions:**
- Risk: `package.json` uses caret ranges (`^`) for all dependencies including Next.js 16, React 19, and Recharts 3. A minor version bump could introduce breaking changes.
- Impact: Builds could break unexpectedly on Netlify if a dependency publishes a bad version.
- Migration plan: Pin exact versions in `package.json` or rely on `package-lock.json` (which is present).

## Missing Critical Features

**Zero Test Coverage:**
- Problem: No test files exist anywhere in the project. No test framework is configured. No test scripts in `package.json`.
- Blocks: Cannot safely refactor any code. Cannot verify bug fixes. Cannot prevent regressions.

**No Error Boundary:**
- Problem: No React error boundaries in the component tree. A runtime error in any component crashes the entire page.
- Files: `src/app/layout.tsx`, `src/app/page.tsx`
- Blocks: Users see a blank white screen on any JavaScript error instead of a graceful fallback.

**No Loading Skeletons:**
- Problem: All loading states show plain "Loading..." text. No skeleton screens or shimmer effects.
- Files: `src/app/page.tsx` (lines 221-227, 243-249, 320-321), `src/app/seo-engine/page.tsx` (lines 99-109)
- Blocks: Poor perceived performance and user experience during data fetching.

## Test Coverage Gaps

**Entire Codebase is Untested:**
- What's not tested: Everything -- all 50+ source files, all API routes, all components, all data processing logic, all hooks.
- Files: All files in `src/`
- Risk: Any change could break existing functionality with no way to detect it. The `useFilteredReports` hook, the `deleteCalls` cascading delete, the webhook payload parsing, and the auth context are all critical paths with zero test coverage.
- Priority: High. Start with API route tests (webhook, tasks) and the `useFilteredReports` hook, then add component tests for the main dashboard.

---

*Concerns audit: 2026-03-10*
