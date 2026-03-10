# Phase 3: Brain Integration + Content Upgrades - Research

**Researched:** 2026-03-10
**Domain:** Brain prompt engineering, content upgrade automation, FAQ schema injection
**Confidence:** HIGH

## Summary

Phase 3 wires GEO scoring and SERP feature data into the existing brain prompt, adds a new `geo_content_upgrade` action type, upgrades the blog engine to produce citation-ready content by default, and extends the schema injector to apply FAQ schema aggressively. All the data infrastructure already exists from Phases 1-2 (Supabase tables `geo_scores` and `serp_features`, plus the `geo_scorer.py` and `serpapi_client.py` modules). The work is pure integration: fetching data, formatting it compactly for the brain prompt, teaching the brain a new action type, and modifying the blog engine template/output rules.

The brain prompt (`brain.py`) is already ~470 lines with 17+ sections. The 3000-char budget for GEO sections is critical to avoid blowing up the total prompt size. Currently the prompt runs ~8,000-12,000 chars depending on client data volume, and Claude CLI has practical limits around 100k context. The GEO data must be compressed into compact table rows.

**Primary recommendation:** Split into 3 plans: (1) Brain prompt GEO integration + prioritization logic, (2) `geo_content_upgrade` action type with execution pipeline, (3) Blog engine citation-ready defaults + FAQ schema expansion.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAIN-01 | Brain prompt includes GEO scores as compact table rows within 3000-char budget | Supabase `geo_scores` table has per-page scores + factors. Query latest scores per client, format as compact rows. See Architecture Pattern 1. |
| BRAIN-02 | Brain can recommend `geo_content_upgrade` action type | New action type in brain rules + seo_loop dispatcher. See Architecture Pattern 2. |
| BRAIN-03 | Brain factors AI Overview citation data into prioritization | Supabase `serp_features` table has `has_ai_overview`, `client_cited_in_ai_overview` per keyword. Query and include in prompt. See Architecture Pattern 1. |
| BRAIN-04 | Brain prioritizes striking-distance + low GEO score pages | Cross-reference GSC position data (already in prompt as striking distance) with GEO scores. Brain rules instruct prioritization. See Architecture Pattern 3. |
| CONT-01 | Enhanced answer capsules (40-60 words after first H2) | `content_validator.py` already checks for 50-150 word capsules. Tighten brain rules to 40-60 words. See Don't Hand-Roll table. |
| CONT-02 | Blog engine generates citation-ready structure by default | Modify blog engine template instructions + brain rules for blog_post. See Architecture Pattern 4. |
| CONT-03 | `page_edit` action can retrofit pages with answer blocks + headings | The existing `page_optimizer.py` already handles old_text/new_text edits. `geo_content_upgrade` is a specialized wrapper. See Architecture Pattern 2. |
| CONT-04 | FAQ schema applied aggressively to question-format content | Extend `schema_injector.py` to auto-detect question-format H2s and build FAQ schema. See Architecture Pattern 5. |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | current | Query geo_scores + serp_features tables | Already used throughout codebase |
| beautifulsoup4 | current | HTML parsing for question detection | Already used by geo_scorer.py |
| claude CLI | current | Brain subprocess call | Already used by brain.py |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json (stdlib) | - | JSON-LD schema generation | FAQ schema injection |
| re (stdlib) | - | Question heading detection | FAQ auto-detection |
| pathlib (stdlib) | - | File path handling | Page reading/writing |

No new dependencies required. Everything needed is already in the project.

## Architecture Patterns

### Pattern 1: GEO Data Section for Brain Prompt (BRAIN-01, BRAIN-03)

**What:** Add two new sections to `_build_prompt()` in `brain.py` -- one for GEO scores, one for AI Overview status. Both must fit within ~3000 chars total.

**When to use:** Every brain call (daily).

**Data sources:**
- `geo_scores` table: latest score per page per client (query with `scored_at = max(scored_at)`)
- `serp_features` table: latest AI Overview + citation data per keyword per client

**Compact format (estimated ~1200 chars for 15 pages, ~800 chars for 10 keywords):**

```python
# GEO scores section (~80 chars per page row)
# Format: "page_path | score | missing_factors"
prompt += "GEO CITATION-READINESS (page | score/5 | missing factors):\n"
for page in geo_scores:
    missing = [k for k, v in page["factors"].items() if v == 0]
    missing_str = ", ".join(missing) if missing else "all present"
    prompt += f"  {page['page_path']:<30} {page['score']}/5  missing: {missing_str}\n"

# AI Overview section (~80 chars per keyword row)
prompt += "AI OVERVIEW STATUS (keyword | has_aio | cited | snippet_holder):\n"
for sf in serp_features:
    aio = "YES" if sf["has_ai_overview"] else "no"
    cited = "CITED" if sf["client_cited_in_ai_overview"] else "-"
    snippet = sf["featured_snippet_holder"][:30] if sf["has_featured_snippet"] else "-"
    prompt += f"  {sf['keyword']:<35} aio:{aio} {cited} snippet:{snippet}\n"
```

**Data fetching:** Add a helper function to brain.py or a new `geo_data.py` module that queries Supabase for the latest GEO scores and SERP features per client. Call it in `seo_loop.py` before `call_brain()` and pass the data as new parameters.

**Budget control:** Limit to 20 pages and 15 keywords max in the prompt. Prioritize pages with lowest GEO scores and keywords with AI Overviews.

### Pattern 2: geo_content_upgrade Action Type (BRAIN-02, CONT-03)

**What:** A new action type the brain can recommend that retrofits an existing page with answer blocks, improved headings, and stat-dense formatting. It combines GEO scoring insights with page_edit mechanics.

**Brain output format:**
```json
{
  "action_type": "geo_content_upgrade",
  "target_keywords": ["turf cleaning poway"],
  "priority": 1,
  "reasoning": "services.html has GEO score 1/5, missing answer_block, stats_density, freshness. Striking distance at position 7.",
  "filename": "services.html",
  "upgrades": [
    {
      "type": "answer_block",
      "after_heading": "Artificial Turf Cleaning Services",
      "content": "<p class=\"answer-capsule\">We clean artificial turf using a 3-step process: deodorize with enzyme spray at 120 PSI, brush and groom fibers, then sanitize with antimicrobial treatment. Most Poway yards take 45-60 minutes and cost $150-250 depending on square footage.</p>"
    },
    {
      "type": "stats_injection",
      "target_section": "Why Choose Us",
      "content": "Over 200 yards cleaned in North County since 2023. 4.9 out of 5 rating across 47 Google reviews."
    },
    {
      "type": "freshness_update",
      "content": "Last updated: March 2026"
    }
  ]
}
```

**Execution:** In `seo_loop.py::_execute_action()`, dispatch `geo_content_upgrade` to a new function that:
1. Reads the target file
2. For each upgrade in the `upgrades` array, applies the modification:
   - `answer_block`: Finds the heading text, inserts answer capsule paragraph after the closing `</h2>` tag
   - `stats_injection`: Finds the target section heading, appends stats paragraph
   - `freshness_update`: Inserts/updates "Last updated" text near the top of the content area
3. Writes the modified file, git commits + pushes

This could live in a new `scripts/seo_engine/actions/geo_upgrade.py` module or extend `page_optimizer.py`. Recommend a new module for clarity.

**Rate limit:** Add `"geo_content_upgrade": 2` to `WEEKLY_LIMITS` in seo_loop.py. These are high-value, low-risk edits.

### Pattern 3: Striking-Distance + Low GEO Score Prioritization (BRAIN-04)

**What:** Brain rules that instruct the model to prioritize pages that are both striking-distance (position 3-20) AND have low GEO scores.

**Implementation:** Add a combined section or brain rule that cross-references GSC position data with GEO scores. The brain prompt already has a "STRIKING DISTANCE PAGES" section. The new approach:

1. Add GEO scores to the existing striking distance table (add a column for GEO score)
2. Add a new brain rule: "When a striking-distance page also has a low GEO score (0-2), prioritize a geo_content_upgrade for that page above all other action types. These pages have the highest ROI: they already rank but aren't citation-ready."

**Cross-reference logic (in seo_loop.py before brain call):**
```python
# Match GSC queries to page paths via URL patterns
# GSC gives us query + position; GEO scorer gives us page_path + score
# The brain sees both sections and makes the connection via the rules
```

The simplest implementation: include GEO scores in the striking distance section itself. For each query in striking distance, if we know which page ranks for it, show that page's GEO score inline.

### Pattern 4: Citation-Ready Blog Engine Defaults (CONT-02)

**What:** Modify brain rules for `blog_post` to enforce citation-ready structure, and optionally modify the blog template to include structural markers.

**Brain rule additions (in the RULES section of brain.py):**
```
- Every blog_post body_content MUST include:
  a. An answer capsule (40-60 words) as the first <p> after the first <h2> with class="answer-capsule"
  b. At least one comparison table (<table>) for any "vs" or comparison topic
  c. At least 3 stat-dense data points (numbers, percentages, costs, measurements)
  d. Question-format H2 headings where the topic is a question
  e. "Last updated: {date}" visible near the top
  f. Short, scannable paragraphs (max 3 sentences each)
```

Note: Rules 27-31 in the current brain prompt already cover much of this. The upgrade is making them more specific (40-60 word capsules instead of 50-150, enforcing the `class="answer-capsule"` attribute for schema targeting) and adding the comparison table requirement.

**Blog engine change:** The `generate_blog_post()` function in `blog_engine.py` does not modify body_content -- it just slots it into a template. The citation-ready structure is enforced at brain-prompt level (the brain generates the HTML). No changes needed to `blog_engine.py` itself unless we want to add post-processing validation.

**Optional post-processing:** Add a validation step in `seo_loop.py` post-action hooks that checks new blog posts for answer capsule presence using `content_validator.check_answer_capsule()` (already exists).

### Pattern 5: Aggressive FAQ Schema Auto-Detection (CONT-04)

**What:** Extend `schema_injector.py` to auto-detect question-format H2 headings and the paragraphs that answer them, then inject FAQ schema automatically.

**Detection logic:**
```python
def detect_faq_candidates(html: str) -> list:
    """Find question-format H2s and their answer paragraphs.

    Returns list of {"question": str, "answer": str} dicts.
    """
    soup = BeautifulSoup(html, "html.parser")
    qa_pairs = []

    for h2 in soup.find_all("h2"):
        text = h2.get_text(strip=True)
        # Question patterns: starts with how/what/why/when/where/is/can/do/does/should/will
        # or ends with "?"
        if text.endswith("?") or re.match(r"^(how|what|why|when|where|is|can|do|does|should|will|are)\b", text, re.I):
            # Get the next sibling paragraph(s) as the answer
            answer_parts = []
            for sibling in h2.find_next_siblings():
                if sibling.name in ("h2", "h3"):
                    break
                if sibling.name == "p":
                    answer_parts.append(sibling.get_text(strip=True))
                if len(answer_parts) >= 2:  # Cap at 2 paragraphs per answer
                    break

            if answer_parts:
                qa_pairs.append({
                    "question": text.rstrip("?") + "?",
                    "answer": " ".join(answer_parts)
                })

    return qa_pairs
```

**Integration points:**
1. **Post-action hook in seo_loop.py:** After any content creation action (blog_post, location_page, geo_content_upgrade), run FAQ detection on the newly created/modified page and inject FAQ schema if candidates found.
2. **Brain-initiated:** The brain can also recommend a `schema_update` action with `schema_type: "faq"` for existing pages it identifies as having question-format content.
3. **Batch sweep:** Optionally, run FAQ detection across all client pages during the GEO scoring step and inject missing FAQ schema in bulk.

Recommend approach #1 (post-action hook) as primary, with the brain also able to recommend schema_update for existing pages it notices.

### Anti-Patterns to Avoid

- **Blowing up the prompt:** Do NOT include raw JSON from Supabase (JSONB fields like `ai_overview_references` or `paa_data`) in the brain prompt. These can be 5000+ chars per keyword. Only include summarized status flags.
- **Over-editing pages:** Do NOT let the brain chain multiple geo_content_upgrades on the same page in the same cycle. One upgrade per page per week max.
- **Replacing good content:** The geo_content_upgrade action should ADD content (answer blocks, stats), not replace existing paragraphs. Use insertion patterns, not replacement.
- **FAQ schema on non-question content:** Do NOT inject FAQ schema on pages that don't have actual question-answer patterns. False FAQ schema can trigger Google penalties.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Answer capsule validation | Custom HTML parser | Existing `content_validator.check_answer_capsule()` | Already handles word counting, link detection, H2 finding |
| FAQ schema generation | Manual JSON-LD construction | Existing `schema_injector.inject_faq_schema()` | Already handles dedup, JSON-LD injection, `</head>` placement |
| Page text editing | Custom DOM manipulation | Existing `page_optimizer.optimize_page()` | Already handles old_text/new_text replacement, git commit, protected pages |
| Schema audit | Custom file scanning | Existing `schema_injector.audit_page_schemas()` | Already scans all pages, extracts schema types |
| Content quality check | Custom word/phrase checker | Existing `content_validator.validate_content()` | Already checks AI tells, em dashes, emojis, experience signals, min length |

**Key insight:** Nearly all the building blocks exist. Phase 3 is integration and wiring, not new infrastructure. The geo_content_upgrade execution is the only genuinely new module needed.

## Common Pitfalls

### Pitfall 1: Prompt Size Explosion
**What goes wrong:** Adding GEO data to the brain prompt pushes it past practical limits, causing truncated or degraded brain responses.
**Why it happens:** Each page's full factor breakdown + each keyword's full AI Overview data can be hundreds of chars.
**How to avoid:** Enforce the 3000-char budget strictly. Count chars before adding to prompt. Prioritize low-score pages and AI Overview keywords. Cap at 20 pages and 15 keywords.
**Warning signs:** Brain responses become incoherent, truncated, or miss existing sections.

### Pitfall 2: Stale GEO Data in Brain Prompt
**What goes wrong:** Brain sees yesterday's GEO scores but the page was already upgraded today, leading to redundant recommendations.
**Why it happens:** GEO scoring runs in Step 1b, brain runs in Step 5. If a previous run already upgraded a page, the score might not reflect the change yet.
**How to avoid:** GEO scoring runs daily at the start of each loop, so scores should be fresh. For same-cycle awareness, track which pages were upgraded in the current run and exclude them from GEO recommendations.
**Warning signs:** Brain keeps recommending upgrades for pages that were already fixed.

### Pitfall 3: Answer Block Insertion Breaking HTML
**What goes wrong:** Inserting an answer capsule paragraph after an H2 tag breaks the page layout because the H2 is inside a container div or other structural element.
**Why it happens:** Static HTML sites have varied structures. The insertion point might be inside a grid, flexbox, or styled container.
**How to avoid:** For geo_content_upgrade, read the full context around the target heading before inserting. Use BeautifulSoup for DOM-aware insertion rather than string replacement. Test on actual client page HTML.
**Warning signs:** Pages break visually after upgrade. CSS layouts shift unexpectedly.

### Pitfall 4: Duplicate FAQ Schema
**What goes wrong:** FAQ schema is injected on a page that already has it, or multiple FAQ schema blocks accumulate.
**Why it happens:** The auto-detection runs on every cycle, and the brain also recommends schema_update actions.
**How to avoid:** `schema_injector.inject_faq_schema()` already checks for existing FAQPage schema and returns unchanged HTML if present. Use this function (don't bypass it).
**Warning signs:** Multiple `<script type="application/ld+json">` blocks with FAQPage in the same page.

### Pitfall 5: Brain Generating Malformed geo_content_upgrade Actions
**What goes wrong:** Claude returns a `geo_content_upgrade` action with missing or malformed `upgrades` array, wrong heading text, or content that doesn't match the page.
**Why it happens:** New action type is more complex than existing ones. The brain hasn't been trained on this format yet.
**How to avoid:** Include a clear output format example in the brain rules. Validate the `upgrades` array before executing. If a heading text doesn't match, skip that upgrade and log a warning (don't crash).
**Warning signs:** Actions fail silently, pages unchanged despite brain recommending upgrades.

## Code Examples

### Fetching Latest GEO Scores from Supabase
```python
# Source: existing codebase patterns (serpapi_client.py, geo_scorer.py)
def get_latest_geo_scores(client_id: str) -> list:
    """Get most recent GEO scores for all pages of a client."""
    sb = _get_supabase()
    # Get latest scored_at date
    resp = (
        sb.table("geo_scores")
        .select("page_path, page_url, score, factors, scored_at")
        .eq("client_id", client_id)
        .order("scored_at", desc=True)
        .limit(50)
        .execute()
    )
    if not resp.data:
        return []

    # Deduplicate: keep only the latest score per page
    seen = set()
    latest = []
    for row in resp.data:
        if row["page_path"] not in seen:
            seen.add(row["page_path"])
            latest.append(row)
    return latest
```

### Fetching Latest SERP Features from Supabase
```python
def get_latest_serp_features(client_id: str) -> list:
    """Get most recent SERP features for all keywords of a client."""
    sb = _get_supabase()
    resp = (
        sb.table("serp_features")
        .select("keyword, has_ai_overview, client_cited_in_ai_overview, has_featured_snippet, featured_snippet_holder, client_has_snippet, paa_questions, collected_at")
        .eq("client_id", client_id)
        .order("collected_at", desc=True)
        .limit(50)
        .execute()
    )
    if not resp.data:
        return []

    # Deduplicate: keep only the latest per keyword
    seen = set()
    latest = []
    for row in resp.data:
        if row["keyword"] not in seen:
            seen.add(row["keyword"])
            latest.append(row)
    return latest
```

### Formatting GEO Data for Brain Prompt (Compact)
```python
def _format_geo_section(geo_scores, serp_features, char_budget=3000):
    """Format GEO data for brain prompt within character budget."""
    section = ""

    # GEO scores (sorted by score ascending = worst first)
    if geo_scores:
        geo_sorted = sorted(geo_scores, key=lambda x: x["score"])
        section += "GEO CITATION-READINESS SCORES:\n"
        section += f"  {'Page':<30} {'Score':<8} {'Missing Factors'}\n"
        section += f"  {'-'*70}\n"
        for page in geo_sorted[:20]:
            factors = page.get("factors", {})
            if isinstance(factors, str):
                import json
                factors = json.loads(factors)
            missing = [k for k, v in factors.items() if v == 0]
            missing_str = ", ".join(missing) if missing else "all present"
            row = f"  {page['page_path']:<30} {page['score']}/5    {missing_str}\n"
            if len(section) + len(row) > char_budget * 0.5:
                break
            section += row
        section += "  Pages with score 0-2 need geo_content_upgrade actions. Fix these BEFORE creating new content.\n\n"

    # AI Overview status
    if serp_features:
        section += "AI OVERVIEW + CITATION STATUS:\n"
        section += f"  {'Keyword':<35} {'AIO':<6} {'Cited':<8} {'Snippet Holder'}\n"
        section += f"  {'-'*75}\n"
        for sf in serp_features[:15]:
            aio = "YES" if sf["has_ai_overview"] else "no"
            cited = "CITED" if sf["client_cited_in_ai_overview"] else "-"
            snippet = sf.get("featured_snippet_holder", "")
            snippet_str = snippet[:25] + "..." if len(snippet) > 25 else (snippet or "-")
            row = f"  {sf['keyword']:<35} {aio:<6} {cited:<8} {snippet_str}\n"
            if len(section) + len(row) > char_budget:
                break
            section += row
        section += "  Keywords with AIO=YES but Cited=- are highest priority for GEO content upgrades on their ranking pages.\n\n"

    return section
```

### geo_content_upgrade Execution
```python
# New module: scripts/seo_engine/actions/geo_upgrade.py
def execute_geo_upgrade(website_path, filename, upgrades, action_id=None, dry_run=True):
    """Apply GEO content upgrades to an existing page.

    Upgrades are additive (insert, not replace) to preserve existing content.
    """
    from pathlib import Path
    from bs4 import BeautifulSoup

    website_path = Path(website_path)
    file_path = website_path / filename

    if filename in ("index.html",):
        return {"status": "blocked", "reason": "protected page"}
    if not file_path.exists():
        return {"status": "error", "reason": "file not found"}

    html = file_path.read_text()
    soup = BeautifulSoup(html, "html.parser")
    applied = []

    for upgrade in upgrades:
        utype = upgrade.get("type", "")

        if utype == "answer_block":
            heading_text = upgrade.get("after_heading", "")
            content = upgrade.get("content", "")
            # Find the H2 with matching text
            for h2 in soup.find_all("h2"):
                if heading_text.lower() in h2.get_text(strip=True).lower():
                    from bs4 import Tag
                    new_p = BeautifulSoup(content, "html.parser")
                    h2.insert_after(new_p)
                    applied.append(utype)
                    break

        elif utype == "stats_injection":
            # Similar heading-find + insert pattern
            pass

        elif utype == "freshness_update":
            # Insert/update "Last updated" text
            pass

    if not applied:
        return {"status": "no_changes", "upgrades_attempted": len(upgrades)}

    if not dry_run:
        file_path.write_text(str(soup))
        # git commit + push (same pattern as page_optimizer.py)

    return {"status": "applied" if not dry_run else "dry_run", "upgrades_applied": len(applied)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Brain has no GEO awareness | Brain sees GEO scores + AI Overview data | Phase 3 (now) | Brain can prioritize citation-readiness upgrades |
| Blog posts follow general AEO rules (rule 27-31) | Blog posts enforce strict citation-ready structure | Phase 3 (now) | Every new post is AI-extractable by default |
| FAQ schema only via manual brain recommendation | FAQ schema auto-detected from question headings | Phase 3 (now) | Much more aggressive FAQ coverage |
| page_edit is the only retrofit tool | geo_content_upgrade adds structured, GEO-specific edits | Phase 3 (now) | More targeted page improvements |

## Open Questions

1. **GEO score + GSC page mapping**
   - What we know: GEO scores are keyed by `page_path` (e.g., "services.html"). GSC data is keyed by `query` (keywords). The brain sees both but needs to connect "this keyword ranks on this page."
   - What's unclear: GSC does not always tell us which URL ranks for a query. We have `gsc_queries` with position but not page URL.
   - Recommendation: For the brain prompt, show both tables side by side and let the brain make the connection via page title/topic matching. If we want programmatic cross-referencing, we'd need GSC's pages report (which would require a new API call). Not worth the complexity for Phase 3 -- the brain is smart enough to connect "turf cleaning poway" with "services.html" given the page inventory.

2. **BeautifulSoup output fidelity**
   - What we know: Using `str(soup)` to serialize back to HTML can alter whitespace, attribute order, and self-closing tag syntax.
   - What's unclear: Whether this will cause visual diffs on client sites.
   - Recommendation: For geo_content_upgrade, use string-level insertion (find the heading text in raw HTML, insert after the closing `</h2>` tag) rather than BeautifulSoup serialization. This preserves the original formatting. Only use BeautifulSoup for reading/detection, not writing.

3. **Answer capsule word count: 40-60 vs 50-150**
   - What we know: CONT-01 specifies 40-60 words. Current content_validator checks 50-150 words. Brain rule 27 says 50-150 words.
   - What's unclear: Whether 40-60 is strict for ALL capsules or just for geo_content_upgrade insertions.
   - Recommendation: Update brain rules to say 40-60 words for answer capsules (tighter is better for AI extraction). Update content_validator to accept 40-60 as the new range. The old 50-150 range was too loose.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: brain.py, seo_loop.py, geo_scorer.py, schema_injector.py, blog_engine.py, page_optimizer.py, content_validator.py, research_runner.py, serpapi_client.py
- Supabase table schemas: geo_scores (from Phase 2 migration), serp_features (from Phase 2 migration)
- Phase 2 plan docs: 02-01-PLAN.md, 02-02-PLAN.md

### Secondary (MEDIUM confidence)
- Brain prompt size estimates based on current prompt analysis (~470 lines, 17+ sections)
- GEO scoring factors from geo_scorer.py implementation (5 binary factors)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing infrastructure
- Architecture: HIGH - extends well-understood existing patterns (brain prompt sections, action types, schema injection)
- Pitfalls: HIGH - based on direct code analysis of edge cases in page_optimizer.py and schema_injector.py

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable codebase, no external API changes expected)
