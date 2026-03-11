---
phase: 05-brave-infrastructure-mention-tracking-tech-debt
verified: 2026-03-11T02:15:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 5: Brave Infrastructure + Mention Tracking + Tech Debt Verification Report

**Phase Goal:** The engine collects mention data from across the web and all v1.0 tech debt is resolved, so data accumulates while dashboard work proceeds in parallel
**Verified:** 2026-03-11T02:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Brave Search API calls are budget-gated with per-client and global monthly caps tracked in Supabase | VERIFIED | `brave_client.py` has `check_budget()` querying `brave_usage` Supabase table with CLIENT_MONTHLY_LIMIT=200, GLOBAL_MONTHLY_LIMIT=800. `search_brave()` calls `check_budget()` first, returns `{"blocked": True}` if over budget, logs to `brave_usage` after success (line 132). 1s rate limit enforced (line 112). |
| 2 | brand_mentions.py routes all Brave calls through brave_client.py instead of raw requests | VERIFIED | `brand_mentions.py` imports `search_brave` from `brave_client` (line 16), calls it at line 54. No `X-Subscription-Token` or `BRAVE_URL` in the file. Old raw `requests.get` to Brave API removed. |
| 3 | content_validator.py rejects answer capsules outside 40-60 word range | VERIFIED | `content_validator.py` line 216: `if word_count < 40` with message "min 40". Line 219: `elif word_count > 60` with message "max 60". DEBT-01 fixed. |
| 4 | inject_organization_on_all_pages() runs during seo_loop and injects Organization schema on client pages | VERIFIED | `seo_loop.py` lines 113-123: Step 1b2 imports `inject_organization_on_all_pages` from `schema_injector`, calls it with `client` config, wrapped in try/except, only runs if `website_local_path` exists. |
| 5 | same_as_urls in clients.json are populated with real profile URLs for active clients | VERIFIED | mr-green-turf-clean has GBP, Yelp, Facebook (3 URLs). integrity-pro-washers has GBP, Yelp, Facebook, Instagram (4 URLs). Real URLs confirmed (google.com/maps?cid=, yelp.com/biz/, facebook.com/). |
| 6 | Running the SEO engine on research days returns relevant Reddit questions per client niche via Brave site:reddit.com queries | VERIFIED | `reddit.py` has `pull_reddit_questions_brave(client_config)` that builds `site:reddit.com` queries from DEFAULT_SEARCH_TERMS and client target_keywords. Calls `search_brave()` (line 65, 78). Filters for reddit.com URLs (line 96). Wired in `research_runner.py` line 151. |
| 7 | Cross-platform mention tracking finds client name mentions across directories, forums, and review sites stored in Supabase mentions table | VERIFIED | `mention_tracker.py` has `track_mentions()` searching 8 query patterns (Yelp, BBB, HomeAdvisor, Thumbtack, Angi, Nextdoor, reviews, forums). Upserts to Supabase `mentions` table (line 169) with `on_conflict="client_id,source_url"`. Wired in `research_runner.py` line 257. |
| 8 | Competitor AI Overview citations are parsed from existing serp_features data with zero additional API calls | VERIFIED | `mention_tracker.py` has `parse_competitor_citations()` that queries `serp_features` table (line 203-211), parses `ai_overview_references` JSONB, filters out client URLs via `url_matches_client()`, upserts to `competitor_aio_citations` table (line 268). Zero API calls. Wired in `research_runner.py` line 268. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/seo_engine/brave_client.py` | Budget-gated Brave Search wrapper | VERIFIED | 141 lines. Exports `search_brave`, `check_budget`. Mirrors serpapi_client.py pattern. Budget gate, rate limit, usage logging all present. |
| `scripts/seo_engine/content_validator.py` | Fixed capsule word count validation (40-60) | VERIFIED | Lines 216-221 use `< 40` and `> 60` thresholds. |
| `scripts/seo_engine/seo_loop.py` | Wired inject_organization_on_all_pages call | VERIFIED | Lines 113-123 (Step 1b2) import and call the function. |
| `clients.json` | Populated same_as_urls for active clients | VERIFIED | Both active clients have non-empty same_as_urls with real URLs. |
| `scripts/seo_engine/research/reddit.py` | Brave-powered Reddit question mining per client | VERIFIED | 122 lines. Exports `pull_reddit_questions_brave`. No Reddit API dependency. Old function kept as deprecated stub. |
| `scripts/seo_engine/research/mention_tracker.py` | Cross-platform mention tracking | VERIFIED | 281 lines. Exports `track_mentions`, `parse_competitor_citations`. Searches 8 platforms, upserts to Supabase. |
| `scripts/seo_engine/research/research_runner.py` | Wired mention tracking steps | VERIFIED | Steps 10 (mentions) and 11 (competitor AIO) added. Reddit step uses `pull_reddit_questions_brave`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| research/brand_mentions.py | brave_client.py | `from scripts.seo_engine.brave_client import search_brave` | WIRED | Line 16 imports, line 54 calls `search_brave()` |
| brave_client.py | brave_usage Supabase table | `sb.table("brave_usage").insert(...)` | WIRED | Line 132-138 inserts after successful API call |
| seo_loop.py | schema_injector.py | `inject_organization_on_all_pages` | WIRED | Line 116 imports, line 117 calls |
| research/reddit.py | brave_client.py | `from scripts.seo_engine.brave_client import search_brave` | WIRED | Line 14 imports, lines 65 and 78 call |
| research/mention_tracker.py | brave_client.py | `from scripts.seo_engine.brave_client import search_brave` | WIRED | Line 18 imports, line 132 calls |
| research/mention_tracker.py | mentions Supabase table | `sb.table("mentions").upsert(...)` | WIRED | Line 169-172 upserts with on_conflict |
| research/mention_tracker.py | competitor_aio_citations table | `sb.table("competitor_aio_citations").upsert(...)` | WIRED | Line 268-270 upserts with on_conflict |
| research/research_runner.py | mention_tracker.py | `from .mention_tracker import track_mentions, parse_competitor_citations` | WIRED | Line 14 imports, lines 257 and 268 call |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 05-01 | Brave Search client with budget gating, rate limiting, and usage tracking | SATISFIED | `brave_client.py` with `search_brave()`, `check_budget()`, 1s sleep, Supabase logging |
| INFRA-02 | 05-01 | Brave Search usage stored in Supabase with monthly caps | SATISFIED | `brave_usage` table queried in `check_budget()` with CLIENT_MONTHLY_LIMIT=200, GLOBAL_MONTHLY_LIMIT=800 |
| MENT-01 | 05-02 | Reddit question mining via Brave site:reddit.com | SATISFIED | `pull_reddit_questions_brave()` in reddit.py, wired in research_runner.py step 2 |
| MENT-02 | 05-02 | Cross-platform mention tracking across directories, forums, review sites | SATISFIED | `track_mentions()` in mention_tracker.py searches 8 platforms, stores in Supabase `mentions` table |
| MENT-04 | 05-02 | Competitor AI Overview citations from existing SERP data | SATISFIED | `parse_competitor_citations()` reads `serp_features` table, zero API calls, stores in `competitor_aio_citations` |
| DEBT-01 | 05-01 | Fix content_validator.py capsule word count 50-150 to 40-60 | SATISFIED | Lines 216-221 now use 40/60 thresholds |
| DEBT-02 | 05-01 | Wire inject_organization_on_all_pages() into runtime | SATISFIED | Called as Step 1b2 in seo_loop.py, wrapped in try/except |
| DEBT-03 | 05-01 | Populate same_as_urls in clients.json for all active clients | SATISFIED | Both mr-green-turf-clean (3 URLs) and integrity-pro-washers (4 URLs) populated |

No orphaned requirements found. All 8 requirement IDs from ROADMAP.md Phase 5 are claimed by plans and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| research/research_runner.py | 240, 254 | Duplicate step numbering: two "# 10." comments | Info | Cosmetic only. Steps 10 (AEO) and 10 (mentions) have same number. Should be 10 and 11 (with AEO as existing step, mention tracking as new step). Does not affect functionality. |
| backlinks/directory_audit.py | 20, 51 | Raw Brave API calls bypassing brave_client.py | Warning | Pre-existing module not in Phase 5 scope. Budget tracking bypassed for these calls. |
| research/backlink_gap.py | 17, 54 | Raw Brave API calls bypassing brave_client.py | Warning | Pre-existing module not in Phase 5 scope. |
| research/keyword_discovery.py | 22, 125 | Raw Brave API calls bypassing brave_client.py | Warning | Pre-existing module not in Phase 5 scope. |
| research/trends.py | 19, 48 | Raw Brave API calls bypassing brave_client.py | Warning | Pre-existing module not in Phase 5 scope. |
| research/journalist_monitor.py | 17, 55 | Raw Brave API calls bypassing brave_client.py | Warning | Pre-existing module not in Phase 5 scope. |
| research/broken_links.py | 18, 50 | Raw Brave API calls bypassing brave_client.py | Warning | Pre-existing module not in Phase 5 scope. |

Note: 6 pre-existing modules still make raw Brave API calls outside brave_client.py. These were not in Phase 5 scope (plans targeted brand_mentions.py and reddit.py only), but they bypass budget tracking. Consider a follow-up task to migrate these modules to use brave_client.py.

### Human Verification Required

### 1. Supabase Tables Exist

**Test:** Run `python3 -c "from scripts.seo_engine.brave_client import _get_supabase; sb = _get_supabase(); print(sb.table('brave_usage').select('id').limit(1).execute()); print(sb.table('mentions').select('id').limit(1).execute()); print(sb.table('competitor_aio_citations').select('id').limit(1).execute())"`
**Expected:** All three queries succeed without "relation does not exist" errors
**Why human:** Supabase table creation was done via Management API during execution. Cannot verify table existence without live Supabase credentials.

### 2. same_as_urls Accuracy

**Test:** Open the GBP, Yelp, Facebook, and Instagram URLs from clients.json for both active clients in a browser
**Expected:** Each URL resolves to the correct business profile (Mr Green Turf Clean in Poway/San Diego, Integrity Pro Washers in San Diego)
**Why human:** URL correctness requires visual confirmation that the profile matches the actual business

### 3. End-to-End Research Run

**Test:** Run `python3 -m scripts.seo_engine.seo_loop --client mr-green-turf-clean` on a Wednesday or Saturday (or with `force=True` in research_runner)
**Expected:** Steps 2 (Reddit via Brave), 10 (mention tracking), and 11 (competitor AIO parsing) execute without errors. brave_usage table gets new rows.
**Why human:** Requires live API keys (BRAVE_API_KEY, SUPABASE_URL/KEY) and network access

### Gaps Summary

No gaps found. All 8 must-have truths verified, all 8 requirements satisfied, all key links wired. The phase goal -- "the engine collects mention data from across the web and all v1.0 tech debt is resolved" -- is achieved.

Two minor items for future consideration (not blockers):
1. Duplicate step numbering in research_runner.py (cosmetic)
2. Six pre-existing modules still bypass brave_client.py for Brave API calls (tech debt for a future phase)

---

_Verified: 2026-03-11T02:15:00Z_
_Verifier: Claude (gsd-verifier)_
