---
phase: 01-serpapi-foundation
verified: 2026-03-10T18:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 1: SerpAPI Foundation Verification Report

**Phase Goal:** Replace Apify SERP scraper with direct SerpAPI integration including budget tracking
**Verified:** 2026-03-10T18:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

Truths consolidated from both plans (01-01 and 01-02).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SerpAPI search returns structured organic results for a given keyword and location | VERIFIED | `serpapi_client.py` lines 86-127: `search_google()` calls `GoogleSearch(params).get_dict()` and returns full results dict |
| 2 | Every SerpAPI call is logged to Supabase with client_id, query, search_type, and timestamp | VERIFIED | `serpapi_client.py` lines 117-125: `sb.table("serpapi_usage").insert(...)` after successful API call with client_id, query, search_type, location |
| 3 | When a client hits 200 searches/month, the budget gate blocks the call and returns a reason | VERIFIED | `serpapi_client.py` lines 76-78: `if client_used >= CLIENT_MONTHLY_LIMIT` sets `allowed=False` with reason string; `search_google()` checks budget first (line 99-102) |
| 4 | When global searches hit 950/month, the budget gate blocks the call and returns a reason | VERIFIED | `serpapi_client.py` lines 79-81: `elif global_used >= GLOBAL_MONTHLY_LIMIT` sets `allowed=False` with reason |
| 5 | Account API returns remaining balance without consuming a credit | VERIFIED | `serpapi_client.py` lines 151-175: `check_account_balance()` GETs `serpapi.com/account.json` and returns searches_used, searches_remaining, plan |
| 6 | Running seo_loop.py for a client fetches organic SERP results from SerpAPI instead of Apify | VERIFIED | `serp_scraper.py` imports `search_google, format_organic_results` from `serpapi_client` (line 11). Zero Apify references remain (grep confirms 0 matches). `research_runner.py` line 92 calls `scrape_serp()` which flows through SerpAPI. `seo_loop.py` line 103 calls `run_research(client)` with `_supabase_id` set at line 85. |
| 7 | The research cache (competitor_serps) contains the same data format as before | VERIFIED | `serp_scraper.py` line 105: `format_organic_results(result)` converts to legacy format (position, title, url, description). `research_runner.py` line 93: `cache["competitor_serps"] = organic` preserves the dict-of-keyword-to-results structure. |
| 8 | Budget gate blocks searches when client or global cap is reached during a live seo_loop run | VERIFIED | `serp_scraper.py` lines 100-101: checks `result.get("blocked")` and skips keyword. Budget gate is embedded in `search_google()` -- cannot be bypassed. |
| 9 | PAA, Featured Snippet, and AI Overview raw data are stored in the research cache for Phase 2 | VERIFIED | `serp_scraper.py` lines 108-112: extracts `ai_overview`, `related_questions`, `answer_box` into `raw_extras`. `research_runner.py` line 94: `cache["serp_extras"] = serp_extras` stores in JSON cache. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/seo_engine/serpapi_client.py` | SerpAPI wrapper with budget gate, usage logging, account API | VERIFIED | 176 lines. Exports: `search_google`, `check_budget`, `check_account_balance`, `format_organic_results`. All substantive implementations. |
| `supabase_migration_serpapi_usage.sql` | serpapi_usage table DDL with indexes | VERIFIED | 19 lines. CREATE TABLE with correct columns (id UUID, client_id UUID FK, query, search_type, location, searched_at, created_at). Two indexes present. |
| `scripts/seo_engine/research/serp_scraper.py` | SerpAPI-backed scrape_serp with same interface | VERIFIED | 118 lines. Imports from serpapi_client. Returns tuple (organic, extras). Location mapping with 50-state auto-expansion. |
| `scripts/seo_engine/research/research_runner.py` | Research orchestrator passing client_id to SERP scraper | VERIFIED | Line 90-94: passes `_supabase_id` and `primary_market` to `scrape_serp()`, stores both `competitor_serps` and `serp_extras` in cache. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `serpapi_client.py` | Supabase serpapi_usage table | `sb.table("serpapi_usage")` insert and count queries | WIRED | 3 references: budget count query (lines 50, 60), usage insert after search (line 118) |
| `serpapi_client.py` | SerpAPI API | `GoogleSearch` from google-search-results lib | WIRED | Import on line 22, instantiated on line 113, `.get_dict()` on line 114 |
| `serpapi_client.py` | SerpAPI Account API | `requests.get("serpapi.com/account.json")` | WIRED | Line 160: GET request with api_key param, response parsed to structured dict |
| `serp_scraper.py` | `serpapi_client.py` | `from scripts.seo_engine.serpapi_client import search_google, format_organic_results` | WIRED | Line 11: absolute import, both functions used in `scrape_serp()` |
| `research_runner.py` | `serp_scraper.py` | `from .serp_scraper import scrape_serp` | WIRED | Line 14: relative import. Line 92: called with location and client_id kwargs |
| `seo_loop.py` | `research_runner.py` | `run_research(client)` with `_supabase_id` in client dict | WIRED | Line 85: sets `client["_supabase_id"] = client_id`. Line 103: `research_data = run_research(client)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SERP-01 | 01-01, 01-02 | SerpAPI client replaces Apify with structured results (organic, AI Overview, PAA, Featured Snippets) in single API call | SATISFIED | `serpapi_client.py` returns full SerpAPI dict; `serp_scraper.py` extracts organic + extras. Zero Apify references remain. |
| SERP-02 | 01-01, 01-02 | Per-client monthly usage tracking in Supabase with hard cap at 200/client and 950 global | SATISFIED | `check_budget()` queries serpapi_usage with month filter. CLIENT_MONTHLY_LIMIT=200, GLOBAL_MONTHLY_LIMIT=950. Migration creates table with indexes. |
| SERP-03 | 01-01, 01-02 | Usage counter checked before every API call; hard-stop when cap reached | SATISFIED | `search_google()` calls `check_budget()` first (line 99). Returns `{"blocked": True}` when not allowed. `serp_scraper.py` skips blocked keywords. |
| SERP-04 | 01-01 | SerpAPI Account API integration for free usage verification | SATISFIED | `check_account_balance()` GETs account.json, returns remaining balance, plan name. No credit consumed. |

No orphaned requirements found. REQUIREMENTS.md maps SERP-01 through SERP-04 to Phase 1, and all four are claimed by the plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `research_runner.py` | 170 | "placeholder" comment (pre-existing, about AEO opportunities) | Info | Not related to Phase 1 work. Pre-existing code. No impact on goal. |

No blockers or warnings found in Phase 1 artifacts.

### Human Verification Required

### 1. Live SerpAPI Search Execution

**Test:** Run `python3 -c "from scripts.seo_engine.serpapi_client import check_account_balance; print(check_account_balance())"` from the project root.
**Expected:** Returns dict with plan name, searches_used, searches_remaining -- all non-zero/valid values.
**Why human:** Requires live API key and network access to verify.

### 2. Supabase Table Existence

**Test:** Check Supabase dashboard for the `serpapi_usage` table, or query it via the REST API.
**Expected:** Table exists with columns: id, client_id, query, search_type, location, searched_at, created_at. At least 1 row from the test search documented in 01-01-SUMMARY.md.
**Why human:** Requires Supabase access to verify table was actually created (migration may or may not have been applied).

### 3. End-to-End seo_loop Run

**Test:** Run `python3 -m scripts.seo_engine.seo_loop --client mr-green-turf-clean` on a research day (Wednesday or Saturday) or with `--force`.
**Expected:** SERP scraping section shows SerpAPI calls (not Apify), new rows appear in serpapi_usage table, research_cache.json contains both `competitor_serps` and `serp_extras` keys.
**Why human:** Full integration test requires live environment, correct day-of-week, and API credentials.

### Gaps Summary

No gaps found. All 9 observable truths verified. All 4 artifacts pass all three levels (exists, substantive, wired). All 6 key links confirmed. All 4 requirements (SERP-01 through SERP-04) satisfied with implementation evidence.

The phase goal -- "Replace Apify SERP scraper with direct SerpAPI integration including budget tracking" -- is achieved. The SerpAPI client is built with embedded budget gates, the SEO engine is wired to use it instead of Apify, and usage tracking flows to Supabase.

---

_Verified: 2026-03-10T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
