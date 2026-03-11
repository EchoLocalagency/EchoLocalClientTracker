---
phase: "06-geo-dashboard"
plan: "01"
subsystem: "dashboard-geo-tab"
tags: ["geo", "dashboard", "supabase", "react"]
dependency_graph:
  requires: ["geo_scores table", "serp_features table", "serpapi_usage table"]
  provides: ["GeoTab component", "GEO types", "GEO data fetching"]
  affects: ["src/app/page.tsx", "src/lib/types.ts", "src/components/TabNav.tsx"]
tech_stack:
  added: []
  patterns: ["Supabase deduplication with Set", "inline style pill badges"]
key_files:
  created:
    - "src/components/tabs/GeoTab.tsx"
  modified:
    - "src/lib/types.ts"
    - "src/components/TabNav.tsx"
    - "src/app/page.tsx"
decisions:
  - "GEO tab visible to ALL users (not admin-gated) per plan spec"
  - "Deduplication uses Set pattern from research (matching geo_data.py)"
  - "serpapi_usage query is global (no client_id filter) matching Python behavior"
metrics:
  duration: "2m 11s"
  completed: "2026-03-11"
---

# Phase 6 Plan 01: GEO Data Layer and Tab Scaffold Summary

GEO tab added to dashboard with TypeScript types (GeoScore, SerpFeature, SerpApiUsage), Supabase data fetching with frontend deduplication, and per-page score cards showing 0-5 color-coded scores with factor pill breakdowns.

## What Was Done

### Task 1: Add GEO types and register the GEO tab
- Added `GeoScore`, `SerpFeature`, `SerpApiUsage` interfaces to `src/lib/types.ts`
- Added `'geo'` to `TabId` union type
- Added `{ id: 'geo', label: 'GEO' }` to TabNav tabs array (after GBP, before SEO Engine)
- GEO tab is visible to all users (not filtered by `visibleTabs` admin gate)
- **Commit:** `151f4f6`

### Task 2: Fetch GEO data in page.tsx and build GeoTab
- Added `geoScores`, `serpFeatures`, `serpApiUsageCount` state variables to page.tsx
- Added useEffect keyed to `activeClient` that fetches from all three Supabase tables
- Deduplicates geo_scores by `page_path` and serp_features by `keyword` keeping most recent
- Only fetches when `seo_engine_enabled` is true
- Created `GeoTab.tsx` (145 lines) with:
  - Empty state when SEO engine disabled
  - Score cards per page with large color-coded score (green 4-5, teal 3, dim-teal 2, red 0-1)
  - Factor pill badges (green for present, red for missing) for all 5 factors
  - Scored-at date display
  - Placeholder comments for Plan 06-02 sections (Citation Status, Budget Gauge, Snippet Ownership)
- **Commit:** `1ae14ee`

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **serpapi_usage query is global**: The query does not filter by client_id, matching the Python budget gauge which tracks global API usage across all clients.

## Verification

- TypeScript compiles with zero errors (`npx tsc --noEmit`)
- `npm run build` completes successfully
- GEO tab appears in TabNav for all users
- Score color coding follows the 0-5 scale spec
- Factor pills show green (present) and red (missing) states
