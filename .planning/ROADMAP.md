# Roadmap: GEO Module for SEO Engine

## Overview

Add Generative Engine Optimization to the existing SEO engine. v1.0 built the data foundation (SerpAPI, GEO scoring, brain integration, entity building). v1.1 extends with mention tracking via Brave Search, surfaces all GEO data in the dashboard, and cleans up v1.0 tech debt.

## Milestones

- v1.0 **GEO Module** -- Phases 1-4 (shipped 2026-03-10)
- v1.1 **Mention Tracking + GEO Dashboard** -- Phases 5-7 (in progress)

## Phases

<details>
<summary>v1.0 GEO Module (Phases 1-4) -- SHIPPED 2026-03-10</summary>

- [x] Phase 1: SerpAPI Foundation (2/2 plans) -- completed 2026-03-10
- [x] Phase 2: GEO Scoring + AI Overview Detection (2/2 plans) -- completed 2026-03-10
- [x] Phase 3: Brain Integration + Content Upgrades (2/2 plans) -- completed 2026-03-10
- [x] Phase 4: Entity + Authority Building (2/2 plans) -- completed 2026-03-10

See: milestones/v1.0-ROADMAP.md for full details

</details>

### v1.1 Mention Tracking + GEO Dashboard

- [ ] **Phase 5: Brave Infrastructure + Mention Tracking + Tech Debt** - Brave client, Reddit mining, cross-platform mentions, competitor AIO monitoring, and v1.0 debt cleanup
- [ ] **Phase 6: GEO Dashboard (Existing Data)** - GEO scores, citation status, budget gauge, and snippet tracker using data already in Supabase
- [ ] **Phase 7: Trends + Source Diversity** - Citation trend charts and source diversity scoring/visualization using accumulated Phase 5 data

## Phase Details

### Phase 5: Brave Infrastructure + Mention Tracking + Tech Debt
**Goal**: The engine collects mention data from across the web and all v1.0 tech debt is resolved, so data accumulates while dashboard work proceeds in parallel
**Depends on**: Phase 4
**Requirements**: INFRA-01, INFRA-02, MENT-01, MENT-02, MENT-04, DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. Brave Search client makes API calls with budget gating and rate limiting, and usage is tracked in Supabase with monthly caps (mirroring serpapi_client.py pattern)
  2. Running the SEO engine on research days returns relevant Reddit questions for each client's niche via Brave `site:reddit.com` queries
  3. Cross-platform mention tracking finds client name mentions across directories, forums, and review sites, stored in Supabase
  4. Competitor AI Overview citations are parsed from existing SERP data for target keywords with zero additional API calls
  5. content_validator.py uses 40-60 word range, inject_organization_on_all_pages() is wired into runtime, and same_as_urls are populated for all active clients
**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md -- Brave client + Supabase table + tech debt fixes + same_as_urls
- [ ] 05-02-PLAN.md -- Reddit mining + mention tracking + competitor AIO parsing

### Phase 6: GEO Dashboard (Existing Data)
**Goal**: Brian and clients can see GEO scores, citation status, API budget, and snippet ownership in the dashboard without writing SQL
**Depends on**: Phase 4 (reads v1.0 Supabase tables; no dependency on Phase 5)
**Requirements**: DASH-01, DASH-02, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Each client page shows its GEO score (0-5), which factors are missing, and score trend over time in a dashboard GEO tab
  2. Each tracked keyword shows AI Overview citation status (cited / not cited / no AI Overview) in the dashboard
  3. SerpAPI budget gauge shows searches used vs remaining this month, updating after each engine run
  4. Featured Snippet ownership is displayed per keyword showing whether the client or a competitor holds it
**Plans:** 2 plans

Plans:
- [ ] 06-01-PLAN.md -- Data layer + GEO tab scaffold (types, data fetching, score display + factor breakdown)
- [ ] 06-02-PLAN.md -- Citation status table, budget gauge, snippet ownership, trend sparklines

### Phase 7: Trends + Source Diversity
**Goal**: Brian can prove GEO ROI over time with citation trend charts and see which platforms mention each client
**Depends on**: Phase 5 (mention data accumulated), Phase 6 (dashboard foundation and GEO tab exist)
**Requirements**: MENT-03, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. AI Overview citation trends are charted as weekly snapshots, showing citation gains/losses over time per keyword
  2. Each client has a source diversity score reflecting how many platform types (directories, forums, review sites, social) mention the business
  3. Source diversity visualization in the dashboard shows which specific platforms mention the client and which platform types are missing
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases 5 and 6 can run in parallel (different layers: Python backend vs Next.js frontend). Phase 7 requires both.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. SerpAPI Foundation | v1.0 | 2/2 | Complete | 2026-03-10 |
| 2. GEO Scoring + AI Overview Detection | v1.0 | 2/2 | Complete | 2026-03-10 |
| 3. Brain Integration + Content Upgrades | v1.0 | 2/2 | Complete | 2026-03-10 |
| 4. Entity + Authority Building | v1.0 | 2/2 | Complete | 2026-03-10 |
| 5. Brave Infra + Mention Tracking + Tech Debt | v1.1 | 0/2 | Planning complete | - |
| 6. GEO Dashboard (Existing Data) | v1.1 | 0/2 | Planning complete | - |
| 7. Trends + Source Diversity | v1.1 | 0/TBD | Not started | - |
