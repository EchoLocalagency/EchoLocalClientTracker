# Phase 1: SerpAPI Foundation - Research

**Researched:** 2026-03-10
**Domain:** SerpAPI integration, budget tracking, Python SEO engine
**Confidence:** HIGH

## Summary

Phase 1 replaces the existing Apify-based SERP scraper (`scripts/seo_engine/research/serp_scraper.py`) with SerpAPI, adds per-client and global budget tracking in Supabase, and integrates the Account API for free balance checks. The existing codebase is well-structured for this swap: `serp_scraper.py` is imported by `research_runner.py` and called only on research days (Wed/Sat). The current Apify implementation processes keywords one at a time with polling -- SerpAPI is synchronous and returns structured JSON, making this a significant simplification.

The SerpAPI Python library (`google-search-results` v2.4.2) provides a clean wrapper. The response includes `organic_results`, `related_questions` (PAA), `answer_box` (Featured Snippets), and `ai_overview` fields in a single call. Budget tracking requires a new Supabase table (`serpapi_usage`) since no usage tracking exists today. The Account API (`/account.json`) is free and does not consume credits.

**Primary recommendation:** Build a `serpapi_client.py` module that wraps all SerpAPI calls with a budget gate (check-before-call pattern), replace the Apify import in `research_runner.py`, and create a `serpapi_usage` Supabase table for tracking.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SERP-01 | SerpAPI client module replaces Apify SERP scraper with structured results (organic, AI Overview, PAA, Featured Snippets) in a single API call | SerpAPI returns all these in one response under `organic_results`, `ai_overview`, `related_questions`, `answer_box`. Drop-in replacement for `scrape_serp()` function |
| SERP-02 | Per-client monthly usage tracking in Supabase with hard cap at 200 searches/client/month and 950 global | New `serpapi_usage` table with client_id, timestamp, search_type columns. COUNT query with date filter for cap checks |
| SERP-03 | Usage counter checked before every API call; hard-stop when cap reached | Budget gate function that queries Supabase counts before allowing any SerpAPI call. Returns blocked status, never warns-only |
| SERP-04 | SerpAPI Account API integration for free usage verification | `GET /account.json?api_key=X` returns remaining searches at zero credit cost. Use for dashboard display and health checks |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-search-results | 2.4.2 | SerpAPI Python wrapper | Official SerpAPI library, stable, well-documented |
| supabase | 2.28.0 | Database client (already installed) | Already used throughout the project |
| requests | 2.31.0 | HTTP client for Account API | Already installed, simpler than the wrapper for one-off calls |
| python-dotenv | 1.0.0 | Env var loading | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All dependencies already installed except google-search-results |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| google-search-results | Raw requests to serpapi.com/search | Library handles pagination, retries, response parsing; use it |
| google-search-results | serpapi (new package) | Newer but docs reference the legacy library everywhere; stick with legacy for now |

**Installation:**
```bash
pip install google-search-results
```

## Architecture Patterns

### Current Integration Point
```
seo_loop.py
  -> research_runner.py (runs Wed/Sat)
    -> serp_scraper.py::scrape_serp(keywords, location)  <-- REPLACE THIS
```

The `scrape_serp()` function is called in one place: `research_runner.py` line 90. It receives a list of keywords (up to 8) and a location string. The return format is `dict[keyword] -> list[result_dicts]`. The replacement must match this interface for backward compatibility.

### Recommended New Module Structure
```
scripts/seo_engine/
  serpapi_client.py          # NEW: SerpAPI wrapper + budget gate
  research/
    serp_scraper.py          # MODIFY: swap Apify for serpapi_client calls
    research_runner.py       # MINIMAL CHANGE: import stays the same
```

### Pattern 1: Budget Gate (Check-Before-Call)
**What:** Every SerpAPI call goes through a budget check function first
**When to use:** Every single API call, no exceptions
**Example:**
```python
# Source: Custom pattern for this project
def check_budget(client_id: str) -> dict:
    """Check if client and global budgets allow another search.

    Returns: {"allowed": bool, "client_used": int, "client_limit": int,
              "global_used": int, "global_limit": int, "reason": str}
    """
    sb = get_supabase()
    month_start = date.today().replace(day=1).isoformat()

    # Client count
    client_resp = sb.table("serpapi_usage") \
        .select("id", count="exact") \
        .eq("client_id", client_id) \
        .gte("searched_at", month_start) \
        .execute()
    client_used = client_resp.count or 0

    # Global count
    global_resp = sb.table("serpapi_usage") \
        .select("id", count="exact") \
        .gte("searched_at", month_start) \
        .execute()
    global_used = global_resp.count or 0

    if client_used >= CLIENT_MONTHLY_LIMIT:
        return {"allowed": False, "reason": f"Client cap reached ({client_used}/{CLIENT_MONTHLY_LIMIT})"}
    if global_used >= GLOBAL_MONTHLY_LIMIT:
        return {"allowed": False, "reason": f"Global cap reached ({global_used}/{GLOBAL_MONTHLY_LIMIT})"}

    return {"allowed": True, "client_used": client_used, "global_used": global_used}
```

### Pattern 2: SerpAPI Search with Logging
**What:** Wrap every SerpAPI call to log usage to Supabase after success
**Example:**
```python
# Source: SerpAPI docs + project patterns
from serpapi import GoogleSearch

def search_google(query: str, client_id: str, location: str, search_type: str = "organic") -> dict:
    """Execute a SerpAPI search with budget check and usage logging."""
    budget = check_budget(client_id)
    if not budget["allowed"]:
        print(f"  [serpapi] BLOCKED: {budget['reason']}")
        return {"blocked": True, "reason": budget["reason"]}

    params = {
        "q": query,
        "location": location,
        "gl": "us",
        "hl": "en",
        "api_key": os.getenv("SERPAPI_KEY"),
        "engine": "google",
    }

    search = GoogleSearch(params)
    results = search.get_dict()

    # Log usage
    sb = get_supabase()
    sb.table("serpapi_usage").insert({
        "client_id": client_id,
        "query": query,
        "search_type": search_type,
        "location": location,
    }).execute()

    return results
```

### Pattern 3: Account API Check (Free)
**What:** Query remaining balance without consuming a credit
**Example:**
```python
# Source: https://serpapi.com/account-api
def check_account_balance() -> dict:
    """Check SerpAPI account balance (free, no credit cost)."""
    resp = requests.get(
        "https://serpapi.com/account.json",
        params={"api_key": os.getenv("SERPAPI_KEY")},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "searches_used": data.get("this_month_usage", 0),
        "searches_limit": data.get("plan_searches_left", 0) + data.get("this_month_usage", 0),
        "searches_remaining": data.get("plan_searches_left", 0),
        "plan": data.get("plan_name", ""),
    }
```

### Anti-Patterns to Avoid
- **Logging after failure:** Log usage ONLY after a successful API call. If the call fails, do not increment the counter.
- **Soft warnings instead of hard blocks:** The requirement is explicit: BLOCK, do not warn. The function must return a blocked result and prevent the API call.
- **Checking budget at research_runner level only:** The gate must be in the serpapi_client module itself so no code path can bypass it.
- **Caching the budget count for the session:** Always query Supabase fresh. With only 8 keywords per research run, the DB overhead is negligible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SERP parsing | Custom HTML scraper | SerpAPI structured JSON | Already parsed, handles Google layout changes |
| Rate limiting | Custom retry/backoff | SerpAPI handles this server-side | SerpAPI queues requests internally |
| Location targeting | Custom geo-IP tricks | SerpAPI `location` parameter | Uses Google Ads location targeting, accurate |
| Month boundary detection | Manual date math | `date.today().replace(day=1)` | Simple, no edge cases with timezones (all dates are local) |

## Common Pitfalls

### Pitfall 1: Two SerpAPI Python Packages
**What goes wrong:** Installing `serpapi` (new) instead of `google-search-results` (legacy). They have different import paths and APIs.
**Why it happens:** PyPI has both packages. The new one is `serpapi`, the legacy is `google-search-results`.
**How to avoid:** Use `pip install google-search-results`. Import as `from serpapi import GoogleSearch`.
**Warning signs:** ImportError on `from serpapi import GoogleSearch` -- the new package uses `import serpapi; serpapi.search()`.

### Pitfall 2: AI Overview page_token Expiration
**What goes wrong:** The `page_token` for async AI Overviews expires in 1-4 minutes (sources disagree; treat as 60 seconds to be safe).
**Why it happens:** Google generates AI Overviews asynchronously for some queries. SerpAPI returns a token to fetch it separately.
**How to avoid:** For Phase 1, do NOT implement the two-step AI Overview fetch. That is Phase 2 (SERP-07). Phase 1 should capture whatever `ai_overview` data comes in the initial response and store the `page_token` if present, but not follow up on it.
**Warning signs:** AI Overview data is None but `page_token` is present in the response.

### Pitfall 3: Budget Race Condition
**What goes wrong:** Two concurrent seo_loop runs could both check budget, both see room, and both proceed past the cap.
**Why it happens:** Check-then-act without locking.
**How to avoid:** Not a real concern for this project. The SEO loop runs once daily via launchd and processes clients sequentially. If this ever changes, use a Supabase RPC function with row-level locking. For now, the sequential execution model is sufficient.

### Pitfall 4: Location Format Mismatch
**What goes wrong:** SerpAPI location format differs from what's in clients.json.
**Why it happens:** clients.json has `"primary_market": "Poway, CA"` but SerpAPI expects `"Poway, California, United States"`.
**How to avoid:** Map the client's `primary_market` to SerpAPI's location format. SerpAPI's location API can help, but for 2-3 clients, hardcode a mapping or use the full format in clients.json.

### Pitfall 5: Monthly Counter Reset
**What goes wrong:** Counting searches from the wrong date boundary.
**Why it happens:** Using 30-day rolling window instead of calendar month start.
**How to avoid:** Always use `date.today().replace(day=1)` as the month start boundary. This matches SerpAPI's own billing cycle (calendar month).

## Code Examples

### Supabase Table Schema
```sql
-- New table for SerpAPI usage tracking
CREATE TABLE IF NOT EXISTS serpapi_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL DEFAULT 'organic',  -- organic, ai_overview, account_check
    location TEXT,
    searched_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast monthly count queries
CREATE INDEX idx_serpapi_usage_client_month
ON serpapi_usage (client_id, searched_at);

-- Index for fast global count queries
CREATE INDEX idx_serpapi_usage_month
ON serpapi_usage (searched_at);
```

### SerpAPI Response Fields to Extract (Phase 1)
```python
# Source: https://serpapi.com/search-api, https://serpapi.com/ai-overview
results = search.get_dict()

# Organic results
organic = results.get("organic_results", [])
# Each: {position, title, link, snippet, displayed_link}

# Related questions (People Also Ask) -- store for Phase 2
paa = results.get("related_questions", [])
# Each: {question, snippet, title, link, displayed_link}

# Featured Snippet (answer box) -- store for Phase 2
answer_box = results.get("answer_box", {})
# Fields: {type, title, answer, snippet, link}

# AI Overview -- store raw for Phase 2
ai_overview = results.get("ai_overview", {})
# Key fields: text_blocks, references, page_token

# Search metadata
metadata = results.get("search_metadata", {})
# Fields: {id, status, created_at, processed_at}
```

### Backward-Compatible Return Format
```python
# Current serp_scraper.py returns:
# {keyword: [{position, title, url, description}, ...]}

# New serpapi_client must return the same shape:
def format_organic_results(serpapi_results: dict) -> list:
    """Convert SerpAPI organic_results to legacy format."""
    return [
        {
            "position": r.get("position", 0),
            "title": r.get("title", ""),
            "url": r.get("link", ""),  # SerpAPI uses "link", old used "url"
            "description": r.get("snippet", ""),  # SerpAPI uses "snippet"
        }
        for r in serpapi_results.get("organic_results", [])
    ]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Apify actor with polling | SerpAPI synchronous JSON | This phase | No more 5-second polling loops, instant structured response |
| No budget tracking | Supabase usage table with hard caps | This phase | Prevents overages on $25/mo plan |
| No AI Overview data | `ai_overview` field in SerpAPI response | Available now | Foundation for Phase 2 GEO scoring |

**Deprecated/outdated:**
- Apify SERP scraper (`serp_scraper.py`): Being replaced. Keep the file but gut the implementation.

## Open Questions

1. **SerpAPI plan details and exact search limit**
   - What we know: $25/mo plan, 200 searches/client/month budget, 950 global cap
   - What's unclear: What is the exact plan search limit from SerpAPI? The Account API will reveal this on first call.
   - Recommendation: On first run, call Account API, log the plan details, and validate that 950 global is within the plan limit.

2. **Store raw SerpAPI response or just extracted fields?**
   - What we know: Phase 2 needs AI Overview, PAA, and Featured Snippet data
   - What's unclear: Whether to store the full JSON blob or extract specific fields now
   - Recommendation: Store the full response as JSONB in a `serpapi_results` column in the usage table. This is cheap in Supabase and avoids needing schema changes for Phase 2. Alternatively, store just organic results now and re-query in Phase 2, but that wastes budget.

3. **Should the budget gate use Supabase RPC for atomicity?**
   - What we know: The loop runs sequentially, once daily
   - What's unclear: Whether future changes could introduce concurrency
   - Recommendation: Simple COUNT query is fine for now. Add a comment noting the sequential assumption.

## Sources

### Primary (HIGH confidence)
- SerpAPI Search API docs (https://serpapi.com/search-api) - endpoint, parameters, response structure
- SerpAPI Account API docs (https://serpapi.com/account-api) - free balance check, no credit cost
- SerpAPI AI Overview docs (https://serpapi.com/ai-overview) - response structure, page_token, references
- SerpAPI AI Overview API docs (https://serpapi.com/google-ai-overview-api) - two-step fetch endpoint, token expiration
- SerpAPI Python integration docs (https://serpapi.com/integrations/python) - import patterns, usage
- PyPI google-search-results (https://pypi.org/project/google-search-results/) - v2.4.2, stable

### Secondary (MEDIUM confidence)
- SerpAPI blog on AI Overviews (https://serpapi.com/blog/scrape-google-ai-overviews/) - practical usage patterns
- SerpAPI blog on building UI for AI Overviews (https://serpapi.com/blog/understanding-ai-overview-data-from-serpapi/) - response field details

### Tertiary (LOW confidence)
- page_token expiration time: One source says 4 minutes, another says 1 minute. Treating as 60 seconds (conservative). Actual testing needed in Phase 2.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SerpAPI is well-documented, Python library is stable, all other deps already installed
- Architecture: HIGH - Integration point is a single function in one file, clear swap path
- Pitfalls: HIGH - Well-understood API, main risks are budget management (custom) and package confusion (documented)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable API, unlikely to change)
