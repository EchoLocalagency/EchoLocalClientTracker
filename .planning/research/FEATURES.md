# Feature Research: v1.1 Mention Tracking + GEO Dashboard

**Domain:** GEO mention tracking and dashboard visualization for local SEO engine
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH

## Context

v1.0 shipped with all backend GEO infrastructure: SerpAPI client, AI Overview detection, citation matching, GEO scorer (5-factor binary checklist), brain integration, content upgrades, entity building. All data flows into Supabase (`geo_scores`, `serp_features`, `serpapi_usage` tables).

v1.1 focuses on two gaps:
1. **Mention Tracking** -- where does the client appear online? Reddit questions, brand mentions, source diversity.
2. **GEO Dashboard** -- making the collected GEO data visible in the Next.js dashboard instead of only existing in brain prompts and Supabase.

## Feature Landscape

### Table Stakes (Users Expect These)

Features Brian and clients assume exist once "GEO" is mentioned in the dashboard. Missing these = the dashboard feels incomplete and v1.0 data stays invisible.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| GEO scores visible per page (DASH-01) | v1.0 computes scores daily but they only show in brain prompts. Brian has no way to see them without SQL queries. | LOW | Read-only query against `geo_scores` table (page_path, score/5, factors, scored_at). Render as Recharts bar chart, color-coded by score. Data already exists and is populated daily. |
| AI Overview citation status per keyword (DASH-02) | The core GEO metric. Without seeing which keywords trigger AI Overviews and whether the client is cited, v1.0's value is invisible. | LOW | Query `serp_features` table (has_ai_overview, client_cited_in_ai_overview, keyword). Render as sortable table with green/red status indicators. No new data collection needed. |
| SerpAPI budget usage indicator (DASH-05) | Brian manually runs `check_budget()` in Python. At $25/mo with 4 clients scaling to potentially more, silent budget exhaustion would kill the engine. | LOW | Query `serpapi_usage` count for current month + call `check_account_balance()`. Simple progress bar: X/950 global, X/200 per client. No new infrastructure. |
| Featured Snippet ownership tracker (DASH-06) | `serp_features` already tracks `has_featured_snippet`, `featured_snippet_holder`, `client_has_snippet`. Not surfacing this wastes data the engine already collects. | LOW | Filterable table: keyword, snippet holder domain, client owns Y/N. Show only keywords where snippets exist. Pure frontend read. |
| Reddit question mining via Brave Search (MENT-01) | Existing `reddit.py` uses Reddit API auth. Per PROJECT.md, "Reddit API auth blocked, Brave site:reddit.com search works fine." Current module is dead code. Brave path is the decided approach. | MEDIUM | Replace `reddit.py` internals with Brave Search queries (`site:reddit.com "artificial turf cleaning" OR "turf odor"`). Parse results for question-format titles. Store in new `reddit_questions` Supabase table. Brave API pattern already proven in `brand_mentions.py`. |

### Differentiators (Competitive Advantage)

Features that make this internal tool genuinely useful beyond what commercial GEO tools ($200-500/mo) provide. The value is integration with the brain + zero marginal API cost for dashboard features.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI Overview citation trends chart (DASH-03) | Shows movement over time: "2 weeks ago 0 citations, now 3." This is the ROI proof for GEO work. Commercial tools charge $200+/mo for this. Our data is free -- already in `serp_features` with timestamps. | MEDIUM | Query `serp_features` grouped by week. Recharts LineChart: two lines (total keywords with AIO, keywords where client is cited). Needs 2-4 weeks of historical data. v1.0 has been collecting since late February -- data should be sufficient now. |
| Cross-platform mention tracking (MENT-02) | Track where the client's brand appears beyond their own site: Reddit, Yelp, directories, forums, news. AI models build an "authority graph" from these mentions. Commercial tools charge $100+/mo. | MEDIUM | Extend `brand_mentions.py` pattern (already uses Brave Search + domain extraction + deduplication) to search for each client's brand name. Store in new `brand_mentions` table (platform, url, domain, title, found_at). Run weekly with research. |
| Source diversity scoring (MENT-03) | AI Overviews cite 13+ sources on average. If a client only appears on their own domain, AI won't cite them. A "source diversity score" measuring distinct platform presence gives the brain a new optimization signal. Reddit alone accounts for 3 of every 100 AI citations. | MEDIUM | Count distinct platform categories mentioning client (from MENT-02 data). Score: 0-2 platforms = poor (0-3), 3-5 = moderate (4-6), 6+ = strong (7-10). Store in `source_diversity_scores` table. Brain uses this to prioritize outreach signals. |
| Source diversity visualization (DASH-04) | Visual breakdown of where the client appears online: pie chart showing Reddit, Yelp, directories, news, forums. Makes the abstract diversity score tangible and client-presentable. | LOW | Depends on MENT-02 data. Recharts PieChart grouping mentions by platform category. Only meaningful after mention tracking has run 2+ cycles. |
| Competitor AI Overview monitoring (MENT-04) | For each tracked keyword, show which competitors ARE cited in AI Overviews. "For 'turf cleaning Poway', HomeAdvisor and TurfCleanSD are cited but you aren't." Directly actionable intelligence at zero API cost. | MEDIUM | `serp_features.ai_overview_references` already stores the full list of cited URLs per keyword (JSONB). Parse these to extract competitor domains, count frequency, rank by citation share. No new API calls -- just data transformation. Dashboard table view. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time AI Overview monitoring | "Know the moment we get cited" | Would burn 950 SerpAPI searches/mo in hours. At 20 keywords checked 3x/day = budget gone in 16 days. Explicitly out of scope in PROJECT.md. | Weekly SERP checks (Wed + Sat research runs). Trends chart shows movement without real-time cost. |
| ChatGPT/Perplexity citation tracking | Commercial tools track 10+ AI platforms | No public API for ChatGPT citations. Perplexity API unreliable (PROJECT.md: out of scope). Would require $200+/mo third-party tool. | Focus on Google AI Overviews (88% search market share). SerpAPI gives structured data for this. Other platforms lack reliable APIs. |
| Reddit/Quora answer posting automation | "Auto-reply to relevant threads" | ToS violation. Ban risk. Explicitly out of scope in PROJECT.md. Destroys trust if discovered. | Surface Reddit questions to the brain as content inspiration. Brain suggests blog topics or FAQ entries. Brian answers manually if desired. |
| Sentiment analysis of mentions | Commercial tools score positive/neutral/negative | Requires LLM call per mention (cost scales with volume). For 2-4 local service clients, mention volume is ~5-15/month -- Brian can read them. Complexity not justified. | Track mention existence and platform. Let Brian read context manually. Add sentiment only if mention volume exceeds 50/month per client. |
| Multi-platform AI visibility aggregate score | Tools like Profound/Peec score visibility across all LLMs | Requires API access to each platform ($200-500/mo combined). These tools target enterprise SaaS with $10K+/mo budgets. Overkill for 4 local service clients. | Google AI Overview citation rate is the single metric that matters for local service SEO. Track that one thing well at $25/mo. |
| YouTube transcript optimization | Some GEO guides recommend YouTube presence | No YouTube presence for current clients (PROJECT.md: out of scope). Building YouTube content is a business decision, not a dashboard feature. | Revisit only if a client starts YouTube. |
| Full GEO scoring parity with Frase/Surfer | "Match their 100-point scoring system" | Their scores use proprietary NLP models and massive datasets. Replicating them is impossible and unnecessary. | v1.0's 5-factor binary checklist already works for relative page ranking. Good enough for the brain to prioritize. |

## Feature Dependencies

```
[MENT-01: Reddit Mining via Brave]
    (independent -- no deps, reuses existing Brave API pattern from brand_mentions.py)

[MENT-02: Cross-platform Mentions]
    └──requires──> Brave Search API (already configured, pattern in brand_mentions.py)
    └──feeds──> [MENT-03: Source Diversity Scoring]
                    └──feeds──> [DASH-04: Source Diversity Viz]

[MENT-04: Competitor AIO Monitoring]
    └──requires──> serp_features.ai_overview_references (already collected in v1.0)
    (independent of MENT-01/02/03)

[DASH-01: GEO Scores Display]
    └──requires──> geo_scores table (already populated daily by v1.0 geo_scorer.py)

[DASH-02: AIO Citation Status]
    └──requires──> serp_features table (already populated by v1.0 serp_scraper.py)

[DASH-03: Citation Trends Chart]
    └──requires──> serp_features historical data (2-4 weeks needed, available since late Feb)
    └──enhances──> [DASH-02]

[DASH-05: Budget Indicator]
    └──requires──> serpapi_usage table (already populated by v1.0 serpapi_client.py)

[DASH-06: Snippet Tracker]
    └──requires──> serp_features table (already populated by v1.0)
```

### Dependency Notes

- **DASH-01/02/05/06 have zero backend dependencies:** All read from existing Supabase tables populated by v1.0. Pure frontend work. Can be built in parallel or any order.
- **MENT-03 requires MENT-02:** Can't score source diversity without mention data to count platforms. Build MENT-02 first, let it run 1-2 weeks, then add scoring.
- **DASH-04 requires MENT-03:** Can't visualize source diversity without the scoring data.
- **DASH-03 needs historical data:** The trends chart requires 2-4 weeks of `serp_features` rows. v1.0 has been collecting since late February 2026, so sufficient data likely exists.
- **MENT-01 is fully independent:** Reddit mining via Brave has no dependencies on other new features. Can be built anytime.
- **MENT-04 is fully independent:** Competitor monitoring parses existing `ai_overview_references` JSONB data. No new API calls needed.

## MVP Definition

### Phase 1: Dashboard (v1.1a) -- Make Existing Data Visible

Pure frontend. No new APIs, no new Python code. All data already in Supabase.

- [ ] DASH-01: GEO scores per page display -- Brian sees what the brain sees
- [ ] DASH-02: AI Overview citation status per keyword -- core GEO metric visible
- [ ] DASH-05: SerpAPI budget usage progress bar -- prevents silent budget exhaustion
- [ ] DASH-06: Featured Snippet ownership table -- surfaces already-collected data

### Phase 2: Mention Tracking Backend (v1.1b) -- New Data Collection

New Python modules extending existing patterns. Creates the data for Phase 3.

- [ ] MENT-01: Reddit question mining via Brave Search -- replaces dead `reddit.py` Reddit API code
- [ ] MENT-02: Cross-platform mention tracking -- extends `brand_mentions.py` to per-client tracking
- [ ] MENT-04: Competitor AIO monitoring -- parse existing `ai_overview_references` data

### Phase 3: Scoring + Visualization (v1.1c) -- After Data Accumulates

Depends on Phase 2 data running for 1-2 weeks.

- [ ] MENT-03: Source diversity scoring -- needs MENT-02 mention data accumulated
- [ ] DASH-03: Citation trends chart -- needs serp_features history (likely already sufficient)
- [ ] DASH-04: Source diversity visualization -- needs MENT-03 scores

### Future (v1.2+)

- [ ] Sentiment analysis of mentions -- only if mention volume exceeds 50/month per client
- [ ] ChatGPT/Perplexity tracking -- only when reliable APIs exist or client demand justifies cost
- [ ] Multi-platform AI visibility aggregate score -- enterprise feature, not needed at current scale

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DASH-01: GEO Scores Display | HIGH | LOW | P1 |
| DASH-02: AIO Citation Status | HIGH | LOW | P1 |
| DASH-05: Budget Indicator | HIGH | LOW | P1 |
| DASH-06: Snippet Tracker | MEDIUM | LOW | P1 |
| MENT-01: Reddit Mining (Brave) | HIGH | MEDIUM | P1 |
| MENT-02: Cross-platform Mentions | HIGH | MEDIUM | P1 |
| MENT-04: Competitor AIO Monitoring | HIGH | MEDIUM | P1 |
| DASH-03: Citation Trends Chart | HIGH | MEDIUM | P2 |
| MENT-03: Source Diversity Score | MEDIUM | MEDIUM | P2 |
| DASH-04: Source Diversity Viz | MEDIUM | LOW | P2 |

**Priority key:**
- P1: Must have for v1.1 -- dashboard reads + mention tracking backend
- P2: Add after P1 data has accumulated 1-2 weeks

## Competitor Feature Analysis

| Feature | Commercial GEO Tools ($200-500/mo) | This Build ($25/mo SerpAPI + free Brave) | Tradeoff |
|---------|-----------------------------------|-----------------------------------------|----------|
| AI Overview citation tracking | Multi-platform (ChatGPT, Gemini, Perplexity, Google) | Google AI Overviews only via SerpAPI | Google = 88% of search. Others lack reliable APIs. Sufficient for local service businesses. |
| Brand mention monitoring | Real-time, 10+ platforms, sentiment scoring | Weekly Brave Search, major platforms, no sentiment | Volume too low (5-15 mentions/mo per client) to justify real-time. Weekly is fine. |
| Competitor analysis | Full competitor domains, share of voice scoring | Parse existing `ai_overview_references` for competitor URLs | Data already collected. Zero extra API cost. Just parse and display. |
| Source diversity | Automated scoring across web presence | Brave Search-based platform counting | Same core metric, different data source. Brave API is free-tier viable. |
| Dashboard | Polished multi-tenant SaaS with role-based access | Internal Next.js dashboard (existing tab system) | Only Brian + clients use it. Functional beats pretty. |
| Reddit intelligence | Dedicated monitoring with sentiment + engagement metrics | Brave Search `site:reddit.com` queries | Brave indexes Reddit well. Sufficient for question discovery. |
| Trends/history | Real-time continuous monitoring | Weekly snapshots on research days (Wed + Sat) | Budget-conscious. Trends still visible over weeks/months. |

## Key Implementation Notes

**Existing infrastructure to leverage:**
- `brand_mentions.py` already has the Brave Search API pattern (headers, rate limiting, domain extraction, link verification)
- `geo_data.py` already formats GEO scores and SERP features for the brain -- dashboard queries can mirror these exact functions
- `SeoTabNav.tsx` tab system is extensible -- add "GEO" tab ID alongside existing `clients | actions | brain | keywords`
- `serp_features.ai_overview_references` JSONB column already stores competitor citation URLs -- MENT-04 is a parse, not a fetch
- Recharts is already installed and used in the dashboard
- `SeoEngineTabId` type in `types.ts` needs a new union member

**New Supabase tables needed:**
- `reddit_questions` -- client_id, title, url, subreddit, search_term, found_at (for MENT-01)
- `client_mentions` -- client_id, platform, url, domain, title, context, found_at (for MENT-02, extends current brand_mentions.py which tracks Echo Local mentions to also track client brand mentions)
- `source_diversity_scores` -- client_id, score (0-10), platform_counts JSONB, scored_at (for MENT-03)

**No new external APIs required.** Everything uses existing SerpAPI (data already collected) and Brave Search API (already in `.env`, proven in `brand_mentions.py`).

**Dashboard architecture:**
- New "GEO" tab in SeoTabNav with sub-sections (scores, citations, budget, snippets, trends, diversity)
- Or split into two tabs: "GEO Scores" + "Mentions" to keep each focused
- All components are client-side Supabase reads -- no API routes needed
- Follow existing pattern: `useEffect` on activeClient change, query Supabase, render with Recharts

## Tech Debt to Address in This Milestone

Per PROJECT.md, three items should be cleaned up alongside new features:

| Debt Item | Impact | Recommended Fix |
|-----------|--------|-----------------|
| `content_validator.py` capsule word count (50-150) vs brain rule (40-60) | Brain and validator disagree on valid capsule length, causing false positives/negatives | Align to 40-80 words (brain's lower bound, wider upper bound for flexibility) |
| `inject_organization_on_all_pages()` defined but never called | Dead code in schema_injector, confusing | Wire into seo_loop.py research cycle or delete if Organization schema is handled elsewhere |
| `same_as_urls` empty in clients.json | Organization schema has empty sameAs array, weakens entity signals for AI citation | Populate with actual GBP, Yelp, BBB, social URLs for each client |

## Sources

- [Search Engine Land: Mastering GEO in 2026](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142) -- GEO best practices, mention tracking patterns (MEDIUM confidence)
- [ReplyAgent: Reddit GEO Guide](https://www.replyagent.ai/blog/reddit-geo-generative-engine-optimization-guide) -- Reddit's role in AI citations, 450% growth in Reddit citations (MEDIUM confidence)
- [Averi: How to Track AI Citations](https://www.averi.ai/how-to/how-to-track-ai-citations-and-measure-geo-success-the-2026-metrics-guide) -- Citation tracking metrics framework (MEDIUM confidence)
- [Otterly: State of AI Search 2025](https://otterly.ai/blog/ai-search-study-2025/) -- AI citation statistics, source diversity data (MEDIUM confidence)
- [UseOmnia: AI Search Monitoring Tools 2026](https://www.useomnia.com/blog/ai-search-monitoring-tools) -- Commercial tool comparison, pricing (MEDIUM confidence)
- [AnswerSignals: Track Competitor Citations](https://answersignals.org/llm-visibility/track-competitor-citations-ai-search-responses-2026-guide) -- Competitor monitoring patterns (MEDIUM confidence)
- [SE Ranking: AI Visibility Tools 2026](https://visible.seranking.com/blog/best-ai-visibility-tools/) -- Tool landscape survey (MEDIUM confidence)
- [Search Engine Journal: Enterprise SEO and AI Trends 2026](https://www.searchenginejournal.com/key-enterprise-seo-and-ai-trends/532337/) -- Source diversity importance (MEDIUM confidence)
- Existing codebase: `brand_mentions.py`, `reddit.py`, `geo_scorer.py`, `geo_data.py`, `serpapi_client.py`, `serp_scraper.py`, `SeoTabNav.tsx`, Supabase schemas (HIGH confidence)

---
*Feature research for: v1.1 Mention Tracking + GEO Dashboard*
*Researched: 2026-03-10*
