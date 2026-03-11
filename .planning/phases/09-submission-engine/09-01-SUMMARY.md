---
phase: 09-submission-engine
plan: 01
subsystem: automation
tags: [playwright, stealth, browser-automation, form-submission, rate-limiter, state-machine]

requires:
  - phase: 08-data-foundation-discovery
    provides: "client_profiles, directories, and submissions tables with seed data and CAPTCHA classifications"
provides:
  - "Playwright-based submission engine for Tier 3 no-CAPTCHA directory auto-submission"
  - "Form config package with semantic locator strategies and per-directory override support"
  - "Rate limiter enforcing 5/day and 8/week hard caps"
  - "State machine tracking form_loaded/form_filled/post_sent stages"
  - "NAP consistency audit blocking mismatched submissions"
  - "Screenshot capture on pre-POST failures"
affects: [10-verification-monitoring, 11-brain-integration]

tech-stack:
  added: [playwright 1.58.0, playwright-stealth 2.0.2]
  patterns:
    - "Async Playwright with Stealth context manager for anti-detection"
    - "press_sequentially with random delays for human-like typing"
    - "Read-then-merge pattern for metadata JSONB updates"
    - "CLIENT_TRADE_MAP constant mirrors frontend trade matching"

key-files:
  created:
    - scripts/seo_engine/submission_engine.py
    - scripts/seo_engine/form_configs/__init__.py
    - scripts/seo_engine/form_configs/base_config.py
    - scripts/seo_engine/form_configs/overrides/__init__.py
    - screenshots/.gitkeep
  modified:
    - .gitignore

key-decisions:
  - "CLIENT_TRADE_MAP duplicated in Python from page.tsx -- no DB trade column exists"
  - "Runtime CAPTCHA check uses JS evaluation for grecaptcha/hcaptcha/data-sitekey detection"
  - "Post-POST errors mark submitted (not failed) -- conservative approach to avoid duplicate submissions"
  - "Failed submissions never auto-retried -- screenshot + error details stored for manual review"

patterns-established:
  - "Form config package: base_config + per-directory overrides in form_configs/overrides/{domain}.py"
  - "Submission state machine: form_loaded -> form_filled -> post_sent persisted to metadata JSONB"
  - "Stealth browser context: one browser per run, one context+page per directory"

requirements-completed: [SUB-01, SUB-02, SUB-03, SUB-04, SUB-05]

duration: 4min
completed: 2026-03-11
---

# Phase 9 Plan 1: Submission Engine Summary

**Playwright submission engine with stealth anti-detection, rate limiter (5/day, 8/week), state machine, NAP audit, and failure screenshot capture for Tier 3 no-CAPTCHA directories**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T16:05:12Z
- **Completed:** 2026-03-11T16:09:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Full submission engine (654 lines) with CLI following discovery.py patterns
- Form config package with 9 canonical fields mapped to semantic locators (label, placeholder, CSS)
- Rate limiter queries Supabase submissions table before each individual submission
- State machine persists stage to metadata JSONB with read-then-merge pattern
- NAP audit compares 5 canonical fields, blocks on any mismatch
- Runtime CAPTCHA detection catches JS-rendered CAPTCHAs missed by static audit
- Screenshot capture on pre-POST failures with error details in metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Playwright deps and create form config package** - `5480b4d` (feat)
2. **Task 2: Build submission engine** - `f991cf8` (feat)

## Files Created/Modified
- `scripts/seo_engine/submission_engine.py` - Main engine: rate limiter, state machine, NAP audit, stealth browser, submit loop, CLI
- `scripts/seo_engine/form_configs/__init__.py` - Package init with get_form_config() loader supporting per-directory overrides
- `scripts/seo_engine/form_configs/base_config.py` - Default field mapping using semantic locators for 9 canonical fields
- `scripts/seo_engine/form_configs/overrides/__init__.py` - Empty overrides package for future per-directory configs
- `screenshots/.gitkeep` - Screenshots directory for failure captures
- `.gitignore` - Added screenshots/*.png exclusion

## Decisions Made
- CLIENT_TRADE_MAP duplicated as Python constant from page.tsx (clients table has no trade column -- matches 08-02 decision to keep trade mapping in code, not DB)
- Runtime CAPTCHA detection uses `window.grecaptcha || window.hcaptcha || document.querySelector('[data-sitekey]')` JS evaluation
- Post-POST errors always mark submitted (not failed) to prevent duplicate submissions
- Failed submissions never auto-retried -- stored with screenshot path + error + traceback for manual review
- One browser per run, fresh context+page per directory for clean state isolation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing clients.trade column reference**
- **Found during:** Task 2 (dry-run verification)
- **Issue:** Plan referenced `client.trade` column but clients table has no trade column. Trade mapping is in CLIENT_TRADE_MAP in page.tsx (08-02 decision).
- **Fix:** Added CLIENT_TRADE_MAP constant to submission_engine.py mirroring frontend mapping. Changed _client_matches_directory to accept trades list instead of single string.
- **Files modified:** scripts/seo_engine/submission_engine.py
- **Verification:** Dry-run mode succeeds, correctly filters directories by client trades
- **Committed in:** f991cf8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for correct trade matching. No scope creep.

## Issues Encountered
- Zero Tier 3 no-CAPTCHA directories currently exist in Supabase (all need CAPTCHA audit classification). Dry-run correctly reports "no eligible directories" -- Brian should run `python3 -m scripts.seo_engine.captcha_audit --update` and manually review results before testing the engine with live submissions.

## User Setup Required
None - Playwright and playwright-stealth installed. Chromium browser binary downloaded.

## Next Phase Readiness
- Submission engine ready for live use once directories are classified as no_captcha via captcha_audit
- Per-directory form config overrides can be added to form_configs/overrides/ as needed (~30% of directories may need them)
- Phase 10 (verification/monitoring) can build on submissions table state machine stages
- Phase 11 (brain integration) can invoke submission_engine.py via CLI

## Self-Check: PASSED

All 6 files exist. Both task commits (5480b4d, f991cf8) verified in git log.

---
*Phase: 09-submission-engine*
*Completed: 2026-03-11*
