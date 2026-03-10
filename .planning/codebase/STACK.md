# Technology Stack

**Analysis Date:** 2026-03-10

## Languages

**Primary:**
- TypeScript 5.x - Next.js frontend, API routes, Supabase Edge Functions (`src/**/*.ts`, `src/**/*.tsx`)
- Python 3 - Data pipelines, SEO engine, sales engine (`scripts/**/*.py`)

**Secondary:**
- SQL - Supabase migrations (`supabase/migrations/add_seo_engine_columns.sql`)
- Bash - Cron/launchd runners (`scripts/run_reports_daily.sh`, `scripts/run_seo_loop.sh`, `scripts/health_check_daily.sh`)

## Runtime

**Frontend Environment:**
- Node.js (managed via NVM, version unspecified -- no `.nvmrc` present)
- Deno - Supabase Edge Functions only (`supabase/functions/ghl-call-webhook/index.ts`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

**Python Environment:**
- Python 3 (system/NVM, no `requirements.txt` or `pyproject.toml` found -- dependencies installed globally)

## Frameworks

**Core:**
- Next.js 16.1.6 - App Router, full-stack React framework (`next.config.ts`)
- React 19.2.3 - UI rendering
- React DOM 19.2.3 - DOM bindings

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS (`postcss.config.mjs` via `@tailwindcss/postcss`)

**Charts:**
- Recharts 3.7.0 - Data visualization for dashboard metrics

**Testing:**
- Not detected -- no test framework configured, no test files present

**Build/Dev:**
- PostCSS with `@tailwindcss/postcss` plugin (`postcss.config.mjs`)
- ESLint 9.x with `eslint-config-next` 16.1.6 (`eslint.config.mjs`)
- TypeScript 5.x compiler (`tsconfig.json`)
- `@netlify/plugin-nextjs` 5.15.8 - Netlify deployment adapter

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.97.0 - Database client for all Supabase operations (browser, server, edge)
- `@supabase/ssr` 0.9.0 - Server-side Supabase auth (middleware cookie handling)
- `next` 16.1.6 - Application framework
- `recharts` 3.7.0 - All dashboard charts

**Python (installed globally, no lockfile):**
- `google-analytics-data` - GA4 Data API client
- `google-api-python-client` - GSC, GBP, Drive APIs
- `google-auth` / `google-auth-oauthlib` - OAuth credential management
- `supabase` (Python) - Supabase client for data pipeline writes
- `requests` - HTTP client for GHL API calls
- `python-dotenv` - Environment variable loading

## Configuration

**Environment:**
- `.env` and `.env.local` files present (not committed)
- Required env vars for frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Required env vars for API routes: `SUPABASE_SERVICE_ROLE_KEY`
- Required env vars for Python scripts: `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PSI_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`
- Required env vars for Edge Functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GHL_WEBHOOK_SECRET`

**Build:**
- `netlify.toml` - Build command (`npm run build`), publish dir (`.next`), Supabase env vars configured as build environment variables
- `tsconfig.json` - Target ES2017, bundler module resolution, strict mode, path alias `@/*` -> `./src/*`
- `postcss.config.mjs` - Tailwind CSS via PostCSS plugin

**NPM Scripts:**
```bash
npm run dev          # next dev - local development server
npm run build        # next build - production build
npm run start        # next start - production server
npm run lint         # eslint
```

**Python Scripts (manual or launchd):**
```bash
python3 scripts/run_reports.py                                    # Daily data pipeline
python3 -m scripts.seo_engine.seo_loop --live --client <slug>    # SEO engine
python3 scripts/health_check.py                                   # Data health check
```

## Platform Requirements

**Development:**
- macOS (hardcoded paths in Python scripts reference `/Users/brianegan/`)
- Node.js via NVM
- Python 3 with globally installed packages
- Google OAuth credentials configured

**Production:**
- Frontend: Netlify (via `@netlify/plugin-nextjs`)
- Database: Supabase hosted Postgres (`yhxovsxpwnrdsgcuzyam.supabase.co`)
- Edge Functions: Supabase Edge (Deno runtime)
- Python scripts: Run locally via launchd on developer machine (not deployed)

## Design System

- Background: `#0A0F1E` (dark navy)
- Accent: `#00CED1` (teal)
- Font: Inter
- Style: Linear.app aesthetic -- dark, minimal, bold numbers

---

*Stack analysis: 2026-03-10*
