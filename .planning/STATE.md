---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Client Pipeline Tracker
status: defining_requirements
last_updated: "2026-03-12"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Track every client from first contact to active/churned so nothing falls through the cracks as the client base grows.
**Current focus:** v1.4 Pipeline Tracker -- defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-03-12 -- Milestone v1.4 started

## Performance Metrics

**Velocity (from v1.0 + v1.1):**
- Average duration: 3.1min per plan
- Total plans completed: 19 (v1.0: 8, v1.1: 6, v1.2: 5)
- 12-01: 4min (3 tasks, 4 files)

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
Recent (v1.2):
- 12-01: Directories tab visible to all users (not admin-only like GEO/SEO Engine)
- 12-01: Inline CSS styles only in DirectoriesTab (consistent with GeoTab pattern)
- 12-01: SUBMITTED_STATUSES includes submitted/approved/verified for tier progress counting
- 11-01: Used .in_() for submitted count to include submitted/approved/verified statuses
- 11-01: Only log clean submissions to seo_actions (not post-submit-error or skipped/failed)
- 11-01: Brain prompt explicitly tells brain NOT to propose directory_submission actions
- 10-01: Named constants for threshold days (7/14/21) instead of inline magic numbers
- 10-01: 21-day escalation processed before 14-day alerts to prevent double-processing
- 10-01: All-clients mode queries distinct client_ids from submissions table
- 09-02: 3 directories (Manta, Hotfrog, CitySquares) require account creation -- flagged REQUIRES_ACCOUNT and skipped
- 09-02: 4 directories eligible for mr-green-turf-clean: EZLocal, iBegin, n49, Tupalo
- 09-02: 18 no_captcha directories found by captcha audit
- 09-01: CLIENT_TRADE_MAP duplicated in Python from page.tsx (no DB trade column)
- 09-01: Post-POST errors mark submitted (not failed) to prevent duplicate submissions
- 09-01: Runtime CAPTCHA detection via JS evaluation catches CAPTCHAs missed by static audit
- 08-02: Trade tags refined to 5 categories (pressure_washing, turf, landscaping, home_services, seo_agency)
- 08-02: Agency directories (Clutch, DesignRush) tagged seo_agency -- only Echo Local sees them
- 08-02: CLIENT_TRADE_MAP in page.tsx rather than DB column -- simple, no migration
- 08-02: Irrelevant directories disabled rather than deleted (preserves submission records)
- 08-03: Discovery protects existing non-pending submissions from overwrite during upsert
- 08-03: CAPTCHA detection uses static HTML only -- JS-rendered CAPTCHAs flagged for manual review
- 08-03: reCAPTCHA v2 = simple_captcha; v3/hCaptcha/Turnstile = advanced_captcha
- 08-01: Hybrid tier system (Tier 1 manual-only DA 50+, Tier 2 semi-auto DA 30-50, Tier 3 auto-eligible DA 10-30)
- 08-01: 55 directories split 15/20/20 across tiers with trade tags for home services
- 08-01: same_as_urls from clients.json auto-create existing_needs_review submissions
- 08-01: Supabase Management API used for migrations (no psql/CLI needed)
- 5 phases (8-12) derived from 20 requirements across 5 categories
- Brain Integration kept as separate Phase 11 despite only 2 requirements -- distinct Python layer
- DASH-03 (Tier 1/2 recommendations) grouped with Dashboard phase -- display-only, no automation risk
- Phase 11 can start after Phase 9 (does not need Phase 10 verification data)

Carried from v1.1:
- GLOBAL_MONTHLY_LIMIT for Brave set to 800 (conservative under $5/1k pricing)
- Brave Search free tier eliminated Feb 2026. $5 credit with metered billing at $5/1k queries.
- [Phase 10-verification-loop]: 21-day escalation before 14-day alerts to prevent double-processing

### Pending Todos

None yet.

### Blockers/Concerns

- Instantly API key returned 401 on 2026-03-08 (unrelated to v1.2)

## Session Continuity

Last session: 2026-03-11
Stopped at: Completed 12-01-PLAN.md (Directories tab -- Phase 12 complete, v1.2 complete)
Resume file: None
