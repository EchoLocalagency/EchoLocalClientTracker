# Client Dashboard — Build Notes

## Purpose
Bi-weekly performance dashboard for SEO + GBP clients. Shows website SEO health, GBP performance, and overall digital presence. Built to demonstrate ROI of Brian's services.

## Current Clients
- Integrity Pro Washers — integrityprowashers.com
- Mr Green Turf Clean — mrgreenturfclean.com

---

## Data Sources (Status)

### GA4 — WORKING
- Sessions (total + organic) with period-over-period delta
- Event tracking (see below)
- Library: `google-analytics-data` Python SDK
- Both clients connected under GA4 account: `accounts/383710663`
- Property IDs in `clients.json`

### Google Search Console — WORKING (data populating)
- Impressions, clicks, avg position
- Top queries (up to 25, ordered by impressions)
- Both sites verified as siteOwner under Brian's account
- Note: GSC data lags ~3 days; new properties take days to populate

### PageSpeed Insights — WORKING
- Mobile + desktop scores
- LCP, CLS, TBT
- No OAuth needed — API key only

### GBP (Business Profile Performance API) — PENDING APPROVAL
- Apply at: https://developers.google.com/my-business/content/prereqs
- GCP project: durable-ripsaw-488104-u2
- Once approved, track:
  - Views (Maps + Search, split desktop/mobile)
  - Phone call clicks
  - Direction requests
  - Website clicks from GBP listing
  - Search queries that triggered GBP listing
- Scope: `business.manage`

### Review Tracking — NOT YET BUILT
- Plan: Apify scrape of GBP listing every 2 weeks
- Track: review count delta, rating delta, new negative reviews
- Doable now without GBP API approval

### Rank Tracking — NOT YET BUILT
- Plan: Brave Search or SerpAPI for top 3-5 target keywords per client
- Track position changes bi-weekly
- Optionally track vs top competitor

---

## GA4 Conversion Tracking — NEEDS SETUP

### Current state (as of Feb 2026)
Neither site has conversion events — only default GA4 events fire:
- `page_view`, `session_start`, `first_visit`, `user_engagement`, `scroll`
- No call clicks, no form submissions, no CTA tracking

### Events to add to both sites
1. **Phone click** — fire `click` event when user taps/clicks `tel:` link
   - Dimension: `link_url` containing `tel:`
   - GA4 filter: `eventName = "click"` AND `linkUrl contains "tel:"`
2. **Form submission** — fire `generate_lead` or `form_submit` on contact/quote form submit
3. **CTA button clicks** — "Get a Quote", "Book Now", etc.

### How to set up
- Add via Google Tag Manager (GTM) on both sites, OR
- Add directly to site HTML if Brian controls the code
- Once firing, these become trackable in the dashboard as "conversions this period"

---

## Dashboard Metrics (Full Vision)

### Website SEO Panel
| Metric | Source | Notes |
|---|---|---|
| Organic sessions | GA4 | vs prior period |
| Total sessions | GA4 | vs prior period |
| Phone click events | GA4 | requires event setup |
| Form submissions | GA4 | requires event setup |
| Top landing pages | GA4 | |
| Top keywords | GSC | impressions + clicks + position |
| Total impressions | GSC | vs prior period |
| Avg keyword position | GSC | vs prior period |
| Mobile PageSpeed score | PSI | flag if < 50 |
| Desktop PageSpeed score | PSI | |
| LCP mobile | PSI | flag if > 4s |
| CLS | PSI | flag if > 0.1 |

### GBP Panel (once API approved)
| Metric | Source | Notes |
|---|---|---|
| GBP search impressions | GBP API | Maps + Search views |
| Phone calls from GBP | GBP API | |
| Direction requests | GBP API | |
| Website clicks from GBP | GBP API | |
| Review count | GBP API or Apify | delta this period |
| Star rating | GBP API or Apify | delta this period |
| New negative reviews | GBP API or Apify | flag immediately |
| Top GBP search queries | GBP API | |

### Rank Tracking Panel (to build)
| Metric | Source | Notes |
|---|---|---|
| Position for keyword 1 | Brave/SerpAPI | e.g. "pressure washing [city]" |
| Position for keyword 2 | Brave/SerpAPI | |
| Position for keyword 3 | Brave/SerpAPI | |
| vs competitor rank | Brave/SerpAPI | optional |

---

## Data Storage
- Per-run JSON: `/Users/brianegan/Claude code.md/reports/{slug}/{YYYY-MM-DD}.json`
- Historical runs accumulate — dashboard reads all files for trend lines
- Schema defined in `skills/client-performance-report.md`

## Tech Stack (Decided)
- **DB**: Supabase (Postgres) — persistent storage, all bi-weekly runs accumulate
- **Data pipeline**: Python scripts (existing), push to Supabase after each pull
- **Frontend**: Next.js, hosted on Netlify
- **Auth**: Supabase Auth with Google OAuth — internal only, Brian's account only
- **Charts**: Recharts (works natively with Next.js/React)

## Dashboard Structure (Finalized)

### Layout
- Left sidebar: client selector (flip between Mr Green / Integrity Pro / future clients)
- Top: active client name + last updated date
- Main area: tabbed content below

### Tab 1 — Overview
Hero metric: "How much more are you showing up on Google" — GSC impressions trend
- One stat card per key metric: organic sessions, impressions, phone clicks, mobile speed score
- Period-over-period delta on each (green up / red down)
- Red flag alerts: mobile score < 50, organic drop > 20%, LCP > 4s
- Covers the "showing up on Google" question at a glance

### Tab 2 — SEO Performance
- Line chart: GSC impressions over all historical runs (the trend over months)
- Line chart: organic sessions over all historical runs
- Avg keyword position trend line
- Top 10 keywords table: query | impressions | clicks | position | delta vs last period
- Top landing pages by organic sessions

### Tab 3 — Website Health
- Mobile vs desktop PageSpeed score over time (line chart)
- Current LCP / CLS / TBT with green/yellow/red indicators
- Run history table — every bi-weekly snapshot
- Flag if score drops > 10 points between runs

### Tab 4 — Conversions
- Phone clicks per period (bar chart over time)
- Form submissions per period (Integrity only)
- Conversion rate: phone clicks / sessions
- Top pages driving phone clicks

### Tab 5 — GBP (placeholder, enable after API approval)
- Views (Maps + Search)
- Phone calls from listing
- Direction requests
- Website clicks from GBP
- Review count + rating delta
- Top GBP search queries

### Tab 6 — Report Generator (future)
- Auto-generated plain-language summary per client
- "Your site got X impressions, up Y% — here's what's driving it"
- Copy/paste ready for client emails

## Supabase Schema (to build)
### clients
- id, name, slug, ga4_property, gsc_url, website, github, phone, created_at

### reports
- id, client_id, run_date, period_start, period_end
- ga4_sessions, ga4_sessions_prev
- ga4_organic, ga4_organic_prev
- ga4_phone_clicks, ga4_phone_clicks_prev
- ga4_form_submits, ga4_form_submits_prev
- gsc_impressions, gsc_impressions_prev
- gsc_clicks, gsc_clicks_prev
- gsc_avg_position, gsc_avg_position_prev
- psi_mobile_score, psi_desktop_score
- psi_lcp_mobile, psi_lcp_desktop
- psi_cls_mobile, psi_cls_desktop
- psi_tbt_mobile, psi_tbt_desktop

### gsc_queries
- id, report_id, client_id, run_date, query, impressions, clicks, position

## Design System (Echo Local Branded)

### Colors
```
--bg-primary:      #0A0F1E   (dark navy background)
--bg-surface:      #0F1629   (card surfaces)
--bg-sidebar:      #001F3F   (Echo Local brand navy — sidebar)
--border:          #1E2A3A   (subtle card borders)
--accent-teal:     #00CED1   (primary accent — CTAs, up deltas, chart lines)
--accent-teal-hover:#00B4B4  (hover state)
--accent-gold:     #FFD700   (alerts, warnings, flags only)
--text-primary:    #F5F5F5   (main text)
--text-muted:      #8892A4   (labels, secondary text)
--success:         #28a745   (positive indicators)
--danger:          #dc3545   (negative deltas, red flags)
```

### Typography
- Font: Inter (matches echolocalagency.com)
- Metric numbers: 32-48px, font-weight 700
- Section headings: 18-20px, font-weight 600
- Body/labels: 14px, font-weight 400
- Muted labels: 12px, font-weight 400, --text-muted color

### Components
- Cards: bg-surface, 1px border, 8px border-radius, subtle teal glow on hover
- Sidebar: bg-sidebar (#001F3F), 240px width, collapsible
- Charts: teal primary line, gold secondary, dark grid lines
- Delta badges: teal bg for positive, red bg for negative, rounded pill shape
- Tabs: underline style, teal active indicator

### Inspiration
- Linear.app aesthetic — dark, minimal, bold numbers, single accent color
- Semrush data density — lots of info without clutter
- Cards with glassmorphism-lite (subtle transparency, not overdone)

## GitHub Repo
- https://github.com/EchoLocalagency/EchoLocalClientTracker
- Deploy: Netlify (connected to this repo)

## Build Priority Order
1. Supabase schema setup + seed with first real data run
2. Python pipeline updated to push to Supabase instead of (or in addition to) JSON files
3. Next.js project scaffold + Supabase client + Google OAuth
4. Tab 1 Overview + Tab 2 SEO Performance (core value)
5. Tab 3 Website Health
6. Tab 4 Conversions
7. Deploy to Netlify
8. Tab 5 GBP — after API approval
9. Tab 6 Report generator
