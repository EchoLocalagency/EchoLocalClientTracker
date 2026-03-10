# GEO Module for SEO Engine

## What This Is

Generative Engine Optimization (GEO) capabilities built into the existing SEO engine. The engine now fetches structured SERP data via SerpAPI, scores every page for citation-readiness, detects AI Overview citations, and gives the brain full visibility to prioritize content upgrades. Organization schema and topical authority scoring round out entity signals.

## Core Value

The brain knows which pages are citation-ready and which aren't, and prioritizes making uncitable content citable -- because AI search is where discovery is shifting.

## Requirements

### Validated

- v1.0 SerpAPI client replaces Apify with budget-gated, usage-tracked structured data (SERP-01 through SERP-04)
- v1.0 AI Overview detection, citation matching, PAA extraction, Featured Snippet tracking (SERP-05 through SERP-09)
- v1.0 GEO scorer: 5-factor binary checklist, daily zero-cost local HTML analysis, Supabase storage with trends (GEO-01 through GEO-05)
- v1.0 Brain integration: GEO scores in prompt, geo_content_upgrade action, striking-distance prioritization (BRAIN-01 through BRAIN-04)
- v1.0 Content upgrades: answer capsules, citation-ready blog structure, page retrofitting, FAQ auto-detect (CONT-01 through CONT-04)
- v1.0 Entity building: Organization schema with sameAs, topical authority scoring, PAA gap detection (ENT-01 through ENT-04)

### Active

- [ ] Reddit question mining via Brave Search (MENT-01)
- [ ] Cross-platform mention tracking (MENT-02)
- [ ] Source diversity scoring (MENT-03)
- [ ] Competitor AI Overview monitoring (MENT-04)
- [ ] GEO scores visible in Next.js dashboard (DASH-01)
- [ ] AI Overview citation status per keyword in dashboard (DASH-02)
- [ ] AI Overview citation trends chart (DASH-03)
- [ ] Source diversity visualization (DASH-04)
- [ ] SerpAPI budget usage indicator (DASH-05)
- [ ] Featured Snippet ownership tracker (DASH-06)

### Out of Scope

- Perplexity API integration -- unreliable for citation tracking, add later if API improves
- ChatGPT citation tracking -- no public API, results inconsistent
- Reddit/Quora answer posting automation -- ToS violation, ban risk
- YouTube transcript optimization -- no YouTube presence for current clients
- Apify SERP scraping -- replaced entirely by SerpAPI
- Real-time AI visibility dashboard -- would burn SerpAPI budget in days
- Multi-language GEO -- English only, current client base

## Context

Shipped v1.0 with ~9,150 LOC Python (seo_engine).
Tech stack: Python 3, Supabase, SerpAPI, Next.js dashboard, Claude brain via `claude -p`.
Two active clients: mr-green-turf-clean, integrity-pro-washers. Two onboarding: AZ Turf, SoCal Turfs.
SEO engine runs daily at noon via launchd. Research runs Wed + Sat.
SerpAPI budget: 200 searches/client/month, 950 global cap. $25/mo Starter Plan.

**Known tech debt from v1.0:**
- content_validator.py capsule word count (50-150) mismatches brain rule (40-60)
- inject_organization_on_all_pages() defined but never called from runtime
- same_as_urls empty in clients.json for all clients (needs manual population)

## Constraints

- **API Budget**: SerpAPI 1000 searches/month at $25/mo. Hard-stop at caps.
- **No Reddit API**: Reddit data via Brave Search site:reddit.com only.
- **Existing Architecture**: All new code extends existing modules within seo_loop.py cycle.
- **Brain Pattern**: All AI decisions go through `claude -p` subprocess.
- **Content Rules**: No em dashes, no emojis, experience signals required.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SerpAPI over Apify for SERPs | Structured AI Overview + PAA data, single API call, no polling | Good -- clean data, budget-gated |
| 200 searches/client/month budget | Sustainable scaling as clients onboard, leaves room for 5 clients | Good -- never hit cap |
| Skip Perplexity API | Only tracks Perplexity citations, not worth the cost for partial coverage | Good -- revisit when API matures |
| Reddit via Brave Search | Reddit API auth blocked, Brave site:reddit.com search works fine | Good -- implementation pending Phase 5 |
| GEO scores feed into brain | Brain should actively prioritize GEO improvements, not just track passively | Good -- brain sees and acts on GEO data |
| Measurement-first approach | 2-4 weeks baseline before brain acts | Good -- prevents blind optimization |
| String-level HTML insertion | BeautifulSoup serialization mangles attributes and whitespace | Good -- preserves HTML fidelity |
| FAQ auto-detect as post-hook | Zero-cost, piggybacks on all content creation actions | Good -- catches all question-format content |
| Organization schema separate from LocalBusiness | Google reads both independently | Good -- clean separation |
| difflib for PAA matching | Stdlib, 0.6 threshold, no external dependency | Good -- lightweight and accurate enough |

## Current Milestone: v1.1 Mention Tracking + GEO Dashboard

**Goal:** Surface all GEO data in the dashboard and track where clients are mentioned online, so Brian and clients can see citation-readiness and AI visibility at a glance.

**Target features:**
- Reddit question mining via Brave Search
- Cross-platform mention tracking and source diversity scoring
- Competitor AI Overview monitoring
- GEO scores, citation status, and trends visible in Next.js dashboard
- SerpAPI budget usage and Featured Snippet ownership in dashboard
- Tech debt cleanup (word count mismatch, orphaned function, empty sameAs URLs)

---
*Last updated: 2026-03-10 after v1.1 milestone start*
