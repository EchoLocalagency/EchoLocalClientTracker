# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 -- GEO Module

**Shipped:** 2026-03-10
**Phases:** 4 | **Plans:** 8
**Timeline:** 18 days | **Avg plan execution:** 3.1 min

### What Was Built
- SerpAPI client with embedded budget gates replacing Apify SERP scraper
- AI Overview detection with two-step page_token fetch and client citation matching
- GEO scorer (5-factor binary checklist) running daily on local HTML at zero API cost
- Brain prompt integration with GEO scores, SERP features, and 3000-char budgets
- geo_content_upgrade action type with string-level HTML insertion
- FAQ auto-detect post-hook on all content creation actions
- Organization schema with sameAs links, topical authority scoring, PAA gap detection

### What Worked
- Measurement-first approach: scoring and data collection built before brain integration. Clean separation.
- Phase dependency chain (1->2->3->4) meant each phase had solid foundations to build on.
- YOLO mode + quality model profile -- fast execution with thorough verification.
- String-level HTML insertion decision (Phase 3) avoided BeautifulSoup serialization problems.
- Lazy import pattern in seo_loop kept module loading clean as new features added.

### What Was Inefficient
- Phase 4 ROADMAP checkboxes not updated (2 and 4 still unchecked despite completion). Minor bookkeeping gap.
- same_as_urls populated in clients.json with empty strings -- should have been populated with real URLs during Phase 4 execution.
- No one-liner frontmatter in SUMMARY.md files -- milestone completion had to derive accomplishments from context.

### Patterns Established
- Budget gate embedded in API wrapper (check before every call, not caller's responsibility)
- Post-action hooks in seo_loop for zero-cost piggyback operations (FAQ auto-detect, internal linking)
- Dedicated char budgets per brain prompt section to prevent context overflow
- Separate data-fetching modules (geo_data.py) from brain prompt construction

### Key Lessons
1. Data config (same_as_urls) should be populated during the phase that creates the feature, not deferred.
2. SUMMARY.md files should always include a one_liner frontmatter field for milestone rollups.
3. Verification catches real issues -- content_validator word count mismatch would have been missed otherwise.

### Cost Observations
- Model mix: sonnet for all agents (quality profile uses sonnet for subagents)
- 4 phases executed in a single day (2026-03-10)
- 3.1 min average per plan execution -- extremely efficient for this complexity level

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 | 8 | First GSD milestone for this project. Established measurement-first approach. |

### Cumulative Quality

| Milestone | Verification Score | Requirements | Tech Debt Items |
|-----------|-------------------|--------------|-----------------|
| v1.0 | 32/32 truths | 26/26 | 5 |

### Top Lessons (Verified Across Milestones)

1. Populate data config during the phase that creates the feature, not later.
2. Always include one_liner in SUMMARY frontmatter for milestone rollups.
