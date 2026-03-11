---
phase: 09-submission-engine
verified: 2026-03-11T17:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 9: Submission Engine Verification Report

**Phase Goal:** The system auto-submits client profiles to Tier 3 no-CAPTCHA directories with human-like behavior, rate limiting, and full failure traceability
**Verified:** 2026-03-11T17:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Running --dry-run shows eligible Tier 3 no-CAPTCHA directories without submitting | VERIFIED | `run_submission_engine()` returns early at line 605 after printing report; queries `tier=3, captcha_status='no_captcha'`; no browser is launched |
| 2  | Engine refuses to submit if daily (5) or weekly (8) rate caps are reached | VERIFIED | `check_rate_limits()` queries `submissions` by `submitted_at` date range, raises `RateLimitExceeded`; re-checked before each individual directory (line 644) |
| 3  | A submission that fails after POST is marked submitted, never retried | VERIFIED | Lines 381-391: if `current_stage == SubmissionStage.POST_SENT.value` in except block, status is set to `submitted` not `failed` |
| 4  | A submission that fails before POST stores a screenshot and error details and is marked failed | VERIFIED | Lines 394-409: `_capture_screenshot()` called, path + error + traceback stored in metadata JSONB, status set to `failed` |
| 5  | NAP mismatches between client profile and form data block submission with status skipped | VERIFIED | Lines 318-326: `nap_audit()` called before form fill; mismatches result in `status: skipped` with mismatch string in `notes` |
| 6  | Engine uses playwright-stealth and human-like typing delays for all form fills | VERIFIED | `Stealth().use_async(async_playwright())` at line 639; `press_sequentially(value, delay=random.randint(80,180))` + `wait_for_timeout(random.randint(200,600))` in `_fill_form()` |
| 7  | Runtime CAPTCHA detection catches JS-rendered CAPTCHAs missed by static audit | VERIFIED | `_check_runtime_captcha()` evaluates `window.grecaptcha \|\| window.hcaptcha \|\| document.querySelector('[data-sitekey]')`; updates `captcha_status` on directory record and skips |
| 8  | Dry-run output shows every eligible Tier 3 no-CAPTCHA directory with form config status | VERIFIED | Lines 551-602: table output shows name, domain, CAPTCHA status, submission status, config source (base/override/acct req) |
| 9  | Directories where semantic locators fail have per-directory override configs created | VERIFIED | `hotfrog_com.py`, `manta_com.py`, `citysquares_com.py` exist in overrides/; all three flagged `REQUIRES_ACCOUNT = True` with documented reason |
| 10 | Failed submissions are never auto-retried | VERIFIED | `failed_ids` set built at lines 527-530; failed directories excluded from `pending_dirs` at line 535; no retry logic anywhere in engine |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/seo_engine/submission_engine.py` | Full engine: rate limiter, state machine, NAP audit, stealth browser, screenshot capture | VERIFIED | 742 lines (min_lines: 200 -- far exceeded); all required functions present and substantive |
| `scripts/seo_engine/form_configs/base_config.py` | Default form field mapping using semantic locators | VERIFIED | 114 lines (min_lines: 30); 9 canonical fields with label/placeholder/CSS strategies |
| `scripts/seo_engine/form_configs/__init__.py` | Package init with get_form_config() loader | VERIFIED | 42 lines (min_lines: 5); loads base config, merges per-directory overrides via importlib |
| `scripts/seo_engine/form_configs/overrides/` | Per-directory override configs | VERIFIED | 4 files: `__init__.py`, `hotfrog_com.py`, `manta_com.py`, `citysquares_com.py` |
| `screenshots/.gitkeep` | Screenshots directory for failure captures | VERIFIED | Directory exists; `.gitignore` has `screenshots/*.png` and `screenshots/**/*.png` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `submission_engine.py` | `supabase.submissions` | `sb.table("submissions")` queries for rate limits, state machine writes, status updates | VERIFIED | Pattern found at lines 90-104 (rate limiter), 142-150 (stage persistence), 362-367 (mark submitted), 405-409 (mark failed) |
| `submission_engine.py` | `supabase.client_profiles` | `sb.table("client_profiles")` loads canonical profile for NAP audit | VERIFIED | Lines 473-483: queries `client_profiles` by `client_id`, exits if not found |
| `submission_engine.py` | `supabase.directories` | `sb.table("directories")` queries Tier 3 no-CAPTCHA, updates captcha_status on runtime detection | VERIFIED | Lines 495-509 (query), 305-306 (runtime CAPTCHA update) |
| `submission_engine.py` | `form_configs/base_config.py` | `from scripts.seo_engine.form_configs import get_form_config` | VERIFIED | Line 31: direct import; `get_form_config()` called at line 692 inside submission loop |
| `form_configs/overrides/` | `form_configs/__init__.py` | `get_form_config()` loads override via `importlib.import_module` | VERIFIED | `__init__.py` lines 34-39: dynamic import of override module, merges `FIELD_OVERRIDES` on top of base config |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SUB-01 | 09-01-PLAN, 09-02-PLAN | Playwright auto-submits to Tier 3 no-CAPTCHA with human-like typing and playwright-stealth | SATISFIED | `Stealth().use_async()` context manager; `press_sequentially` with `random.randint(80,180)` delays; `_fill_form()` with 200-600ms inter-field waits |
| SUB-02 | 09-01-PLAN | Rate limiter: 5/day and 8/week hard caps | SATISFIED | `check_rate_limits()` queries `submitted_at` date ranges; `DAILY_CAP=5`, `WEEKLY_CAP=8` constants; checked before each individual submission |
| SUB-03 | 09-01-PLAN, 09-02-PLAN | State machine tracks form_loaded/form_filled/post_sent; POST failures never trigger re-submission | SATISFIED | `SubmissionStage` enum with 3 values; `_advance_stage()` persists to metadata JSONB; post-POST exception path marks `submitted` not `failed` |
| SUB-04 | 09-01-PLAN | NAP audit before each submission | SATISFIED | `nap_audit()` compares 5 fields; called at line 318 before form fill; any mismatch returns `skipped` status with mismatch detail in notes |
| SUB-05 | 09-01-PLAN, 09-02-PLAN | Failed submissions store screenshot and error, not retried | SATISFIED | `_capture_screenshot()` called on pre-POST failures; error + traceback[:1000] stored in metadata; `failed_ids` exclusion prevents retry |

All 5 SUB requirements fully accounted for across plans 01 and 02. No orphaned requirements for Phase 9 in REQUIREMENTS.md.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `submission_engine.py` | 352 | `pass` on `wait_for_url` timeout | Info | Intentional -- some forms don't redirect. Documented in comment. No impact on goal. |
| `submission_engine.py` | 397-398 | `pass` on screenshot capture exception | Info | Intentional -- prevents screenshot failure from masking root error. No impact on goal. |

No blockers or warnings found. Both `pass` statements are defensive/intentional with comments explaining the design decision.

---

## Human Verification Required

### 1. Live Submission Against Real Directory

**Test:** Run `python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean` (without --dry-run) against one of the 4 eligible directories (EZLocal, iBegin, n49, Tupalo)
**Expected:** Submission row created in `submissions` table with `status='submitted'`, `submitted_at` timestamp, and listing appears on directory site within 7 days
**Why human:** Real browser interaction against live URLs; directory form structures change; CAPTCHA detection needs live validation; submission outcome requires checking the external site

### 2. Brian's Dry-Run Approval (Documented in 09-02-SUMMARY)

**Test:** `python3 -m scripts.seo_engine.submission_engine --client-slug mr-green-turf-clean --dry-run`
**Expected:** Output lists 4 eligible directories with correct rate limit counts and config source labels
**Why human:** Per 09-02-SUMMARY, Brian reviewed and approved. This is already marked complete in the phase. Documented here for completeness.

---

## Gaps Summary

No gaps. All must-have truths are verified at all three levels (exists, substantive, wired). All 5 SUB requirements are satisfied with concrete code evidence.

One notable architectural note: the engine correctly reports "no eligible directories" when `captcha_status='no_captcha'` records don't exist yet in Supabase (as was the state at end of Plan 01). This is expected behavior -- Plan 02 confirmed 18 no_captcha directories were found after `captcha_audit --update` was run.

---

_Verified: 2026-03-11T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
