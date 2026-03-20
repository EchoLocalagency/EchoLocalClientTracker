---
phase: 18-seo-engine-hardening
plan: 5
subsystem: seo-engine
tags: [python, seo, content-quality, dns, sitemap, internal-linking, launchd]

requires:
  - phase: 18-01
    provides: self_improve merge safety and engine_tuning.json protection
  - phase: 18-02
    provides: brain retry logic in seo_loop.py
  - phase: 18-03
    provides: GEO brain integration and impact scoring
provides:
  - Location page duplicate detection via trigram Jaccard similarity
  - Sitemap lastmod auto-update on page edits and GEO upgrades
  - Homepage internal linking with 1-link cap
  - DNS pre-flight check preventing Supabase startup failures
  - Image alt text validation warnings in content pipeline
  - Real-time log output via PYTHONUNBUFFERED in launchd plist
affects: [seo-engine, content-pipeline]

tech-stack:
  added: []
  patterns: [trigram-jaccard-similarity, dns-preflight-with-cache-flush]

key-files:
  created: []
  modified:
    - scripts/seo_engine/actions/location_pages.py
    - scripts/seo_engine/actions/page_optimizer.py
    - scripts/seo_engine/actions/geo_upgrade.py
    - scripts/seo_engine/internal_linker.py
    - scripts/seo_engine/seo_loop.py
    - scripts/seo_engine/content_validator.py
    - ~/Library/LaunchAgents/com.echolocal.seo-engine.plist

key-decisions:
  - "Trigram Jaccard with 0.7 threshold for duplicate detection -- balances false positives vs catching template-recycled pages"
  - "Image alt text issues logged as warnings, not blocking rejections -- avoids breaking existing content flow"
  - "Homepage gets exactly 1 internal link per run -- enough for link equity without cluttering"

patterns-established:
  - "Duplicate content check before file write pattern in location_pages.py"
  - "Sitemap lastmod update after page modification pattern"

requirements-completed: [HARD-11, HARD-12, HARD-15, HARD-16, HARD-17]

duration: 3min
completed: 2026-03-20
---

# Phase 18 Plan 5: Location Page Dedup + Sitemap Lastmod + DNS Preflight + Misc Fixes Summary

**Duplicate location page detection via trigram similarity, sitemap lastmod auto-updates, DNS preflight, homepage linking, image alt validation, and unbuffered launchd logs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T21:34:26Z
- **Completed:** 2026-03-20T21:37:00Z
- **Tasks:** 6
- **Files modified:** 7

## Accomplishments
- Location pages checked against existing area pages before writing -- rejects >70% similar content
- Sitemap lastmod updated automatically when page_optimizer or geo_upgrade modifies a page
- Homepage now receives internal links (capped at 1) instead of being completely skipped
- DNS pre-flight resolves Supabase hostname with retry + cache flush before any DB calls
- Image alt text validation warns on missing/empty/short alt attributes
- Launchd plist set to PYTHONUNBUFFERED=1 for real-time log streaming

## Task Commits

Each task was committed atomically:

1. **Task 1: Location page duplicate detection** - `059b50a` (feat)
2. **Task 2: Sitemap lastmod on page edits** - `2f401e4` (feat)
3. **Task 3: Homepage internal linking** - `9cdf8a9` (feat)
4. **Task 4: DNS pre-flight check** - `51f0fe1` (feat)
5. **Task 5: Image alt text validation** - `4c10a51` (feat)
6. **Task 6: Launchd plist PYTHONUNBUFFERED** - (applied to ~/Library/LaunchAgents/, outside git repo)

## Files Created/Modified
- `scripts/seo_engine/actions/location_pages.py` - _check_duplicate_content() + rejection before write
- `scripts/seo_engine/actions/page_optimizer.py` - _update_sitemap_lastmod() after edits
- `scripts/seo_engine/actions/geo_upgrade.py` - _update_sitemap_lastmod() after GEO upgrades
- `scripts/seo_engine/internal_linker.py` - Homepage skip removed, 1-link cap added
- `scripts/seo_engine/seo_loop.py` - DNS preflight + rejected_duplicate logging
- `scripts/seo_engine/content_validator.py` - check_image_alt_texts() with warning output
- `~/Library/LaunchAgents/com.echolocal.seo-engine.plist` - PYTHONUNBUFFERED=1 added

## Decisions Made
- Trigram Jaccard similarity at 0.7 threshold chosen to catch template-recycled pages while avoiding false positives on pages that legitimately share service descriptions
- Image alt text issues are non-blocking warnings to avoid breaking existing content pipeline
- Homepage internal link cap set to 1 (vs 3 for other pages) to add link equity without cluttering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 plans in Phase 18 (SEO Engine Hardening) are now complete
- SEO engine has: merge safety, brain retry, GEO integration, impact scoring, review velocity, duplicate detection, sitemap freshness, DNS resilience, content quality gates

---
*Phase: 18-seo-engine-hardening*
*Completed: 2026-03-20*
