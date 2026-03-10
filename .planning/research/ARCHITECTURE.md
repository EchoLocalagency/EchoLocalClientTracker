# Architecture Patterns

**Domain:** v1.1 Mention Tracking + GEO Dashboard integration into existing SEO engine
**Researched:** 2026-03-10
**Scope:** NEW features only -- how they integrate with existing v1.0 architecture

## Existing Architecture (v1.0 Baseline)

```
launchd (daily noon)
  |
  v
seo_loop.py (7-step orchestrator)
  |-- [1] data_collector.py       (GA4, GSC, GBP, PageSpeed)
  |-- [1b] geo_scorer.py          (local HTML -> geo_scores table, 0-5 binary)
  |-- [1c] geo_data.py            (reads geo_scores + serp_features for brain)
  |-- [2] research_runner.py      (Wed+Sat: 10 modules including reddit.py, brand_mentions.py)
  |-- [3] outcome follow-ups
  |-- [4] photo sync
  |-- [5] brain.py                (claude -p -> prioritized actions)
  |-- [6] execute actions         (rate-limited)
  |-- [7] summary
  |
  v
Supabase (Postgres)
  |-- clients, reports, seo_actions, seo_brain_decisions
  |-- geo_scores (page_path, score 0-5, factors JSON, scored_at)
  |-- serp_features (keyword, has_ai_overview, client_cited, ai_overview_references JSON,
  |                   paa_questions JSON, has_featured_snippet, featured_snippet_holder)
  |-- serpapi_usage (client_id, query, search_type, searched_at)
  |
  v
Next.js Dashboard (src/app/seo-engine/page.tsx)
  |-- SeoTabNav: clients | actions | brain | keywords
  |-- Direct Supabase queries via @supabase/supabase-js (no API routes)
  |-- Recharts for charts
  |-- Design: dark navy #0A0F1E, teal #00CED1, Inter font
```

**Key existing modules relevant to v1.1:**
- `research/reddit.py` -- Uses Reddit OAuth API (currently broken per PROJECT.md: "Reddit API auth blocked"). Returns reddit_questions for brain.
- `research/brand_mentions.py` -- Uses Brave Search API to find Echo Local brand mentions. Already has `BRAVE_API_KEY` wired up with rate limiting (`time.sleep(0.4)`).
- `geo_data.py` -- Formats geo_scores + serp_features into compact brain prompt sections with char_budget.
- `serpapi_client.py` -- Budget-gated wrapper. Already tracks usage in `serpapi_usage` table. Hard caps: 200/client/month, 950 global.

## New Components (v1.1)

### Python Side: 2 New Modules + 4 Modified Files

---

#### NEW: `scripts/seo_engine/research/mention_tracker.py`

**Responsibility:** Reddit question mining via Brave Search (replacing broken Reddit OAuth), cross-platform client mention detection, source diversity scoring.

**Why new module (not extending reddit.py or brand_mentions.py):**
- `reddit.py` is built around Reddit OAuth which is blocked. The replacement uses Brave Search `site:reddit.com` -- fundamentally different data path.
- `brand_mentions.py` tracks *Echo Local agency* mentions for backlink opportunities. `mention_tracker.py` tracks *client business* mentions across platforms -- different queries, different storage, different consumer (brain vs outreach).
- Source diversity scoring aggregates across platforms -- a new concept that doesn't belong in either existing module.

**Integration points:**
- Called from `research_runner.py` as step 11 (after existing AEO opportunities step), Wed+Sat only.
- Uses existing `BRAVE_API_KEY` from `.env` (same key as `brand_mentions.py`).
- Results stored in new `client_mentions` Supabase table + cached in `research_cache.json`.
- Follows existing Brave API rate limiting pattern: `time.sleep(0.4)` between calls.

**Core interface:**
```python
def track_client_mentions(client_config: dict) -> dict:
    """
    Uses Brave Search API with site: operators.
    Queries: site:reddit.com "{niche} {market}", site:yelp.com "{client name}",
             "{client name} {service} review" (general web).

    Returns {
        "reddit_questions": [...],
        "platform_mentions": [...],
        "source_diversity": {
            "score": float (0-1),
            "platforms_found": ["reddit", "yelp", ...],
            "platforms_missing": ["bbb", "thumbtack", ...],
        }
    }
    """
```

**Brave API budget consideration:** Brave Search free tier is 2,000 queries/month. With 2 clients and ~5 queries per client per research day (2 days/week), that is ~40 queries/month. Well within limits. At 10 clients: ~200 queries/month, still fine.

**Data flow:**
```
Wed/Sat: research_runner.py step 11
  |
  v
mention_tracker.py
  |-- Brave API: site:reddit.com "{niche keywords} {market}"  (2-3 queries)
  |-- Brave API: site:yelp.com "{client name}"                (1 query)
  |-- Brave API: "{client name} {service} review"             (1 query)
  |
  v
Deduplicate by URL, score relevance (1-10), classify platform
  |
  +-> Supabase: client_mentions table (UNIQUE on client_id, url)
  +-> research_cache.json: "client_mentions" + "source_diversity" keys
  |
  v
Daily: seo_loop loads from cache -> brain.py receives source_diversity
```

---

#### NEW: `scripts/seo_engine/research/competitor_aio_monitor.py`

**Responsibility:** Analyze which competitor domains appear in AI Overviews for client target keywords. Zero API cost -- reads existing `serp_features.ai_overview_references` data.

**Why separate from serp_scraper.py:**
- `serp_scraper.py` handles raw SerpAPI calls and organic results formatting.
- Competitor AIO monitoring is pure analysis logic operating on already-stored data.
- Keeps read-only analysis separate from write-path API integration.

**Integration point:**
- Called from `seo_loop.py` in Step 1c, alongside existing `get_latest_geo_scores()` and `get_latest_serp_features()` calls.
- Output passed to `call_brain()` as new `competitor_aio_data` parameter.

**Core interface:**
```python
def get_competitor_aio_presence(client_id: str, client_website: str) -> list:
    """
    Reads serp_features table, parses ai_overview_references JSON.
    Groups reference URLs by domain, counts frequency, excludes client domain.

    Returns [
        {"domain": "competitor.com", "cited_count": 5, "keywords": ["kw1", "kw2"]},
        ...
    ] sorted by cited_count desc, limit 10.
    """
```

---

#### MODIFIED: `scripts/seo_engine/research/research_runner.py`

**Current state:** 10 research steps (Trends, Reddit, SERPs, News, Backlinks, Broken Links, Brand Mentions, Journalists, AEO Crawler, AEO Opportunities).

**Changes:**
1. Add step 11: `track_client_mentions(client_config)` call.
2. Store results in cache under `client_mentions` and `source_diversity` keys.
3. Reddit step (#2) can remain for backward compatibility but `mention_tracker` becomes the primary Reddit data source since OAuth is blocked.

**Code pattern (matching existing steps):**
```python
# 11. Client mention tracking (Brave Search)
print(f"  [research] Tracking client mentions...")
try:
    from .mention_tracker import track_client_mentions
    mention_data = track_client_mentions(client_config)
    cache["client_mentions"] = mention_data.get("platform_mentions", [])
    cache["reddit_questions"] = mention_data.get("reddit_questions", cache.get("reddit_questions", []))
    cache["source_diversity"] = mention_data.get("source_diversity", {})
except Exception as e:
    print(f"  [research] Mention tracking error: {e}")
    cache["client_mentions"] = []
    cache["source_diversity"] = {}
```

Note: `cache["reddit_questions"]` is already consumed by `seo_loop.py` line 216 for AEO opportunity extraction. The mention_tracker overwrites this key with Brave-sourced Reddit data, maintaining backward compatibility.

---

#### MODIFIED: `scripts/seo_engine/seo_loop.py`

**Changes:**
1. **Step 1c (line ~117):** Add `competitor_aio_monitor.get_competitor_aio_presence()` call.
2. **Step 5 (line ~283):** Pass `competitor_aio_data` and `source_diversity` to `call_brain()`.

**No new steps needed.** Mention data flows through existing research cache mechanism (loaded in Step 2). Competitor AIO data is a read-only analysis of existing Supabase data (no API calls).

```python
# Step 1c addition (after existing geo_data calls):
competitor_aio_data = []
try:
    from .research.competitor_aio_monitor import get_competitor_aio_presence
    competitor_aio_data = get_competitor_aio_presence(client_id, client.get("website", ""))
    print(f"  Loaded {len(competitor_aio_data)} competitor AIO domains")
except Exception as e:
    print(f"  Competitor AIO analysis failed (non-fatal): {e}")

# Step 5: add to call_brain() -- 2 new kwargs
actions = call_brain(
    ...existing params...,
    competitor_aio_data=competitor_aio_data,
    source_diversity=(research_data or {}).get("source_diversity", {}),
)
```

---

#### MODIFIED: `scripts/seo_engine/brain.py`

**Changes:** Two new prompt sections added to `call_brain()` or `_build_prompt()`.

**Section 1: COMPETITOR AI OVERVIEW PRESENCE**
```
COMPETITOR AI OVERVIEW PRESENCE (domain | times cited | keywords):
  homeadvisor.com     cited 4x  keywords: turf cleaning poway, artificial turf cleaning SD
  yelp.com            cited 3x  keywords: pressure washing san diego, soft washing SD
  ...
  Actionable: improve pages targeting keywords where competitors are cited but client is not.
```

**Section 2: SOURCE DIVERSITY**
```
SOURCE DIVERSITY: 0.4/1.0 (4/10 platforms)
  Found: website, yelp, google-maps, facebook
  Missing: bbb, thumbtack, angi, houzz, nextdoor, reddit
  Actionable: listing on missing platforms improves entity signals for AI citation.
```

Both sections should follow existing `format_geo_section()` pattern with char_budget enforcement.

---

### Next.js Side: 1 New Tab + 5 New Components + 2 Modified Files

---

#### MODIFIED: `src/lib/types.ts`

**Changes:**
1. Extend `SeoEngineTabId` union type:
```typescript
// Before
export type SeoEngineTabId = 'clients' | 'actions' | 'brain' | 'keywords';
// After
export type SeoEngineTabId = 'clients' | 'actions' | 'brain' | 'keywords' | 'geo';
```

2. Add new interfaces:
```typescript
export interface GeoScore {
  id: string;
  client_id: string;
  page_path: string;
  page_url: string;
  score: number;  // 0-5
  factors: {
    answer_block: 0 | 1;
    stats_density: 0 | 1;
    schema_present: 0 | 1;
    heading_structure: 0 | 1;
    freshness_signal: 0 | 1;
  };
  scored_at: string;
}

export interface SerpFeature {
  id: string;
  client_id: string;
  keyword: string;
  has_ai_overview: boolean;
  client_cited_in_ai_overview: boolean;
  ai_overview_references: string;  // JSON string of reference objects
  has_featured_snippet: boolean;
  featured_snippet_holder: string;
  client_has_snippet: boolean;
  paa_questions: string;  // JSON string of question strings
  collected_at: string;
}

export interface ClientMention {
  id: string;
  client_id: string;
  platform: string;
  url: string;
  title: string;
  context: string;
  relevance_score: number;
  found_at: string;
}
```

---

#### MODIFIED: `src/components/seo-engine/SeoTabNav.tsx`

**Change:** Add GEO tab to array.

```typescript
const tabs: SeoTab[] = [
  { id: 'clients', label: 'Clients' },
  { id: 'actions', label: 'Action Feed' },
  { id: 'brain', label: 'Brain Decisions' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'geo', label: 'GEO' },  // NEW
];
```

---

#### MODIFIED: `src/app/seo-engine/page.tsx`

**Changes:**
- Import `GeoDashboard`.
- Add render block for `activeTab === 'geo'`.
- GeoDashboard receives `activeClient` and handles its own data fetching (matching KeywordDashboard pattern).

```tsx
{activeTab === 'geo' && activeClient && (
  <GeoDashboard clientId={activeClient.id} clientWebsite={activeClient.website} />
)}
```

---

#### NEW: `src/components/seo-engine/GeoDashboard.tsx`

**Responsibility:** Container for the GEO tab. Fetches all GEO data from Supabase, passes to child components via props.

**Data fetching (direct Supabase, matching existing pattern):**
```typescript
useEffect(() => {
  async function loadGeoData() {
    const [scoresRes, featuresRes, usageRes] = await Promise.all([
      supabase.from('geo_scores').select('*')
        .eq('client_id', clientId).order('scored_at', { ascending: false }).limit(200),
      supabase.from('serp_features').select('*')
        .eq('client_id', clientId).order('collected_at', { ascending: false }).limit(200),
      supabase.from('serpapi_usage').select('id', { count: 'exact' })
        .gte('searched_at', monthStart),
    ]);
    // Set state, pass to children
  }
  loadGeoData();
}, [clientId]);
```

**Renders:** GeoScoreCards, CitationTrends, SnippetTracker, BudgetGauge, SourceDiversityPanel (conditional on data).

---

#### NEW: `src/components/seo-engine/GeoScoreCards.tsx`

**Requirement:** DASH-01 (GEO scores visible in dashboard).

**Data source:** `geo_scores` table via props.

**Display:** Card grid. Each card = one page. Shows page_path, score/5 as large number, colored dot (0-2 red, 3 yellow, 4-5 green), list of missing factors.

**Deduplication:** Latest score per page_path only (handled by parent query `ORDER BY scored_at DESC` + dedup in JS).

---

#### NEW: `src/components/seo-engine/CitationTrends.tsx`

**Requirements:** DASH-02 (citation status per keyword) + DASH-03 (citation trends chart).

**Data source:** `serp_features` table via props.

**Two views:**
1. **Table:** Keyword | AIO Present | Client Cited | Last Checked. Keywords with AIO=yes but cited=no highlighted.
2. **Chart:** Recharts LineChart. X-axis = collected_at dates. Two lines: "Keywords with AIO" (count) and "Client Cited" (count). Group by date, count booleans.

**Sparsity handling:** With 8 keywords checked 2x/week, expect ~16 data points/week. Chart needs at least 4 weeks of data to be meaningful. Show "Collecting baseline data..." message if fewer than 4 unique dates.

---

#### NEW: `src/components/seo-engine/SnippetTracker.tsx`

**Requirement:** DASH-06 (Featured Snippet ownership).

**Data source:** `serp_features` table, filtered to latest per keyword, `has_featured_snippet = true`.

**Columns:** Keyword | Current Holder | Client Owns? (checkmark/X) | Last Checked.

**Color coding:** Client owns snippet = green row. Competitor owns = default. No snippet = grey.

---

#### NEW: `src/components/seo-engine/BudgetGauge.tsx`

**Requirement:** DASH-05 (SerpAPI budget usage indicator).

**Data source:** `serpapi_usage` table. Count rows where `searched_at >= first of month`.

**Implementation:** Two gauges: client-level (X / 200) and global (X / 950). Linear progress bar or arc gauge. Green <50%, yellow 50-80%, red >80%.

**Hardcoded caps:** Match Python constants from `serpapi_client.py` (CLIENT_MONTHLY_LIMIT = 200, GLOBAL_MONTHLY_LIMIT = 950). No config table exists for these -- hardcode in component.

**Client-level query requires knowing which client's usage to show:**
```typescript
const { count: clientUsage } = await supabase
  .from('serpapi_usage')
  .select('id', { count: 'exact' })
  .eq('client_id', clientId)
  .gte('searched_at', monthStart);
```

---

#### NEW: `src/components/seo-engine/SourceDiversityPanel.tsx`

**Requirement:** DASH-04 (Source diversity visualization).

**Data source:** `client_mentions` table (new, populated by mention_tracker.py).

**Display:** Platform checklist showing where client is mentioned. Each platform = row with icon + name + found/missing status. Overall diversity score as percentage.

**Dependency:** Requires Phase 1 (mention_tracker.py + client_mentions table) to have data. Show "Mention tracking not yet active" if table is empty.

---

### Supabase: 1 New Table

#### NEW TABLE: `client_mentions`

```sql
CREATE TABLE client_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  platform TEXT NOT NULL,           -- 'reddit', 'yelp', 'forum', 'directory', 'review_site'
  url TEXT NOT NULL,
  title TEXT,
  context TEXT,                     -- snippet of mention context
  relevance_score INTEGER DEFAULT 5, -- 1-10
  sentiment TEXT,                   -- 'positive', 'neutral', 'negative' (optional)
  found_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, url)
);

CREATE INDEX idx_client_mentions_client ON client_mentions(client_id);
CREATE INDEX idx_client_mentions_platform ON client_mentions(platform);
```

**No other new tables needed.** All GEO dashboard data reads from existing tables:
- `geo_scores` (created in v1.0)
- `serp_features` (created in v1.0)
- `serpapi_usage` (created in v1.0)

## Component Boundaries Summary

| Component | Layer | New/Modified | Communicates With |
|-----------|-------|-------------|-------------------|
| `mention_tracker.py` | Research | NEW | Brave API, Supabase, research_runner |
| `competitor_aio_monitor.py` | Analysis | NEW | Supabase (read-only), seo_loop |
| `research_runner.py` | Orchestration | MODIFIED | mention_tracker (new step 11) |
| `seo_loop.py` | Orchestration | MODIFIED | competitor_aio_monitor (Step 1c), brain (Step 5) |
| `brain.py` | Decision | MODIFIED | New prompt sections (competitor AIO, source diversity) |
| `types.ts` | Types | MODIFIED | All dashboard components |
| `SeoTabNav.tsx` | Navigation | MODIFIED | page.tsx |
| `page.tsx` | Page | MODIFIED | GeoDashboard import |
| `GeoDashboard.tsx` | Container | NEW | Supabase, all child components |
| `GeoScoreCards.tsx` | Display | NEW | GeoDashboard (props) |
| `CitationTrends.tsx` | Display | NEW | GeoDashboard (props), Recharts |
| `SnippetTracker.tsx` | Display | NEW | GeoDashboard (props) |
| `BudgetGauge.tsx` | Display | NEW | Supabase (serpapi_usage) |
| `SourceDiversityPanel.tsx` | Display | NEW | GeoDashboard (props) |

## Patterns to Follow

### Pattern 1: Non-Fatal Research Wrapping
Every research module call in research_runner.py is wrapped in try/except with a descriptive non-fatal error message. The mention_tracker call must follow this exact pattern. Never let a research failure crash the loop.

### Pattern 2: Brave API Rate Limiting
`brand_mentions.py` uses `time.sleep(0.4)` between Brave API calls. `mention_tracker.py` must do the same. Brave free tier does not document rate limits explicitly, but 0.4s spacing has worked without issues.

### Pattern 3: Direct Supabase Queries in Dashboard
All existing dashboard components (KeywordDashboard, ActionFeedGreen, BrainDecisionsGreen) query Supabase directly via `@supabase/supabase-js`. No API routes. New GEO components must follow this pattern.

### Pattern 4: Brain Prompt Char Budget
`geo_data.py:format_geo_section()` enforces a `char_budget` parameter (default 3000 chars) to prevent prompt bloat. New brain sections (competitor AIO, source diversity) must use the same approach with their own char budgets.

### Pattern 5: Deduplication by Most Recent
`geo_data.py` queries with `order("scored_at", desc=True)` and deduplicates by page_path/keyword keeping the latest. All dashboard queries and new Python queries should follow this pattern.

### Pattern 6: Research Cache for Non-Research Days
Research runs Wed+Sat. Daily runs load from `research_cache.json`. New mention data follows this same caching pattern -- mention_tracker stores to cache, daily runs read from cache.

## Anti-Patterns to Avoid

### Anti-Pattern 1: API Routes for Read-Only Data
**Do not** create Next.js `/api/` routes for GEO data. The entire dashboard uses direct Supabase queries. Adding API routes creates inconsistency and adds latency.

### Anti-Pattern 2: Additional SerpAPI Calls for Competitor Monitoring
**Do not** make new SerpAPI calls to track competitors. The `ai_overview_references` data is already stored in `serp_features` by `process_serp_features()`. Competitor monitoring is pure analysis of existing data -- zero additional API cost.

### Anti-Pattern 3: Real-Time Dashboard Polling
**Do not** use Supabase realtime subscriptions or short-interval polling. GEO scores update once daily. SERP features update Wed+Sat. Mentions update Wed+Sat. Fetch on component mount, optionally add a manual refresh button.

### Anti-Pattern 4: Separate Tables per Platform
**Do not** create reddit_mentions, yelp_mentions, etc. as separate tables. Use single `client_mentions` table with `platform` column. Source diversity scoring needs to aggregate across platforms -- a single table makes this a simple GROUP BY.

### Anti-Pattern 5: Replacing reddit.py Entirely
**Do not** delete `reddit.py` yet. It still works if Reddit OAuth credentials are provided. `mention_tracker.py` is the new primary source, but the old module can serve as fallback. research_runner.py keeps both: step 2 (reddit.py, may return []) and step 11 (mention_tracker, overwrites reddit_questions in cache).

## Suggested Build Order

```
Phase 1: Database + Python Mention Tracking
  1a. CREATE TABLE client_mentions in Supabase
  1b. Build mention_tracker.py (Brave Search queries, dedup, scoring)
  1c. Wire into research_runner.py as step 11
  1d. Build competitor_aio_monitor.py (reads serp_features)
  1e. Wire competitor_aio_monitor into seo_loop.py Step 1c
  1f. Add competitor AIO + source diversity sections to brain.py

Phase 2: Dashboard Foundation
  2a. Add TypeScript types (GeoScore, SerpFeature, ClientMention)
  2b. Extend SeoEngineTabId, update SeoTabNav.tsx
  2c. Build GeoDashboard.tsx container with Supabase fetching
  2d. Update page.tsx to render GeoDashboard on 'geo' tab

Phase 3: Dashboard Components (parallelizable, no interdeps)
  3a. GeoScoreCards.tsx
  3b. BudgetGauge.tsx
  3c. CitationTrends.tsx
  3d. SnippetTracker.tsx

Phase 4: Source Diversity Display
  4a. SourceDiversityPanel.tsx (needs client_mentions data from Phase 1)

Phase 5: Tech Debt Cleanup
  5a. Fix content_validator word count mismatch (50-150 vs brain rule 40-60)
  5b. Wire inject_organization_on_all_pages() into runtime
  5c. Populate same_as_urls in clients.json
```

**Why this order:**
- Phase 1 first: mention data needs 2+ research cycles (1 week) to accumulate before dashboard has meaningful data to display.
- Phase 2 before Phase 3: tab plumbing and container must exist before leaf components.
- Phase 3 components read from different tables with no shared state -- build in any order.
- Phase 4 depends on Phase 1 data existing in client_mentions table.
- Phase 5 (tech debt) is independent and can be done anytime but naturally fits at the end.

## Scalability Considerations

| Concern | 2 clients (current) | 10 clients | 50 clients |
|---------|---------------------|------------|------------|
| Brave API (mentions) | ~10 queries/week | ~50/week | ~250/week (may need paid tier) |
| client_mentions rows | ~20/week | ~100/week | Add 90-day retention policy |
| Dashboard geo_scores load | <100 rows | <500 rows | Paginate, aggregate by week |
| Competitor AIO analysis | <50 serp_features rows | <250 rows | Fine, read-only analysis |
| SerpAPI budget | 400 used/month of 950 | Hits 950 cap | Upgrade plan ($50/mo) |

## Sources

- Existing codebase: seo_loop.py, geo_scorer.py, geo_data.py, serpapi_client.py, research_runner.py, brand_mentions.py, reddit.py, page.tsx, SeoTabNav.tsx, types.ts -- HIGH confidence (direct code review)
- PROJECT.md constraints: Reddit API blocked, Brave Search for Reddit data, SerpAPI budget caps -- HIGH confidence
- [Brave Search API query parameters](https://api-dashboard.search.brave.com/app/documentation/web-search/query) -- HIGH confidence
- [Brave Search operators (site: etc.)](https://search.brave.com/help/operators) -- HIGH confidence

---

*Architecture analysis for v1.1 milestone: 2026-03-10*
