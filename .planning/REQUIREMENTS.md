# Requirements: GEO Module for SEO Engine

**Defined:** 2026-03-10
**Core Value:** The brain knows which pages are citation-ready and which aren't, and prioritizes making uncitable content citable.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### SerpAPI Foundation

- [x] **SERP-01**: SerpAPI client module replaces Apify SERP scraper with structured results (organic, AI Overview, PAA, Featured Snippets) in a single API call
- [x] **SERP-02**: Per-client monthly usage tracking in Supabase with hard cap at 200 searches/client/month and 950 global
- [x] **SERP-03**: Usage counter checked before every API call; hard-stop when cap reached (no silent overages)
- [x] **SERP-04**: SerpAPI Account API integration for free usage verification (no credit cost to check remaining balance)
- [x] **SERP-05**: AI Overview detection per tracked keyword (knows which queries trigger AI Overviews)
- [x] **SERP-06**: AI Overview citation check (knows if client URL appears in AI Overview references)
- [x] **SERP-07**: Two-step AI Overview fetch handles page_token expiration (60-second window) correctly
- [x] **SERP-08**: PAA extraction returns structured question + answer data from SerpAPI related_questions field
- [x] **SERP-09**: Featured Snippet tracking (who holds the snippet for each target keyword)

### GEO Scoring

- [x] **GEO-01**: GEO scorer analyzes local HTML pages for citation-readiness signals (answer blocks, stats density, schema presence, heading structure, freshness)
- [x] **GEO-02**: Score stored per page in Supabase geo_scores table with timestamp for trend tracking
- [x] **GEO-03**: Scoring runs daily as part of data collection step (zero API cost -- local analysis only)
- [x] **GEO-04**: Baseline capture: 2-4 weeks of GEO scores + AI Overview data collected before brain acts on them
- [x] **GEO-05**: Score starts as binary checklist (0-5 factors present) not weighted formula; validated against citation data after 30+ data points

### Brain Integration

- [x] **BRAIN-01**: Brain prompt includes GEO scores as compact table rows (page, score, missing factors) within 3000-char budget for all GEO sections
- [x] **BRAIN-02**: Brain can recommend geo_content_upgrade action type to fix low-scoring pages
- [x] **BRAIN-03**: Brain factors AI Overview citation data into daily action prioritization
- [x] **BRAIN-04**: Brain prioritizes pages that are striking-distance AND low GEO score (highest ROI)

### Content Upgrades

- [x] **CONT-01**: Enhanced answer capsules: 40-60 word self-contained answers after first H2, formatted for AI extraction
- [x] **CONT-02**: Blog engine generates new posts with citation-ready structure by default (answer blocks, stats, lists, comparison tables)
- [x] **CONT-03**: page_edit action can retrofit existing pages with answer blocks and improved heading structure
- [x] **CONT-04**: FAQ schema applied aggressively to pages with question-format content (extends existing schema_injector)

### Entity Building

- [ ] **ENT-01**: Organization schema with sameAs links injected on all client pages (GBP, Yelp, BBB, social profiles)
- [ ] **ENT-02**: sameAs URLs configurable per client in clients.json
- [ ] **ENT-03**: Topical authority completeness score per content cluster (extends cluster_manager)
- [ ] **ENT-04**: Question-to-content matching maps PAA questions to existing pages and identifies gaps

### Mention Tracking

- [ ] **MENT-01**: Reddit question mining via Brave Search site:reddit.com (replaces broken Reddit API module)
- [ ] **MENT-02**: Cross-platform mention tracking via Brave Search (directories, forums, review sites)
- [ ] **MENT-03**: Source diversity score per client (how many platform types mention the business)
- [ ] **MENT-04**: Competitor AI Overview monitoring (which competitors get cited for target keywords)

### Dashboard

- [ ] **DASH-01**: GEO scores visible per page in Next.js dashboard (score, missing factors, trend)
- [ ] **DASH-02**: AI Overview citation status per keyword (cited/not cited/no AI Overview)
- [ ] **DASH-03**: AI Overview citation trends chart (weekly snapshots over time)
- [ ] **DASH-04**: Source diversity visualization (which platforms mention the client)
- [ ] **DASH-05**: SerpAPI budget usage indicator (searches used / remaining this month)
- [ ] **DASH-06**: Featured Snippet ownership tracker (client vs competitor per keyword)

## v2 Requirements

Deferred to future release.

### Advanced Budget

- **BUDG-01**: Smart SerpAPI budget allocation weighted by keyword value (impressions, position, AI Overview presence)
- **BUDG-02**: Auto-reduce frequency when approaching monthly cap instead of hard-stop

### Multi-Platform Tracking

- **MULT-01**: Perplexity citation tracking (when API stabilizes)
- **MULT-02**: ChatGPT citation tracking (if reliable method emerges)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Perplexity API integration | Only tracks Perplexity, not worth cost for partial coverage |
| ChatGPT citation tracking | No public API, results inconsistent |
| Automated Reddit/Quora posting | ToS violation, ban risk |
| YouTube transcript optimization | No YouTube presence for current clients |
| Real-time AI visibility dashboard | Would burn SerpAPI budget in days |
| Full commercial GEO scoring parity | Proprietary models, unnecessary for local service businesses |
| Multi-language GEO | English only, current client base |
| Reddit API integration | Auth issues, replaced by Brave Search |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SERP-01 | Phase 1 | Complete |
| SERP-02 | Phase 1 | Complete |
| SERP-03 | Phase 1 | Complete |
| SERP-04 | Phase 1 | Complete |
| SERP-05 | Phase 2 | Complete |
| SERP-06 | Phase 2 | Complete |
| SERP-07 | Phase 2 | Complete |
| SERP-08 | Phase 2 | Complete |
| SERP-09 | Phase 2 | Complete |
| GEO-01 | Phase 2 | Complete |
| GEO-02 | Phase 2 | Complete |
| GEO-03 | Phase 2 | Complete |
| GEO-04 | Phase 2 | Complete |
| GEO-05 | Phase 2 | Complete |
| BRAIN-01 | Phase 3 | Complete |
| BRAIN-02 | Phase 3 | Complete |
| BRAIN-03 | Phase 3 | Complete |
| BRAIN-04 | Phase 3 | Complete |
| CONT-01 | Phase 3 | Complete |
| CONT-02 | Phase 3 | Complete |
| CONT-03 | Phase 3 | Complete |
| CONT-04 | Phase 3 | Complete |
| ENT-01 | Phase 4 | Pending |
| ENT-02 | Phase 4 | Pending |
| ENT-03 | Phase 4 | Pending |
| ENT-04 | Phase 4 | Pending |
| MENT-01 | Phase 5 | Pending |
| MENT-02 | Phase 5 | Pending |
| MENT-03 | Phase 5 | Pending |
| MENT-04 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |
| DASH-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
