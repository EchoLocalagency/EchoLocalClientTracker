# Stack Research: GEO Module

**Domain:** Generative Engine Optimization for local SEO engine
**Researched:** 2026-03-10
**Confidence:** HIGH (SerpAPI), MEDIUM (GEO scoring approach), HIGH (Brave Search)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `google-search-results` | 2.4.2 | SerpAPI Python client -- AI Overview detection, PAA extraction, Featured Snippet data, organic SERP results | Official SerpAPI SDK. Single package covers all SERP engines (google, google_ai_overview, google_related_questions). Replaces Apify SERP scraper entirely. Stable -- last release Mar 2023, API changes happen server-side not in SDK. |
| `requests` | (already installed) | HTTP client for direct SerpAPI Account API calls | Already in the codebase. Needed for usage tracking endpoint (`serpapi.com/account.json`) which the SDK doesn't wrap. |
| Brave Search API (direct HTTP) | v1 | Reddit question mining, cross-platform mention tracking, source diversity scoring | Already integrated via `requests` in brand_mentions.py, keyword_discovery.py, etc. No new library needed -- keep using direct HTTP with `BRAVE_API_KEY`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-dotenv` | (already installed) | Load `SERPAPI_KEY` from .env | Already in codebase. Add `SERPAPI_KEY` to .env alongside existing keys. |
| `urllib.parse` | (stdlib) | URL/domain normalization for citation matching | Used to compare SerpAPI reference URLs against client domains. Already used elsewhere in codebase. |

### No New Libraries Needed

The GEO module requires **one new pip install** (`google-search-results`) and **one new env var** (`SERPAPI_KEY`). Everything else builds on what's already installed.

## Installation

```bash
pip install google-search-results
```

Add to `.env`:
```
SERPAPI_KEY=your_key_here
```

## SerpAPI Integration Architecture

### How AI Overview Detection Works (Two-Step Process)

**Step 1: Initial Google Search** (1 search credit)
```python
from serpapi import GoogleSearch

params = {
    "engine": "google",
    "q": "best turf cleaning service poway",
    "location": "Poway, California, United States",
    "api_key": SERPAPI_KEY,
    "no_cache": "true"  # Required -- page_token expires in 60 seconds
}
search = GoogleSearch(params)
results = search.get_dict()

# Check if AI Overview exists
ai_overview = results.get("ai_overview", {})
page_token = ai_overview.get("page_token")
```

**Step 2: Fetch Full AI Overview** (1 additional search credit, only if page_token exists)
```python
if page_token:
    params = {
        "engine": "google_ai_overview",
        "page_token": page_token,
        "api_key": SERPAPI_KEY
    }
    overview_search = GoogleSearch(params)
    overview = overview_search.get_dict()

    # Extract citations
    references = overview.get("ai_overview", {}).get("references", [])
    # Each reference: {"title": "...", "link": "...", "snippet": "...", "source": "..."}
```

**Critical billing detail:** AI Overview detection costs 1-2 searches per query. If the initial search returns the AI Overview inline (no page_token), it's 1 search. If a page_token is returned, the follow-up costs a second search. Budget accordingly -- assume worst case of 2 per query.

### Data Available Per Search

One SerpAPI Google search returns ALL of these in a single response:

| Field | JSON Key | What You Get |
|-------|----------|--------------|
| AI Overview (inline) | `ai_overview` | Text blocks, references with URLs, page_token if lazy-loaded |
| People Also Ask | `related_questions` | Question text, snippet answer, source URL, source title |
| Featured Snippet | `answer_box` or `featured_snippet` | Snippet text, source URL, snippet type (paragraph/list/table) |
| Organic Results | `organic_results` | Position, title, URL, snippet, sitelinks |
| Local Pack | `local_results` | Business name, rating, reviews, position |
| Knowledge Graph | `knowledge_graph` | Entity info if present |

This means one search credit gives you AI Overview presence, PAA questions, Featured Snippet holder, and organic rankings simultaneously. Far more efficient than the current Apify scraper which only returns organic results.

### People Also Ask (Expanded)

PAA questions from the initial search are free (included in the response). Expanding individual PAA questions requires the `google_related_questions` engine with a `next_page_token`, costing 1 additional search each. **Do not expand PAA questions** -- the initial question + snippet is sufficient for content targeting.

### Usage Tracking Endpoint

```python
import requests

resp = requests.get("https://serpapi.com/account.json", params={"api_key": SERPAPI_KEY})
account = resp.json()
# account["this_month_usage"] -> searches used this month
# account["plan_searches_left"] -> remaining searches
# account["searches_per_month"] -> plan limit (1000)
```

This endpoint is free (does not count as a search). Call it before every batch to enforce the hard cap.

## Budget Math

**Plan:** $25/month, 1000 searches/month.

**Per-client weekly allocation:** 50 searches (200/month / 4 weeks).

**What 50 searches/week buys per client:**
- 15 priority keywords x 1-2 searches each = 15-30 searches (SERP + AI Overview)
- Remaining 20-35 for Featured Snippet checks on opportunity queries

**Scaling to 5 clients:** 200 searches/client/month x 5 = 1000. Exactly fits the plan. No room for waste -- usage tracking and hard caps are mandatory.

**If AI Overviews require 2 searches consistently:** Budget drops to ~7-8 keywords tracked weekly per client. Monitor the ratio of 1-step vs 2-step queries in the first week and adjust.

## GEO Scoring Approach

### No Off-the-Shelf Python Library Exists

There is no established open-source Python library for GEO scoring. The commercial tools (ZipTie, GetCito, Scrunch, Semrush AI Visibility) are SaaS platforms, not libraries. **Build the scoring in-house.** This is the right call because:

1. The scoring is simple math, not complex ML
2. It needs to integrate with the brain's decision-making
3. Commercial tools cost $200-500/month and overlap with what SerpAPI already provides

### Recommended GEO Score Components

Build a 0-100 composite score per page:

| Signal | Weight | How to Measure | Source |
|--------|--------|----------------|--------|
| Answer block present | 25 | Parse page HTML for 50-150 word self-contained answer blocks | Local file/git |
| Structured data (FAQ, HowTo, Organization schema) | 20 | Check for schema types in page source | Local file/git |
| Statistics/data density | 15 | Count numerical claims, percentages, dollar amounts | Local file/git |
| Definitive list formatting | 10 | Check for numbered/bulleted lists with descriptive items | Local file/git |
| Citation in AI Overview | 15 | SerpAPI -- is this page's domain in AI Overview references? | SerpAPI |
| Featured Snippet held | 10 | SerpAPI -- does this page hold the featured snippet? | SerpAPI |
| Source diversity (mentioned on Reddit, forums, directories) | 5 | Brave Search site: queries | Brave API |

**On-page signals (70 points)** are measurable without any API calls by parsing the page content from the local git repo or deployed site. **Off-page signals (30 points)** require SerpAPI and Brave Search.

This split means the brain can calculate a partial GEO score (on-page only) for every page without burning API credits, and prioritize API checks for pages that score well on-page but haven't been verified off-page yet.

## Brave Search Integration (Existing)

Already in the codebase. Used by: `brand_mentions.py`, `keyword_discovery.py`, `trends.py`, `journalist_monitor.py`, `backlink_gap.py`, `directory_audit.py`.

**Pattern:** Direct HTTP via `requests` to `https://api.search.brave.com/res/v1/web/search` with `BRAVE_API_KEY` header.

**For GEO, use Brave Search for:**
- `site:reddit.com "[topic] [city]"` -- find Reddit questions about client's service area
- `"[client business name]" -site:[client domain]` -- find mentions across the web (already in brand_mentions.py)
- `site:reddit.com OR site:quora.com "[keyword]"` -- source diversity checks

No new library needed. Extend existing patterns.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| SerpAPI (`google-search-results`) | DataForSEO SERP API | More expensive at low volume ($0.003/result but charges per result type). SerpAPI charges per search regardless of result types returned -- better value when extracting AI Overview + PAA + organic in one call. |
| SerpAPI (`google-search-results`) | SearchAPI.io | Cheaper ($50/5000 searches) but AI Overview support is less mature. SerpAPI has dedicated `google_ai_overview` engine with structured references. |
| SerpAPI (`google-search-results`) | Direct scraping via Playwright | Fragile, blocks on rate limits, no structured AI Overview data, requires parsing unstable HTML. Not worth the maintenance burden. |
| Custom GEO scoring | GetCito (open-source) | GetCito tracks AI mentions across ChatGPT/Claude/Perplexity -- different scope. We need page-level citation-readiness scoring, not brand mention tracking across LLMs. |
| Custom GEO scoring | Semrush AI Visibility | $200+/month SaaS tool. Overkill for 2-5 clients. The data we need (AI Overview citations, content structure) is available via SerpAPI + local parsing. |
| Brave Search (direct HTTP) | `brave-search-python-client` 0.4.27 | Adding a library for what's already a simple `requests.get()` call adds unnecessary dependency. The existing pattern works. Keep it consistent. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Apify Google Search Scraper | Slower (polling for results), no AI Overview/PAA data, more expensive per search | SerpAPI `google-search-results` |
| `httpx` or `aiohttp` | The SEO engine runs sequentially in a single loop. Async adds complexity for zero benefit here. | `requests` (already used everywhere) |
| `beautifulsoup4` for SerpAPI parsing | SerpAPI returns structured JSON. No HTML parsing needed for SERP data. | Direct dict access on SerpAPI response |
| Perplexity API | Unreliable for citation tracking, only covers one AI engine, expensive | SerpAPI for Google AI Overviews (where the traffic actually is) |
| Reddit API (PRAW) | Auth was never successfully configured. Reddit blocks scraping. | Brave Search `site:reddit.com` queries |
| `brave-search` or `brave-search-python-client` pip packages | Unnecessary abstraction over a single REST endpoint. Existing `requests` pattern is simpler and already proven in the codebase. | Direct HTTP with `requests` |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `google-search-results` 2.4.2 | Python 3.x | Stable SDK. API changes happen server-side. Last PyPI release Mar 2023 but actively maintained -- SDK is thin wrapper over REST API. |
| `google-search-results` 2.4.2 | `requests` (any version) | Uses `requests` internally. No conflict with existing `requests` usage. |

## Key Environment Variables

| Variable | Value | Where |
|----------|-------|-------|
| `SERPAPI_KEY` | SerpAPI API key | `.env` (new) |
| `BRAVE_API_KEY` | Brave Search API key | `.env` (existing) |
| `APIFY_TOKEN` | Apify token | `.env` (existing, can be removed after migration) |

## Sources

- [SerpAPI Google AI Overview API docs](https://serpapi.com/google-ai-overview-api) -- two-step process, response structure, parameters (HIGH confidence)
- [SerpAPI AI Overview Rank Tracker tutorial](https://serpapi.com/blog/ai-overview-rank-tracker-using-python/) -- Python code patterns, citation extraction (HIGH confidence)
- [SerpAPI Google Related Questions API](https://serpapi.com/google-related-questions-api) -- PAA response fields (HIGH confidence)
- [SerpAPI Account API](https://serpapi.com/account-api) -- usage tracking endpoint, free to call (HIGH confidence)
- [SerpAPI Pricing](https://serpapi.com/pricing) -- $25/mo for 1000 searches, only successful searches counted (HIGH confidence)
- [google-search-results on PyPI](https://pypi.org/project/google-search-results/) -- version 2.4.2 confirmed (HIGH confidence)
- [GEO tools landscape 2026](https://www.alexbirkett.com/generative-engine-optimization-software/) -- commercial tools survey, no Python libraries exist (MEDIUM confidence)
- [brave-search-python-client on PyPI](https://pypi.org/project/brave-search-python-client/) -- v0.4.27, unnecessary for this project (LOW confidence -- not using)

---
*Stack research for: GEO module addition to existing Python SEO engine*
*Researched: 2026-03-10*
