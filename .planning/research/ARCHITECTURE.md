# Architecture Patterns

**Domain:** GEO module integration into existing SEO engine
**Researched:** 2026-03-10

## Recommended Architecture

Extend the existing SEO engine's pipeline pattern -- do not introduce new orchestration. Every GEO component slots into one of four existing layers: research, data collection, brain context, or actions. The only new infrastructure is a SerpAPI client with usage tracking and two new Supabase tables.

### Architecture Diagram

```
                         seo_loop.py (daily orchestrator)
                              |
    +-----------+-------------+-------------+-----------+
    |           |             |             |           |
[Step 1]    [Step 2]     [Step 5]      [Step 6]    [Step 7]
data_       research_     brain.py      _execute_    outcome_
collector   runner                      action       logger
    |           |             |             |           |
    |    +------+------+      |      +------+------+    |
    |    |      |      |      |      |      |      |    |
    |  serp_  mention_ geo_   |   blog_  page_   geo_   |
    |  api    tracker  scorer |   engine optim.  content |
    |    |      |      |      |      |      |    upgrade |
    |    +------+------+      |      +------+------+    |
    |           |             |             |           |
    +------> Supabase <------+-----> Supabase <--------+
              (read)                  (write)
```

### Component Boundaries

| Component | Responsibility | Communicates With | New or Modified |
|-----------|---------------|-------------------|-----------------|
| `serpapi_client.py` | Centralized SerpAPI wrapper with usage tracking + hard cap | research modules, data_collector | **NEW** |
| `research/serp_api.py` | Replace Apify SERP scraper. AI Overview detection, PAA extraction, Featured Snippet data, organic results | serpapi_client, research_runner, brain (via cache) | **NEW** (replaces serp_scraper.py) |
| `research/mention_tracker.py` | Cross-platform mention discovery via Brave Search. Reddit questions via `site:reddit.com`. Source diversity scoring | research_runner, brain (via cache) | **NEW** (absorbs reddit.py) |
| `geo_scorer.py` | Score each page for GEO readiness: answer blocks, stat density, schema, structure, freshness signals | data_collector (page inventory), brain | **NEW** |
| `brain.py` | Receives GEO scores, AI Overview data, PAA data, mention data. Prioritizes GEO improvements alongside traditional SEO | All research + data modules | **MODIFIED** (new prompt sections) |
| `actions/geo_content.py` | Content structure upgrades: definitive lists, comparison tables, stat-dense formatting, enhanced answer blocks | brain (dispatched by seo_loop) | **NEW** |
| `schema_injector.py` | Add Organization schema with sameAs, enhanced BlogPosting with speakable, HowTo schema | brain (dispatched by seo_loop) | **MODIFIED** (new schema types) |
| `outcome_logger.py` | Track GEO-specific outcomes: AI Overview citation changes, GEO score changes over time | seo_loop, Supabase | **MODIFIED** (new metric columns) |
| `research_runner.py` | Orchestrate new research modules alongside existing ones | All research modules | **MODIFIED** (add new modules) |
| `data_collector.py` | Integrate GEO scores into performance data passed to brain | geo_scorer, page inventory | **MODIFIED** (call geo_scorer) |
| `engine_tuning.json` | Add GEO-specific tuning: content structure preferences, answer block style | brain | **MODIFIED** (new fields) |

### Data Flow

**SerpAPI Data Flow (Research Day: Wed + Sat):**

```
research_runner.py
  -> serpapi_client.py (usage-tracked wrapper)
    -> SerpAPI /search?engine=google
      <- organic_results, related_questions (PAA), ai_overview.page_token, featured_snippet
    -> SerpAPI /search?engine=google_ai_overview (if page_token exists)
      <- ai_overview.text_blocks, ai_overview.references (with links)
  -> Parse: is client domain in references? What position?
  -> Cache to research_cache.json:
      {
        "ai_overview_citations": [{"keyword": "...", "cited": true, "position": 2, "references": [...]}],
        "paa_questions": [{"question": "...", "snippet": "...", "source": "..."}],
        "featured_snippets": [{"keyword": "...", "holder": "...", "holder_url": "..."}],
        "competitor_serps": {...}  // existing field, now from SerpAPI
      }
  -> serpapi_client tracks usage in Supabase `serpapi_usage` table
```

**GEO Scoring Flow (Daily):**

```
data_collector.py
  -> scan_page_inventory(website_path)  // existing
  -> geo_scorer.score_pages(pages, research_cache)  // NEW
    For each page:
      - Has answer capsule? (CSS class or pattern match)
      - Has question-format H2s?
      - Has comparison table?
      - Has stat-dense content (numbers, PSI, sq ft)?
      - Has "Last updated" date?
      - Has schema markup? (from schema_audit)
      - Has internal links?
      - Is cited in AI Overview? (from research cache)
      - Freshness: days since last modification
    -> Returns: {"filename": "blog/xyz.html", "geo_score": 72, "gaps": ["no_answer_capsule", "stale_date"]}
  -> Passed to brain.py as geo_scores parameter
```

**Brain Integration Flow:**

```
brain.py _build_prompt()
  -> New section: "GEO SCORES (citation readiness per page):"
    page.html: 72/100 | gaps: no_answer_capsule, stale_date
    blog/xyz.html: 45/100 | gaps: no_stats, no_comparison_table, no_schema
  -> New section: "AI OVERVIEW STATUS:"
    "turf cleaning poway": CITED at position #2 (defend!)
    "artificial turf cleaning san diego": NOT CITED (opportunity)
  -> New section: "PAA QUESTIONS (from SerpAPI):"
    "How much does turf cleaning cost?" -- currently held by: competitor.com
  -> New section: "FEATURED SNIPPETS:"
    "turf cleaning cost" -- held by: yelp.com (attackable)
  -> New section: "CROSS-PLATFORM MENTIONS:"
    Reddit: 3 threads mention client | Yelp: listed | BBB: not listed
  -> Updated rules: "When GEO score < 60, prioritize geo_content_upgrade over new content"
```

**Content Upgrade Action Flow:**

```
brain returns: {"action_type": "geo_content_upgrade", "filename": "blog/xyz.html", "upgrades": [...]}
seo_loop._execute_action()
  -> actions/geo_content.py
    - Parse existing HTML
    - Add/improve answer capsule (50-150 words, self-contained)
    - Add comparison table if missing for vs-type content
    - Add stat-dense paragraph with specific measurements
    - Update "Last updated" date
    - Ensure question-format H2s
    - Add definitive numbered list if how-to content
  -> Write file, git commit, git push
  -> outcome_logger: log with geo_score baseline for follow-up measurement
```

**Mention Tracking Flow (Research Day):**

```
research_runner.py
  -> mention_tracker.py
    -> Brave Search: "{client_name}" site:reddit.com
    -> Brave Search: "{client_name}" site:yelp.com
    -> Brave Search: "{client_name}" -site:{client_domain}
    -> Score: source diversity = count of unique platforms mentioning client
  -> Cache to research_cache.json:
      {
        "mentions": {"reddit": [...], "yelp": [...], "bbb": [...], "other": [...]},
        "source_diversity_score": 4,  // out of 10 target platforms
        "missing_platforms": ["bbb", "thumbtack", "angi"]
      }
```

## Patterns to Follow

### Pattern 1: Usage-Tracked API Client
**What:** Centralized SerpAPI client that tracks every call in Supabase and enforces hard monthly caps per client.
**When:** Every SerpAPI call goes through this client. No direct HTTP calls to SerpAPI from any module.
**Why:** SerpAPI is $25/mo for 1000 searches. Blowing the budget silently would be catastrophic. The client must hard-stop before the limit.

```python
# serpapi_client.py
class SerpAPIClient:
    def __init__(self, client_slug):
        self.slug = client_slug
        self.monthly_cap = 200  # per client
        self.global_cap = 950  # total (50 buffer for manual)

    def search(self, query, **params):
        usage = self._get_month_usage()
        if usage["client"] >= self.monthly_cap:
            raise BudgetExhausted(f"{self.slug}: {usage['client']}/{self.monthly_cap}")
        if usage["global"] >= self.global_cap:
            raise BudgetExhausted(f"Global: {usage['global']}/{self.global_cap}")
        # Execute search, log to serpapi_usage table, return results
```

### Pattern 2: Extend Brain Prompt, Don't Fork It
**What:** Add new GEO sections to the existing `_build_prompt()` function. Do not create a separate GEO brain.
**When:** Always. The brain needs unified context to make tradeoff decisions between traditional SEO and GEO actions.
**Why:** The brain's value is in weighing ALL signals together. A separate GEO brain would make conflicting decisions. The existing prompt already has 36+ rules and handles complex prioritization.

### Pattern 3: Cache-First Research Architecture
**What:** GEO research runs on Wed+Sat (same as existing research). Results cached to `research_cache.json`. Daily runs read from cache.
**When:** All SerpAPI-derived data (AI Overviews, PAA, Featured Snippets) follows this pattern.
**Why:** SerpAPI budget is tight (200/client/month). Running AI Overview checks daily for all keywords would burn the budget in a week. Wed+Sat gives 2 fresh snapshots per week, and the data doesn't change faster than that for local service queries.

### Pattern 4: GEO Score as Page Metadata
**What:** GEO score is computed per-page during data collection and passed to the brain as structured metadata alongside page inventory.
**When:** Every daily run. GEO scoring is cheap (local HTML analysis + cached SerpAPI data).
**Why:** The brain can't act on GEO without knowing which pages need work. The score makes gaps visible and actionable. It parallels how schema_audit already works.

### Pattern 5: New Action Type for Content Upgrades
**What:** `geo_content_upgrade` as a new action_type distinct from `page_edit`.
**When:** Brain detects a page with low GEO score that could be improved with structural changes.
**Why:** `page_edit` is for traditional SEO edits (headings, copy, keywords). GEO upgrades are structural: answer blocks, tables, stat density, date freshness. Separating them allows independent rate limiting, outcome tracking, and tuning. The brain learns which approach works better.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate GEO Orchestrator
**What:** Creating a new `geo_loop.py` that runs independently from `seo_loop.py`.
**Why bad:** Doubles complexity, creates scheduling conflicts, splits the brain's context. Two loops might both try to edit the same page. Rate limits become impossible to enforce across two systems.
**Instead:** All GEO logic integrates into the existing loop steps. GEO is an enhancement to SEO, not a parallel system.

### Anti-Pattern 2: Real-Time SerpAPI Calls
**What:** Calling SerpAPI during the brain call or action execution phase (not research phase).
**Why bad:** SerpAPI calls are slow (2-5 seconds each) and budget-limited. The brain call is already long (claude -p can take 60+ seconds). Adding API latency compounds. And if the brain decides to check 10 keywords, you blow 5% of your monthly budget in one cycle.
**Instead:** All SerpAPI data is pre-fetched during the research step and cached. Brain reads from cache only.

### Anti-Pattern 3: GEO Score Without Calibration
**What:** Deploying GEO scoring without baseline data, then having the brain aggressively prioritize GEO upgrades.
**Why bad:** Until you have 2-4 weeks of GEO scores + outcome data, you don't know what score thresholds matter. The brain might waste cycles optimizing pages that are already citation-ready.
**Instead:** Phase 1 is measurement-only: compute scores, store them, but don't give the brain action authority over GEO. Phase 2 enables brain-driven GEO actions after calibration.

### Anti-Pattern 4: Tracking Perplexity/ChatGPT Citations
**What:** Building citation tracking for AI platforms beyond Google AI Overviews.
**Why bad:** No reliable API exists for Perplexity or ChatGPT citation tracking. Results are inconsistent and non-reproducible. You'd build infrastructure that produces unreliable data, which corrupts the brain's decision-making.
**Instead:** Track only Google AI Overviews (via SerpAPI, reliable and structured). Add other platforms later if APIs materialize.

## Scalability Considerations

| Concern | At 2 clients | At 5 clients | At 10 clients |
|---------|-------------|-------------|--------------|
| SerpAPI budget | 400/mo, plenty of headroom | 1000/mo, need $50 plan | 2000/mo, need $75+ plan |
| Research cache size | ~50KB per client, negligible | ~250KB total, fine | ~500KB total, still fine |
| Brain prompt size | ~15K chars (current ~12K + GEO sections) | Same per client | Same per client |
| Daily loop runtime | ~8 min total (2 clients x ~4 min) | ~20 min total | ~40 min, consider parallelizing |
| Supabase storage | Minimal, hundreds of rows/month | Thousands of rows/month, still free tier | May need Supabase Pro |
| GEO scoring | <1 sec per client (local file scan) | <3 sec total | <5 sec total |

## New Supabase Tables

### `serpapi_usage`
Tracks every SerpAPI call for budget enforcement.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| client_slug | text | Which client this search was for |
| query | text | The search query |
| search_type | text | "google", "google_ai_overview" |
| credits_used | int | Number of API credits consumed |
| created_at | timestamp | When the search was made |

### `geo_scores` (or add columns to existing `seo_actions`)
Tracks GEO score history per page for trend analysis.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| client_id | uuid | FK to clients |
| page_path | text | Relative path (e.g., "blog/xyz.html") |
| geo_score | int | 0-100 composite score |
| gaps | jsonb | Array of gap identifiers |
| ai_overview_cited | boolean | Is this page cited in any AI Overview? |
| scored_at | date | When this score was computed |

## Suggested Build Order

Based on dependency analysis:

1. **serpapi_client.py + serpapi_usage table** -- Everything else depends on this. No SerpAPI calls without budget tracking.
2. **research/serp_api.py** -- Replace Apify scraper with SerpAPI. Gets organic results, PAA, featured snippets. No AI Overview yet (separate API call, save budget for calibration).
3. **geo_scorer.py** -- Score existing pages. This is local analysis only, no API cost. Gives immediate visibility into GEO readiness.
4. **brain.py GEO sections** -- Add GEO scores + SerpAPI data to brain prompt. Initially read-only (brain sees data but no new action types yet).
5. **AI Overview detection** -- Add the two-step AI Overview flow to serp_api.py. Budget-aware: only check top 5-10 keywords per client per research day.
6. **geo_content_upgrade action** -- New action type the brain can use to upgrade page structure.
7. **research/mention_tracker.py** -- Cross-platform mention discovery via Brave Search. Lower priority because it informs strategy, not immediate actions.
8. **schema_injector.py upgrades** -- Organization schema, enhanced BlogPosting, HowTo schema.
9. **Outcome tracking for GEO** -- Add geo_score follow-ups to outcome_logger.py. Measures whether GEO upgrades actually improve citation rates.

**Dependency chain:** 1 -> 2 -> 4 (brain needs SerpAPI data). 3 -> 4 (brain needs GEO scores). 5 depends on 1. 6 depends on 4. 7 is independent. 8 is independent. 9 depends on 3 + 6.

## Sources

- [SerpAPI AI Overview API](https://serpapi.com/ai-overview) - HIGH confidence. Official documentation confirming two-step AI Overview retrieval (page_token then google_ai_overview engine).
- [SerpAPI AI Overview Rank Tracker Python Tutorial](https://serpapi.com/blog/ai-overview-rank-tracker-using-python/) - HIGH confidence. Official blog with working Python code for domain citation matching.
- [SerpAPI Google Search API - PAA/Related Questions](https://serpapi.com/blog/unlocking-seo-insights/) - MEDIUM confidence. Official blog confirming `related_questions` field in response.
- [GEO: Generative Engine Optimization (arXiv paper)](https://arxiv.org/abs/2311.09735) - HIGH confidence. Academic paper establishing GEO scoring methodology.
- [Search Engine Land GEO Guide 2026](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142) - MEDIUM confidence. Industry source confirming listicle/structured content citation patterns.
- Existing codebase analysis: seo_loop.py, brain.py, research_runner.py, data_collector.py, schema_injector.py, outcome_logger.py, serp_scraper.py, aeo_opportunities.py - HIGH confidence. Direct code review.

---

*Architecture analysis: 2026-03-10*
