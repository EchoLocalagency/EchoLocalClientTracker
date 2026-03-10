---
phase: 03-brain-integration-content-upgrades
plan: 02
subsystem: seo-engine
tags: [geo-upgrade, faq-schema, content-upgrade, string-insertion, html-fidelity]

# Dependency graph
requires:
  - phase: 03-brain-integration-content-upgrades
    plan: 01
    provides: Brain GEO rules (37-39), geo_content_upgrade action type definition, geo_data.py
provides:
  - geo_upgrade.py action module (execute_geo_upgrade) for answer_block, stats_injection, freshness_update
  - seo_loop dispatch for geo_content_upgrade with 2/week rate limit
  - detect_faq_candidates function for question-format H2 detection
  - FAQ auto-detect post-action hook on content creation + geo upgrades
affects: [03-03, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String-level HTML insertion (not BeautifulSoup serialization) for HTML fidelity"
    - "FAQ auto-detection from question-format H2 headings as post-action hook"
    - "Additive content modifications (insert, never replace existing content)"

key-files:
  created:
    - scripts/seo_engine/actions/geo_upgrade.py
  modified:
    - scripts/seo_engine/seo_loop.py
    - scripts/seo_engine/schema_injector.py

key-decisions:
  - "String-level insertion over BeautifulSoup serialization (preserves whitespace and attributes)"
  - "FAQ auto-detect runs as post-action hook not standalone action (zero-cost, piggybacks on content creation)"
  - "Question word regex + trailing ? for H2 detection (covers both explicit questions and question-word starters)"

patterns-established:
  - "geo_upgrade action module pattern: read HTML, regex-find heading, string-slice insert, git commit+push"
  - "Post-action FAQ hook pattern: detect_faq_candidates -> inject_faq_schema (existing dedup prevents duplicates)"

requirements-completed: [BRAIN-02, CONT-03, CONT-04]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 3 Plan 2: GEO Content Upgrade Execution Pipeline Summary

**geo_upgrade.py action module with string-level HTML insertion for answer blocks/stats/freshness, wired into seo_loop dispatch with 2/week rate limit and automatic FAQ schema detection as post-action hook**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T18:10:58Z
- **Completed:** 2026-03-10T18:13:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created geo_upgrade.py with execute_geo_upgrade handling answer_block (H2 insertion), stats_injection (paragraph insertion), and freshness_update (container insertion/replacement) -- all using string-level manipulation for HTML fidelity
- Wired geo_content_upgrade into seo_loop _execute_action dispatch with 2/week rate limit in WEEKLY_LIMITS
- Added detect_faq_candidates to schema_injector that finds question-format H2 headings (ending with ? or starting with question words) and extracts answer paragraphs
- Added FAQ auto-detect post-action hook that runs for blog_post, newsjack_post, location_page, and geo_content_upgrade -- leverages existing inject_faq_schema with dedup
- Protected pages (index.html) blocked from geo_content_upgrade
- geo_content_upgrade added to internal linking post-action hook tuple

## Task Commits

Each task was committed atomically:

1. **Task 1: Create geo_upgrade.py action module** - `afd243f` (feat)
2. **Task 2: Wire geo_content_upgrade dispatch and FAQ auto-detect hook** - `c6510ae` (feat)

## Files Created/Modified
- `scripts/seo_engine/actions/geo_upgrade.py` - GEO content upgrade execution: answer_block, stats_injection, freshness_update with string-level insertion + git commit/push
- `scripts/seo_engine/seo_loop.py` - Dispatch for geo_content_upgrade, rate limit (2/week), internal linking hook, FAQ auto-detect hook
- `scripts/seo_engine/schema_injector.py` - New detect_faq_candidates function for question-format H2 detection

## Decisions Made
- String-level insertion over BeautifulSoup serialization to preserve original HTML whitespace, attributes, and formatting (per research finding that str(soup) alters content)
- FAQ auto-detect runs as post-action hook rather than standalone action -- zero additional cost, piggybacks on every content creation action
- Question word regex pattern covers how/what/why/when/where/is/can/do/does/should/will/are plus explicit trailing ?
- Freshness update checks for existing .freshness-date element and replaces content rather than duplicating

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Brain can now recommend geo_content_upgrade actions and seo_loop will execute them (answer blocks, stats, freshness dates)
- FAQ schema auto-injected on any content creation action with question-format headings
- Ready for Plan 03-03: Blog engine citation-ready defaults and remaining content upgrades
- End-to-end pipeline: brain sees GEO scores (Plan 01) -> recommends upgrades (rules 37-39) -> seo_loop dispatches (Plan 02) -> page modified + FAQ schema injected

---
*Phase: 03-brain-integration-content-upgrades*
*Completed: 2026-03-10*
