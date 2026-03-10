---
phase: 04-entity-authority-building
verified: 2026-03-10T22:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 4: Entity + Authority Building Verification Report

**Phase Goal:** Client sites emit strong entity signals (Organization schema, sameAs links) and have measurable topical authority completeness
**Verified:** 2026-03-10T22:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All client HTML pages include Organization schema with sameAs links to configured profiles | VERIFIED | `inject_organization_schema()` at line 267 of schema_injector.py builds Organization JSON-LD with filtered sameAs. `inject_schemas_for_page()` calls it for all page types (line 446-451). `inject_organization_on_all_pages()` provides bulk injection. |
| 2 | sameAs URLs are configurable per client in clients.json without code changes | VERIFIED | All 4 clients with `website_local_path` have `same_as_urls` dict (gbp, yelp, bbb, facebook, instagram). Primal Plates (no website_local_path) correctly excluded. |
| 3 | Organization schema omits sameAs array when no URLs are configured (no empty arrays) | VERIFIED | Line 292-295: filters empty strings, only adds sameAs key if filtered list is non-empty. |
| 4 | Brain can recommend schema_update with schema_type organization and it gets dispatched correctly | VERIFIED | seo_loop.py line 497-502: `elif schema_type == "organization"` branch calls `inject_organization_schema` with client name, website, phone, same_as_urls. |
| 5 | Each content cluster has an authority completeness score showing coverage gaps | VERIFIED | cluster_manager.py line 42-43: `authority_completeness = round(supporting_count / total, 2)` computed in get_clusters(). |
| 6 | PAA questions are matched against existing page headings and unmatched questions are identified as content gaps | VERIFIED | paa_matcher.py: `match_paa_to_content()` uses difflib SequenceMatcher with 0.6 threshold, returns `{"matched": [...], "gaps": [...]}`. Substring text match as secondary signal at 0.65. |
| 7 | Brain prompt includes authority and PAA gap data for prioritization | VERIFIED | brain.py lines 326-357: TOPICAL AUTHORITY section with completeness %, gap count, top gap topics. PAA CONTENT GAPS section with up to 10 unmatched questions. Brain rules included. |
| 8 | Authority score is only surfaced when cluster has 5+ total items (supporting + gaps) | VERIFIED | brain.py lines 328-331: `auth_clusters` filtered to `(supporting_count + gap_count) >= 5`. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/seo_engine/schema_injector.py` | inject_organization_schema() + inject_organization_on_all_pages() + updated inject_schemas_for_page() | VERIFIED | All three functions present and substantive. Organization injected separately from LocalBusiness. |
| `scripts/seo_engine/paa_matcher.py` | PAA question-to-content matching utility | VERIFIED | 122 lines. extract_page_headings() and match_paa_to_content() both implemented with difflib fuzzy matching. |
| `scripts/seo_engine/cluster_manager.py` | authority_completeness computed field in get_clusters() | VERIFIED | Line 43: derived metric computed inline from existing supporting_count and gap_count. |
| `scripts/seo_engine/geo_data.py` | get_all_paa_questions() for fetching PAA data from Supabase | VERIFIED | Lines 26-68. Queries serp_features, deduplicates by keyword, handles JSON string or list paa_questions. |
| `scripts/seo_engine/brain.py` | TOPICAL AUTHORITY and PAA CONTENT GAPS sections in prompt | VERIFIED | Lines 326-357. Both sections with char budgets (500 and 400 chars). paa_gaps param flows through call_brain -> _build_prompt. |
| `clients.json` | same_as_urls dict per active client | VERIFIED | 4/4 active clients have same_as_urls. 1 inactive client (primal-plates) correctly excluded. |
| `scripts/seo_engine/seo_loop.py` | organization schema_type dispatch + PAA matching wired | VERIFIED | Organization dispatch at line 497. PAA matching at lines 249-265 with non-fatal try/except. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| schema_injector.py | clients.json | inject_schemas_for_page reads client_config.same_as_urls | WIRED | Line 446: `same_as_urls = client_config.get("same_as_urls", {})` |
| seo_loop.py | schema_injector.py | _execute_schema_update dispatches organization to inject_organization_schema | WIRED | Line 462: import. Line 497-502: dispatch branch. |
| brain.py | cluster_manager.py | get_clusters() returns authority_completeness field used in prompt | WIRED | Line 337: `c.get("authority_completeness", 0)` used in prompt formatting. |
| brain.py | paa_matcher.py | match_paa_to_content() gaps surfaced in brain prompt | WIRED | paa_gaps param flows call_brain (line 540) -> _build_prompt (line 43) -> PAA section (line 348). |
| paa_matcher.py | geo_data.py | get_all_paa_questions() provides PAA data for matching | WIRED | seo_loop.py line 253: imports both, calls get_all_paa_questions then match_paa_to_content. |
| seo_loop.py | brain.py | paa_gaps passed to call_brain | WIRED | seo_loop.py line 306: `paa_gaps=paa_gaps` in call_brain invocation. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ENT-01 | 04-01-PLAN | Organization schema with sameAs links injected on all client pages | SATISFIED | inject_organization_schema() + inject_schemas_for_page() + inject_organization_on_all_pages() |
| ENT-02 | 04-01-PLAN | sameAs URLs configurable per client in clients.json | SATISFIED | same_as_urls dict on all 4 active clients |
| ENT-03 | 04-02-PLAN | Topical authority completeness score per content cluster | SATISFIED | authority_completeness in get_clusters() + brain prompt TOPICAL AUTHORITY section |
| ENT-04 | 04-02-PLAN | Question-to-content matching maps PAA questions to existing pages and identifies gaps | SATISFIED | paa_matcher.py match_paa_to_content() + brain prompt PAA CONTENT GAPS section |

No orphaned requirements found. All 4 ENT requirements covered by plans and verified in codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

No TODO/FIXME/PLACEHOLDER comments found in any modified files. No empty implementations. No stub returns.

### Human Verification Required

### 1. Organization Schema JSON-LD Validity

**Test:** Populate at least one same_as_urls value for a client in clients.json, run inject_organization_on_all_pages(), then validate the output HTML through Google Rich Results Test.
**Expected:** Organization schema passes validation with sameAs array containing the configured URL.
**Why human:** Requires running against actual client HTML files and external validation tool.

### 2. PAA Matching Quality

**Test:** Run the SEO loop for a client with SERP feature data in Supabase. Check the brain prompt output for the PAA CONTENT GAPS section.
**Expected:** Unmatched PAA questions appear as numbered gaps. Questions already answered by H2 headings are not listed.
**Why human:** Requires live Supabase data and judgment on matching quality.

### Gaps Summary

No gaps found. All 8 observable truths verified. All 7 artifacts pass existence, substantive, and wiring checks. All 6 key links are wired. All 4 requirements (ENT-01 through ENT-04) are satisfied. No anti-patterns detected.

---

_Verified: 2026-03-10T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
