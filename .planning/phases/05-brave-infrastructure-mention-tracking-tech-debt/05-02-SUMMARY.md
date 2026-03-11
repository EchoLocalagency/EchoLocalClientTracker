---
phase: 05-brave-infrastructure-mention-tracking-tech-debt
plan: 02
subsystem: research
tags: [brave-search, mention-tracking, reddit, competitor-citations, supabase]

# Dependency graph
requires:
  - phase: 05-brave-infrastructure-mention-tracking-tech-debt
    provides: "brave_client.py budget-gated Brave Search wrapper"
provides:
  - "pull_reddit_questions_brave() Brave-powered Reddit mining"
  - "track_mentions() cross-platform mention tracking via Brave"
  - "parse_competitor_citations() zero-cost AIO competitor parsing"
  - "mentions Supabase table"
  - "competitor_aio_citations Supabase table"
  - "research_runner.py Steps 10-11 wired"
affects: [06-geo-dashboard, 07-mention-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [brave-site-search, cross-platform-mention-tracking, zero-cost-data-reuse]

key-files:
  created:
    - scripts/seo_engine/research/mention_tracker.py
  modified:
    - scripts/seo_engine/research/reddit.py
    - scripts/seo_engine/research/research_runner.py

key-decisions:
  - "Reddit mining uses site:reddit.com Brave queries instead of Reddit API -- eliminates Reddit auth dependency"
  - "Mention tracking searches 8 platforms (Yelp, BBB, HomeAdvisor, Thumbtack, Angi, Nextdoor, reviews, forums)"
  - "Competitor AIO citations parsed from existing serp_features data with zero additional API calls"
  - "Old pull_reddit_questions() kept as deprecated stub to prevent import breakage"

patterns-established:
  - "Brave site:domain.com queries for platform-specific search"
  - "Supabase upsert on_conflict for idempotent mention storage"
  - "Zero-cost data reuse: parse existing serp_features for competitor citations"

requirements-completed: [MENT-01, MENT-02, MENT-04]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 5 Plan 2: Mention Tracking Summary

**Brave-powered Reddit mining, cross-platform mention tracking across 8 directory/forum/review sites, and competitor AIO citation parsing from existing SERP data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T01:36:51Z
- **Completed:** 2026-03-11T01:39:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote reddit.py to use Brave site:reddit.com queries, removing all Reddit API dependency
- Created mention_tracker.py with track_mentions() (8 platform queries via Brave) and parse_competitor_citations() (zero API cost, reads serp_features)
- Created mentions and competitor_aio_citations Supabase tables with proper indexes and unique constraints
- Wired Steps 10 (mention tracking) and 11 (competitor AIO parsing) into research_runner.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite reddit.py + create mention_tracker.py + Supabase tables** - `be30d7a` (feat)
2. **Task 2: Wire mention tracking into research_runner.py** - `47a6c24` (feat)

## Files Created/Modified
- `scripts/seo_engine/research/reddit.py` - Brave-powered Reddit question mining, no Reddit API
- `scripts/seo_engine/research/mention_tracker.py` - Cross-platform mention tracking + competitor AIO citation parsing
- `scripts/seo_engine/research/research_runner.py` - Steps 2 (Reddit/Brave), 10 (mentions), 11 (competitor AIO) wired

## Decisions Made
- Used site:reddit.com Brave queries instead of Reddit API -- eliminates Reddit OAuth dependency entirely
- Mention tracking searches 8 query patterns across Yelp, BBB, HomeAdvisor, Thumbtack, Angi, Nextdoor, plus generic reviews/forum queries
- Competitor AIO citations parsed from existing serp_features data (zero API cost, reuses collected SERP data)
- Kept old pull_reddit_questions() as deprecated stub returning [] to prevent import errors in any unreferenced code

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 5 fully complete -- both plans executed
- mentions table populated on next research day (Wed/Sat) when SEO engine runs
- competitor_aio_citations populated from existing serp_features data (requires prior SERP scraping)
- Phase 6 (GEO Dashboard) can proceed -- all backend data collection is in place
- Phase 7 (Mention Dashboard) has data sources ready once 1-2 weeks of mention data accumulates

---
*Phase: 05-brave-infrastructure-mention-tracking-tech-debt*
*Completed: 2026-03-11*
