# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** Next.js App Router SPA + Python Data Pipeline + Supabase Backend

**Key Characteristics:**
- Single-page dashboard app with tab-based navigation (no client-side routing between tabs)
- Dedicated standalone pages for admin tools (SEO Engine, Sales Engine, Agents)
- All data flows through Supabase (Postgres) -- Python scripts write, Next.js frontend reads
- Auth via Supabase Auth with role-based access (admin vs client)
- Python scripts run locally via cron/launchd, not on a server
- API routes serve as lightweight proxies to Supabase and external services (Instantly)

## Layers

**Presentation Layer (Next.js Frontend):**
- Purpose: Render dashboard UI, charts, and admin tools
- Location: `src/app/`, `src/components/`
- Contains: React components, page routes, tab views
- Depends on: Supabase client (`src/lib/supabase.ts`), Recharts, utility functions
- Used by: End users (clients and admin) via browser

**API Layer (Next.js Route Handlers):**
- Purpose: Server-side endpoints for webhooks, agent data, and external API proxying
- Location: `src/app/api/`
- Contains: Route handlers using Supabase service role key
- Depends on: Supabase server client, Instantly API
- Used by: GHL webhooks, frontend agent tab, external services

**Data Layer (Supabase):**
- Purpose: Central data store for all client data, reports, SEO actions, agent runs
- Contains: Postgres tables accessed via Supabase JS client
- Depends on: Nothing (it is the persistence layer)
- Used by: Frontend (browser client), API routes (service role client), Python scripts

**Data Pipeline (Python Scripts):**
- Purpose: Collect performance data from GA4, GSC, PageSpeed, GBP; run SEO engine brain
- Location: `scripts/`
- Contains: Python modules for data collection, SEO automation, sales analysis
- Depends on: Google APIs, Supabase Python client, `claude -p` subprocess for AI brain
- Used by: launchd cron jobs on Brian's Mac

**Configuration Layer:**
- Purpose: Client definitions and SEO tuning parameters
- Location: `clients.json`, `scripts/seo_engine/engine_tuning.json`
- Contains: Client metadata (GA4 IDs, GHL tokens, target keywords, service areas)
- Used by: Python scripts and Supabase (clients table mirrors this file)

## Data Flow

**Report Generation (Python -> Supabase -> Frontend):**

1. `scripts/run_reports.py` runs via `scripts/run_reports_daily.sh` (launchd)
2. Pulls GA4 sessions/organic, GSC impressions/clicks/queries, PageSpeed scores, GBP metrics
3. Writes report row + GSC query rows + GBP keyword rows to Supabase tables
4. Frontend `page.tsx` fetches from `reports`, `gsc_queries`, `gbp_keywords` tables via browser client
5. Tab components render charts and stat cards from the fetched data

**SEO Engine Loop (Python -> Claude -> Supabase -> Frontend):**

1. `scripts/seo_engine/seo_loop.py` runs daily at noon via launchd
2. `data_collector.py` pulls fresh GSC/GA4/GBP data + scans page inventory
3. `brain.py` builds a prompt with performance data + action history + outcome patterns
4. Calls `claude -p` subprocess to get AI-recommended SEO actions as JSON
5. `seo_loop.py` executes approved actions (blog posts, GBP posts, page edits, schema updates)
6. Logs actions to `seo_actions` and brain decisions to `seo_brain_decisions` in Supabase
7. Frontend SEO Engine tab and `/seo-engine` page display action feed and brain decisions

**GHL Form Webhook (External -> API -> Supabase):**

1. GoHighLevel fires webhook on form submission to `/api/webhook/ghl-form`
2. Route handler maps GHL `location_id` to client slug via hardcoded `LOCATION_MAP`
3. Increments `ga4_form_submits` on latest report row
4. Inserts granular record into `form_submissions` table

**State Management:**
- No global state library (no Redux, Zustand, etc.)
- React `useState` + `useEffect` in page components for all data fetching
- `AuthProvider` context (`src/lib/auth-context.tsx`) is the only React context
- Data is fetched fresh on client/tab change -- no caching layer

## Key Abstractions

**Client:**
- Purpose: Represents a business customer being tracked
- Definition: `src/lib/types.ts` (`Client` interface)
- Source of truth: `clients` Supabase table (mirrored in `clients.json` for Python scripts)
- Pattern: Selected in sidebar, drives all data fetching

**Report:**
- Purpose: Bi-weekly performance snapshot for a client
- Definition: `src/lib/types.ts` (`Report` interface)
- Pattern: Time-series data with current + previous period values for delta calculations

**Tab System:**
- Purpose: Organize dashboard views without client-side routing
- Types: `TabId` = `'overview' | 'seo' | 'conversions' | 'gbp' | 'seo-engine' | 'agents'`
- Pattern: Conditional rendering in `page.tsx` based on `activeTab` state
- Admin-only tabs: `seo-engine`, `agents` (filtered by `isAdmin` flag)

**SEO Brain:**
- Purpose: AI decision-maker for SEO actions
- Implementation: `scripts/seo_engine/brain.py` calls `claude -p` with structured prompt
- Pattern: Collect data -> build prompt -> parse JSON response -> execute actions -> log outcomes

## Entry Points

**Dashboard (Main Page):**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Load clients, reports, queries; render sidebar + tabs; handle auth gating

**Login Page:**
- Location: `src/app/login/page.tsx`
- Triggers: Unauthenticated access
- Responsibilities: Email/password login via Supabase Auth

**SEO Engine Page (Standalone Admin):**
- Location: `src/app/seo-engine/page.tsx`
- Triggers: Direct navigation to `/seo-engine`
- Responsibilities: Client management, SEO action feed, brain decisions, keyword dashboard

**Sales Engine Page (Standalone Admin):**
- Location: `src/app/sales-engine/page.tsx`
- Triggers: Direct navigation to `/sales-engine`
- Responsibilities: Call log analysis, objection tracking, callback management, Instantly stats

**Agents Page (Standalone Admin):**
- Location: `src/app/agents/page.tsx`
- Triggers: Direct navigation to `/agents`
- Responsibilities: Agent run history, task management, agent status overview

**GHL Webhook:**
- Location: `src/app/api/webhook/ghl-form/route.ts`
- Triggers: GoHighLevel form submission webhook POST
- Responsibilities: Record form submissions, increment report counters

**Agent Chat API:**
- Location: `src/app/api/agents/chat/route.ts`
- Triggers: GET request from Agents tab
- Responsibilities: Fetch agent runs and tasks from Supabase

**Instantly Stats API:**
- Location: `src/app/api/agents/instantly-stats/route.ts`
- Triggers: GET request from Sales Engine page
- Responsibilities: Proxy Instantly API for campaign analytics, warmup stats, lead counts

**Agent Tasks API:**
- Location: `src/app/api/agents/tasks/route.ts`
- Triggers: POST request from Agents tab
- Responsibilities: CRUD operations on `agent_tasks` table

**Report Pipeline:**
- Location: `scripts/run_reports.py`
- Triggers: `scripts/run_reports_daily.sh` via launchd
- Responsibilities: Pull GA4/GSC/PSI/GBP data, write to Supabase

**SEO Loop:**
- Location: `scripts/seo_engine/seo_loop.py`
- Triggers: `scripts/run_seo_loop.sh` via launchd (daily noon)
- Responsibilities: Orchestrate data collection, brain call, action execution, outcome logging

## Error Handling

**Strategy:** Minimal -- console.error + graceful empty state rendering

**Patterns:**
- Frontend: Supabase query errors logged to console, state set to empty arrays
- API routes: Try/catch with JSON error responses (400/404/500)
- Python scripts: `_retry()` helper with exponential backoff for Google API calls
- No error tracking service (no Sentry, etc.)
- No user-facing error messages beyond "No data yet"

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error` in frontend and API routes; Python `print()` statements
**Validation:** SEO engine has `content_validator.py` for AI-generated content; no input validation on API routes beyond basic field extraction
**Authentication:** Supabase Auth with `AuthProvider` context; middleware handles session refresh via `src/lib/supabase-middleware.ts`; role-based visibility (admin/client) throughout UI
**Authorization:** Admin users see all clients + admin tabs; client users see only their assigned client; API routes do NOT check auth (rely on Supabase RLS or service role key)

## Supabase Tables (Inferred from Queries)

| Table | Purpose | Written by |
|-------|---------|-----------|
| `clients` | Client configuration | Python scripts, SEO Engine UI |
| `reports` | Bi-weekly performance snapshots | `run_reports.py`, GHL webhook |
| `gsc_queries` | Search Console query data per report | `run_reports.py` |
| `gbp_keywords` | GBP keyword impressions per report | `run_reports.py` |
| `seo_actions` | SEO engine action log | `seo_loop.py` |
| `seo_brain_decisions` | AI brain decision log | `brain.py` |
| `form_submissions` | Granular form submission records | GHL webhook |
| `user_profiles` | Auth user -> role + client mapping | Manual/Supabase dashboard |
| `agent_runs` | Agent execution history | Python agent scripts |
| `agent_tasks` | Agent task board | Agents tab UI |

---

*Architecture analysis: 2026-03-10*
