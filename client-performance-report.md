# Skill: Client Performance Report

## Trigger
"run client reports" or "bi-weekly report" or "run performance report"

## Overview
Pulls bi-weekly performance data for all clients from GA4, GSC, and PageSpeed. Saves structured JSON per client per run to `/Users/brianegan/Claude code.md/reports/{slug}/{YYYY-MM-DD}.json`. Compares current 14-day period vs prior 14-day period.

## Files
- Client registry: `/Users/brianegan/Claude code.md/clients.json`
- Reports output: `/Users/brianegan/Claude code.md/reports/{slug}/{YYYY-MM-DD}.json`
- Token: `/Users/brianegan/Claude code.md/token.json`

## Credentials
- OAuth Refresh Token: stored in MEMORY.md under "Google OAuth"
- OAuth Client ID: stored in MEMORY.md
- OAuth Client Secret: stored in MEMORY.md
- PageSpeed API Key: stored in MEMORY.md

## APIs
- **GA4**: `google-analytics-data` Python library — `BetaAnalyticsDataClient`
  - Metrics: `sessions`, organic sessions via `sessionDefaultChannelGroup = "Organic Search"` filter
  - Property IDs from `clients.json`
- **GSC**: `searchconsole v1` via `googleapiclient.discovery`
  - `searchanalytics().query()` with dimensions `["query"]`, rowLimit 25, ordered by impressions desc
  - Site URLs from `clients.json`
- **PageSpeed**: REST API, no OAuth — key in MEMORY.md
  - `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&strategy={mobile|desktop}&key={key}`
  - Metrics: performance score, LCP, CLS, TBT
- **GBP**: pending Google API approval — add when approved
  - Apply at: https://developers.google.com/my-business/content/prereqs
  - GCP project: durable-ripsaw-488104-u2
  - Scope: `business.manage`

## Python Libraries Required
```
pip3 install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client google-analytics-data
```

## Output JSON Schema
```json
{
  "client": "Client Name",
  "date": "YYYY-MM-DD",
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "prev_start": "YYYY-MM-DD",
  "prev_end": "YYYY-MM-DD",
  "ga4": {
    "sessions": 0,
    "sessions_prev": 0,
    "organic_sessions": 0,
    "organic_sessions_prev": 0
  },
  "gsc": {
    "impressions": 0,
    "impressions_prev": 0,
    "clicks": 0,
    "clicks_prev": 0,
    "avg_position": 0.0,
    "avg_position_prev": 0.0,
    "top_queries": [
      {"query": "", "impressions": 0, "clicks": 0, "position": 0.0}
    ]
  },
  "pagespeed": {
    "mobile_score": 0,
    "desktop_score": 0,
    "lcp_mobile": "",
    "lcp_desktop": "",
    "cls_mobile": "",
    "cls_desktop": "",
    "tbt_mobile": "",
    "tbt_desktop": ""
  },
  "gbp": {}
}
```

## Run Steps
1. Read `clients.json` for all clients
2. For each client, pull GA4 + GSC + PageSpeed in sequence
3. Write JSON to `reports/{slug}/{YYYY-MM-DD}.json`
4. Print summary table to chat with deltas
5. Note any red flags (mobile score < 50, LCP > 4s, organic sessions declining > 20%)

## Notes
- GSC data lags ~3 days — use `today - 3` as period_end if needed
- GA4 `prev` period will show 0 if property was recently created
- GBP section left empty until API approval — add `gbp_location` field to clients.json when ready
- Add new clients to `clients.json` and create their reports directory manually
