# Project Research Summary

**Project:** EchoLocal ClientTracker v1.2 -- Directory Submission & Tracking
**Domain:** Automated local SEO citation building, form submission, and verification
**Researched:** 2026-03-10
**Confidence:** HIGH (stack + architecture based on direct codebase review; pitfalls MEDIUM-HIGH)

## Executive Summary

v1.2 targets the single biggest unaddressed gap in Echo Local's SEO stack: submitting clients to 30-50 niche directories that GHL/Yext does not cover, then tracking and verifying those submissions. Commercial tools (BrightLocal, Whitespark) focus on the same ~150 directories Yext already handles. The curated master list of manufacturer dealer locators, trade associations, and niche home service directories is the core differentiator -- nobody automates these, and that means a manual 75-250 min/client time cost that can be eliminated. The $0 marginal cost after build versus BrightLocal's $39+/month per client makes this a compounding ROI story.

The recommended approach is Playwright-based Python automation layered into the existing seo_loop.py engine as Step 4b, with a 5-submissions-per-day and 8-per-week cap enforced by the scheduler. Three Supabase tables (directories, directory_submissions, client_profiles) become the data backbone, read by both the Python engine and the Next.js dashboard. A new "Directories" tab in SeoTabNav surfaces coverage progress per client. Verification runs via Brave Search site: queries (not SerpAPI, to preserve keyword budget). The entire system adds only 2 new pip packages (playwright, playwright-stealth) and zero new env vars.

The dominant risks are SEO self-harm: duplicate listings from botched retries, NAP inconsistency across submissions, and citation velocity that looks unnatural to Google. All three are preventable through schema decisions made before the first line of automation code. The data model and submission state machine must be locked in Phase 1 -- retrofitting idempotency and canonical NAP after submissions are running means cleaning up real SEO damage. The pitfalls research is unambiguous: skip the discovery and dedup phase and you will spend more time on cleanup than the automation saved.

## Key Findings

### Recommended Stack

The existing stack (Next.js, Python 3, Supabase, Recharts, Tailwind, SerpAPI, Brave Search) needs only two additions. Playwright 1.58.0 is the only viable option for JS-rendered directory forms -- requests + BeautifulSoup cannot handle dynamic forms, file uploads, or client-side validation. playwright-stealth 2.0.2 patches browser fingerprints to avoid bot detection on directories that use basic bot checks. Both are actively maintained, Python 3.9+ compatible, and match the existing codebase pattern.

See [STACK.md](.planning/research/STACK.md) for full details.

**Core technologies:**
- Playwright 1.58.0: headless browser automation for Tier 3 form submission -- only viable option for JS-rendered forms
- playwright-stealth 2.0.2: anti-detection patches (navigator.webdriver, user-agent, plugins) -- low-effort insurance against bot flagging
- SerpAPI (existing): reused for post-submission Google site: verification where result precision matters
- Brave Search (existing): reused for bulk pre-submission audits and weekly verification -- cheaper than SerpAPI for presence checks
- Supabase (existing): 3 new tables; Python writes, Next.js reads via existing clients
- launchd (existing): scheduling via day-of-week check in seo_loop.py -- no new scheduler added

**Installation footprint:** 2 pip packages, 0 npm packages, 0 new env vars, ~200MB Chromium binary one-time download.

### Expected Features

See [FEATURES.md](.planning/research/FEATURES.md) for competitive landscape and full dependency graph.

**Must have (table stakes):**
- Client profile data store (Supabase `client_profiles`) -- canonical NAP + descriptions + services for every form fill
- Directory master list in Supabase (`directories`) -- ~55 directories seeded from research doc, queryable by tier and trade
- Submission tracking with status workflow (`directory_submissions`) -- pending / submitted / approved / rejected / verified / skipped
- Per-client directory coverage view -- "Mr. Green is on 18/35 directories" visible at a glance in dashboard
- Tier 1/2 recommendation surfacing -- manufacturer/trade association directories need client action, not automation; surface as checklist

**Should have (differentiators):**
- Playwright auto-submission for Tier 3 directories -- eliminates 75-250 min/client manual effort per submission round
- Google site: verification (via Brave Search) -- confirms listings went live without manual spot-checking
- Auto-retry with escalation -- catches silent failures; alerts Brian after 14 days unverified
- NAP consistency audit -- pre-submission quality check (BrightLocal charges $39+/month for this separately)
- Duplicate listing detection -- search before submitting to avoid creating conflicting profiles
- Backlink value tracking -- DA-weighted portfolio score per client to prove ROI

**Defer to v1.3:**
- Confirmation email processing -- HIGH complexity (Gmail API + Playwright link-clicking); scope after seeing which directories actually require it
- Sentiment/review tracking on directories -- different problem domain, not needed for backlink acquisition

**Anti-features (do not build):**
- Auto-submit to Tier 1/2 directories (reputation risk -- requires real business relationships)
- CAPTCHA solving services (adversarial, wasteful on free directory listings)
- Parallel browser farm (infrastructure complexity for under 1-hour sequential runtime)
- Mass submission to DA < 10 directories (pre-2015 spam pattern)

### Architecture Approach

The system fits into the existing architecture as Step 4b in seo_loop.py, running between photo sync and the brain call. Three new Python modules (directory_manager.py as orchestrator, directory_submitter.py for Playwright form fills, directory_verifier.py for Brave Search checks) slot into scripts/seo_engine/backlinks/ alongside the refactored directory_audit.py. The dashboard adds one tab (Directories) and three components (DirectoryDashboard, DirectoryStatusGrid, DirectoryProgressBar) following the established GeoDashboard pattern. Directory submissions are deterministic -- no brain decision-making needed, which keeps brain call costs down. The brain receives a directory_summary prompt section so it knows current coverage and avoids wasting action budget on work the automation handles.

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for SQL schemas, data flow diagrams, component interface specs, and build order.

**Major components:**
1. `directories` table (Supabase) -- master list, seeded once, queryable by tier/trade/submission_method
2. `client_profiles` table (Supabase) -- mutable business data separate from git-tracked clients.json
3. `directory_submissions` table (Supabase) -- one row per client-directory pair (UNIQUE constraint), full lifecycle
4. `directory_manager.py` -- orchestrator: loads profiles, filters directories, enforces 5/day cap, coordinates submitter + verifier
5. `directory_submitter.py` -- Playwright form filler with heuristic field matching + per-directory config overrides in DB
6. `directory_verifier.py` -- Brave Search site: verification with 7/14/21-day escalation logic
7. `DirectoryDashboard.tsx` + `DirectoryStatusGrid.tsx` + `DirectoryProgressBar.tsx` -- dashboard tab showing coverage per client
8. Modified `seo_loop.py` (Step 4b) + `brain.py` (directory context in prompt)

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for prevention strategies, recovery costs, and phase-to-pitfall mapping.

1. **Duplicate listings from auto-retry** -- Never retry after POST fires. Track 3-stage state: form_loaded -> form_filled -> post_sent. Any failure after post_sent marks as `submitted_unverified` (queued for manual verification), not re-submission. This is the highest-damage pitfall; retrofitting costs more than preventing.

2. **NAP inconsistency across submissions** -- Lock canonical NAP in `client_profiles` before any submissions. One format, one source of truth. Business name must match GBP exactly. Format adapters per directory derive from canonical, never override it.

3. **Spam velocity triggers Google's local spam detection** -- Max 8 new directory submissions per client per week. Start with highest-DA directories. The scheduler must enforce this as a hard cap from day one. 25 citations appearing simultaneously for a low-citation business is a clear automation signal.

4. **Pre-existing listings cause conflicts** -- BuildZoom, Houzz, and Porch auto-generate profiles from contractor license data. Run discovery search (business name + phone + address) on every target directory before submitting. Existing profiles need a claim/update flow, not a new submission.

5. **CAPTCHA blocks 40-60% of target directories** -- Audit every directory for CAPTCHA type before writing any Playwright code. Only automate `no_captcha` directories. Use playwright-stealth + headed mode + human-like typing delays (`page.type()` with 50-150ms delay, not `page.fill()`).

## Implications for Roadmap

The critical insight from combined research: all pitfalls with HIGH recovery cost (duplicates, NAP inconsistency, velocity spam, pre-existing conflicts) must be addressed in Phase 1 before any automation runs. The architecture research confirms the same ordering independently. Do not build the Playwright engine before the data model and discovery phase are solid.

### Phase 1: Data Foundation + Discovery
**Rationale:** Everything depends on this. The submission engine cannot run without client profiles. The UNIQUE(client_id, directory_id) constraint prevents duplicates from day one. Discovery must identify pre-existing listings before any form fill or the system creates conflicting profiles.
**Delivers:** 3 Supabase tables created, indexed, and seeded. `client_profiles` populated for all active clients (Mr. Green, Integrity Pro, AZ Turf, SoCal Turfs). CAPTCHA categorization and pre-existing listing discovery run for each client across all 55 target directories. Canonical NAP locked per client.
**Addresses:** Client profile store, directory master list, submission tracking (all table stakes from FEATURES.md)
**Avoids:** Duplicate listings (#1), NAP inconsistency (#2), pre-existing conflicts (#8) -- all HIGH recovery cost

### Phase 2: Submission Engine (Tier 3 Automation)
**Rationale:** With data layer solid and discovery complete, Playwright automation is safe to build. Start with 5 highest-DA, no-CAPTCHA Tier 3 directories in dry-run mode to validate the engine before expanding.
**Delivers:** `directory_manager.py` + `directory_submitter.py` wired into `seo_loop.py` as Step 4b. 5/day and 8/week rate caps enforced. Human-like typing delays and playwright-stealth applied to all submissions. Screenshots stored for `submitted_unverified` and `failed` states.
**Uses:** Playwright 1.58.0, playwright-stealth 2.0.2, heuristic field matching with per-directory config overrides in `directories` table
**Implements:** directory_manager + directory_submitter architecture components
**Avoids:** Spam velocity (#9), rate limiting/IP bans (#6), CAPTCHA blocking (#3), form structure breakage (#4)

### Phase 3: Verification Loop
**Rationale:** Submissions are in-flight; verification closes the feedback loop. The state machine must treat `site:` absence as inconclusive (not failure) or false negatives trigger re-submissions that create duplicates.
**Delivers:** `directory_verifier.py` with 7/14/21-day escalation. Brian alerted at 14 days. Status updates to `needs_review` at 21 days. Verification uses Brave Search (not SerpAPI) to preserve keyword tracking budget. Multiple verification methods (site: search + direct URL fetch) to compensate for Google indexing lag.
**Implements:** directory_verifier architecture component
**Avoids:** site: unreliability (#5), SerpAPI budget depletion

### Phase 4: Brain Integration
**Rationale:** Brain should see directory progress so it does not waste action budget on submissions the automation already handles. Log submissions to `seo_actions` table for full brain visibility.
**Delivers:** `directory_summary` context section in `brain.py` prompt. Submissions logged to existing `seo_actions` table with `action_type='directory_submission'`. Brain-aware of current coverage per client.

### Phase 5: Dashboard
**Rationale:** Build after Phase 2-3 produce real data. Testing UI against empty states reveals nothing; testing against real submission and verification rows reveals layout and filtering needs. All components follow established GeoDashboard pattern -- no new libraries.
**Delivers:** Directories tab in SeoTabNav. `DirectoryStatusGrid` (per-directory status table with color-coded badges: verified=green, submitted=yellow, pending=grey, rejected=red). `DirectoryProgressBar` (tier coverage bars: X/Y submitted, X/Y verified). TypeScript types for Directory, DirectorySubmission, ClientProfile.
**Implements:** Dashboard layer in full

### Phase 6: Tier 1/2 Recommendations + Audit Refactor
**Rationale:** Display-only features with no automation risk. Lowest urgency relative to automation and verification. Refactoring `directory_audit.py` to query the `directories` table eliminates hardcoded list and gives the dashboard a single source of truth.
**Delivers:** Tier 1/2 directories surfaced as actionable checklist per client in dashboard (requires_client_input=true filter). `directory_audit.py` reads from Supabase instead of hardcoded Python list.

### Phase Ordering Rationale

- Phase 1 before all others: UNIQUE constraint and canonical NAP must exist before any POST fires. This is not a soft preference -- submitting before dedup protection is in place creates SEO damage with MEDIUM-HIGH recovery cost (manual cleanup per directory, per client).
- Phase 2 before Phase 3: verifier depends on submissions existing in `submitted` status to check.
- Phase 3 before Phase 4: brain should receive real directory data, not empty summaries.
- Phase 5 after Phase 2: dashboard needs actual submission rows to validate layout; empty-state-only testing is inadequate.
- Phase 6 last: Tier 1/2 recommendations are display-only with no automation dependencies. Audit refactor is housekeeping that does not block any other feature.
- Phases 5 and 6 can run in parallel with Phase 4 if development capacity allows -- they touch separate layers (Next.js vs Python).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Submission Engine):** CAPTCHA audit of all 55 form URLs must happen during Phase 1 discovery (visit each URL, categorize detection type). This determines which directories enter the automation queue. Cannot be skipped or estimated -- requires live site inspection. Budget 2-3 hours of manual form inspection.
- **Phase 3 (Verification):** Email verification handling (Pitfall #7) is partially deferred but the categorization (verification_none / verification_email / verification_phone) must be added to the `directories` table schema in Phase 1. The data model gap needs to be resolved before Phase 3 ships.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Database):** Supabase migrations and seeding follow established project patterns. SQL schemas fully specified in ARCHITECTURE.md ready to run.
- **Phase 4 (Brain Integration):** Existing `brain.py` prompt extension pattern is documented. Straightforward addition matching v1.1 mention tracking integration.
- **Phase 5 (Dashboard):** GeoDashboard component is the template. No new libraries. Standard Supabase-direct query pattern.
- **Phase 6 (Tier 1/2 + Audit Refactor):** Display-only filtering of existing data. Standard Supabase query pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Playwright and playwright-stealth verified on PyPI with exact versions (1.58.0, 2.0.2). All other additions reuse existing integrations. Zero new env vars. Python 3.9.6 compatibility confirmed. |
| Features | MEDIUM-HIGH | Table stakes and differentiators well-defined with clear dependency graph. Competitive landscape confirmed. Confirmation email processing correctly deferred -- feasibility unclear until submissions are live and we see which directories actually require it. |
| Architecture | HIGH | Based on direct codebase review of seo_loop.py, directory_audit.py, brain.py, GeoDashboard, clients.json. SQL schemas fully specified. Component boundaries match existing patterns exactly. Scalability analysis included. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls (duplicates, NAP inconsistency, velocity spam) well-documented with recovery costs from multiple sources. Directory-specific CAPTCHA behavior requires per-site validation during Phase 1 discovery -- cannot be determined without live site inspection. |

**Overall confidence:** HIGH

### Gaps to Address

- **CAPTCHA categorization per directory:** Must be done manually during Phase 1 audit (visit each form URL, classify detection type). Cannot be automated or researched in advance. Determines which of the 55 directories enter the Playwright automation queue vs. the manual submission queue.
- **Email verification scope:** How many target directories require email verification is unknown until submissions happen. Add `verification_type` enum to `directories` table schema in Phase 1 so Phase 3 can handle the full lifecycle correctly.
- **Form mapping success rate:** Heuristic field matching is estimated to handle ~70% of Tier 3 forms. The 30% requiring per-directory config overrides will surface during Phase 2 dry-run testing. Budget iteration time for config authoring; this is expected maintenance, not a failure mode.
- **SerpAPI budget headroom:** Architecture estimates ~120 verification queries/month on top of ~400 existing SEO usage, within the 950/month cap. Confirm actual headroom after Phase 2 is live for 30 days and adjust verification strategy if needed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `seo_loop.py`, `brain.py`, `directory_audit.py`, `serpapi_client.py`, `brave_client.py`, `clients.json`, Supabase migrations, `GeoDashboard.tsx` -- direct code review
- Directory master list: `.planning/research/find-a-pro-directory-master-list.md` -- 55 directories across 4 tiers
- Playwright Python on PyPI (v1.58.0, 2026-01-30) -- form interaction, browser launch, Python 3.9+ requirement
- Playwright Python Installation Docs -- Chromium install, headless/headful modes
- playwright-stealth on PyPI (v2.0.2, 2026-02-13) -- stealth patches, Python 3.9+ requirement
- Google site: operator official docs -- "may not list all indexed URLs" documented limitation
- PROJECT.md v1.2 milestone spec

### Secondary (MEDIUM confidence)
- BrightLocal Citation Tracker -- citation tracking features, NAP consistency, $39+/mo pricing
- Whitespark Listings Service -- citation building packages, manual submission workflow
- Apify Citation Builder Actor -- automated NAP submission, $2.60/batch comparison point
- Playwright CAPTCHA bypass analysis (BrowserStack) -- detection layers Playwright cannot control
- playwright-stealth techniques (ZenRows) -- patches navigator.webdriver, user-agent, plugins
- Rate limiting in web scraping (Apify Academy) -- per-IP limits, escalation to bans
- Directory submission best practices 2025 (VA Web SEO) -- quality over quantity, NAP consistency
- Playwright retry APIs (Tim Deschryver) -- non-idempotent operations should not be retried
- Preventing double form submissions (OpenReplay) -- server-side idempotency required
- BuildZoom auto-generated profiles (BBB complaints) -- profiles auto-created from contractor license data

### Tertiary (LOW confidence)
- FirstSiteGuide: Best Citation Management Tools 2026 -- tool comparison (needs validation against current pricing)
- AutoSaaSLaunch: Automated Directory Submission Tools 2025 -- CAPTCHA handling approaches (broad survey, low specificity)

---
*Research completed: 2026-03-10*
*Supersedes v1.1 research summary (Mention Tracking + GEO Dashboard)*
*Ready for roadmap: yes*
