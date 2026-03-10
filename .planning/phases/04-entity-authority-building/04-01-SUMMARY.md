---
phase: 04-entity-authority-building
plan: 01
subsystem: seo
tags: [schema.org, json-ld, organization, sameAs, structured-data]

requires:
  - phase: 01-serpapi-foundation
    provides: schema_injector.py base functions and patterns
provides:
  - inject_organization_schema() for Organization JSON-LD with sameAs filtering
  - inject_organization_on_all_pages() for bulk Organization injection
  - organization dispatch in seo_loop._execute_schema_update()
  - same_as_urls config field per client in clients.json
affects: [04-entity-authority-building, seo-loop, brain-actions]

tech-stack:
  added: []
  patterns: [sameAs URL filtering (empty string exclusion), Organization separate from LocalBusiness]

key-files:
  created: []
  modified:
    - scripts/seo_engine/schema_injector.py
    - scripts/seo_engine/seo_loop.py
    - clients.json

key-decisions:
  - "Organization schema injected separately from LocalBusiness (Google reads both, do not merge)"
  - "sameAs key omitted entirely when no URLs configured (no empty arrays in JSON-LD)"
  - "same_as_urls added only to clients with website_local_path (active SEO clients)"

patterns-established:
  - "sameAs filtering: filter out empty strings, omit key if no values remain"
  - "Organization on all pages: entity schema is site-wide, not page-type-specific"

requirements-completed: [ENT-01, ENT-02]

duration: 3min
completed: 2026-03-10
---

# Phase 4 Plan 1: Organization Schema + sameAs Summary

**Organization JSON-LD with configurable sameAs profile links, bulk injection utility, and brain dispatch integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T21:30:05Z
- **Completed:** 2026-03-10T21:33:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- inject_organization_schema() with guard clause, sameAs filtering (empty strings excluded, key omitted if all empty)
- inject_organization_on_all_pages() bulk injection across root, blog/, areas/ HTML files
- inject_schemas_for_page() now includes Organization on all page types when sameAs URLs configured
- seo_loop dispatches organization schema_type through standard action pipeline
- same_as_urls dict added to all 4 clients with website_local_path in clients.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Add same_as_urls to clients.json and create inject_organization_schema** - `614c470` (feat)
2. **Task 2: Wire organization schema_type into seo_loop dispatch** - `9bd26a0` (feat)

## Files Created/Modified
- `clients.json` - Added same_as_urls dict (gbp, yelp, bbb, facebook, instagram) to 4 active clients
- `scripts/seo_engine/schema_injector.py` - Added inject_organization_schema(), inject_organization_on_all_pages(), updated inject_schemas_for_page()
- `scripts/seo_engine/seo_loop.py` - Added organization branch to _execute_schema_update dispatch

## Decisions Made
- Organization schema injected separately from LocalBusiness -- Google reads both types independently, merging would lose entity signals
- sameAs key omitted entirely when no non-empty URLs exist (no empty arrays in JSON-LD output)
- same_as_urls only added to clients with website_local_path (Primal Plates excluded, no local site)

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

Brian needs to populate same_as_urls values in clients.json for each client:
- GBP profile URL
- Yelp business page URL
- BBB listing URL (if applicable)
- Facebook page URL
- Instagram profile URL

Until at least one URL is populated per client, Organization schema will inject without sameAs (telephone + name + url only).

## Next Phase Readiness
- Organization schema infrastructure complete and ready for use
- Brain can recommend schema_update with schema_type "organization"
- Bulk injection available once same_as_urls are populated
- Ready for 04-02 plan execution

---
*Phase: 04-entity-authority-building*
*Completed: 2026-03-10*

## Self-Check: PASSED
