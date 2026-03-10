# Phase 2: GEO Scoring + AI Overview Detection - Research

**Researched:** 2026-03-10
**Domain:** SerpAPI AI Overview extraction, local HTML analysis, Supabase time-series storage
**Confidence:** HIGH

## Summary

Phase 2 has two distinct workstreams that share no code: (A) extracting AI Overview, PAA, and Featured Snippet data from SerpAPI responses and storing them in Supabase, and (B) building a local HTML analyzer that scores client pages for citation-readiness. Workstream A extends the existing `serpapi_client.py` with a two-step AI Overview fetch and adds Supabase tables for SERP feature data. Workstream B is a new pure-Python module that reads local HTML files (already accessible via `website_local_path` in `clients.json`) and outputs a 0-5 binary checklist score.

The SerpAPI two-step AI Overview fetch is the riskiest part. The `page_token` expires in 60 seconds (conservative estimate -- one source says 4 minutes, but the official API docs say 1 minute). The follow-up call uses `engine=google_ai_overview` and consumes an additional SerpAPI credit. This means keywords that trigger a deferred AI Overview cost 2 credits instead of 1. With 8 keywords per client per research day and only some triggering AI Overviews, the budget impact is manageable but must be tracked. The existing `serpapi_usage` table already logs each call with `search_type`, so tracking `ai_overview` as a separate type handles this naturally.

The GEO scorer is zero-cost (local file analysis only) and should run daily during data collection -- not just on research days. It analyzes HTML for five binary signals: answer blocks, stats/data density, schema presence, heading structure quality, and content freshness signals. These signals are deliberately simple and unweighted per GEO-05. The scorer reads from the local filesystem paths already configured per client (`website_local_path` in clients.json).

**Primary recommendation:** Split into two plans -- Plan 1 handles SERP feature extraction (AI Overview two-step, PAA, Featured Snippets) with Supabase storage. Plan 2 handles the GEO scorer module with daily scoring integration into the data collection step.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SERP-05 | AI Overview detection per tracked keyword | SerpAPI response includes `ai_overview` field when present. Check for its existence per keyword. Store boolean `has_ai_overview` plus raw data in Supabase. |
| SERP-06 | AI Overview citation check (client URL in references) | `ai_overview.references` array contains `link` fields. Match against client's `website` URL from clients.json. Store `client_cited` boolean. |
| SERP-07 | Two-step AI Overview fetch with page_token expiration handling | When `ai_overview.page_token` exists, immediately call `engine=google_ai_overview` with that token. Token expires in 60 seconds. Costs 1 extra credit. Must be called before processing next keyword. |
| SERP-08 | PAA extraction from related_questions field | `related_questions` array already captured in `serp_extras` from Phase 1. Each object has `question`, `snippet`, `title`, `link`. Store structured in Supabase. |
| SERP-09 | Featured Snippet tracking (who holds snippet per keyword) | `answer_box` field contains `link` for the snippet holder. Compare against client URL. Store snippet holder URL and whether client owns it. |
| GEO-01 | GEO scorer analyzes local HTML for citation-readiness signals | New `geo_scorer.py` module reads local HTML files via `website_local_path`. Checks 5 binary factors: answer blocks, stats density, schema presence, heading structure, freshness. |
| GEO-02 | Score stored per page in Supabase with timestamp for trends | New `geo_scores` table with page_url, score, factors JSON, scored_at timestamp. Daily inserts create trend data. |
| GEO-03 | Scoring runs daily during data collection (zero API cost) | Hook into `seo_loop.py` data collection step (Step 1). Pure local file analysis, no HTTP calls. |
| GEO-04 | Baseline capture: 2-4 weeks before brain acts | Score daily, store in Supabase, but do NOT wire into brain prompt (that is Phase 3). Accumulate data silently. |
| GEO-05 | Score is binary checklist (0-5), not weighted formula | Each of 5 factors is 0 or 1. Total score is sum. No weights. Validated against citation data after 30+ data points (future phase). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-search-results | 2.4.2 | SerpAPI wrapper (already installed) | Official SerpAPI library, handles google_ai_overview engine |
| supabase | 2.28.0 | Database client (already installed) | Already used throughout project |
| beautifulsoup4 | 4.12+ | HTML parsing for GEO scorer | Standard Python HTML parser, handles malformed HTML gracefully |
| python-dotenv | 1.0.0 | Env vars (already installed) | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| re (stdlib) | - | Regex for heading/stats detection | Used in GEO scorer for pattern matching |
| json (stdlib) | - | Schema extraction from LD+JSON | Used in GEO scorer for schema presence check |
| pathlib (stdlib) | - | File system paths | Already used throughout for website_local_path |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| beautifulsoup4 | lxml only | bs4 handles malformed HTML better, lxml is faster but less forgiving |
| beautifulsoup4 | regex only | Regex for HTML parsing is fragile; bs4 is the right tool for structural analysis |

**Installation:**
```bash
pip install beautifulsoup4
```

## Architecture Patterns

### Integration Points
```
seo_loop.py
  Step 1: collect_performance_data(client)  <-- ADD GEO scoring here (daily)
  Step 2: run_research(client)              <-- SERP features already captured in serp_extras

  NEW in Step 1 or new Step 1b:
    geo_scorer.score_all_pages(client) -> stores scores in Supabase

research_runner.py
  scrape_serp() -> returns (organic, serp_extras)  <-- serp_extras has ai_overview, PAA, answer_box

  NEW after scrape_serp():
    process_serp_features(serp_extras, client_id, client_website) -> stores to Supabase
```

### Recommended New Module Structure
```
scripts/seo_engine/
  serpapi_client.py          # MODIFY: add fetch_ai_overview() for two-step
  geo_scorer.py              # NEW: local HTML citation-readiness scoring
  research/
    serp_scraper.py          # MINOR: call two-step AI Overview after initial search
    research_runner.py       # MODIFY: add SERP feature processing + Supabase storage
```

### Pattern 1: Two-Step AI Overview Fetch
**What:** Immediately follow up with page_token when AI Overview requires separate request
**When to use:** When `ai_overview.page_token` exists in initial search response
**Example:**
```python
# Source: SerpAPI Google AI Overview API docs
def fetch_ai_overview(page_token: str, client_id: str) -> dict:
    """Fetch full AI Overview using page_token from initial search.

    IMPORTANT: page_token expires in ~60 seconds. Call immediately.
    Costs 1 additional SerpAPI credit.
    """
    budget = check_budget(client_id)
    if not budget["allowed"]:
        return {"blocked": True, "reason": budget["reason"]}

    params = {
        "engine": "google_ai_overview",
        "page_token": page_token,
        "api_key": os.getenv("SERPAPI_KEY"),
    }
    search = GoogleSearch(params)
    results = search.get_dict()

    # Log as ai_overview type (separate from organic)
    sb = _get_supabase()
    sb.table("serpapi_usage").insert({
        "client_id": client_id,
        "query": "ai_overview_followup",
        "search_type": "ai_overview",
        "location": None,
    }).execute()

    return results
```

### Pattern 2: SERP Feature Extraction and Storage
**What:** Extract AI Overview, PAA, and Featured Snippet data from serp_extras and store in Supabase
**When to use:** After every research run that returns serp_extras
**Example:**
```python
def process_serp_features(serp_extras: dict, client_id: str, client_website: str):
    """Extract and store SERP features per keyword in Supabase."""
    sb = _get_supabase()

    for keyword, extras in serp_extras.items():
        ai_overview = extras.get("ai_overview") or {}
        paa = extras.get("related_questions", [])
        answer_box = extras.get("answer_box") or {}

        # AI Overview detection
        has_ai_overview = bool(ai_overview and not ai_overview.get("error"))

        # Citation check -- does client URL appear in AI Overview references?
        client_cited = False
        references = ai_overview.get("references", [])
        for ref in references:
            if client_website.rstrip("/") in (ref.get("link", "") or ""):
                client_cited = True
                break

        # Featured Snippet -- who holds it?
        snippet_holder = answer_box.get("link", "") if answer_box else ""
        client_has_snippet = client_website.rstrip("/") in snippet_holder if snippet_holder else False

        # Store per-keyword SERP features
        sb.table("serp_features").insert({
            "client_id": client_id,
            "keyword": keyword,
            "has_ai_overview": has_ai_overview,
            "client_cited_in_ai_overview": client_cited,
            "ai_overview_references": json.dumps(references),
            "paa_questions": json.dumps([q.get("question", "") for q in paa]),
            "paa_data": json.dumps(paa),
            "has_featured_snippet": bool(answer_box),
            "featured_snippet_holder": snippet_holder,
            "client_has_snippet": client_has_snippet,
        }).execute()
```

### Pattern 3: GEO Score Binary Checklist
**What:** Score a single HTML page on 5 binary factors (0 or 1 each)
**When to use:** Daily for every client page
**Example:**
```python
from bs4 import BeautifulSoup
import json
import re

def score_page(html: str) -> dict:
    """Score a page for GEO citation-readiness (0-5 binary checklist).

    Factors:
      1. answer_block: Has a concise answer paragraph (40-80 words) in first 500 words
      2. stats_density: Contains at least 2 stat-like patterns (numbers + context)
      3. schema_present: Has at least one JSON-LD schema block
      4. heading_structure: Has H2s that form a logical Q&A or topic structure
      5. freshness_signal: Has a visible date, "updated" text, or recent copyright year

    Returns: {"score": int, "factors": {"answer_block": 0|1, ...}, "details": {...}}
    """
    soup = BeautifulSoup(html, "html.parser")
    factors = {}
    details = {}

    # 1. Answer block: concise paragraph early in content
    factors["answer_block"] = _check_answer_block(soup)

    # 2. Stats density: numbers with context
    factors["stats_density"] = _check_stats_density(soup)

    # 3. Schema presence
    factors["schema_present"] = _check_schema(html)

    # 4. Heading structure
    factors["heading_structure"] = _check_headings(soup)

    # 5. Freshness signal
    factors["freshness_signal"] = _check_freshness(soup, html)

    score = sum(factors.values())
    return {"score": score, "factors": factors}
```

### Anti-Patterns to Avoid
- **Processing page_token after all keywords:** The token expires in 60 seconds. Must fetch immediately after the initial search for that keyword, before moving to the next keyword.
- **Storing GEO scores in the research cache:** Research cache is JSON on disk, only updated Wed/Sat. GEO scores must go to Supabase for daily trend tracking.
- **Weighted GEO formula:** GEO-05 explicitly says binary checklist first, validate weights after 30+ data points. Do not attempt weighted scoring yet.
- **Fetching page HTML via HTTP for GEO scoring:** Pages are local files on disk. Use `website_local_path` from clients.json. Zero API cost.
- **Running GEO scoring only on research days:** It must run daily (GEO-03). Hook into data collection, not research.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing for GEO scoring | Custom regex HTML parser | BeautifulSoup4 | Handles malformed HTML, nested structures, encoding issues |
| Schema detection in pages | Custom JSON-LD extractor | Existing `_extract_schema_types()` in `schema_injector.py` | Already built and tested, reuse the pattern |
| AI Overview token management | Custom HTTP client for token fetch | SerpAPI `GoogleSearch` with `engine=google_ai_overview` | Library handles request formatting, retries |
| URL matching for citation check | Exact string match | `urllib.parse` normalization + contains check | URLs can have trailing slashes, www prefixes, https vs http |

**Key insight:** The GEO scorer must be simple enough that false positives/negatives are obvious. Binary factors with clear detection rules are better than sophisticated NLP. We validate accuracy later with citation correlation data.

## Common Pitfalls

### Pitfall 1: page_token Expiration Window Confusion
**What goes wrong:** Token expires before the follow-up call because other keywords are processed first.
**Why it happens:** Processing keywords in a loop and deferring AI Overview fetches to the end.
**How to avoid:** Immediately after getting a response with `ai_overview.page_token`, call `fetch_ai_overview()` before processing the next keyword. The loop must be: search keyword -> check for page_token -> if yes, follow up immediately -> then next keyword.
**Warning signs:** AI Overview responses returning errors or empty data despite page_token being present.

### Pitfall 2: Two-Step Fetch Doubles Budget Consumption
**What goes wrong:** AI Overview follow-up calls are not counted against budget, leading to overages.
**Why it happens:** The follow-up uses `engine=google_ai_overview` which is a separate API call costing 1 credit.
**How to avoid:** Route the follow-up through `serpapi_client.py` with `search_type="ai_overview"` so it gets logged in `serpapi_usage`. The budget gate catches it naturally. Worst case: 8 keywords * 2 credits = 16 per research run per client (vs 8 without AI Overview follow-ups). With 200/client/month cap and 8 research days/month, this is 128 credits -- well within budget.
**Warning signs:** `check_account_balance()` showing higher usage than expected from `serpapi_usage` count.

### Pitfall 3: AI Overview Not Always Present
**What goes wrong:** Code assumes `ai_overview` is always in the response and crashes on KeyError.
**Why it happens:** AI Overviews only appear for some queries, in some regions, in English.
**How to avoid:** Always use `.get("ai_overview")` with default `None`. The SERP feature storage should record `has_ai_overview = False` for keywords without it -- this is valuable data (knowing which keywords do NOT trigger AI Overviews is as important as knowing which do).

### Pitfall 4: GEO Scorer False Positives on Stats Detection
**What goes wrong:** Phone numbers, zip codes, and prices get counted as "stats."
**Why it happens:** Naive regex like `\d+` matches everything.
**How to avoid:** Stats detection should look for patterns like "X% of...", "over X years", "rated X out of Y", "$X,XXX" in a context that suggests data/claims. Exclude phone numbers (10-digit patterns), zip codes (5-digit), and standalone prices.
**Warning signs:** Every page scoring 1/1 on stats_density regardless of actual content.

### Pitfall 5: Supabase Insert Failures Silently Ignored
**What goes wrong:** SERP feature or GEO score data not being stored but no error shown.
**Why it happens:** Supabase insert in a try/except that catches too broadly.
**How to avoid:** Log every Supabase insert result. Use `.execute()` and check the response. For SERP features, a failed insert means lost data that costs budget to re-acquire.

## Code Examples

### Supabase Schema: serp_features Table
```sql
-- SERP feature tracking per keyword per collection run
CREATE TABLE IF NOT EXISTS serp_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    has_ai_overview BOOLEAN DEFAULT FALSE,
    client_cited_in_ai_overview BOOLEAN DEFAULT FALSE,
    ai_overview_references JSONB DEFAULT '[]',
    paa_questions JSONB DEFAULT '[]',
    paa_data JSONB DEFAULT '[]',
    has_featured_snippet BOOLEAN DEFAULT FALSE,
    featured_snippet_holder TEXT,
    client_has_snippet BOOLEAN DEFAULT FALSE,
    collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for per-keyword time series
CREATE INDEX idx_serp_features_keyword ON serp_features(client_id, keyword, collected_at);

-- Index for AI Overview detection queries
CREATE INDEX idx_serp_features_ai_overview ON serp_features(client_id, has_ai_overview, collected_at);
```

### Supabase Schema: geo_scores Table
```sql
-- GEO citation-readiness score per page per day
CREATE TABLE IF NOT EXISTS geo_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    page_path TEXT NOT NULL,          -- relative path, e.g. "services.html"
    page_url TEXT,                     -- full URL, e.g. "https://mrgreenturfclean.com/services.html"
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 5),
    factors JSONB NOT NULL,            -- {"answer_block": 0, "stats_density": 1, ...}
    scored_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One score per page per day (upsert target)
CREATE UNIQUE INDEX idx_geo_scores_page_day ON geo_scores(client_id, page_path, scored_at);

-- Index for trend queries
CREATE INDEX idx_geo_scores_trend ON geo_scores(client_id, scored_at);
```

### GEO Score Factor Detection Examples
```python
# Factor 1: Answer block detection
# Look for a concise paragraph (30-80 words) near the top of content that
# reads as a self-contained answer (not a sales pitch)
def _check_answer_block(soup) -> int:
    """Check if page has a concise answer paragraph early in content."""
    # Get text content from first ~500 words
    body = soup.find("body")
    if not body:
        return 0

    # Look for paragraphs within first few sections
    paragraphs = body.find_all("p")[:10]
    for p in paragraphs:
        text = p.get_text(strip=True)
        word_count = len(text.split())
        # Answer blocks are 30-80 words, self-contained
        if 30 <= word_count <= 80:
            return 1
    return 0

# Factor 2: Stats density
# Look for number patterns that suggest data/claims (not phone numbers)
STATS_PATTERNS = [
    r'\d+%',                           # percentages
    r'\d+\+?\s*years?',                # years of experience
    r'over\s+\d+',                     # "over 500"
    r'rated\s+\d',                     # "rated 5"
    r'\d+\s*out\s*of\s*\d+',          # "4 out of 5"
    r'\$[\d,]+',                       # dollar amounts
    r'\d+\s*(?:sq\.?\s*ft|square\s*feet)',  # square footage
]

def _check_stats_density(soup) -> int:
    """Check if page contains at least 2 stat-like patterns."""
    text = soup.get_text()
    count = sum(1 for pattern in STATS_PATTERNS if re.search(pattern, text, re.I))
    return 1 if count >= 2 else 0

# Factor 3: Schema presence (reuse pattern from schema_injector.py)
def _check_schema(html: str) -> int:
    """Check if page has at least one JSON-LD schema block."""
    pattern = r'<script\s+type=["\']application/ld\+json["\']>'
    return 1 if re.search(pattern, html, re.I) else 0

# Factor 4: Heading structure
def _check_headings(soup) -> int:
    """Check if page has well-structured H2s (3+ that suggest topic coverage)."""
    h2s = soup.find_all("h2")
    return 1 if len(h2s) >= 3 else 0

# Factor 5: Freshness signal
def _check_freshness(soup, html: str) -> int:
    """Check for visible date, 'updated' text, or current copyright year."""
    text = soup.get_text().lower()
    # Current year or last year in copyright
    if re.search(r'(?:2025|2026)', text):
        return 1
    # "Updated" or "Last modified" text
    if re.search(r'(?:updated|last modified|published)\s*:?\s*\w+\s+\d', text, re.I):
        return 1
    return 0
```

### URL Matching for Citation Checks
```python
from urllib.parse import urlparse

def url_matches_client(url: str, client_website: str) -> bool:
    """Check if a URL belongs to the client's domain.

    Handles www/non-www, trailing slashes, https/http variations.
    """
    if not url or not client_website:
        return False

    client_domain = urlparse(client_website).netloc.replace("www.", "")
    url_domain = urlparse(url).netloc.replace("www.", "")

    return client_domain == url_domain
```

### Two-Step AI Overview Integration in scrape_serp
```python
# In serp_scraper.py, modify the keyword loop:
for kw in keywords:
    result = search_google(kw, client_id, resolved_location)
    if result.get("blocked"):
        continue

    organic_results[kw] = format_organic_results(result)

    # Extract AI Overview -- handle two-step fetch
    ai_overview = result.get("ai_overview")
    if ai_overview and ai_overview.get("page_token"):
        # Must fetch immediately -- token expires in ~60 seconds
        from scripts.seo_engine.serpapi_client import fetch_ai_overview
        full_ai = fetch_ai_overview(ai_overview["page_token"], client_id)
        if not full_ai.get("blocked") and not full_ai.get("error"):
            ai_overview = full_ai.get("ai_overview", ai_overview)

    raw_extras[kw] = {
        "ai_overview": ai_overview,
        "related_questions": result.get("related_questions", []),
        "answer_box": result.get("answer_box"),
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No AI Overview tracking | SerpAPI returns ai_overview in response | Phase 1 (captures raw) | Phase 2 processes and stores it |
| No GEO scoring | Binary checklist (0-5 factors) | This phase | Foundation for brain decisions in Phase 3 |
| serp_extras in JSON cache only | serp_features table in Supabase | This phase | Time-series tracking, trend queries, citation correlation |
| No page_token handling | Two-step fetch with 60s window | This phase | Full AI Overview data even for deferred responses |

**Deprecated/outdated:**
- Apify SERP scraper: Already replaced in Phase 1. No further changes needed.
- `aeo_opportunities.py`: Placeholder module (returns empty list). Phase 2 data will eventually feed into this, but not in this phase.

## Open Questions

1. **Does the two-step AI Overview fetch cost 1 extra credit?**
   - What we know: The `google_ai_overview` engine is a separate API call. SerpAPI's general rule is "1 credit per API call."
   - What's unclear: No official source explicitly confirms or denies the credit cost for the page_token follow-up.
   - Recommendation: Assume 1 extra credit (conservative). Track with `search_type="ai_overview"` in serpapi_usage. Verify with `check_account_balance()` after first research run to compare expected vs actual usage. Budget math: worst case 16 credits per client per research day (8 keywords * 2), * 8 research days/month = 128, well under 200 cap.

2. **How frequently do local service keywords trigger AI Overviews?**
   - What we know: AI Overviews appear for informational queries more than commercial ones. Local service keywords ("turf cleaning poway") may rarely trigger them.
   - What's unclear: Exact trigger rate for our keyword set.
   - Recommendation: The first 2-4 weeks of baseline data (GEO-04) will answer this. If AI Overviews are rare for our keywords, the two-step fetch budget impact is negligible.

3. **Should GEO scoring use BeautifulSoup4 or is regex sufficient?**
   - What we know: `schema_injector.py` already uses regex for JSON-LD extraction. `data_collector.py` uses regex for title/meta extraction.
   - What's unclear: Whether the 5 GEO factors need DOM traversal or just text pattern matching.
   - Recommendation: Use BeautifulSoup4. Factors like "answer block in first 500 words" and "3+ H2 headings" require DOM awareness. The schema check can stay regex (reuse existing pattern). bs4 is a standard dependency and handles malformed HTML gracefully.

## Sources

### Primary (HIGH confidence)
- SerpAPI Google AI Overview API docs (https://serpapi.com/google-ai-overview-api) - two-step fetch, engine parameter, page_token, response structure
- SerpAPI AI Overview Results docs (https://serpapi.com/ai-overview) - ai_overview field structure, references, text_blocks, when present vs absent
- SerpAPI Related Questions docs (https://serpapi.com/related-questions) - PAA structure, question/snippet/link fields, type field
- SerpAPI Direct Answer Box docs (https://serpapi.com/direct-answer-box-api) - answer_box structure, 30+ types, link field for snippet holder
- Existing codebase: `serpapi_client.py`, `serp_scraper.py`, `research_runner.py`, `schema_injector.py`, `data_collector.py`

### Secondary (MEDIUM confidence)
- SerpAPI blog: Scraping AI Overviews (https://serpapi.com/blog/scrape-google-ai-overviews/) - practical two-step implementation, says 4 minute expiry
- SerpAPI blog: Building UI for AI Overviews (https://serpapi.com/blog/understanding-ai-overview-data-from-serpapi/) - response field details

### Tertiary (LOW confidence)
- page_token expiration: Official docs say 1 minute, blog says 4 minutes. Using 60 seconds as conservative bound. Will validate empirically.
- Two-step credit cost: No explicit confirmation. Assuming 1 credit per call based on SerpAPI's general "1 credit per API call" policy.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already used or are standard Python ecosystem (bs4)
- Architecture: HIGH - Integration points are clear from Phase 1 (serp_extras already captured), GEO scorer is a new standalone module with a clean hook point
- Pitfalls: HIGH - page_token timing is the main risk, well-documented with conservative mitigation
- Supabase schema: HIGH - Follows existing patterns (serpapi_usage table), straightforward time-series design

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (SerpAPI AI Overview API is stable; GEO scoring factors are project-defined, not external)
