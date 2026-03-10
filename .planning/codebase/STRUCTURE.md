# Codebase Structure

**Analysis Date:** 2026-03-10

## Directory Layout

```
EchoLocalClientTracker/
├── src/                    # Next.js frontend application
│   ├── app/                # App Router pages and API routes
│   │   ├── page.tsx        # Main dashboard (root page)
│   │   ├── layout.tsx      # Root layout with AuthProvider
│   │   ├── globals.css     # Global styles (CSS variables, dark theme)
│   │   ├── login/          # Login page
│   │   ├── agents/         # Standalone agents page
│   │   ├── sales-engine/   # Standalone sales engine page
│   │   │   └── script/     # Sales script sub-page
│   │   ├── seo-engine/     # Standalone SEO engine page
│   │   └── api/            # API route handlers
│   │       ├── agents/     # Agent-related endpoints
│   │       │   ├── chat/   # Agent runs + tasks fetch
│   │       │   ├── tasks/  # Agent task CRUD
│   │       │   ├── instantly-stats/  # Instantly API proxy
│   │       │   └── linkedin-drafts/  # LinkedIn draft generation
│   │       └── webhook/
│   │           └── ghl-form/  # GHL form submission webhook
│   ├── components/         # React components
│   │   ├── tabs/           # Dashboard tab views (Overview, SEO, etc.)
│   │   ├── seo-engine/     # SEO Engine page components
│   │   ├── Sidebar.tsx     # Client selector sidebar
│   │   ├── TabNav.tsx      # Tab navigation bar
│   │   ├── StatCard.tsx    # Metric stat card
│   │   ├── HealthScoreCard.tsx  # Health score display
│   │   ├── AlertBanner.tsx # Alert/notification banner
│   │   ├── ChartTooltip.tsx # Recharts custom tooltip
│   │   ├── TimeRangeFilter.tsx  # Time range selector (4w/3m/6m/all)
│   │   └── VelocityBadge.tsx    # Trend velocity indicator
│   ├── hooks/              # Custom React hooks
│   │   └── useFilteredReports.ts  # Time-range filtered reports
│   └── lib/                # Shared utilities and config
│       ├── types.ts        # TypeScript interfaces (Client, Report, etc.)
│       ├── supabase.ts     # Browser Supabase client
│       ├── supabase-middleware.ts  # Server Supabase client for middleware
│       ├── auth-context.tsx # AuthProvider + useAuth hook
│       ├── utils.ts        # Calculation helpers (delta, health score, velocity)
│       └── mock-data.ts    # Development mock data
├── scripts/                # Python data pipeline and automation
│   ├── run_reports.py      # Main report collection pipeline
│   ├── run_reports_daily.sh # Shell wrapper for launchd cron
│   ├── run_seo_loop.sh     # Shell wrapper for SEO loop cron
│   ├── health_check.py     # System health checker
│   ├── health_check_daily.sh # Health check cron wrapper
│   ├── send_email.py       # Email sending utility
│   ├── campaign_log.py     # Campaign logging
│   ├── backfill.py         # Data backfill utility
│   ├── setup-supabase.mjs  # Supabase table setup (Node.js)
│   ├── sync_photos_to_supabase.py  # Photo sync utility
│   ├── tag_db_reactivation.py  # GHL tag management
│   ├── tag_review_campaign.py  # Review campaign tagging
│   ├── seo_engine/         # Autonomous SEO system
│   │   ├── seo_loop.py     # Main orchestrator (daily loop)
│   │   ├── brain.py        # AI decision engine (claude -p)
│   │   ├── data_collector.py  # Performance data gathering
│   │   ├── outcome_logger.py  # Action outcome tracking
│   │   ├── content_validator.py  # AI content quality checks
│   │   ├── cluster_manager.py   # Keyword cluster management
│   │   ├── internal_linker.py   # Internal link optimization
│   │   ├── photo_manager.py     # Photo management for GBP
│   │   ├── schema_injector.py   # Schema markup injection
│   │   ├── self_improve.py      # Self-improvement loop
│   │   ├── auth_drive.py        # Google Drive auth
│   │   ├── engine_tuning.json   # Per-client tuning config
│   │   ├── actions/        # Executable SEO actions
│   │   │   ├── blog_engine.py      # Blog post generation
│   │   │   ├── gbp_posts.py        # GBP post creation
│   │   │   ├── gbp_media.py        # GBP photo uploads
│   │   │   ├── gbp_qanda.py        # GBP Q&A (deprecated)
│   │   │   ├── location_pages.py   # Location page generation
│   │   │   └── page_optimizer.py   # Page content optimization
│   │   ├── backlinks/      # Backlink outreach system
│   │   │   ├── directory_audit.py
│   │   │   ├── email_templates.py
│   │   │   ├── gmail_sender.py
│   │   │   └── outreach_executor.py
│   │   ├── research/       # SEO research modules
│   │   │   ├── research_runner.py  # Research orchestrator
│   │   │   ├── keyword_discovery.py
│   │   │   ├── serp_scraper.py
│   │   │   ├── aeo_opportunities.py
│   │   │   ├── aeo_crawler_check.py
│   │   │   ├── backlink_gap.py
│   │   │   ├── brand_mentions.py
│   │   │   ├── broken_links.py
│   │   │   ├── journalist_monitor.py
│   │   │   ├── news.py
│   │   │   ├── reddit.py
│   │   │   ├── stock_photo_links.py
│   │   │   └── trends.py
│   │   └── templates/      # HTML templates for generated content
│   │       ├── blog_template.html
│   │       ├── blog_template_echo_local.html
│   │       ├── blog_template_integrity.html
│   │       ├── location_template.html
│   │       └── location_template_integrity.html
│   ├── sales_engine/       # Sales call analysis
│   │   ├── sales_brain.py  # AI call analysis
│   │   ├── call_watcher.py # Call monitoring
│   │   └── analyze_calls.py # Call analysis pipeline
│   └── agency_engine/      # Agency operations automation
│       ├── agency_brain.py  # Agency AI brain
│       └── agency_loop.py   # Agency automation loop
├── supabase/               # Supabase configuration
│   ├── migrations/         # SQL migration files
│   │   └── add_seo_engine_columns.sql
│   └── functions/          # Supabase Edge Functions
│       └── ghl-call-webhook/  # GHL call webhook handler
│           └── index.ts
├── clients.json            # Client configuration (Python scripts read this)
├── reports/                # Local report backups (per-client subdirs)
│   ├── az-turf-cleaning/
│   ├── echo-local/
│   ├── integrity-pro-washers/
│   ├── mr-green-turf-clean/
│   ├── primal-plates/
│   ├── emails/             # Email report templates
│   │   └── templates/
│   ├── presentations/      # Client presentation files
│   └── sales/              # Sales-related reports
├── baselines/              # Client baseline snapshots
├── assets/                 # Client photo assets (per-client subdirs)
│   ├── az-turf-cleaning/
│   ├── integrity-pro-washers/
│   └── mr-green-turf-clean/
├── outreach/               # Sales outreach drafts (HTML/text)
├── logs/                   # Script execution logs
├── public/                 # Static assets (logos, icons)
├── package.json            # Node.js dependencies
├── next.config.ts          # Next.js configuration
├── netlify.toml            # Netlify deployment config
├── tsconfig.json           # TypeScript configuration
├── postcss.config.mjs      # PostCSS (Tailwind)
└── eslint.config.mjs       # ESLint configuration
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components (`page.tsx`), layouts, route handlers
- Key files: `page.tsx` (main dashboard), `layout.tsx` (root layout with AuthProvider)

**`src/components/`:**
- Purpose: Reusable React UI components
- Contains: Dashboard widgets, tab views, SEO engine components
- Key files: `tabs/OverviewTab.tsx`, `tabs/SeoTab.tsx`, `Sidebar.tsx`, `StatCard.tsx`

**`src/components/tabs/`:**
- Purpose: Dashboard tab content views
- Contains: One component per tab (Overview, SEO, Conversions, GBP, SEO Engine, Agents)
- Key files: `OverviewTab.tsx`, `SeoTab.tsx`, `ConversionsTab.tsx`, `GbpTab.tsx`, `SeoEngineTab.tsx`, `AgentsTab.tsx`

**`src/components/seo-engine/`:**
- Purpose: Components for the standalone `/seo-engine` admin page
- Contains: Client management, action feeds, brain decision views, keyword tracking
- Key files: `SeoEngineLayout.tsx`, `ClientManager.tsx`, `ActionFeedGreen.tsx`, `BrainDecisionsGreen.tsx`, `KeywordDashboard.tsx`

**`src/lib/`:**
- Purpose: Shared utilities, types, and configuration
- Contains: Supabase clients, type definitions, calculation helpers, auth context
- Key files: `types.ts`, `supabase.ts`, `auth-context.tsx`, `utils.ts`

**`scripts/seo_engine/`:**
- Purpose: Autonomous SEO system that runs daily
- Contains: Orchestrator, AI brain, data collectors, action executors, research modules
- Key files: `seo_loop.py` (entry point), `brain.py` (AI decisions), `data_collector.py`

**`scripts/seo_engine/actions/`:**
- Purpose: Executable SEO actions the brain can trigger
- Contains: Blog engine, GBP posts/photos, location page generator, page optimizer

**`scripts/seo_engine/research/`:**
- Purpose: SEO research and discovery modules
- Contains: Keyword discovery, SERP scraping, AEO analysis, backlink gap analysis, news/trends monitoring

**`scripts/sales_engine/`:**
- Purpose: Sales call analysis and coaching
- Contains: Call watcher, AI analysis, sales brain

**`scripts/agency_engine/`:**
- Purpose: Agency operations automation
- Contains: Agency brain and automation loop

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Main dashboard page (client-facing + admin)
- `src/app/login/page.tsx`: Authentication page
- `src/app/seo-engine/page.tsx`: Standalone SEO engine admin
- `src/app/sales-engine/page.tsx`: Standalone sales engine admin
- `src/app/agents/page.tsx`: Agent management page
- `scripts/run_reports.py`: Data pipeline entry point
- `scripts/seo_engine/seo_loop.py`: SEO engine entry point

**Configuration:**
- `clients.json`: Client definitions (GA4 IDs, keywords, service areas, GHL tokens)
- `scripts/seo_engine/engine_tuning.json`: Per-client SEO tuning parameters
- `netlify.toml`: Deployment config with Supabase env vars
- `next.config.ts`: Next.js config (currently empty)
- `tsconfig.json`: TypeScript config with `@/` path alias to `src/`

**Core Logic:**
- `src/lib/utils.ts`: Health score calculation, velocity detection, delta formatting
- `src/lib/auth-context.tsx`: Auth state management (admin/client role detection)
- `src/lib/types.ts`: All TypeScript interfaces
- `scripts/seo_engine/brain.py`: AI decision engine
- `scripts/seo_engine/data_collector.py`: Performance data aggregation
- `scripts/run_reports.py`: GA4/GSC/PSI/GBP data pulling

**API Routes:**
- `src/app/api/webhook/ghl-form/route.ts`: GHL form submission webhook
- `src/app/api/agents/chat/route.ts`: Agent runs/tasks fetch
- `src/app/api/agents/tasks/route.ts`: Agent task CRUD
- `src/app/api/agents/instantly-stats/route.ts`: Instantly API proxy

## Naming Conventions

**Files:**
- React components: PascalCase (`StatCard.tsx`, `OverviewTab.tsx`)
- Utilities/hooks: camelCase (`utils.ts`, `useFilteredReports.ts`)
- Python scripts: snake_case (`run_reports.py`, `seo_loop.py`)
- Config files: kebab-case (`auth-context.tsx`, `mock-data.ts`)

**Directories:**
- Next.js routes: kebab-case (`sales-engine/`, `seo-engine/`, `ghl-form/`)
- Component groups: kebab-case (`seo-engine/`) or plain lowercase (`tabs/`)
- Python packages: snake_case (`seo_engine/`, `sales_engine/`)

**Components:**
- Tab components: `{Name}Tab.tsx` (e.g., `OverviewTab.tsx`, `SeoTab.tsx`)
- SEO engine components: descriptive PascalCase (e.g., `ActionFeedGreen.tsx`, `BrainDecisionsGreen.tsx`)

## Where to Add New Code

**New Dashboard Tab:**
1. Add tab ID to `TabId` type in `src/lib/types.ts`
2. Create component in `src/components/tabs/{Name}Tab.tsx`
3. Import and add conditional render in `src/app/page.tsx`
4. Add tab entry in `src/components/TabNav.tsx` tabs array

**New API Route:**
- Create `src/app/api/{path}/route.ts`
- Use `createClient` from `@supabase/supabase-js` with service role key for server-side access
- Export `GET`, `POST`, etc. as named functions

**New UI Component:**
- Shared/reusable: `src/components/{ComponentName}.tsx`
- SEO Engine specific: `src/components/seo-engine/{ComponentName}.tsx`
- Tab-specific: `src/components/tabs/{Name}Tab.tsx`

**New SEO Action Type:**
- Create `scripts/seo_engine/actions/{action_name}.py`
- Add to imports/dispatch in `scripts/seo_engine/seo_loop.py`
- Add weekly limit in `WEEKLY_LIMITS` dict in `seo_loop.py`

**New Research Module:**
- Create `scripts/seo_engine/research/{module_name}.py`
- Integrate via `scripts/seo_engine/research/research_runner.py`

**New Python Utility Script:**
- Place in `scripts/` root
- Use `dotenv` for env vars, `supabase` Python client for DB access

**New Client:**
- Add entry to `clients.json`
- Insert matching row in Supabase `clients` table
- Add GHL location mapping in `src/app/api/webhook/ghl-form/route.ts` `LOCATION_MAP`

## Special Directories

**`.netlify/`:**
- Purpose: Netlify build artifacts and edge functions
- Generated: Yes
- Committed: No (should be in .gitignore)

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`reports/`:**
- Purpose: Local JSON backup of report data (also stored in Supabase)
- Generated: Yes (by `run_reports.py`)
- Committed: Some files committed (markdown reports, presentations)

**`assets/`:**
- Purpose: Client photos for GBP and website use
- Generated: No (manually curated + synced)
- Committed: Yes

**`baselines/`:**
- Purpose: Point-in-time client performance snapshots
- Generated: Yes (by scripts)
- Committed: Yes

**`logs/`:**
- Purpose: Script execution logs
- Generated: Yes
- Committed: Varies

**`outreach/`:**
- Purpose: Sales outreach email/message drafts
- Generated: Yes (by cold email system)
- Committed: Yes

**`supabase/migrations/`:**
- Purpose: SQL schema migrations
- Generated: No (manually written)
- Committed: Yes

---

*Structure analysis: 2026-03-10*
