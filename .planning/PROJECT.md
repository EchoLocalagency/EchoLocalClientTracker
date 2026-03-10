# GEO Module for SEO Engine

## What This Is

Generative Engine Optimization (GEO) capabilities built into the existing SEO engine. Makes client content more likely to be cited by AI search engines (Google AI Overviews, Perplexity, ChatGPT) and tracks when citations happen. Extends brain.py, research modules, actions, and schema_injector for both active clients.

## Core Value

The brain knows which pages are citation-ready and which aren't, and prioritizes making uncitable content citable -- because AI search is where discovery is shifting.

## Requirements

### Validated

- Existing SEO engine loop (data collection, brain, actions, outcome logging)
- AEO crawler check (robots.txt verification for AI bots)
- AEO opportunity extraction (question queries from GSC)
- Answer capsules in blog posts (50-150 word self-contained answers)
- FAQ schema injection
- Content clusters and internal linking
- Brave Search API configured
- SerpAPI key configured ($25/mo, 1000 searches/month)

### Active

- [ ] AI Overview detection via SerpAPI (are client pages cited in Google AI Overviews?)
- [ ] People Also Ask extraction via SerpAPI (structured PAA data for content targeting)
- [ ] Replace Apify SERP scraper with SerpAPI (structured data, cheaper, faster)
- [ ] SerpAPI usage tracking with hard monthly cap (200/client/month)
- [ ] GEO score per page (citation readiness: answer blocks, stats, structure, schema)
- [ ] Brain integration (GEO scores influence daily action decisions)
- [ ] Content structure upgrades (definitive lists, stat-dense formatting, comparison tables)
- [ ] Enhanced answer blocks (beyond basic capsule -- multi-format, question-matched)
- [ ] Entity/authority building (Organization schema, sameAs links, knowledge panel signals)
- [ ] Topical authority scoring (how complete is coverage of each topic cluster?)
- [ ] Reddit question mining via Brave Search (replace broken Reddit API integration)
- [ ] Cross-platform mention tracking via Brave Search (where is client mentioned online?)
- [ ] Source diversity scoring (Reddit, forums, directories -- where should client be mentioned?)
- [ ] Featured Snippet optimization (SerpAPI tells us who holds the snippet)

### Out of Scope

- Perplexity API integration -- unreliable for citation tracking, add later if API improves
- ChatGPT citation tracking -- no public API, results inconsistent
- Reddit/Quora answer posting automation -- legal/ToS risk, manual only
- YouTube transcript optimization -- no YouTube presence for current clients
- Apify SERP scraping -- replaced entirely by SerpAPI

## Context

- Two active clients: mr-green-turf-clean (Poway turf cleaning) and integrity-pro-washers (San Diego pressure washing)
- SEO engine runs daily at noon via launchd. Research runs Wed + Sat.
- Brain calls `claude -p` subprocess. Actions: blog_post, gbp_post, location_page, page_edit, schema_update, newsjack_post, gbp_photo.
- Reddit API was never configured (auth issues). Reddit data will come from Brave Search `site:reddit.com` queries.
- SerpAPI budget: 200 searches/client/month. ~50/client/week. Hard cap at 950/month total (50 buffer for manual).
- New clients onboarding this month (AZ Turf, SoCal Turfs) -- budget must scale.

## Constraints

- **API Budget**: SerpAPI 1000 searches/month at $25/mo. 200 per client. Engine must track usage and hard-stop before limit.
- **No Reddit API**: Reddit data exclusively via Brave Search site:reddit.com queries.
- **Existing Architecture**: All new code extends existing modules. No new orchestration patterns -- fits into seo_loop.py daily cycle.
- **Brain Pattern**: All AI decisions go through `claude -p` subprocess. No direct Anthropic API calls.
- **Content Rules**: No em dashes, no emojis, experience signals required. All existing brain rules apply to GEO content.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SerpAPI over Apify for SERPs | Structured AI Overview + PAA data, single API call, no polling | -- Pending |
| 200 searches/client/month budget | Sustainable scaling as clients onboard, leaves room for 5 clients | -- Pending |
| Skip Perplexity API | Only tracks Perplexity citations, not worth the cost for partial coverage | -- Pending |
| Reddit via Brave Search | Reddit API auth blocked, Brave site:reddit.com search works fine | -- Pending |
| GEO scores feed into brain | Brain should actively prioritize GEO improvements, not just track passively | -- Pending |

---
*Last updated: 2026-03-10 after initialization*
