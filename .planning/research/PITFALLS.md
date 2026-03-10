# Domain Pitfalls: v1.1 Mention Tracking + GEO Dashboard

**Domain:** Adding mention tracking and GEO dashboard to existing SEO engine
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH (existing codebase well-understood; Brave API and dashboard patterns verified via docs)

## Critical Pitfalls

Mistakes that cause budget blowouts, break the existing daily loop, or require rewrites.

### Pitfall 1: Brave Search Budget Surprise -- Free Tier is Dead

**What goes wrong:** You build the Reddit question mining module assuming Brave Search has a free tier (2,000 queries/month). As of early 2026, Brave eliminated the free tier for new users. New signups get $5/month in credits (~1,000 queries), then real charges kick in. Your card is now an active billing instrument.

**Why it happens:** The existing `brand_mentions.py` already uses `BRAVE_API_KEY` with zero budget tracking -- no Supabase logging, no monthly cap, no gate. Adding Reddit mining via `site:reddit.com` queries multiplies Brave usage significantly. Rough math: 5 subreddits x 6 search terms x 4 clients = 120 queries per research run, twice a week = ~960/month just for Reddit mining. Add the existing brand mention queries (4 queries per client x 4 clients x 8 runs/month = ~128/month), and you hit ~1,088 queries/month -- exceeding the ~1,000 credit buffer before charges kick in.

**Consequences:** Unexpected monthly charges that grow silently as clients onboard. No visibility into spend until the bill arrives.

**Prevention:**
- Build a `brave_client.py` budget tracker mirroring the `serpapi_client.py` pattern: log every call to a `brave_usage` Supabase table with client_id, query, and timestamp. Gate every call behind a `check_brave_budget()` function.
- Set a hard monthly cap (500 queries/month initially, adjustable).
- Batch Reddit queries aggressively: use OR operators (`"turf cleaning" OR "artificial grass smell" site:reddit.com`) to reduce from 30 queries per client to 5-8.
- Cache Brave results for 7 days minimum. Reddit questions from last week are still valuable.

**Detection:** Check Brave API dashboard weekly. If charges exceed $5/month, the gate is leaking or missing.

**Phase:** Must be Phase 1 -- before any new Brave API calls.

---

### Pitfall 2: Breaking the Daily Loop with New Module Failures

**What goes wrong:** A new mention tracking module throws an unhandled exception, crashes `seo_loop.py`, and the entire daily loop stops. No GEO scoring, no brain call, no actions. Brian does not notice for days since the loop runs via launchd with no alerting.

**Why it happens:** The existing seo_loop.py is meticulous about try/except wrapping -- every step has `(non-fatal)` error handling. But when adding new steps (mention fetch, source diversity calc, competitor AI Overview monitoring), developers often add them outside the established pattern, or make them dependencies where failure cascades into `call_brain()`.

**Consequences:** Silent daily loop failure. If it crashes at step 2 (research), steps 3-7 never run. The brain never thinks, no actions happen. The client's SEO goes stale for days.

**Prevention:**
- Follow the exact same pattern as existing research modules: every new module call gets `try/except Exception as e` with `(non-fatal)` logging and an empty-list/dict fallback.
- Never make mention data a required parameter for `call_brain()`. Default to empty list if mention tracking fails.
- Add new steps as substeps (e.g., `[2b/7]` or `[2c/7]`) rather than modifying existing numbered steps.
- Add a check in `health_check.py`: if no action logged in 48+ hours, alert.

**Detection:** Check `reports/<slug>/research_cache.json` for `last_updated` date. If stale by 3+ days, the loop is broken.

**Phase:** Every phase. This is a discipline issue enforced on every PR.

---

### Pitfall 3: Supabase Time-Series Query Performance Cliff

**What goes wrong:** The GEO dashboard loads slowly or times out when querying `geo_scores` and `serp_features` for trend charts. Charts show spinners or partial data. Gets worse as data accumulates.

**Why it happens:** Supabase is Postgres -- row-oriented, not optimized for analytics. Documented performance cliff at ~500K rows for aggregation queries (DATE_TRUNC + AVG/SUM + GROUP BY). Current data volume estimate: `geo_scores` grows at ~80 rows/day (4 clients x 20 pages), reaching ~29K rows/year. `serp_features` grows at ~136 rows/month (17 keywords x 4 clients x 2 runs/week). Manageable for now, but the real issue is unoptimized queries without proper aggregation. Even 10K rows with a bad GROUP BY on unindexed columns will feel slow.

More critically: analytical queries running against the same Supabase instance as the daily loop's transactional writes create I/O contention.

**Consequences:** Dashboard feels broken. Brian shows the dashboard to clients as a sales tool -- slow charts kill the demo.

**Prevention:**
- Pre-aggregate data server-side. Create a summary table (e.g., `geo_score_weekly`) that the daily loop populates after scoring. Dashboard queries hit the summary table, not raw data.
- Add composite indexes: `(client_id, scored_at)` already exists on `geo_scores`. Verify `(client_id, keyword, collected_at)` is efficient on `serp_features`.
- Default dashboard date range to 90 days. Never allow unbounded "all time" queries without aggregation.
- Do aggregation in Next.js API routes or Supabase Edge Functions, not in the browser with raw row data.

**Detection:** Run `EXPLAIN ANALYZE` on every dashboard query during development. If any shows `Seq Scan` on tables with 5K+ rows, add an index.

**Phase:** Phase 2 (dashboard). Design the data access layer before building any chart components.

---

### Pitfall 4: Recharts Choking on Unaggregated Time-Series Data

**What goes wrong:** Citation trends and GEO score trends charts render slowly or freeze the browser when fed raw daily data points across multiple keywords and pages.

**Why it happens:** Recharts is SVG-based. Each data point becomes a DOM element. A trend chart showing 17 keywords x 90 days = 1,530 SVG elements per chart. Multiple charts on one page compounds this. React re-renders make it worse when filters change.

**Consequences:** Dashboard unusable on lower-end devices. Client demos on phone or older laptop show janky, laggy charts.

**Prevention:**
- Downsample for display: weekly averages for trends beyond 30 days, daily only for last 30.
- Wrap chart components in `React.memo` to prevent unnecessary re-renders.
- Keep `dataKey` functions stable with `useCallback` -- Recharts recalculates all points when `dataKey` reference changes.
- Limit visible series: show top 5 keywords by default. Do not render 17+ `<Line>` components simultaneously.
- For the "AI Overview citation trends" chart, aggregate to boolean counts per week (e.g., "3 of 17 keywords cited this week") rather than plotting each keyword individually.
- Upgrade to Recharts v2.10+ for tick measurement optimizations.
- Mark all chart components with `'use client'` and use dynamic imports with `ssr: false` -- Recharts/D3 need DOM access.

**Detection:** Test with 90 days of simulated data before shipping. If chart render time exceeds 500ms (React DevTools Profiler), optimize.

**Phase:** Phase 2 (dashboard). Design chart data shapes before implementing components.

---

## Moderate Pitfalls

### Pitfall 5: Brave "site:reddit.com" Returns Incomplete Results vs Google

**What goes wrong:** Brave's independent index does not crawl Reddit as thoroughly as Google. The `site:reddit.com` operator on Brave returns fewer and sometimes different results than Google. Niche subreddits like r/ArtificialTurf may have poor coverage.

**Why it happens:** Brave maintains its own 40-billion-page index, independently crawled. Reddit's content volume is enormous. Brave's coverage of recent posts in low-traffic subreddits lags.

**Prevention:**
- Do not treat Brave Reddit results as exhaustive. They are a sample.
- Test coverage of your specific subreddits (r/lawncare, r/ArtificialTurf, r/SanDiego, r/homeimprovement) with manual queries before building the full module. If coverage is poor for niche subs, use broader terms rather than subreddit-specific searches.
- Supplement with Reddit's undocumented `.json` endpoint (append `.json` to any Reddit URL) for known-valuable subreddits. But rate limit hard -- Reddit returns 429 after ~70-80 requests.
- Cache all results for 7+ days. Reddit questions do not expire in a week.

**Phase:** Phase 1. Validate Brave's Reddit coverage in a spike before committing to the full module.

---

### Pitfall 6: Source Diversity Score Without Baseline is Meaningless

**What goes wrong:** You build a source diversity score that reports "client mentioned on 3 platforms" but have no baseline, no competitor comparison, and no definition of what "good" looks like. Brian cannot tell clients whether 3 is good or bad. The metric sits in the dashboard providing zero actionable insight.

**Why it happens:** Source diversity scoring is a novel metric with no industry standard for home service businesses. Unlike rankings (position 1-3 is clearly good), source diversity has no natural benchmark.

**Prevention:**
- Score relative to competitors, not in isolation. "You are on 3 platforms; top competitor is on 7" is actionable.
- Start with a fixed platform checklist rather than discovery-based scoring: GBP, Yelp, BBB, Facebook, Angi, HomeAdvisor, Nextdoor, Reddit. Score as presence/absence.
- Track progress over time -- the trend matters more than absolute numbers. "3 platforms last month, now 5" is compelling for client reports.
- Do not conflate "mentions" with "citations." A Yelp listing is a presence signal. An AI Overview citation is a citation signal. Different things.

**Phase:** Phase 1. Define the scoring rubric with concrete benchmarks before writing code.

---

### Pitfall 7: Competitor AI Overview Monitoring Burns SerpAPI Budget

**What goes wrong:** Monitoring competitors' AI Overview status for each keyword requires additional SerpAPI searches that eat into the already-tight 200/client/month budget.

**Why it happens:** PROJECT.md already warns "Real-time AI visibility dashboard would burn SerpAPI budget in days." Even non-real-time competitor monitoring can be expensive. Current SERP scraping (8 keywords/client, twice weekly) uses ~64 credits/month per client. Adding 5 competitor keywords adds ~40 credits/month. That pushes toward the 200/client limit, leaving less headroom as you scale to 5 clients.

**Consequences:** SerpAPI budget exhausted mid-month. Existing keyword tracking breaks alongside new features.

**Prevention:**
- Do NOT search competitor keywords separately. Extract competitor data from existing SERP results. When you search "turf cleaning poway," organic results already show competitors. `serp_features` already stores `featured_snippet_holder` and `ai_overview_references` -- competitors are already in this data.
- Parse `ai_overview_references` for competitor URLs. This is zero additional API cost.
- If you must track competitor brand names, do it monthly (5 keywords x 1 search = 5 credits), not weekly (40 credits).
- Add "SerpAPI budget: 87/200 used this month" indicator to the dashboard so Brian sees the pressure.

**Phase:** Phase 1. Design competitor monitoring to reuse existing data before adding any new API calls.

---

### Pitfall 8: Brave Search Rate Limiting Crashes Research Runs

**What goes wrong:** The research runner makes multiple Brave calls back-to-back (brand mentions + Reddit mining) and hits 429 (Too Many Requests). The free/basic tier limits to 1 request per second.

**Why it happens:** The existing `brand_mentions.py` has `time.sleep(0.4)` between queries -- not enough for the 1/second limit. With Reddit mining added, you could have 4 brand mention queries + 8 Reddit queries = 12 Brave calls needing proper spacing.

**Prevention:**
- Build a shared `brave_client.py` module (like `serpapi_client.py`) with: built-in rate limiting (1.1s sleep between calls minimum), budget tracking, retry logic with exponential backoff on 429.
- Check `X-RateLimit-Remaining` header before each request. If 0, sleep until window resets.
- Refactor `brand_mentions.py` to use the shared client. Do not have two modules making independent Brave calls.
- Consider upgrading to paid Brave tier ($5/month, 20 req/sec) if research run reliability is critical.

**Phase:** Phase 1. Build the shared Brave client before the Reddit mining module.

---

### Pitfall 9: Empty same_as_urls Breaks Source Diversity Baseline

**What goes wrong:** Source diversity scorer checks `clients.json` for `same_as_urls` to establish existing presence. All four clients have empty objects (`"gbp": "", "yelp": "", ...`). The scorer starts from zero, missing existing profiles the clients already have.

**Why it happens:** This is known tech debt from v1.0, documented in PROJECT.md. Nobody populated the URLs because nothing consumed them until now.

**Prevention:**
- Populate `same_as_urls` for all active clients before building the source diversity scorer. This is 30 minutes of manual work (Google each client + platform).
- Or: make the scorer auto-discover profiles via Brave Search (`"Mr Green Turf Clean" site:yelp.com`) and populate the config programmatically. But this costs Brave queries.

**Phase:** Pre-work before Phase 1. Part of tech debt cleanup.

---

### Pitfall 10: Mention Deduplication Across Research Runs

**What goes wrong:** If the mention tracking module inserts mentions into Supabase without deduplication, you get duplicate rows every research run (Wed + Sat). Dashboard shows inflated mention counts.

**Why it happens:** The research runner caches to JSON and re-runs from scratch each research day. Without upsert logic, the same Reddit question or brand mention gets inserted twice.

**Prevention:**
- Use Supabase upsert with a unique constraint (e.g., `client_id, platform, mention_url`).
- Or follow the existing cache pattern: store in JSON cache, diff against what is already in Supabase, insert only new mentions.

**Phase:** Phase 1. Bake deduplication into the schema design from day one.

---

### Pitfall 11: SerpAPI page_token Expiry Silently Drops AI Overview Data

**What goes wrong:** The existing `fetch_ai_overview()` documents that page_tokens expire in ~60 seconds. If mention tracking or source diversity calculations are inserted into the research runner between the initial SERP search and the AI Overview follow-up, the token expires. The follow-up silently fails.

**Why it happens:** Adding new processing steps to `research_runner.py` without understanding the tight coupling between `scrape_serp()` and `fetch_ai_overview()`.

**Prevention:**
- Keep the search-then-AI-Overview pair atomic. Never insert new processing between them.
- If refactoring the research runner, ensure this pair runs as a single unit per keyword.
- Existing code in `serp_scraper.py` already handles this correctly -- just do not break it.

**Phase:** Any phase that modifies `research_runner.py` or `serp_scraper.py`.

---

### Pitfall 12: Dashboard SSR/CSR Mismatch for Charts

**What goes wrong:** Recharts (and D3.js internals) requires DOM access. If chart components are accidentally server-rendered in Next.js App Router, they throw hydration errors or render blank.

**Prevention:**
- Mark all chart components with `'use client'` directive.
- Use dynamic imports with `{ ssr: false }` for chart-heavy sections.
- Test the production build (`npm run build && npm start`), not just dev mode, before deploying.

**Phase:** Phase 2 (dashboard). First chart component should verify SSR/CSR handling works.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Reddit mining via Brave | Budget surprise (#1) + rate limiting (#8) | Build shared `brave_client.py` with budget gate and rate limiting first |
| Reddit mining via Brave | Incomplete results vs Google (#5) | Validate Brave's Reddit coverage in spike; batch queries with OR operators |
| Cross-platform mention tracking | No budget gate on Brave (#1) | Mirror `serpapi_usage` pattern for Brave before any calls |
| Cross-platform mention tracking | Deduplication across runs (#10) | Unique constraint in Supabase schema from day one |
| Source diversity scoring | Meaningless without baseline (#6) | Score relative to competitors; use fixed platform checklist |
| Source diversity scoring | Empty same_as_urls (#9) | Populate client configs before building scorer |
| Competitor AI Overview monitoring | Burns SerpAPI budget (#7) | Reuse existing `ai_overview_references` data -- zero new API calls |
| GEO dashboard charts | Recharts SVG perf (#4) + SSR issues (#12) | Downsample to weekly; `use client` + dynamic imports |
| Dashboard data loading | Supabase aggregation perf (#3) | Pre-aggregate with summary tables; default 90-day range |
| Integration with daily loop | New module crashes loop (#2) | Try/except wrapping on every new call; empty defaults for brain params |
| Budget tracking across APIs | Two APIs, separate caps, no unified view | Dashboard widget showing both SerpAPI and Brave usage side by side |
| Research runner modifications | page_token expiry (#11) | Never insert code between search and AI Overview fetch |

## Sources

- [Brave Search API Plans](https://api-dashboard.search.brave.com/app/plans) -- current pricing, tier structure (HIGH confidence)
- [Brave Drops Free API Tier](https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/) -- free tier elimination confirmed (HIGH confidence)
- [Brave API Rate Limiting Docs](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting) -- 1/sec limit on free tier, sliding window (HIGH confidence)
- [Recharts Performance Guide](https://recharts.github.io/en-US/guide/performance/) -- SVG rendering, memoization (HIGH confidence)
- [Improving Recharts Performance](https://belchior.hashnode.dev/improving-recharts-performance-clp5w295y000b0ajq8hu6cnmm) -- dataKey stability, React.memo patterns (MEDIUM confidence)
- [Supabase Performance Tuning](https://supabase.com/docs/guides/platform/performance) -- Postgres analytics limitations (HIGH confidence)
- [Can I Use Supabase for Analytics?](https://www.tinybird.co/blog/can-i-use-supabase-for-user-facing-analytics) -- 500K row performance cliff (MEDIUM confidence)
- [SerpAPI vs Brave Search API](https://serpapi.com/blog/serpapi-vs-brave-search-api/) -- multi-API strategy (MEDIUM confidence)
- [Reddit Scraping Post-API](https://medium.com/@arjuns0206/you-dont-need-the-reddit-api-to-acquire-its-data-here-s-how-41ef8f15e1db) -- .json endpoint workaround (LOW confidence, may break)
- Codebase analysis: `seo_loop.py`, `serpapi_client.py`, `brand_mentions.py`, `reddit.py`, `research_runner.py`, `geo_scorer.py`, `geo_data.py`, `clients.json`, Supabase migration files -- direct code review (HIGH confidence)
