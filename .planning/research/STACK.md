# Technology Stack

**Project:** EchoLocal ClientTracker v1.1 -- Mention Tracking + GEO Dashboard
**Researched:** 2026-03-10
**Confidence:** HIGH

## Existing Stack (validated, NOT changing)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | Dashboard frontend |
| React | 19.2.3 | UI framework |
| Recharts | 3.7.0 | Charts (already installed) |
| Supabase JS | 2.97.0 | Browser client for dashboard |
| Tailwind CSS | 4.x | Styling |
| Python 3 | 3.x | SEO engine backend |
| supabase-py | installed | Python Supabase client |
| SerpAPI (`google-search-results`) | 2.4.2 | SERP data, AI Overview detection (budget-gated) |
| `requests` | installed | HTTP calls |
| `python-dotenv` | installed | Env var loading |

## New Stack Additions

### Python Backend: Zero New Dependencies

#### Brave Search API Client (via raw `requests`)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `requests` (already installed) | existing | Brave Search API calls for Reddit mining and cross-platform mentions | The Brave Search API is a single REST endpoint (`GET https://api.search.brave.com/res/v1/web/search`). The existing codebase already uses raw `requests` for SerpAPI account checks and other HTTP calls. No wrapper library needed. |

**API details:**
- **Endpoint:** `GET https://api.search.brave.com/res/v1/web/search`
- **Auth:** `X-Subscription-Token: <BRAVE_API_KEY>` header
- **Site operator:** Fully supported. `q=turf+cleaning+site:reddit.com` returns Reddit-only results.
- **Other operators:** `"exact match"`, `-exclusion`, `intitle:`, `inbody:` all work. Logical `AND`, `OR`, `NOT` (uppercase) supported.
- **Known limitation:** Multiple `site:` operators with `OR` only returns results from the first domain. Use separate queries per platform instead.
- **Response format:** JSON with `web.results[]` containing `title`, `url`, `description`, `profile` per result.
- **Confidence:** HIGH (verified against official API docs and operator documentation)

**Pricing (as of Feb 2026):**
- $5 per 1,000 requests
- $5/month free credit (~1,000 searches/month)
- No free tier anymore -- credit card required
- Budget estimate: 4 clients x 6 queries x 4 runs/month = 96 queries/month. Comfortably within the $5 free credit.

**New env var:** `BRAVE_API_KEY`

#### Reddit Mining Approach

The existing `scripts/seo_engine/research/reddit.py` uses Reddit OAuth API with `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`. This module should be **replaced** with Brave Search `site:reddit.com` queries because:

1. PROJECT.md constraint: "No Reddit API -- Reddit data via Brave Search site:reddit.com only"
2. Eliminates two env vars (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`)
3. Brave returns title, URL, description -- sufficient for mining questions
4. One API, one budget tracking table, simpler operations

#### What Each Feature Uses

| Feature | Library/Tool | Rationale |
|---------|-------------|-----------|
| Reddit question mining (MENT-01) | `requests` to Brave Search API with `site:reddit.com` | Single HTTP call per query. Results include title + URL + snippet. |
| Cross-platform mentions (MENT-02) | `requests` to Brave Search API with `"business name"` (no site: filter) | Same API, broader query. Count unique domains in results. |
| Source diversity scoring (MENT-03) | Pure Python (`collections.Counter`, `urllib.parse`) | Extract domains from mention URLs, compute diversity ratio. All stdlib. |
| Competitor AI Overview monitoring (MENT-04) | Existing `serpapi_client.py` | Already built -- `search_google()` + `fetch_ai_overview()`. Just run for competitor keywords. |
| GEO dashboard charts (DASH-01 to DASH-06) | Existing Recharts 3.7.0 + Supabase browser client | All chart types needed are standard Recharts components. Data already in Supabase tables. |

### Next.js Dashboard: Zero New npm Packages

All dashboard visualizations use Recharts 3.7.0 (already installed):

| Dashboard Feature | Recharts Component | Implementation Notes |
|-------------------|-------------------|----------------------|
| GEO scores per page (DASH-01) | No chart -- stat cards | Score/5 with colored indicator. Match existing `StatCard.tsx` pattern. |
| AI Overview citation status (DASH-02) | No chart -- table rows | Colored dots (cited/not cited) per keyword. Simple JSX. |
| Citation trends over time (DASH-03) | `LineChart` or `AreaChart` | Two series: total keywords with AIO, keywords where client is cited. Standard Recharts. |
| Source diversity visualization (DASH-04) | `PieChart` or horizontal `BarChart` | Domain distribution. Categorical data. |
| SerpAPI budget gauge (DASH-05) | `RadialBarChart` | Half-circle gauge: `startAngle={180}` `endAngle={0}`. Well-documented pattern -- see shadcn/ui radial chart examples. |
| Featured Snippet tracker (DASH-06) | No chart -- table with status | Keyword + current holder + owned/not-owned indicator. |

**Do NOT install:** `react-gauge-chart`, `react-circular-progressbar`, or any gauge-specific library. Recharts handles gauges natively with `RadialBarChart`.

### Supabase: New Tables (no new client libraries)

Python writes, Next.js reads. Both use existing Supabase clients.

| New Table | Purpose | Key Columns |
|-----------|---------|-------------|
| `brave_search_usage` | Budget tracking (mirrors `serpapi_usage` pattern) | `id, client_id, query, search_type, searched_at` |
| `mentions` | Cross-platform mention records | `id, client_id, platform, url, title, snippet, found_at, query_used` |
| `mention_sources` | Source diversity aggregation per scoring run | `id, client_id, domain, mention_count, scored_at` |
| `competitor_ai_overviews` | Competitor AIO monitoring snapshots | `id, client_id, competitor_name, keyword, has_ai_overview, competitor_cited, checked_at` |

**Existing tables already cover GEO dashboard needs (no changes):**
- `geo_scores` -- `page_path, page_url, score, factors, scored_at, client_id`
- `serp_features` -- `keyword, has_ai_overview, client_cited_in_ai_overview, has_featured_snippet, featured_snippet_holder, client_has_snippet, collected_at, client_id`
- `serpapi_usage` -- `client_id, query, search_type, searched_at`

### Dashboard Data Fetching Pattern

The existing `seo-engine/page.tsx` queries Supabase directly from the browser client -- no API routes. All new GEO dashboard components follow the same pattern:

```typescript
// Existing pattern from seo-engine/page.tsx:
const { data, error } = await supabase
  .from('geo_scores')
  .select('*')
  .eq('client_id', activeClient.id)
  .order('scored_at', { ascending: false })
  .limit(50);
```

No Next.js API routes needed. Supabase RLS handles auth. New components plug into the existing tab system via `SeoTabNav`.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Brave Search Python client | Raw `requests` | `brave-search-python-client` 0.4.27 | Adds a dependency for one GET call. Project pattern is raw requests. The library hasn't seen major updates since its initial release cycle. |
| Brave Search Python client | Raw `requests` | `brave-search` (kayvane1) | Last updated Apr 2024. Stale. Same argument -- unnecessary wrapper. |
| Reddit data source | Brave Search `site:reddit.com` | Reddit OAuth API (existing `reddit.py`) | PROJECT.md constraint says no Reddit API. Brave approach is simpler. |
| Budget gauge chart | Recharts `RadialBarChart` | `react-gauge-chart` npm package | Extra dependency when Recharts already handles this. Zero benefit. |
| Dashboard state management | Direct Supabase queries in `useEffect` | SWR or React Query | Overkill for 1-2 internal users. Existing pattern works. Revisit if data freshness becomes an issue. |
| Mention storage | Supabase tables | Local JSON files | Need historical trends, dashboard reads, cross-device access. Supabase is the existing pattern. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `brave-search-python-client` or `brave-search` pip packages | Unnecessary abstraction. One REST endpoint. | Raw `requests` with `X-Subscription-Token` header |
| `react-gauge-chart` or similar | Recharts 3.7.0 already does gauges via `RadialBarChart` | Recharts `RadialBarChart` with `startAngle/endAngle` |
| `httpx` or `aiohttp` | SEO engine runs sequentially. Async adds complexity for zero benefit. | `requests` (already everywhere) |
| Any Reddit API library (PRAW, etc.) | PROJECT.md says no Reddit API | Brave Search `site:reddit.com` |
| Perplexity API | Unreliable for citation tracking, only one AI engine | SerpAPI for Google AI Overviews |
| SWR / React Query / TanStack Query | 1-2 users, internal dashboard. `useEffect` + Supabase client is fine. | Direct Supabase browser queries |

## Environment Variables

```bash
# New (add to .env)
BRAVE_API_KEY=your_brave_search_api_key

# Existing (no changes)
SERPAPI_KEY=already_configured
SUPABASE_URL=already_configured
SUPABASE_KEY=already_configured
NEXT_PUBLIC_SUPABASE_URL=already_configured
NEXT_PUBLIC_SUPABASE_ANON_KEY=already_configured
```

**Can remove after migration:**
- `REDDIT_CLIENT_ID` -- replaced by Brave Search
- `REDDIT_CLIENT_SECRET` -- replaced by Brave Search

## Installation

```bash
# Python: Nothing to install
python -c "import requests; print('requests available')"

# Next.js: Nothing to install
npm ls recharts  # Should show 3.7.0
```

**Total new pip packages: 0**
**Total new npm packages: 0**
**Total new env vars: 1** (`BRAVE_API_KEY`)

## Integration Architecture

```
brave_search_client.py (NEW)
  |-- Mirrors serpapi_client.py pattern exactly
  |-- Budget gating via brave_search_usage Supabase table
  |-- search_brave(query, client_id) -> dict
  |-- check_brave_budget(client_id) -> dict

mention_tracker.py (NEW)
  |-- Reddit mining: brave_search_client.search_brave("query site:reddit.com", client_id)
  |-- Cross-platform: brave_search_client.search_brave('"business name"', client_id)
  |-- Source diversity: count unique domains from mentions, store in mention_sources
  |-- Called from seo_loop.py (extends existing daily cycle)

competitor_monitor.py (NEW)
  |-- Uses existing serpapi_client.search_google() for competitor keywords
  |-- Uses existing serpapi_client.fetch_ai_overview() for competitor AIO checks
  |-- Stores results in competitor_ai_overviews table
  |-- Called from seo_loop.py

Dashboard components (NEW, in src/components/seo-engine/):
  |-- GeoScoreCards.tsx -- reads geo_scores table
  |-- CitationTrends.tsx -- reads serp_features table, LineChart
  |-- SourceDiversity.tsx -- reads mention_sources table, PieChart
  |-- BudgetGauge.tsx -- reads serpapi_usage table, RadialBarChart
  |-- SnippetTracker.tsx -- reads serp_features table, table component
  |-- MentionFeed.tsx -- reads mentions table, list component
  |-- New tab "GEO" added to SeoTabNav.tsx
```

## Sources

- [Brave Search API](https://brave.com/search/api/) -- endpoints, auth, capabilities (HIGH confidence)
- [Brave Search Operators](https://search.brave.com/help/operators) -- site: operator confirmed working (HIGH confidence)
- [Brave API Pricing Changes Feb 2026](https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing/) -- $5/1k, $5 credit (HIGH confidence)
- [brave-search-python-client on PyPI](https://pypi.org/project/brave-search-python-client/) -- v0.4.27, evaluated and rejected (HIGH confidence)
- [Recharts RadialBarChart API](https://recharts.github.io/en-US/api/RadialBarChart/) -- gauge pattern documented (HIGH confidence)
- [shadcn/ui Radial Charts](https://ui.shadcn.com/charts/radial) -- copy-paste Recharts radial examples matching dark aesthetic (MEDIUM confidence)
- [Recharts Gauge Gist](https://gist.github.com/emiloberg/ee549049ea0f6b83e25f1a1110947086) -- half-circle gauge implementation (MEDIUM confidence)
- Existing codebase: `serpapi_client.py`, `geo_data.py`, `reddit.py`, `seo-engine/page.tsx` -- established patterns (HIGH confidence)

---
*v1.1 stack research -- Mention Tracking + GEO Dashboard*
*Replaces v1.0 stack research from 2026-03-10*
