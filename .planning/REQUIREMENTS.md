# Requirements: GEO Module v1.1

**Defined:** 2026-03-10
**Core Value:** The brain knows which pages are citation-ready and which aren't, and prioritizes making uncitable content citable -- because AI search is where discovery is shifting.

## v1.1 Requirements

### Infrastructure

- [x] **INFRA-01**: Brave Search client with budget gating, rate limiting, and usage tracking (mirrors serpapi_client.py pattern)
- [x] **INFRA-02**: Brave Search usage stored in Supabase with monthly caps

### Mention Tracking

- [x] **MENT-01**: Reddit question mining via Brave Search `site:reddit.com` returns relevant local service questions per client niche
- [x] **MENT-02**: Cross-platform mention tracking finds client mentions across directories, forums, and review sites
- [ ] **MENT-03**: Each client has a source diversity score showing how many platform types mention the business
- [x] **MENT-04**: Competitor AI Overview citations tracked for target keywords (reuses existing SERP data, zero additional API calls)

### GEO Dashboard

- [x] **DASH-01**: GEO scores visible per page in Next.js dashboard with missing factors and score trend
- [x] **DASH-02**: AI Overview citation status per keyword (cited / not cited / no AI Overview)
- [x] **DASH-03**: AI Overview citation trends charted as weekly snapshots over time
- [ ] **DASH-04**: Source diversity visualization showing which platforms mention the client
- [x] **DASH-05**: SerpAPI budget usage indicator (searches used vs remaining this month)
- [x] **DASH-06**: Featured Snippet ownership displayed per keyword (client vs competitor)

### Tech Debt

- [x] **DEBT-01**: Fix content_validator.py capsule word count range (50-150 -> 40-60)
- [x] **DEBT-02**: Wire inject_organization_on_all_pages() into runtime or remove
- [x] **DEBT-03**: Populate same_as_urls in clients.json for all active clients

## Future Requirements

### Notifications

- **NOTF-01**: Brain alerts when a client loses an AI Overview citation
- **NOTF-02**: Weekly GEO summary email to Brian

### Advanced Tracking

- **ADVT-01**: Perplexity API citation tracking (when API matures)
- **ADVT-02**: ChatGPT citation tracking (when public API available)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Perplexity API integration | Unreliable for citation tracking, revisit when API improves |
| ChatGPT citation tracking | No public API, results inconsistent |
| Reddit/Quora answer posting | ToS violation, ban risk |
| Real-time dashboard updates | Would burn API budgets; daily refresh sufficient |
| Multi-language GEO | English only, current client base |
| YouTube transcript optimization | No YouTube presence for current clients |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 5 | Complete |
| INFRA-02 | Phase 5 | Complete |
| MENT-01 | Phase 5 | Complete |
| MENT-02 | Phase 5 | Complete |
| MENT-03 | Phase 7 | Pending |
| MENT-04 | Phase 5 | Complete |
| DASH-01 | Phase 6 | Complete |
| DASH-02 | Phase 6 | Complete |
| DASH-03 | Phase 7 | Complete |
| DASH-04 | Phase 7 | Pending |
| DASH-05 | Phase 6 | Complete |
| DASH-06 | Phase 6 | Complete |
| DEBT-01 | Phase 5 | Complete |
| DEBT-02 | Phase 5 | Complete |
| DEBT-03 | Phase 5 | Complete |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
