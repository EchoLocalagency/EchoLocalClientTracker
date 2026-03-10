# Phase 4: Entity + Authority Building - Research

**Researched:** 2026-03-10
**Domain:** Schema.org Organization markup, topical authority scoring, PAA-to-content matching
**Confidence:** HIGH

## Summary

Phase 4 adds entity signals and topical authority measurement to the SEO engine. There are four requirements: (1) Organization schema with sameAs on all client pages, (2) configurable sameAs URLs per client in clients.json, (3) topical authority completeness scoring per content cluster, and (4) PAA question-to-content matching with gap identification.

The existing codebase already has strong foundations for all four. `schema_injector.py` has a mature injection pattern (`_inject_json_ld`, `_has_schema_type`, per-type injection functions) that just needs a new `inject_organization_schema` function. `cluster_manager.py` already tracks pillar pages, supporting posts, and gap topics in Supabase -- it needs a completeness metric added. PAA data is already stored in `serp_features.paa_questions` and `paa_data` columns -- the work is matching those questions against page content. No new Supabase tables needed. No new API costs. Everything is local computation + schema extension.

**Primary recommendation:** Extend existing modules (schema_injector, cluster_manager) rather than creating new files. Add `same_as_urls` field to clients.json. Build authority scoring as a function in cluster_manager. Build PAA matching as a standalone utility that reads from existing Supabase data and scans local HTML.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENT-01 | Organization schema with sameAs links injected on all client pages (GBP, Yelp, BBB, social profiles) | Extend schema_injector.py with `inject_organization_schema()`. Use existing `_inject_json_ld` and `_has_schema_type` patterns. Schema must include @type Organization, name, url, telephone, sameAs array. |
| ENT-02 | sameAs URLs configurable per client in clients.json | Add `same_as_urls` dict to each client entry in clients.json. Keys: gbp, yelp, bbb, facebook, instagram, etc. Schema injector reads from client config at runtime. |
| ENT-03 | Topical authority completeness score per content cluster | Extend cluster_manager.py with `compute_authority_score()`. Score = supporting_posts / (supporting_posts + gap_topics). Store in cluster row or compute on-read. |
| ENT-04 | Question-to-content matching maps PAA questions to existing pages and identifies gaps | New utility function: read PAA questions from serp_features table, fuzzy-match against H2 headings and page content of existing HTML files, report matched and unmatched questions. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| json (stdlib) | - | JSON-LD generation | Already used in schema_injector.py |
| re (stdlib) | - | Content matching | Already used throughout codebase |
| BeautifulSoup4 | 4.x | HTML parsing for PAA matching | Already used in geo_scorer.py, schema_injector.py |
| supabase-py | existing | Read PAA data, cluster data | Already used in cluster_manager.py, geo_data.py |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| difflib (stdlib) | - | Fuzzy string matching for PAA-to-content | Match PAA questions to H2 headings with SequenceMatcher |
| pathlib (stdlib) | - | File path handling | Already used in seo_loop.py action execution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| difflib for fuzzy match | rapidfuzz, thefuzz | External dependency for marginal accuracy gain. difflib is good enough for question-to-heading matching. |
| Storing authority score in Supabase | Compute on-the-fly | On-the-fly is simpler and cluster count is small (<10 per client). No table needed. |

## Architecture Patterns

### Pattern 1: Extend schema_injector with Organization Schema
**What:** Add `inject_organization_schema(html, name, url, phone, same_as_urls)` following the exact pattern of existing functions (inject_faq_schema, inject_local_business_schema).
**When to use:** Called from `inject_schemas_for_page()` and from `_execute_schema_update()` in seo_loop.py.

```python
# Source: Existing schema_injector.py pattern
def inject_organization_schema(html, name, url, phone, same_as_urls=None):
    """Inject Organization schema with sameAs links."""
    if _has_schema_type(html, "Organization"):
        return html

    schema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": name,
        "url": url,
        "telephone": phone,
    }
    if same_as_urls:
        # Filter out empty strings
        schema["sameAs"] = [u for u in same_as_urls.values() if u]

    return _inject_json_ld(html, schema)
```

### Pattern 2: clients.json same_as_urls Field
**What:** Add a `same_as_urls` dict to each client in clients.json. Keys are platform names, values are URLs.
**When to use:** Every client gets this field. Empty strings for platforms not yet collected.

```json
{
    "name": "Mr Green Turf Clean",
    "slug": "mr-green-turf-clean",
    "same_as_urls": {
        "gbp": "https://www.google.com/maps/place/?q=place_id:...",
        "yelp": "https://www.yelp.com/biz/mr-green-turf-clean-poway",
        "bbb": "",
        "facebook": "https://www.facebook.com/mrgreenturfclean",
        "instagram": ""
    }
}
```

### Pattern 3: Authority Completeness as Computed Metric
**What:** Calculate authority score from existing cluster data rather than storing a separate field. `score = len(supporting_posts) / (len(supporting_posts) + len(gap_topics))` when total > 0.
**When to use:** In cluster_manager.py, add to `get_clusters()` computed fields alongside existing `supporting_count` and `gap_count`.

```python
# Extend existing computed fields in get_clusters()
for c in clusters:
    c["supporting_count"] = len(c.get("supporting_posts") or [])
    c["gap_count"] = len(c.get("gap_topics") or [])
    total = c["supporting_count"] + c["gap_count"]
    c["authority_completeness"] = round(c["supporting_count"] / total, 2) if total > 0 else 0.0
```

### Pattern 4: PAA Question Matching via Text Similarity
**What:** Read PAA questions from serp_features table. For each question, scan all HTML files' H2 headings and first-paragraph text. Use difflib.SequenceMatcher for fuzzy matching (ratio > 0.6 = match).
**When to use:** Run as part of research or brain prompt building. Results feed into brain context for content gap identification.

```python
from difflib import SequenceMatcher

def match_paa_to_content(paa_questions, pages):
    """Match PAA questions against page headings and content.

    Args:
        paa_questions: List of question strings from serp_features
        pages: List of {"path": str, "headings": [str], "text": str}

    Returns:
        {"matched": [{"question": str, "page": str, "heading": str}],
         "gaps": [str]}  # unmatched questions
    """
    matched = []
    gaps = []
    for q in paa_questions:
        q_lower = q.lower().rstrip("?")
        best_match = None
        best_ratio = 0.0
        for page in pages:
            for h in page["headings"]:
                ratio = SequenceMatcher(None, q_lower, h.lower().rstrip("?")).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = (page["path"], h)
        if best_ratio >= 0.6 and best_match:
            matched.append({"question": q, "page": best_match[0], "heading": best_match[1]})
        else:
            gaps.append(q)
    return {"matched": matched, "gaps": gaps}
```

### Pattern 5: Bulk Organization Schema Injection
**What:** A utility function that iterates all HTML files for a client and injects Organization schema where missing. Called once during setup, then maintained by `inject_schemas_for_page()` on new pages.
**When to use:** Initial rollout for ENT-01. After initial injection, new pages get Organization schema automatically via the existing `inject_schemas_for_page` hook.

### Recommended Project Structure

No new files needed beyond extending existing ones:

```
scripts/seo_engine/
    schema_injector.py       # ADD: inject_organization_schema(), update inject_schemas_for_page()
    cluster_manager.py       # ADD: authority_completeness computed field, format_authority_section()
    paa_matcher.py           # NEW: PAA-to-content matching utility
    seo_loop.py              # MODIFY: _execute_schema_update() to handle "organization" schema_type
    brain.py                 # MODIFY: add authority + PAA gap sections to prompt
clients.json                 # ADD: same_as_urls per client
```

### Anti-Patterns to Avoid
- **Creating a new Organization schema per-page with different data:** Organization schema should be identical across all pages for the same client. It represents the business entity, not the page. Generate it once from client config and inject the same block everywhere.
- **Storing authority scores in a new Supabase table:** Cluster data already has all the fields needed. Authority completeness is a derived metric (supporting / total). Compute it on-read, not stored.
- **Using NLP or embeddings for PAA matching:** Overkill. PAA questions and H2 headings are short text. difflib SequenceMatcher handles this fine for 10-50 questions x 20-50 pages. No external API or model needed.
- **Patching existing LocalBusiness schema to add sameAs:** Organization and LocalBusiness are separate schema types serving different purposes. Inject Organization alongside LocalBusiness, do not merge them. Google reads both.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom distance function | `difflib.SequenceMatcher` | Standard library, handles unicode, well-tested |
| JSON-LD generation | Template strings | `json.dumps()` with dict | Already pattern in schema_injector, handles escaping |
| HTML injection | Regex replace | Existing `_inject_json_ld()` | Already handles `</head>` insertion safely |
| Schema validation | Custom validator | Google Rich Results Test (manual) | No programmatic validation needed at this scale |

## Common Pitfalls

### Pitfall 1: Schema Injection Conflicts with Existing Schema
**What goes wrong:** `_has_schema_type(html, "Organization")` will skip injection if Organization schema already exists, even if it's incomplete (no sameAs). Pitfall already documented in project research (PITFALLS.md #8).
**Why it happens:** Current guard clause is binary: schema exists or not.
**How to avoid:** For initial rollout, audit which pages already have Organization schema (should be zero based on current schema_injector which only injects LocalBusiness, Service, FAQ, BlogPosting, Person). For updates later, add a `patch_organization_schema()` that finds existing Organization JSON-LD and adds missing sameAs URLs.
**Warning signs:** `inject_organization_schema` returns unchanged HTML for pages that should have been updated.

### Pitfall 2: sameAs URLs Not Yet Collected
**What goes wrong:** STATE.md already notes "Per-client sameAs URLs need manual collection before Phase 4." If clients.json has empty same_as_urls, Organization schema gets injected with empty sameAs array.
**Why it happens:** GBP URLs, Yelp listings, BBB pages need to be looked up manually per client.
**How to avoid:** Schema injector should only include sameAs if at least one URL is non-empty. Treat empty same_as_urls gracefully. Collect URLs for Mr Green Turf Clean and Integrity Pro Washers before running injection.
**Warning signs:** Organization schema in pages with `"sameAs": []`.

### Pitfall 3: Authority Score Meaningless with Low Content Volume
**What goes wrong:** With 2-4 blog posts per cluster, every cluster shows low authority. Brain tries to fill all gaps simultaneously. Already documented in PITFALLS.md #9.
**Why it happens:** New sites don't have enough content for authority scoring to be meaningful.
**How to avoid:** Only surface authority completeness in brain prompt if cluster has 5+ total items (supporting + gaps). Below that threshold, use existing gap-based prioritization. Add brain rule: "Complete one cluster to 80% before starting the next."
**Warning signs:** Brain generating blog posts spread across many clusters instead of focused on one.

### Pitfall 4: PAA Questions Change Over Time
**What goes wrong:** PAA matching done once becomes stale. New PAA questions appear, old ones disappear.
**Why it happens:** SerpAPI returns different PAA questions on different days for the same keyword.
**How to avoid:** Run PAA matching on every brain cycle using latest serp_features data. Don't cache match results long-term. The matching is cheap (local computation).
**Warning signs:** "Matched" questions no longer appearing in SERP data.

### Pitfall 5: Organization Schema on Non-Client Pages
**What goes wrong:** Primal Plates and Echo Local are in clients.json but may not want Organization schema (different business type, no sameAs links).
**Why it happens:** Blanket injection across all clients.
**How to avoid:** Only inject Organization schema for clients that have `website_local_path` set AND have at least one non-empty same_as_urls entry. This naturally filters to active SEO clients.

## Code Examples

### Injecting Organization Schema on All Pages

```python
# Source: Existing schema_injector.py pattern (inject_schemas_for_page)
def inject_organization_on_all_pages(client_config):
    """One-time bulk injection of Organization schema across all client pages."""
    website_path = Path(client_config.get("website_local_path", ""))
    if not website_path.is_dir():
        return []

    same_as = client_config.get("same_as_urls", {})
    if not any(same_as.values()):
        return []  # No sameAs URLs configured

    name = client_config["name"]
    url = client_config.get("website", "")
    phone = client_config.get("phone", "")

    # Collect all HTML files (same glob pattern as geo_scorer)
    html_files = sorted(website_path.glob("*.html"))
    for subdir in ("blog", "areas"):
        sub = website_path / subdir
        if sub.exists():
            html_files.extend(sorted(sub.glob("*.html")))

    injected = []
    for f in html_files:
        html = f.read_text()
        modified = inject_organization_schema(html, name, url, phone, same_as)
        if modified != html:
            f.write_text(modified)
            injected.append(str(f.relative_to(website_path)))

    return injected
```

### Reading PAA Data from Supabase

```python
# Source: Existing geo_data.py pattern
def get_all_paa_questions(client_id):
    """Get unique PAA questions across all keywords for a client."""
    sb = _get_supabase()
    resp = (
        sb.table("serp_features")
        .select("keyword, paa_questions")
        .eq("client_id", client_id)
        .order("collected_at", desc=True)
        .limit(100)
        .execute()
    )

    # Deduplicate by keyword (latest first), collect all unique questions
    seen_keywords = set()
    all_questions = set()
    for row in resp.data or []:
        kw = row.get("keyword", "")
        if kw in seen_keywords:
            continue
        seen_keywords.add(kw)
        questions = row.get("paa_questions") or []
        if isinstance(questions, str):
            import json
            questions = json.loads(questions)
        for q in questions:
            if q:
                all_questions.add(q)

    return list(all_questions)
```

### Extracting Page Headings for Matching

```python
# Source: Existing schema_injector.py pattern (detect_faq_candidates uses BeautifulSoup)
def extract_page_headings(website_path):
    """Extract H2 headings from all pages for PAA matching."""
    from bs4 import BeautifulSoup

    website_path = Path(website_path)
    pages = []

    html_files = sorted(website_path.glob("*.html"))
    for subdir in ("blog", "areas"):
        sub = website_path / subdir
        if sub.exists():
            html_files.extend(sorted(sub.glob("*.html")))

    for f in html_files:
        html = f.read_text()
        soup = BeautifulSoup(html, "html.parser")
        headings = [h2.get_text(strip=True) for h2 in soup.find_all("h2")]
        # Also grab first paragraph after each H2 for deeper matching
        text_content = soup.get_text(separator=" ", strip=True)[:2000]
        pages.append({
            "path": str(f.relative_to(website_path)),
            "headings": headings,
            "text": text_content,
        })

    return pages
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LocalBusiness schema only | Organization + LocalBusiness together | 2024-2025 | Google and AI engines use Organization for entity disambiguation. sameAs links connect the entity graph. |
| Manual content gap analysis | PAA-to-content automated matching | 2025 | SerpAPI PAA data makes it possible to programmatically identify what questions need content. |
| Post count as authority metric | Topic coverage completeness | 2025-2026 | Topical authority is about breadth of coverage, not just volume. Cluster completeness > raw post count. |

## Open Questions

1. **sameAs URL collection status**
   - What we know: STATE.md says "Per-client sameAs URLs need manual collection before Phase 4"
   - What's unclear: Have GBP URLs, Yelp pages, BBB listings been collected for Mr Green and Integrity Pro?
   - Recommendation: Add empty same_as_urls dicts to clients.json now. Populate as URLs are collected. Schema injection handles empty URLs gracefully (omits sameAs from schema if all empty).

2. **Minimum cluster size for authority scoring**
   - What we know: PITFALLS.md warns about meaningless scores with <8 posts per cluster.
   - What's unclear: Current cluster sizes for active clients.
   - Recommendation: Set threshold at 5 total items (supporting + gaps). Below that, just show gap list without a percentage score.

3. **Where to surface authority and PAA data**
   - What we know: Brain prompt already has a 3000-char GEO section budget.
   - What's unclear: How much space authority + PAA data will need.
   - Recommendation: Keep authority + PAA sections compact (2-3 lines per cluster, list only gap questions). Stay within existing char budget or add a small dedicated budget (500 chars).

## Sources

### Primary (HIGH confidence)
- Existing codebase: `schema_injector.py` -- full code review of injection patterns, guard clauses, and supported schema types
- Existing codebase: `cluster_manager.py` -- full code review of cluster data model, supporting_posts, gap_topics
- Existing codebase: `geo_data.py` -- full code review of serp_features query patterns and PAA data structure
- Existing codebase: `seo_loop.py` -- full code review of _execute_schema_update dispatch and post-action hooks
- Existing codebase: `brain.py` -- full code review of prompt building, action types, and GEO sections
- Existing Supabase schema: `serp_features` table has paa_questions (JSONB) and paa_data (JSONB) columns
- Existing Supabase schema: `seo_content_clusters` table has supporting_posts, gap_topics arrays

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` -- Pitfalls 8 (schema injection conflicts) and 9 (authority score with low volume) directly applicable
- `.planning/research/ARCHITECTURE.md` -- Confirmed Organization schema as planned extension to schema_injector
- `.planning/research/FEATURES.md` -- Confirmed entity graph building is LOW complexity, one-time setup

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in the codebase
- Architecture: HIGH - All four requirements extend existing, well-understood modules
- Pitfalls: HIGH - Two pitfalls already documented in project research, others from code analysis

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, no external API changes expected)
