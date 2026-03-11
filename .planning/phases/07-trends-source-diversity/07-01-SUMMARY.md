---
phase: 07-trends-source-diversity
plan: 01
subsystem: geo-dashboard
tags: [recharts, citation-trends, time-series, geo-tab]
dependency_graph:
  requires: [06-02]
  provides: [citation-trend-chart, weekly-trend-data]
  affects: [geo-tab, page-data-fetching]
tech_stack:
  added: []
  patterns: [weekly-grouping, sunday-start-week, 90-day-window, set-based-dedup]
key_files:
  created:
    - src/components/geo/CitationTrendChart.tsx
  modified:
    - src/lib/types.ts
    - src/app/page.tsx
    - src/components/tabs/GeoTab.tsx
decisions:
  - Used Set-based dedup per week bucket to count unique keywords (not raw row counts)
  - Sunday-start week grouping aligns with ISO week convention for US locale
  - Separate serp_features query for trends (all rows) vs status table (latest-per-keyword dedup)
metrics:
  duration: 7m47s
  completed: 2026-03-11
---

# Phase 7 Plan 1: Weekly AIO Citation Trend Charts Summary

Recharts AreaChart showing weekly cited vs AI Overview keyword counts from serp_features, with 90-day window and Sunday-start week grouping.

## What Was Built

### Types (src/lib/types.ts)
- `WeeklyTrendPoint` interface: week label, citedCount, aioCount, citationRate percentage
- `Mention` interface: platform, source_domain, mention_type, title, source_url (pre-added for Plan 07-02)

### Data Fetching (src/app/page.tsx)
- New `loadCitationTrends()` function in the GEO data useEffect
- Queries all serp_features rows for the active client within 90-day window
- Groups by Sunday-start week using Set-based dedup (unique keywords per week, not raw row counts)
- Computes citation rate as percentage per week
- Passed as `citationTrends` prop to GeoTab

### Chart Component (src/components/geo/CitationTrendChart.tsx, 145 lines)
- Three render states: empty (no data message), single point (stat card), 2+ points (AreaChart)
- Two area lines: "Cited Keywords" (green/success) and "AI Overview Keywords" (teal/accent)
- Uses ChartTooltip component for consistent tooltip styling
- Current citation rate summary below chart with color coding (>=50% green, <50% teal)
- Matches existing dark theme design system

### GeoTab Integration (src/components/tabs/GeoTab.tsx)
- CitationTrendChart rendered between citation status table and featured snippets section
- citationTrends prop added to GeoTabProps interface

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 10ff985 | Add trend types, data fetching, and chart component |
| 2 | 3fb106a | Wire CitationTrendChart into GeoTab |

## Self-Check: PASSED

- CitationTrendChart.tsx: FOUND
- types.ts: FOUND
- Commit 10ff985: FOUND
- Commit 3fb106a: FOUND
- npm run build: PASSED
