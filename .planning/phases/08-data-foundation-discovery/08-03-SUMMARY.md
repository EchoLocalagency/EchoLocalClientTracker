---
phase: 08-data-foundation-discovery
plan: 03
subsystem: python-scripts
tags: [brave-search, captcha, discovery, directories, supabase, python]

# Dependency graph
requires:
  - phase: 08-01
    provides: "client_profiles, directories, submissions tables with seed data"
provides:
  - Per-client listing discovery via Brave Search site: queries
  - Automated CAPTCHA detection for directory form URLs
  - existing_needs_review submission rows for found listings
  - captcha_status classification (no_captcha, simple_captcha, advanced_captcha, unknown)
affects: [09-submission-engine, 10-verification, 12-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [budget-gated-brave-discovery, html-captcha-detection, protected-status-upsert]

key-files:
  created:
    - scripts/seo_engine/discovery.py
    - scripts/seo_engine/captcha_audit.py
  modified: []

key-decisions:
  - "Discovery protects existing non-pending submissions from overwrite during upsert"
  - "CAPTCHA detection uses static HTML analysis only -- JS-rendered CAPTCHAs flagged for manual review"
  - "reCAPTCHA v2 classified as simple_captcha; v3, hCaptcha, Turnstile classified as advanced_captcha"

patterns-established:
  - "Discovery skip cache: directories checked within N days are skipped (default 30)"
  - "Rate limiting: 1.1s between Brave queries, 2s between directory HTTP fetches"
  - "Protected status pattern: submissions with non-pending status are never overwritten by discovery"

requirements-completed: [DATA-04, DATA-05]

# Metrics
duration: 6min
completed: 2026-03-11
---

# Phase 8 Plan 3: Discovery + CAPTCHA Audit Summary

**Brave Search listing discovery with budget gating and HTML-based CAPTCHA classification for 55 directory submission URLs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-11T04:14:25Z
- **Completed:** 2026-03-11T04:20:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Built per-client discovery script that searches all 55 enabled directories via Brave Search site: queries
- Discovery creates existing_needs_review submission rows, respects budget cap, skips recently-checked directories, and protects existing non-pending submissions
- Built CAPTCHA audit script that fetches directory submission URLs and classifies reCAPTCHA v2/v3, hCaptcha, and Cloudflare Turnstile
- CAPTCHA audit supports dry-run reporting and live Supabase updates with --update flag

## Task Commits

Each task was committed atomically:

1. **Task 1: Build discovery script for pre-existing listing detection** - `90bf058` (feat)
2. **Task 2: Build CAPTCHA audit script with automated detection** - `bf3742c` (feat)

## Files Created/Modified
- `scripts/seo_engine/discovery.py` - On-demand per-client listing discovery via Brave Search with budget gating
- `scripts/seo_engine/captcha_audit.py` - Automated CAPTCHA detection for directory form URLs with HTML pattern matching

## Decisions Made
- Discovery protects existing submissions with non-pending status (submitted, verified, skipped, existing_needs_review) from being overwritten during upsert
- CAPTCHA detection is static HTML only -- avoids heavyweight Playwright/Selenium dependency for a quick classification pass
- reCAPTCHA v2 (checkbox) classified as simple_captcha (potentially solvable); reCAPTCHA v3, hCaptcha, and Turnstile classified as advanced_captcha (require manual handling or specialized solving)
- Directories with no CAPTCHA in HTML flagged with a note that JS-rendered CAPTCHAs may exist -- manual review recommended before Phase 9

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None -- both scripts use existing BRAVE_API_KEY and Supabase credentials from .env.

## Next Phase Readiness
- Discovery script ready for Brian to run per-client: `python3 -m scripts.seo_engine.discovery --client-slug mr-green-turf-clean`
- CAPTCHA audit ready to classify all 55 directories: `python3 -m scripts.seo_engine.captcha_audit --update`
- Phase 9 submission engine can use captcha_status to determine automation eligibility per directory
- Directories classified as no_captcha or simple_captcha are candidates for Playwright automation
- Directories classified as advanced_captcha or unknown require manual submission

---
*Phase: 08-data-foundation-discovery*
*Completed: 2026-03-11*
