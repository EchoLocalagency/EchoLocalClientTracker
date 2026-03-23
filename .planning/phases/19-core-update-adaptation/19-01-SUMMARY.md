---
phase: 19-core-update-adaptation
plan: 01
subsystem: seo-engine
tags: [schema, json-ld, howto, breadcrumb, freshness, structured-data]

requires:
  - phase: 18-seo-engine-hardening
    provides: schema_injector.py with FAQ, Service, LocalBusiness, BlogPosting, Person, Organization schemas
provides:
  - HowTo schema auto-detection and injection for step-by-step content
  - BreadcrumbList schema injection with page hierarchy awareness
  - Visible freshness dates on all location page templates
  - Auto-update of Last updated date on page edits via page_optimizer
affects: [seo-engine, blog-engine, location-pages, page-optimizer]

tech-stack:
  added: []
  patterns: [schema-auto-detection-in-inject_schemas_for_page, visible-freshness-signal-pattern]

key-files:
  created: []
  modified:
    - scripts/seo_engine/schema_injector.py
    - scripts/seo_engine/actions/page_optimizer.py
    - scripts/seo_engine/actions/location_pages.py
    - scripts/seo_engine/templates/location_template.html
    - scripts/seo_engine/templates/location_template_integrity.html
    - scripts/seo_engine/templates/location_template_az.html
    - scripts/seo_engine/templates/location_template_socal.html

key-decisions:
  - "HowTo detection uses ordered lists first, falls back to Step N H3 headings"
  - "BreadcrumbList path detection uses blog/ areas/ locations/ prefixes"
  - "Blog templates already had Last updated placeholder -- no changes needed"
  - "page_optimizer auto-refreshes both visible date and dateModified in JSON-LD on edits"

patterns-established:
  - "Schema auto-detection: new schema types added to inject_schemas_for_page for sweep coverage"
  - "Freshness signal: all content templates include visible Last updated with publish_date placeholder"

requirements-completed: [CORE-01, CORE-02, CORE-03, CORE-04]

duration: 2min
completed: 2026-03-23
---

# Phase 19 Plan 01: Schema Expansion + Visible Freshness Summary

**HowTo and BreadcrumbList JSON-LD schema injection with visible freshness dates on all content templates**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T19:08:54Z
- **Completed:** 2026-03-23T19:11:00Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments
- HowTo schema auto-detects ordered lists (3+ items) and Step N H3 patterns, including cost/supply/tool extraction
- BreadcrumbList schema generates correct hierarchy for blog, area, and service pages
- Visible "Last updated" date added to all 4 location page templates
- page_optimizer auto-refreshes both visible date and dateModified schema on every edit

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: HowTo + BreadcrumbList schema injection** - `0546801` (feat)
2. **Task 3: Blog template freshness + page_optimizer date update** - `a3fc87e` (feat)
3. **Task 4: Location template freshness dates** - `5fa0fe7` (feat)

## Files Created/Modified
- `scripts/seo_engine/schema_injector.py` - Added inject_howto_schema(), inject_breadcrumb_schema(), integrated into auto-detection
- `scripts/seo_engine/actions/page_optimizer.py` - Auto-updates Last updated date and dateModified on edits
- `scripts/seo_engine/actions/location_pages.py` - Added publish_date template variable replacement
- `scripts/seo_engine/templates/location_template.html` - Added Last updated paragraph
- `scripts/seo_engine/templates/location_template_integrity.html` - Added Last updated paragraph
- `scripts/seo_engine/templates/location_template_az.html` - Added Last updated paragraph
- `scripts/seo_engine/templates/location_template_socal.html` - Added Last updated paragraph

## Decisions Made
- HowTo detection prioritizes OL elements over H3 "Step N" patterns (OL is more reliable signal)
- BreadcrumbList uses path-based detection (blog/, areas/, locations/) rather than template type
- Blog templates already had "Last updated: {{publish_date}}" in all 4 variants -- no modification needed
- page_optimizer refreshes both visible text and JSON-LD dateModified using regex replacement

## Deviations from Plan

### Auto-observed

**1. Blog templates already had Last updated placeholder**
- **Found during:** Task 3
- **Issue:** Plan stated "the template didn't have the placeholder" but all 4 blog templates already had `Last updated: {{publish_date}}`
- **Action:** Skipped template HTML changes, focused on page_optimizer date refresh instead
- **Impact:** None -- the feature was already present, optimizer update adds ongoing freshness

None - plan executed as written with minor observation above.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema injector now supports 8 types (FAQ, Service, LocalBusiness, BlogPosting, Person, Organization, HowTo, BreadcrumbList)
- All content templates have visible freshness signals
- Ready for plan 19-02 and 19-03

---
*Phase: 19-core-update-adaptation*
*Completed: 2026-03-23*
