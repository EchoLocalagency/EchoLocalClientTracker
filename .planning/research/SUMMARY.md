# Project Research Summary

**Project:** EchoLocal ClientTracker v1.1 -- Mention Tracking + GEO Dashboard
**Domain:** Local SEO engine extension (mention tracking + dashboard visualization)
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.1 extends the existing ClientTracker SEO engine with two capabilities: (1) tracking where clients appear online via Brave Search API, replacing the broken Reddit OAuth path, and (2) making all the GEO data collected by v1.0 visible in the Next.js dashboard. The good news is that v1.0 already built the hard parts -- SerpAPI integration, GEO scoring, AI Overview detection, and Supabase storage. v1.1 is primarily about surfacing existing data and adding one new data source (Brave Search for mentions). Zero new pip packages, zero new npm packages, one new env var (`BRAVE_API_KEY`).

The recommended approach is to build mention tracking backend first, then dashboard components. Mention tracking needs 1-2 weeks of data accumulation before source diversity scoring and visualization become meaningful. Meanwhile, four dashboard components (GEO scores, citation status, budget gauge, snippet tracker) can be built immediately since they read from tables v1.0 already populates daily. The architecture follows established patterns exactly: Python modules mirror `serpapi_client.py` for budget gating, dashboard components mirror existing Supabase-direct queries with Recharts visualization.

The primary risks are Brave Search budget surprises (free tier is dead -- now $5 credit with metered billing) and breaking the daily SEO loop by inserting new module calls without proper try/except wrapping. Both are preventable with disciplined pattern-following. A shared `brave_client.py` with budget tracking must be built before any new Brave calls. Every new module integration must use the existing non-fatal error wrapping pattern. Secondary risks include Recharts SVG performance with time-series data (solved by weekly aggregation) and Supabase query performance (solved by proper indexing and 90-day default ranges).

## Key Findings

### Recommended Stack

No new dependencies. The entire v1.1 build uses existing installed packages on both Python (`requests`, `supabase-py`, `python-dotenv`) and Next.js (`recharts`, `@supabase/supabase-js`, Tailwind CSS) sides. The only infrastructure addition is the `BRAVE_API_KEY` env var, and the Brave API is already proven in the codebase via `brand_mentions.py`.

**Core technologies (all existing):**
- **Brave Search API** (via raw `requests`): Reddit mining + cross-platform mentions -- replaces broken Reddit OAuth
- **SerpAPI** (existing `serpapi_client.py`): Competitor AI Overview data already collected, just needs parsing
- **Recharts 3.7.0** (already installed): All chart types needed (LineChart, RadialBarChart for gauge, PieChart)
- **Supabase** (existing clients): 1 new table (`client_mentions`), 3 existing tables provide all dashboard data

### Expected Features

**Must have (table stakes):**
- DASH-01: GEO scores visible per page -- data exists, no way to see it without SQL
- DASH-02: AI Overview citation status per keyword -- the core GEO metric, currently invisible
- DASH-05: SerpAPI budget gauge -- prevents silent budget exhaustion at $25/mo
- DASH-06: Featured Snippet tracker -- surfaces already-collected data
- MENT-01: Reddit question mining via Brave -- replaces dead `reddit.py` OAuth code

**Should have (differentiators):**
- MENT-02: Cross-platform mention tracking -- authority signal for AI citation
- MENT-04: Competitor AI Overview monitoring -- zero API cost, parses existing data
- DASH-03: Citation trends chart -- ROI proof over time
- MENT-03: Source diversity scoring -- new optimization signal for the brain

**Defer (v2+):**
- Sentiment analysis of mentions (volume too low to justify)
- ChatGPT/Perplexity citation tracking (no reliable APIs)
- Multi-platform AI visibility aggregate score (enterprise feature)
- YouTube transcript optimization (no client YouTube presence)

### Architecture Approach

The architecture extends the existing 7-step `seo_loop.py` orchestrator without adding new steps. Two new Python modules (`mention_tracker.py`, `competitor_aio_monitor.py`) plug into existing integration points: mention tracking as research step 11 in `research_runner.py` (Wed+Sat only), competitor monitoring as a Step 1c addition reading existing Supabase data. On the dashboard side, a new "GEO" tab in `SeoTabNav` renders a `GeoDashboard` container that fetches from Supabase directly (no API routes) and distributes data to 5 child components.

**Major components:**
1. **`brave_client.py`** (NEW) -- Shared Brave API wrapper with budget gating, rate limiting (1.1s between calls), usage logging to `brave_usage` Supabase table
2. **`mention_tracker.py`** (NEW) -- Brave Search queries for Reddit + cross-platform mentions, source diversity scoring
3. **`competitor_aio_monitor.py`** (NEW) -- Parses existing `ai_overview_references` JSONB for competitor presence, zero API cost
4. **`GeoDashboard.tsx`** (NEW) -- Container component with Supabase data fetching, renders 5 child chart/table components
5. **`brain.py`** (MODIFIED) -- Two new prompt sections (competitor AIO presence, source diversity) with char_budget enforcement

### Critical Pitfalls

1. **Brave Search budget surprise** -- Free tier eliminated Feb 2026. Build `brave_client.py` with budget tracking (mirror `serpapi_client.py` pattern) before any new Brave calls. Hard cap at 500 queries/month. Batch Reddit queries with OR operators.
2. **Breaking the daily loop** -- New module exceptions crash the entire 7-step loop silently. Every new call must use try/except with empty-list fallback. Never make mention data a required param for `call_brain()`.
3. **Recharts SVG performance** -- 17 keywords x 90 days = 1,530 SVG elements per chart. Downsample to weekly aggregates beyond 30 days. Limit visible series to top 5. Use `React.memo` and `'use client'` directive.
4. **Competitor monitoring burning SerpAPI budget** -- Do NOT make new SerpAPI calls. Parse existing `ai_overview_references` data from `serp_features` table. Zero additional API cost.
5. **Empty `same_as_urls` in clients.json** -- Source diversity scoring needs baseline platform presence. Populate URLs for all clients before building the scorer (30 min manual work).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Brave Client + Mention Tracking Backend
**Rationale:** Mention data needs 1-2 weeks to accumulate before dashboard visualization is meaningful. Start data collection first. The shared Brave client with budget gating is a prerequisite for all new Brave API usage.
**Delivers:** Shared Brave API client with budget gating, Reddit question mining via Brave Search, cross-platform mention tracking, competitor AIO analysis (zero-cost), brain prompt integration with new sections.
**Addresses:** MENT-01, MENT-02, MENT-04, `brave_client.py` infrastructure
**Avoids:** Budget surprise (Pitfall 1), loop crashes (Pitfall 2), SerpAPI budget burn (Pitfall 7), rate limiting (Pitfall 8), dedup issues (Pitfall 10)

### Phase 2: GEO Dashboard -- Existing Data
**Rationale:** Four components read from v1.0 tables that are already populated daily. No backend work needed. Can ship immediately while mention data accumulates from Phase 1. This is the phase that makes v1.0's investment visible to Brian and clients.
**Delivers:** GEO tab with score cards, citation status table, budget gauge, snippet tracker. Dashboard foundation (types, tab nav, container component).
**Addresses:** DASH-01, DASH-02, DASH-05, DASH-06
**Avoids:** SSR/CSR mismatch (Pitfall 12), Supabase query perf (Pitfall 3)

### Phase 3: Trends + Source Diversity
**Rationale:** Depends on Phase 1 data accumulating (1-2 weeks) and Phase 2 dashboard foundation existing. Citation trends need historical serp_features data (available from v1.0). Source diversity needs mention data from Phase 1.
**Delivers:** Citation trends chart (ROI proof), source diversity scoring, source diversity visualization.
**Addresses:** DASH-03, MENT-03, DASH-04
**Avoids:** Recharts perf (Pitfall 4), meaningless scores without baseline (Pitfall 6)

### Phase 4: Tech Debt Cleanup
**Rationale:** Independent of feature work. Improves data quality for all features. `same_as_urls` population strengthens entity signals and source diversity baselines.
**Delivers:** Fixed content_validator word count mismatch, wired `inject_organization_on_all_pages()`, populated `same_as_urls` in clients.json.
**Addresses:** Tech debt items from PROJECT.md

### Phase Ordering Rationale

- Phase 1 before Phase 2: Starts data collection early. Mention data needs 1-2 weeks of accumulation. While data builds, Phase 2 dashboard work can proceed.
- Phase 2 before Phase 3: Dashboard container, tab infrastructure, and type definitions must exist before trend charts and diversity panels can be added.
- Phase 3 after 1-2 week gap: Source diversity visualization requires accumulated mention data. Citation trends benefit from more historical data points.
- Phase 4 is independent: Can run alongside any phase. Ideally `same_as_urls` population happens before Phase 1 source diversity scoring, but auto-discovery via Brave is a fallback.
- Phases 1 and 2 can run in parallel if resources allow: they touch different layers (Python backend vs Next.js frontend) with no shared work.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Brave client + mention tracking):** Validate Brave Search `site:reddit.com` coverage for target subreddits (r/lawncare, r/ArtificialTurf) with 5-10 test queries before committing to full module. Also confirm rate limit behavior under combined brand_mentions + mention_tracker load.
- **Phase 3 (Source diversity):** Define scoring rubric with concrete benchmarks. No industry standard exists for home service businesses. Need to establish what "good" looks like by analyzing competitor presence.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Dashboard existing data):** All components are standard Recharts + Supabase reads. Patterns already used in the codebase. Well-documented.
- **Phase 4 (Tech debt):** Straightforward fixes with clear scope from PROJECT.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All tools already in use and verified against official docs. |
| Features | MEDIUM-HIGH | Feature scope well-defined with clear dependency chains. Some uncertainty on source diversity scoring rubric (novel metric). |
| Architecture | HIGH | Extends existing patterns exactly. Code-level integration points identified via direct codebase review. |
| Pitfalls | MEDIUM-HIGH | Budget and loop-stability risks well-understood from codebase analysis. Brave Reddit coverage is the main unknown. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Brave Reddit coverage quality:** Brave's independent index may miss niche subreddits. Validate with test queries before building the full module. If coverage is poor for r/ArtificialTurf, use broader terms rather than subreddit-specific searches.
- **Source diversity benchmarks:** No industry standard for what constitutes "good" source diversity for home service businesses. Establish benchmarks by analyzing competitor presence across platforms during Phase 1.
- **Recharts RadialBarChart gauge:** No production example in this codebase yet. First chart component should validate the gauge pattern (startAngle/endAngle approach).
- **Brave API rate limit enforcement:** Existing `brand_mentions.py` uses 0.4s sleep which is below the documented 1 req/sec limit. Needs testing under combined load before production use.
- **`same_as_urls` population timing:** Ideally populated before Phase 1 source diversity scoring, but classified as Phase 4 tech debt. Consider pulling this task forward as pre-work.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `seo_loop.py`, `serpapi_client.py`, `brand_mentions.py`, `reddit.py`, `geo_scorer.py`, `geo_data.py`, `serp_scraper.py`, `research_runner.py`, `page.tsx`, `SeoTabNav.tsx`, `types.ts`
- [Brave Search API docs](https://brave.com/search/api/) -- endpoints, auth, operators
- [Brave Search operators](https://search.brave.com/help/operators) -- site: operator confirmed working
- [Brave API rate limiting](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting) -- 1/sec free tier
- [Recharts RadialBarChart API](https://recharts.github.io/en-US/api/RadialBarChart/) -- gauge pattern
- [Supabase performance docs](https://supabase.com/docs/guides/platform/performance) -- Postgres tuning

### Secondary (MEDIUM confidence)
- [Brave pricing changes Feb 2026](https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/) -- $5/1k, $5 credit
- [Search Engine Land: GEO 2026](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142) -- mention tracking patterns
- [Otterly: AI Search 2025](https://otterly.ai/blog/ai-search-study-2025/) -- citation statistics, source diversity data
- [Recharts performance patterns](https://belchior.hashnode.dev/improving-recharts-performance-clp5w295y000b0ajq8hu6cnmm) -- memoization, dataKey stability
- [shadcn/ui radial charts](https://ui.shadcn.com/charts/radial) -- gauge implementation examples
- [Supabase analytics limitations](https://www.tinybird.co/blog/can-i-use-supabase-for-user-facing-analytics) -- 500K row performance cliff

### Tertiary (LOW confidence)
- [Reddit scraping post-API](https://medium.com/@arjuns0206/you-dont-need-the-reddit-api-to-acquire-its-data-here-s-how-41ef8f15e1db) -- .json endpoint workaround (may break)

---
*Research completed: 2026-03-10*
*Replaces v1.0 research summary*
*Ready for roadmap: yes*
