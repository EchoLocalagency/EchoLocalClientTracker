# Roadmap: GEO Module for SEO Engine

## Overview

Add Generative Engine Optimization to the existing SEO engine. v1.0 built the data foundation (SerpAPI, GEO scoring, brain integration, entity building). v1.1 extends with mention tracking via Brave Search, surfaces all GEO data in the dashboard, and cleans up v1.0 tech debt. v1.2 adds automated directory submission and tracking -- submitting clients to 30+ niche directories GHL/Yext misses, verifying listings, and surfacing coverage in the dashboard.

## Milestones

- v1.0 **GEO Module** -- Phases 1-4 (shipped 2026-03-10)
- v1.1 **Mention Tracking + GEO Dashboard** -- Phases 5-7 (shipped 2026-03-11)
- v1.2 **Directory Submission & Tracking** -- Phases 8-12 (in progress)

## Phases

<details>
<summary>v1.0 GEO Module (Phases 1-4) -- SHIPPED 2026-03-10</summary>

- [x] Phase 1: SerpAPI Foundation (2/2 plans) -- completed 2026-03-10
- [x] Phase 2: GEO Scoring + AI Overview Detection (2/2 plans) -- completed 2026-03-10
- [x] Phase 3: Brain Integration + Content Upgrades (2/2 plans) -- completed 2026-03-10
- [x] Phase 4: Entity + Authority Building (2/2 plans) -- completed 2026-03-10

See: milestones/v1.0-ROADMAP.md for full details

</details>

<details>
<summary>v1.1 Mention Tracking + GEO Dashboard (Phases 5-7) -- SHIPPED 2026-03-11</summary>

- [x] **Phase 5: Brave Infrastructure + Mention Tracking + Tech Debt** - Brave client, Reddit mining, cross-platform mentions, competitor AIO monitoring, and v1.0 debt cleanup
- [x] **Phase 6: GEO Dashboard (Existing Data)** - GEO scores, citation status, budget gauge, and snippet tracker using data already in Supabase
- [x] **Phase 7: Trends + Source Diversity** - Citation trend charts and source diversity scoring/visualization using accumulated Phase 5 data

</details>

### v1.2 Directory Submission & Tracking

- [x] **Phase 8: Data Foundation + Discovery** - Supabase tables, client profiles, directory master list, CAPTCHA audit, and pre-existing listing detection
- [x] **Phase 9: Submission Engine** - Playwright auto-submission for Tier 3 directories with rate limiting, state machine, NAP audit, and failure capture
- [x] **Phase 10: Verification Loop** - Brave Search site: verification at 7/14/21 day intervals with escalation to Brian (completed 2026-03-11)
- [x] **Phase 11: Brain Integration** - Directory coverage summary in brain prompt and submission logging to seo_actions (completed 2026-03-11)
- [x] **Phase 12: Directory Dashboard** - Directories tab with status grid, tier progress bars, Tier 1/2 recommendations, and backlink value score (completed 2026-03-11)

## Phase Details

### Phase 8: Data Foundation + Discovery
**Goal**: All directory and client data lives in Supabase with dedup protection and CAPTCHA categorization locked in before any automation runs
**Depends on**: Phase 7 (v1.1 complete)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. Each active client has a canonical profile in Supabase with NAP, services, descriptions, certifications, and hours -- and that profile is the single source of truth for all downstream form fills
  2. All 55 directories from the research master list are seeded in Supabase with tier, trade, submission method, DA score, and URL queryable by any combination of those fields
  3. The submission tracking table enforces UNIQUE(client_id, directory_id) so duplicate submissions are impossible at the database level
  4. Running discovery for any client returns which target directories already have a listing for that business, preventing the system from creating conflicting duplicate profiles
  5. Every directory form URL is categorized as no_captcha, simple_captcha, or advanced_captcha so the submission engine knows which directories it can automate
**Plans:** 3 plans
Plans:
- [x] 08-01-PLAN.md -- Schema migration, TypeScript interfaces, seed scripts for client profiles and 55 directories
- [x] 08-02-PLAN.md -- Client profile editor form and directory management UI with CAPTCHA badges
- [x] 08-03-PLAN.md -- Pre-existing listing discovery script and CAPTCHA audit script

### Phase 9: Submission Engine
**Goal**: The system auto-submits client profiles to Tier 3 no-CAPTCHA directories with human-like behavior, rate limiting, and full failure traceability
**Depends on**: Phase 8
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05
**Success Criteria** (what must be TRUE):
  1. Running the submission engine for a client fills and submits forms on Tier 3 no-CAPTCHA directories using Playwright with human-like typing delays and anti-detection, and the submission row updates to submitted status
  2. No client ever exceeds 5 submissions per day or 8 per week regardless of how many directories remain pending -- the rate limiter enforces this as a hard cap
  3. A submission that fails after POST was sent is marked submitted (not retried), and a submission that fails before POST stores a screenshot and error details for debugging
  4. Before each submission, the system verifies the form data matches the canonical client profile exactly -- any NAP mismatch blocks the submission
**Plans:** 2 plans
Plans:
- [x] 09-01-PLAN.md -- Build submission engine with Playwright stealth, rate limiter, state machine, NAP audit, form configs, and screenshot capture
- [x] 09-02-PLAN.md -- Dry-run testing against eligible directories, per-directory overrides, Brian approval checkpoint

### Phase 10: Verification Loop
**Goal**: The system confirms which directory listings went live and escalates stale submissions so nothing falls through the cracks
**Depends on**: Phase 9
**Requirements**: VER-01, VER-02, VER-03, VER-04
**Success Criteria** (what must be TRUE):
  1. After 7 days, each submitted directory listing is checked via Brave Search site: query for the client's presence on that directory domain
  2. Verified listings update to verified status with the live URL stored in the submission record
  3. Submissions still unverified after 14 days trigger an alert to Brian identifying the directory and client
  4. Submissions still unverified after 21 days are marked needs_review for manual investigation, clearly separated from active pending submissions
**Plans:** 1/1 plans complete
Plans:
- [x] 10-01-PLAN.md -- Verification script with Brave Search site: checking, status updates, 14/21-day escalation, and dry-run validation

### Phase 11: Brain Integration
**Goal**: The brain sees current directory coverage per client and all submissions appear in the action log so the brain never duplicates or conflicts with automation work
**Depends on**: Phase 9 (needs submission data to report on)
**Requirements**: BRAIN-01, BRAIN-02
**Success Criteria** (what must be TRUE):
  1. The brain prompt for each client includes a directory_summary section showing X/Y submitted and X/Y verified counts, so the brain knows current coverage without querying separately
  2. Every directory submission appears in the seo_actions table with action_type='directory_submission', visible in the same action log the brain already reads
**Plans:** 1/1 plans complete
Plans:
- [x] 11-01-PLAN.md -- Add get_directory_summary() to outcome_logger, wire into brain prompt, log submissions to seo_actions

### Phase 12: Directory Dashboard
**Goal**: Brian and clients can see directory submission status, tier progress, actionable Tier 1/2 recommendations, and backlink portfolio value in the dashboard without writing SQL
**Depends on**: Phase 10 (needs verified submissions for meaningful display), Phase 11
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. A Directories tab in the dashboard shows a per-client grid of every target directory with color-coded status badges (verified=green, submitted=yellow, pending=grey, rejected=red, skipped=muted)
  2. Tier progress bars show X/Y submitted and X/Y verified per tier for each client, giving an at-a-glance view of coverage depth
  3. Tier 1/2 directories appear as an actionable recommendation checklist per client, clearly marked as requiring client input rather than automation
  4. Each client has a backlink value score calculated as the DA-weighted sum of verified directory listings, showing the SEO value of the directory portfolio
**Plans:** 1/1 plans complete
Plans:
- [x] 12-01-PLAN.md -- DirectoriesTab with status grid, tier progress bars, Tier 1/2 recommendations, and backlink value score

### v1.3 GSC Keyword History

- [ ] **Phase 13: Full GSC Keyword History** - Store ALL GSC queries daily (not top 25), backfill from existing data, update dashboard sparklines/graphs to show full history

### Phase 13: Full GSC Keyword History
**Goal**: Every GSC query ever seen is stored daily with full position/impression/click history, and the dashboard keyword graphs show the complete trajectory from day one
**Depends on**: None (standalone, uses existing infrastructure)
**Requirements**: KWH-01, KWH-02, KWH-03, KWH-04
**Success Criteria** (what must be TRUE):
  1. run_reports.py pulls ALL GSC queries (not top 25) and upserts them daily to gsc_queries without deleting previous data
  2. Existing gsc_queries data is preserved and backfilled where possible
  3. The SeoTab keyword table and sparklines pull from the full history, showing data from the earliest available date
  4. Expanded keyword position graphs show the complete trajectory, not just the last few days
**Plans:** 2 plans
Plans:
- [ ] 13-01-PLAN.md -- Backend: modify pull_gsc to fetch all queries, change push_to_supabase to upsert instead of delete+insert, add unique constraint, backfill
- [ ] 13-02-PLAN.md -- Frontend: update SeoTab queries to use full gsc_queries history for sparklines and expanded charts

## Progress

**Execution Order:**
Phases 8-12 execute sequentially. Phase 11 can start after Phase 9 (does not need Phase 10). Phase 12 needs Phase 10 data for meaningful testing.
Phase 13 is standalone.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. SerpAPI Foundation | v1.0 | 2/2 | Complete | 2026-03-10 |
| 2. GEO Scoring + AI Overview Detection | v1.0 | 2/2 | Complete | 2026-03-10 |
| 3. Brain Integration + Content Upgrades | v1.0 | 2/2 | Complete | 2026-03-10 |
| 4. Entity + Authority Building | v1.0 | 2/2 | Complete | 2026-03-10 |
| 5. Brave Infra + Mention Tracking + Tech Debt | v1.1 | 2/2 | Complete | 2026-03-11 |
| 6. GEO Dashboard (Existing Data) | v1.1 | 2/2 | Complete | 2026-03-11 |
| 7. Trends + Source Diversity | v1.1 | 2/2 | Complete | 2026-03-11 |
| 8. Data Foundation + Discovery | v1.2 | 3/3 | Complete | 2026-03-11 |
| 9. Submission Engine | v1.2 | 2/2 | Complete | 2026-03-11 |
| 10. Verification Loop | v1.2 | 1/1 | Complete | 2026-03-11 |
| 11. Brain Integration | v1.2 | 1/1 | Complete | 2026-03-11 |
| 12. Directory Dashboard | v1.2 | Complete    | 2026-03-12 | 2026-03-11 |
| 13. Full GSC Keyword History | v1.3 | 0/2 | In Progress | - |
