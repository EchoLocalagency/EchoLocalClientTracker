# External Integrations

**Analysis Date:** 2026-03-10

## APIs & External Services

**Google Analytics 4 (GA4):**
- Purpose: Pull sessions, organic traffic, phone click events, form submit events per client
- SDK: `google-analytics-data` Python package (`BetaAnalyticsDataClient`)
- Auth: Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`)
- Implementation: `scripts/run_reports.py` -> `pull_ga4()`
- Per-client config: `ga4_property` field in `clients.json`

**Google Search Console (GSC):**
- Purpose: Search impressions, clicks, avg position, top queries, target keyword rankings
- SDK: `google-api-python-client` (`searchconsole` v1 service)
- Auth: Same Google OAuth credentials
- Implementation: `scripts/run_reports.py` -> `pull_gsc()`, `pull_gsc_target_keywords()`
- Per-client config: `gsc_url` field in `clients.json`

**Google Business Profile (GBP):**
- Purpose: Maps/search impressions, call clicks, website clicks, direction requests, search keywords
- SDK: `google-api-python-client` (`businessprofileperformance` v1 service)
- Auth: Same Google OAuth credentials
- Implementation: `scripts/run_reports.py` -> `pull_gbp()`, `pull_gbp_keywords()`
- Per-client config: `gbp_location` field in `clients.json` (e.g., `locations/3810638775821930387`)
- Also used by SEO engine for GBP posts and photo uploads

**Google PageSpeed Insights:**
- Purpose: Mobile/desktop performance scores, LCP, CLS, TBT
- SDK: Direct HTTP via `urllib.request` (REST API)
- Auth: `PSI_KEY` env var (API key)
- Implementation: `scripts/run_reports.py` -> `pull_pagespeed()`

**Google Drive:**
- Purpose: Sync client photos from Drive folders to local and Supabase storage
- SDK: `google-api-python-client`
- Auth: Same Google OAuth credentials
- Implementation: `scripts/seo_engine/photo_manager.py`, `scripts/seo_engine/auth_drive.py`
- Per-client config: `drive_folder_id` in `clients.json`

**GoHighLevel (GHL):**
- Purpose: CRM -- form submissions tracking, call webhook ingestion, lead management
- SDK: Direct HTTP via `requests` (REST API v2)
- Auth: Per-client bearer tokens stored in `clients.json` (`ghl_token` field)
- Base URL: `https://services.leadconnectorhq.com`
- API Version Header: `2021-07-28`
- Implementation:
  - Form submissions: `scripts/run_reports.py` -> `pull_ghl_forms()`
  - Form webhook: `src/app/api/webhook/ghl-form/route.ts`
  - Call webhook: `supabase/functions/ghl-call-webhook/index.ts`
- Per-client config: `ghl_location_id`, `ghl_token`, `ghl_form_name` in `clients.json`
- Location ID mapping (webhook): `KwsH04X22oBXm8Ugdqb8` -> `integrity-pro-washers`, `3m3jhkEz2xInUprxbRzX` -> `mr-green-turf-clean`

**Instantly (Cold Email):**
- Purpose: Campaign analytics, warmup monitoring, lead list management, unread reply counts
- SDK: Direct HTTP via `fetch` (REST API v2)
- Auth: Bearer token (hardcoded in `src/app/api/agents/instantly-stats/route.ts`)
- Base URL: `https://api.instantly.ai/api/v2`
- Implementation: `src/app/api/agents/instantly-stats/route.ts`
- Campaign ID: `db447474-0044-4b75-b8f1-c437eaf7eef5`
- Sender accounts: 4 email addresses (`brian@echolocaldigital.com`, etc.)
- Lead lists: hot, warm, moderate, archive (each with UUID)

**Claude CLI (AI Brain):**
- Purpose: SEO decision-making brain, sales call analysis brain, agency brain
- SDK: `claude -p` subprocess call (uses CLI auth, NOT API key)
- Implementation:
  - SEO brain: `scripts/seo_engine/brain.py` (called by `seo_loop.py`)
  - Sales brain: `scripts/sales_engine/sales_brain.py`
  - Agency brain: `scripts/agency_engine/agency_brain.py`

## Data Storage

**Database:**
- Supabase Postgres (hosted)
  - Project: `yhxovsxpwnrdsgcuzyam.supabase.co`
  - Connection (frontend): `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Connection (server): `SUPABASE_SERVICE_ROLE_KEY` for elevated access
  - Python client: `SUPABASE_URL` + `SUPABASE_KEY`

**Known Supabase Tables:**
- `clients` - Client records with slug, name, SEO config columns
- `reports` - Daily performance reports (GA4, GSC, PSI, GBP metrics), upsert on `client_id,run_date`
- `gsc_queries` - Top GSC queries per report
- `gbp_keywords` - GBP search keyword data per report
- `form_submissions` - Granular form submission log from GHL webhook
- `user_profiles` - Auth profiles with `role` (admin/client) and `client_id`
- `agent_runs` - Agent execution history (SEO engine, sales engine, etc.)
- `agent_tasks` - Task board for agent management
- `linkedin_drafts` - LinkedIn content drafts and research
- `sales_calls` - Call transcripts and analysis from GHL call webhook
- `seo_actions` - SEO engine action log with outcomes/follow-ups
- `content_clusters` - Topic cluster management for SEO

**File Storage:**
- Local filesystem for report JSON backups (`reports/<slug>/<date>.json`)
- Google Drive for client photos (synced locally)
- Supabase Storage for photo management (`scripts/sync_photos_to_supabase.py`)

**Caching:**
- None (no Redis or similar)
- SEO research cache is file-based (JSON on disk)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth with Google OAuth
  - Implementation: `src/lib/auth-context.tsx` (client-side), `src/lib/supabase-middleware.ts` (server-side)
  - Middleware: `src/middleware.ts` - redirects unauthenticated users to `/login`
  - Excluded from auth: `/login`, `/api/webhook/*`, `/api/agents/*`, static assets
  - Role system: `admin` or `client` from `user_profiles` table
  - Internal use only

**Webhook Auth:**
- GHL form webhook: No auth (open endpoint)
- GHL call webhook (Edge Function): Bearer token validated against `GHL_WEBHOOK_SECRET` env var
- Agent API routes: No auth (excluded from middleware)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or similar)
- `console.error` throughout API routes
- `error_flags` array on report records tracks data source failures per run

**Health Check:**
- `scripts/health_check.py` - validates data integrity post-pipeline
- `scripts/health_check_daily.sh` - scheduled runner
- Checks: all-zero reports, missing GBP data, missing conversions, NULL anomalies, stale data

**Logs:**
- Python scripts: stdout/stderr (captured by launchd)
- Log directory: `logs/` (local)
- Next.js: `console.log`/`console.error` in API routes

## CI/CD & Deployment

**Hosting:**
- Netlify - Next.js frontend via `@netlify/plugin-nextjs`
- Build command: `npm run build`
- Publish dir: `.next`

**CI Pipeline:**
- None detected (no GitHub Actions, no `.github/workflows/`)

**Deployment Flow:**
- Push to GitHub -> Netlify auto-deploys
- GitHub repo: `https://github.com/EchoLocalagency/EchoLocalClientTracker`

**Python Scripts:**
- Run on developer's local machine via launchd (macOS scheduler)
- Not deployed to any cloud service

## Environment Configuration

**Required env vars (frontend/.env.local):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

**Required env vars (Python scripts/.env):**
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REFRESH_TOKEN` - Google OAuth refresh token
- `PSI_KEY` - PageSpeed Insights API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase service role key

**Secrets location:**
- `.env` and `.env.local` in project root (gitignored)
- GHL per-client tokens stored in `clients.json` (committed to git -- security concern)
- Instantly API key hardcoded in `src/app/api/agents/instantly-stats/route.ts` (committed to git -- security concern)
- Supabase keys exposed in `netlify.toml` build environment (committed to git -- security concern)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhook/ghl-form` - GHL form submission webhook (`src/app/api/webhook/ghl-form/route.ts`)
  - Maps GHL location_id to client slug, increments form_submits on latest report, logs to `form_submissions` table
- `POST /supabase/functions/ghl-call-webhook` - GHL call transcript webhook (Supabase Edge Function)
  - Validates bearer token, inserts call data into `sales_calls` table

**Outgoing:**
- Git push to client website repos after SEO engine actions (blog posts, schema updates, location pages)
- GBP API posts and photo uploads via SEO engine

---

*Integration audit: 2026-03-10*
