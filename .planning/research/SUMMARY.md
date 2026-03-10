# Project Research Summary

**Project:** GEO Module for SEO Engine
**Domain:** Generative Engine Optimization for local service business SEO automation
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

The GEO module adds AI Overview detection, citation tracking, and citation-readiness scoring to the existing Python SEO engine. The stack is minimal: one new pip package (`google-search-results` for SerpAPI) and one new env var. Everything else builds on existing infrastructure -- Brave Search, Supabase, the brain/loop architecture, and the research-day pattern. The architecture research confirms that GEO should integrate into the existing `seo_loop.py` pipeline rather than run as a separate system. This is an enhancement to the existing engine, not a new product.

The recommended approach is measurement-first. Build the SerpAPI client with hard budget caps before anything else (the $25/month plan gives exactly enough searches for 5 clients with zero margin for waste). Then add GEO scoring as a local-only page analysis tool -- no API cost, immediate visibility into content gaps. Only after 2-4 weeks of baseline data should the brain be given authority to execute GEO content upgrades. This phased approach prevents the top risk: optimizing for a GEO score that has not been validated against actual citation outcomes.

The key risks are budget blowout (SerpAPI's two-step AI Overview detection can silently double costs), brain prompt bloat (adding GEO data to an already large prompt degrades action quality), and vanity metrics (no validated GEO scoring formula exists for local service content). All three are preventable with specific guardrails documented in the pitfalls research: centralized budget tracking, a hard 3000-char prompt budget for GEO sections, and starting with a binary checklist instead of a weighted score.

## Key Findings

### Recommended Stack

The stack is intentionally thin. SerpAPI replaces the existing Apify SERP scraper with a single package that returns AI Overviews, People Also Ask, Featured Snippets, and organic results in one API call -- far more data per credit than Apify. Brave Search is already integrated and handles Reddit question mining and cross-platform mention tracking. No new libraries beyond the SerpAPI SDK.

**Core technologies:**
- `google-search-results` (SerpAPI SDK): AI Overview detection, PAA extraction, Featured Snippet data, organic SERP results -- replaces Apify scraper entirely
- Brave Search API (existing): Reddit question mining, cross-platform mention tracking, source diversity scoring -- already in codebase via `requests`
- Custom GEO scorer (build in-house): 0-100 page scoring based on answer blocks, schema, stats density, structure -- no off-the-shelf library exists and commercial tools ($200-500/mo) are overkill

**Critical version/config:**
- SerpAPI plan: $25/mo for 1000 searches. Hard cap at 200/client/month, 950 global.
- `SERPAPI_KEY` must be added to `.env`

### Expected Features

**Must have (table stakes):**
- AI Overview detection per keyword (SerpAPI `ai_overview` field)
- AI Overview citation tracking (is client domain in references?)
- GEO content score per page (structure, schema, answer blocks)
- Answer block formatting in blog engine (40-60 word self-contained answers)
- FAQ schema injection (aggressive application via existing `schema_injector.py`)
- PAA extraction (structured question data for content targeting)
- Featured snippet tracking (who holds it for target queries)
- SerpAPI budget management with hard caps

**Should have (differentiators):**
- Brain-integrated GEO prioritization (closed-loop: detect, score, fix, measure)
- Topical authority completeness scoring (extends `cluster_manager.py`)
- Entity graph building (Organization schema + sameAs links)
- Question-to-content matching (map PAA questions to existing content gaps)
- Competitor AI Overview monitoring (same SerpAPI data, comparison logic)

**Defer (v2+):**
- Source diversity scoring (lower urgency than on-site optimization)
- Cross-platform mention tracking (valuable but not urgent at 2-4 client scale)
- Dashboard GEO visualization (report after proving value, not before)
- Multi-language GEO, YouTube optimization, Perplexity/ChatGPT tracking (no reliable APIs)

### Architecture Approach

GEO integrates into the existing four-layer pipeline: research (SerpAPI + Brave), data collection (GEO scorer), brain context (new prompt sections), and actions (content upgrades + schema). No new orchestrator. The `seo_loop.py` daily loop gains GEO awareness through new modules that slot into existing steps. Two new Supabase tables (`serpapi_usage` for budget tracking, `geo_scores` for score history) are the only infrastructure additions.

**Major components:**
1. `serpapi_client.py` (NEW) -- centralized SerpAPI wrapper with per-client and global budget caps, usage logging to Supabase
2. `research/serp_api.py` (NEW, replaces `serp_scraper.py`) -- AI Overview detection, PAA, Featured Snippets, organic results via SerpAPI
3. `geo_scorer.py` (NEW) -- local HTML analysis for citation-readiness: answer blocks, stats density, schema presence, heading structure
4. `actions/geo_content.py` (NEW) -- content structure upgrades: enhanced answer capsules, comparison tables, stat-dense formatting
5. `brain.py` (MODIFIED) -- new GEO sections in prompt with hard 3000-char budget; GEO scores as compact table rows, not paragraphs
6. `research/mention_tracker.py` (NEW, absorbs `reddit.py`) -- Brave Search for Reddit questions and cross-platform mentions

### Critical Pitfalls

1. **SerpAPI budget blowout** -- AI Overview detection costs 1-2 searches per keyword (two-step page_token flow). Build the budget tracker as the absolute first deliverable. Hard-stop at 950/month global, 200/client. Only fetch AI Overviews for striking-distance keywords.
2. **Brain prompt token explosion** -- Current prompt is ~10K+ chars. Adding GEO data without a budget will degrade action quality. Cap all GEO sections at 3000 chars. Add data as table columns, not new sections. Only include pages where the brain can act.
3. **No baseline before optimization** -- Without before/after data, GEO work is unjustifiable. Capture AI Overview presence, citation status, and GEO scores for all target keywords before any content changes execute.
4. **AI Overview page_token race condition** -- Token expires in 60 seconds. Must fetch AI Overview immediately after the initial search for each keyword. Never batch searches then batch AI Overview fetches.
5. **GEO score as vanity metric** -- No validated scoring formula exists for local service content. Start with a binary checklist (0-5), validate against real citation data after 30+ data points, then weight the formula.

## Implications for Roadmap

### Phase 1: SerpAPI Foundation + Budget Infrastructure
**Rationale:** Everything depends on SerpAPI data, and budget tracking must exist before any API calls. The architecture research and pitfalls research both independently identified this as the non-negotiable first step.
**Delivers:** `serpapi_client.py` with usage tracking, `serpapi_usage` Supabase table, `SERPAPI_KEY` env var, basic organic search replacing Apify scraper.
**Addresses:** SerpAPI integration (P1), budget management (P1)
**Avoids:** Budget blowout (Pitfall #1), page_token race condition (Pitfall #4)

### Phase 2: GEO Scoring + Baseline Capture
**Rationale:** GEO scoring is local-only analysis (zero API cost) and provides immediate visibility. Baseline data must be captured before any optimization. This phase is measurement-only -- the brain sees data but cannot act on it yet.
**Delivers:** `geo_scorer.py`, GEO scores per page, `geo_scores` Supabase table, baseline AI Overview/citation snapshots for all tracked keywords.
**Addresses:** GEO content score (P1), AI Overview detection (P1), citation tracking (P1), PAA extraction (P1)
**Avoids:** No baseline (Pitfall #3), vanity metric (Pitfall #5)

### Phase 3: Brain Integration + Content Upgrades
**Rationale:** With 2-4 weeks of baseline data from Phase 2, the brain can now make informed GEO decisions. This is where the closed-loop differentiator comes alive: brain sees GEO gaps, prioritizes fixes, executes content upgrades.
**Delivers:** GEO sections in brain prompt, `geo_content_upgrade` action type, `actions/geo_content.py`, enhanced answer capsule pattern, FAQ schema aggressive application.
**Addresses:** Brain GEO integration (P1), answer block formatting (P1), FAQ schema (P1)
**Avoids:** Prompt explosion (Pitfall #2), answer capsule cannibalization (Pitfall #6)

### Phase 4: Entity + Authority Building
**Rationale:** Once the core GEO loop is working (score, detect, fix, measure), layer on the authority signals that make citations more likely. These are independent of the core loop and can be built in parallel once Phase 3 stabilizes.
**Delivers:** Organization schema with sameAs, topical authority scoring, question-to-content matching, competitor AI Overview monitoring, content structure audit for existing pages.
**Addresses:** Entity graph (P2), topical authority (P2), question-to-content matching (P2), competitor monitoring (P2)
**Avoids:** Premature topical authority scoring (Pitfall #9), schema injection conflicts (Pitfall #8)

### Phase 5: Mention Tracking + Source Diversity
**Rationale:** Off-site signals are lower priority than on-site optimization. Source diversity scoring and cross-platform mention tracking are valuable for strategy but do not drive immediate content actions. Defer until ROI from Phases 1-4 is demonstrated.
**Delivers:** `mention_tracker.py`, Reddit question mining with subreddit whitelist, source diversity scoring, cross-platform mention history in Supabase.
**Addresses:** Source diversity (P3), cross-platform mentions (P3)
**Avoids:** Reddit noise (Pitfall #7), low-quality citation chasing (Pitfall #12), Brave rate limits (Pitfall #13)

### Phase Ordering Rationale

- Budget infrastructure must exist before any SerpAPI calls (dependency, not preference)
- Measurement before optimization: GEO scores and baselines must precede brain-driven actions (Pitfall #3 and #5 both demand this)
- On-site optimization before off-site signals: on-page GEO factors account for 70% of the scoring model and are fully within our control
- Authority and mentions are enhancement layers that compound on a working core loop
- Each phase delivers standalone value: Phase 1 alone improves SERP data quality by replacing Apify

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Brain Integration):** The prompt budget constraint (3000 chars for GEO) requires careful design of data formatting. Needs experimentation with the brain to find the right level of detail.
- **Phase 4 (Entity Building):** Organization schema + sameAs implementation details are straightforward but per-client sameAs URL collection requires a manual data-gathering step.

Phases with standard patterns (skip research-phase):
- **Phase 1 (SerpAPI Foundation):** SerpAPI docs are excellent, code patterns are well-documented, budget tracking is simple CRUD.
- **Phase 2 (GEO Scoring):** Local HTML analysis with known patterns. The scoring formula is custom but the implementation is straightforward string/DOM parsing.
- **Phase 5 (Mention Tracking):** Extends existing Brave Search patterns already in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SerpAPI docs are official and include working Python examples. Only 1 new dependency. |
| Features | MEDIUM | GEO is an emerging domain. Table stakes are clear but differentiator value is unproven for local service businesses specifically. |
| Architecture | HIGH | Extends proven existing patterns. Codebase was directly analyzed. No new orchestration or infrastructure paradigms. |
| Pitfalls | MEDIUM | Budget and prompt risks are well-understood. GEO scoring validation risk is real but mitigation (binary checklist, delayed brain authority) is sound. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **GEO score validation:** No existing data on what content signals actually drive AI Overview citations for local service businesses. The scoring formula is a hypothesis that needs 4-6 weeks of data to validate. Plan for a scoring formula revision after Phase 2 baseline collection.
- **AI Overview appearance rate for local queries:** One source claims ~7% of local searches trigger AI Overviews. If the actual rate is lower, the entire GEO module delivers less value than projected. Phase 2 baseline data will resolve this.
- **SerpAPI AI Overview consistency:** Citation data is volatile (Pitfall #10). The frequency-based reporting approach is sound but needs real data to calibrate expectations with clients.
- **Brain prompt capacity:** The exact current prompt size was estimated at ~10K+ chars but not precisely measured. Measure before Phase 3 to set the real GEO budget.

## Sources

### Primary (HIGH confidence)
- [SerpAPI Google AI Overview API](https://serpapi.com/google-ai-overview-api) -- two-step retrieval, response structure, page_token behavior
- [SerpAPI AI Overview Rank Tracker tutorial](https://serpapi.com/blog/ai-overview-rank-tracker-using-python/) -- Python implementation patterns
- [SerpAPI Account API](https://serpapi.com/account-api) -- free usage tracking endpoint
- [SerpAPI Pricing](https://serpapi.com/pricing) -- $25/mo for 1000 searches
- [google-search-results on PyPI](https://pypi.org/project/google-search-results/) -- version 2.4.2
- [GEO: Generative Engine Optimization (arXiv)](https://arxiv.org/abs/2311.09735) -- academic GEO scoring methodology
- Codebase analysis: seo_loop.py, brain.py, research_runner.py, data_collector.py, schema_injector.py, serp_scraper.py

### Secondary (MEDIUM confidence)
- [Frase GEO Scoring](https://www.frase.io/blog/geo-scoring-in-frase) -- commercial GEO scoring approach
- [eSEOspace GEO Content Score](https://eseospace.com/blog/geo-content-score-how-to-measure-ai-visibility/) -- 5-component scoring framework
- [Semrush AI Search Optimization](https://www.semrush.com/blog/how-to-optimize-content-for-ai-search-engines/) -- content structure impact (2.8x citation increase)
- [Search Engine Land GEO Guide 2026](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142) -- best practices
- [ALM Corp Schema Markup Impact](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/) -- 36% citation increase with schema
- [ALM Corp AI Overview Citation Volatility](https://almcorp.com/blog/google-ai-overview-citations-drop-top-ranking-pages-2026/) -- citations dropping from 76% to 38%

### Tertiary (LOW confidence)
- [Heroic Rankings AI Overview Statistics](https://heroicrankings.com/seo/managed/google-ai-overview-statistics-2026/) -- 7% local search AI Overview rate (single source)
- [Incremys Source Diversity Data](https://www.incremys.com/en/resources/blog/geo-content-strategy) -- 48% citations from community platforms (single source)

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
