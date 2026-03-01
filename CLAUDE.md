# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Bi-weekly performance dashboard for Echo Local SEO + GBP clients. Shows website SEO health, GBP performance, and overall digital presence to demonstrate ROI.

## Tech Stack

- **Frontend**: Next.js (hosted on Netlify)
- **Database**: Supabase (Postgres)
- **Auth**: Supabase Auth with Google OAuth (internal only)
- **Charts**: Recharts
- **Data Pipeline**: Python scripts push to Supabase

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
```

## Data Sources

- **GA4**: Sessions, organic traffic, phone clicks, form submissions
- **Google Search Console**: Impressions, clicks, avg position, top queries
- **PageSpeed Insights**: Mobile/desktop scores, LCP, CLS, TBT
- **GBP API**: Pending approval - views, calls, direction requests

## Key Files

- `scripts/run_reports.py` - Data collection pipeline
- `dashboard-plan.md` - Full specs and design system
- `clients.json` - Client configuration (GA4 property IDs, etc.)
- `client-performance-report.md` - Report schema

## Design System

- Background: `#0A0F1E` (dark navy)
- Accent: `#00CED1` (teal)
- Font: Inter
- Style: Linear.app aesthetic - dark, minimal, bold numbers

## GitHub

https://github.com/EchoLocalagency/EchoLocalClientTracker
