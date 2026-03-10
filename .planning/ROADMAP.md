# Roadmap: GEO Module for SEO Engine

## Overview

Add Generative Engine Optimization to the existing SEO engine. Measurement-first approach: build data foundation, score citation-readiness, let the brain act on it, then surface everything in the dashboard.

## Milestones

- v1.0 **GEO Module** -- Phases 1-4 (shipped 2026-03-10)
- Phase 5: Mention Tracking (planned)
- Phase 6: GEO Dashboard (planned)

## Phases

<details>
<summary>v1.0 GEO Module (Phases 1-4) -- SHIPPED 2026-03-10</summary>

- [x] Phase 1: SerpAPI Foundation (2/2 plans) -- completed 2026-03-10
- [x] Phase 2: GEO Scoring + AI Overview Detection (2/2 plans) -- completed 2026-03-10
- [x] Phase 3: Brain Integration + Content Upgrades (2/2 plans) -- completed 2026-03-10
- [x] Phase 4: Entity + Authority Building (2/2 plans) -- completed 2026-03-10

See: milestones/v1.0-ROADMAP.md for full details

</details>

### Phase 5: Mention Tracking
**Goal**: The engine knows where clients are mentioned online and identifies Reddit/forum opportunities for manual engagement
**Depends on**: Phase 1
**Requirements**: MENT-01, MENT-02, MENT-03, MENT-04
**Success Criteria** (what must be TRUE):
  1. Reddit question mining via Brave Search `site:reddit.com` returns relevant local service questions for each client's niche
  2. Cross-platform mention tracking finds client mentions across directories, forums, and review sites
  3. Each client has a source diversity score showing how many platform types mention the business
  4. Competitor AI Overview citations are tracked for the same target keywords (who gets cited instead)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: GEO Dashboard
**Goal**: All GEO data from Phases 1-5 is visible in the Next.js dashboard so clients and Brian can see citation-readiness and AI visibility at a glance
**Depends on**: Phase 2, Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Each client page shows its GEO score, missing factors, and score trend over time in the dashboard
  2. Each tracked keyword shows AI Overview citation status (cited / not cited / no AI Overview)
  3. AI Overview citation trends are charted as weekly snapshots over time
  4. Source diversity is visualized showing which platforms mention the client
  5. SerpAPI budget usage shows searches used vs remaining this month
  6. Featured Snippet ownership is displayed per keyword (client vs competitor)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. SerpAPI Foundation | v1.0 | 2/2 | Complete | 2026-03-10 |
| 2. GEO Scoring + AI Overview Detection | v1.0 | 2/2 | Complete | 2026-03-10 |
| 3. Brain Integration + Content Upgrades | v1.0 | 2/2 | Complete | 2026-03-10 |
| 4. Entity + Authority Building | v1.0 | 2/2 | Complete | 2026-03-10 |
| 5. Mention Tracking | -- | 0/TBD | Not started | - |
| 6. GEO Dashboard | -- | 0/TBD | Not started | - |
