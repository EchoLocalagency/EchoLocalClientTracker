# Feature Research: GEO Module

**Domain:** Generative Engine Optimization for local service businesses
**Researched:** 2026-03-10
**Confidence:** MEDIUM (emerging domain, patterns stabilizing but tools/metrics still evolving)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any GEO-aware SEO engine must have in 2026. Without these, the system is just traditional SEO pretending to care about AI search.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AI Overview detection per keyword | Every GEO tool tracks whether AI Overviews appear for tracked keywords. SerpAPI returns this structured data directly. | LOW | SerpAPI `ai_overview` field in search results. Already in PROJECT.md scope. |
| AI Overview citation tracking | Knowing IF client pages are cited in AI Overviews is the core GEO metric. 76% of AIO citations link to top-10 pages (dropping to 38% in recent data). | MEDIUM | SerpAPI extracts `references` with titles, links, snippets from AI Overview blocks. Requires matching against client URLs. |
| GEO content score per page | Every major GEO tool (Frase, Surfer, eSEOspace) scores content 0-100 for AI-readiness. Standard components: structure, schema, semantic richness, conversational relevance. | MEDIUM | Build a lightweight scorer. Does NOT need to match commercial tools exactly -- needs to rank pages relative to each other so the brain prioritizes the worst ones. |
| Answer block injection | Self-contained 40-60 word answer blocks after H2s are the single most cited content pattern. LLMs are 28-40% more likely to cite content with clear answer formatting. | LOW | Extends existing blog_engine and page_optimizer. Brain already generates content -- just needs formatting rules. |
| FAQ schema injection | FAQPage schema is the #1 schema type for AI citations. Pages with schema markup are 36% more likely to appear in AI responses. | LOW | schema_injector.py already supports FAQ. Needs to be applied more aggressively and tied to AEO opportunity data. |
| People Also Ask extraction | PAA boxes reveal the exact questions AI systems answer. Every GEO tool mines these. SerpAPI returns structured PAA data. | LOW | SerpAPI `related_questions` field. Direct extraction, store in research_cache. |
| Content structure optimization | Clear heading hierarchy (H1>H2>H3), short paragraphs (3-4 sentences), lists, tables, key takeaway boxes. Pages with this structure are 2.8x more likely to be cited. | LOW | Content rules for the brain to follow during generation. Audit existing pages for compliance. |
| Featured snippet tracking | Knowing who holds the featured snippet for target queries. Featured snippets feed directly into AI Overviews. | LOW | SerpAPI `featured_snippet` field. Track client vs competitor ownership. |

### Differentiators (Competitive Advantage)

Features that separate this from a generic GEO checker. These leverage the existing brain/engine architecture in ways standalone tools cannot.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Brain-integrated GEO prioritization | Commercial GEO tools score content but leave action to humans. Our brain sees GEO scores AND can autonomously fix low-scoring pages through page_edit, blog_post, and schema_update actions. Closed-loop optimization. | MEDIUM | Brain already prioritizes by SEO signals. Add GEO score as a decision input. The brain decides "this page has a GEO score of 35, it needs answer blocks and FAQ schema" and executes. |
| Topical authority completeness scoring | Measures how thoroughly each content cluster covers its topic. Domains with comprehensive topical coverage get cited more than those with more backlinks. Extends existing cluster_manager. | MEDIUM | Count gaps in clusters, measure coverage breadth. cluster_manager.py already tracks pillar pages and supporting posts. Add a completeness metric. |
| Entity graph building (Organization + sameAs) | Organization schema with sameAs links to verified profiles (GBP, Yelp, BBB, social) helps AI systems verify entity legitimacy. sameAs portfolios correlate with higher AI citation rates. | LOW | Extend schema_injector to generate Organization schema with sameAs array. One-time setup per client, then maintain. |
| Source diversity scoring | 48% of AI citations come from community platforms, not owned sites. Track where clients are mentioned (Reddit, directories, forums) and identify gaps. | MEDIUM | Brave Search `site:reddit.com`, `site:yelp.com`, etc. Quantify presence across source types. Feeds into the brain's action planning. |
| Cross-platform mention tracking | Monitor where client brand appears across the web. Not just "are we cited in AI Overviews" but "are we building the web presence that makes AI citation likely." | MEDIUM | Brave Search brand monitoring. Store mention history in Supabase. Track growth over time. |
| Question-to-content matching | Map AEO opportunity questions to existing content. Show which questions have answers on the site and which are gaps. Brain auto-fills gaps via blog posts. | LOW | Cross-reference aeo_opportunities output with existing page content. The data already exists -- just needs connecting. |
| SerpAPI budget management with smart allocation | Hard monthly cap with intelligent distribution across keywords. Prioritize high-value queries (high impressions, question format, known AI Overview presence) over low-value ones. | MEDIUM | Track usage in Supabase. Allocate budget per client (200/month). Prioritize keywords by value. Hard-stop at cap. |
| Competitor AI Overview monitoring | Track which competitors get cited for your target keywords. Know when a competitor displaces you in AI Overviews. | LOW | SerpAPI already returns all cited URLs in AI Overviews. Compare against known competitor domains. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Perplexity API citation tracking | "Track citations across ALL AI platforms" | Perplexity API is unreliable for citation tracking, results inconsistent, adds cost for partial coverage. PROJECT.md already scoped this out. | Monitor Perplexity presence via manual spot-checks or Brave Search brand queries. Revisit if API stabilizes. |
| ChatGPT citation tracking | "Know when ChatGPT recommends us" | No public API. Results vary by session, user, and prompt. Impossible to get consistent data. Commercial tools that claim to track this use prompt simulation (unreliable). | Focus on Google AI Overviews (trackable via SerpAPI) and building the authority signals that make all AI engines cite you. |
| Automated Reddit/Quora posting | "Get mentioned on community platforms to boost citations" | ToS violation. Ban risk. Destroys brand trust if discovered. Legal liability. | Manual participation only. Engine identifies relevant threads, Brian decides whether to engage personally. |
| Real-time AI visibility dashboard | "See citation changes live" | SerpAPI budget is 200/client/month. Real-time monitoring would burn through budget in days. Commercial tools charging $95-495/mo for this have much larger API budgets. | Weekly AI visibility snapshots. Run targeted checks on research days (Wed + Sat). Dashboard shows trends, not live data. |
| Full commercial GEO scoring parity | "Match Frase/Surfer scoring exactly" | Their scores use proprietary training data, NLP models, and massive SERP datasets. Replicating them is impossible and unnecessary. | Build a simpler, opinionated GEO score focused on the 5 factors that matter most for local service businesses. Good enough to rank pages relative to each other. |
| YouTube transcript optimization | "Optimize video content for AI citation" | Current clients have no YouTube presence. Zero ROI for now. | Revisit when a client has active YouTube content. |
| Multi-language GEO | "Support Spanish market content" | AI Overview detection via SerpAPI only works for English (hl=en). Current clients are English-only. | English only. Revisit if client base expands to multilingual markets. |

## Feature Dependencies

```
[SerpAPI Integration]
    |--provides--> [AI Overview Detection]
    |                   |--enables--> [AI Overview Citation Tracking]
    |                   |--enables--> [Competitor AI Overview Monitoring]
    |--provides--> [PAA Extraction]
    |                   |--feeds--> [Question-to-Content Matching]
    |                                    |--feeds--> [Brain GEO Prioritization]
    |--provides--> [Featured Snippet Tracking]
    |--requires--> [SerpAPI Budget Management]

[GEO Content Score]
    |--requires--> [Content Structure Audit] (check heading hierarchy, paragraph length, etc.)
    |--requires--> [Schema Audit] (check FAQ, HowTo, Organization presence)
    |--requires--> [Answer Block Detection] (check for 40-60 word self-contained answers)
    |--feeds--> [Brain GEO Prioritization]

[Entity Graph Building]
    |--requires--> [Organization Schema] (schema_injector extension)
    |--requires--> [sameAs Link Collection] (GBP, Yelp, BBB, social URLs per client)
    |--enhances--> [GEO Content Score] (entity signals boost score)

[Topical Authority Scoring]
    |--requires--> [cluster_manager.py] (already exists)
    |--enhances--> [GEO Content Score]
    |--feeds--> [Brain GEO Prioritization]

[Source Diversity Scoring]
    |--requires--> [Brave Search Brand Queries]
    |--requires--> [Cross-Platform Mention Tracking]
    |--feeds--> [Brain GEO Prioritization]

[Brain GEO Prioritization]
    |--requires--> [GEO Content Score]
    |--requires--> [AI Overview Citation Tracking]
    |--consumes--> all upstream data to decide daily actions
```

### Dependency Notes

- **SerpAPI Integration is the foundation:** AI Overview detection, PAA, featured snippets all come from SerpAPI. Budget management must ship with it or before it.
- **GEO Content Score requires auditing infrastructure:** Must be able to analyze existing page structure, schema, and answer blocks before you can score them.
- **Brain GEO Prioritization is the capstone:** It needs GEO scores + citation data to make informed decisions. Build the inputs first.
- **Entity Graph is independent:** Can be built in parallel with SerpAPI work. Low complexity, high signal value.
- **Source Diversity requires Brave Search:** Already configured per PROJECT.md. Reddit queries replace broken Reddit API.

## MVP Definition

### Launch With (v1)

Minimum viable GEO capability -- what's needed to start improving AI visibility.

- [ ] SerpAPI integration with budget tracking (200/client/month cap) -- foundation for all SERP intelligence
- [ ] AI Overview detection per tracked keyword -- know which queries trigger AI Overviews
- [ ] AI Overview citation check -- know if client pages are cited
- [ ] PAA extraction -- structured question data for content targeting
- [ ] GEO content score (simplified) -- score pages on structure, schema, answer blocks
- [ ] Answer block formatting in blog engine -- new content is citation-ready from day one
- [ ] Brain integration -- GEO scores influence daily action selection

### Add After Validation (v1.x)

Features to add once core GEO scoring and SerpAPI are working.

- [ ] Topical authority completeness scoring -- once cluster_manager data is flowing
- [ ] Entity graph building (Organization schema + sameAs) -- one-time setup per client
- [ ] Question-to-content matching -- connect AEO opportunities to existing content
- [ ] Featured snippet tracking and optimization -- extends SerpAPI data already collected
- [ ] Competitor AI Overview monitoring -- uses same SerpAPI data, just adds comparison logic
- [ ] Content structure audit for existing pages -- retroactive scoring of old content

### Future Consideration (v2+)

Features to defer until GEO fundamentals are proven.

- [ ] Source diversity scoring -- requires Brave Search integration work, lower urgency than on-site optimization
- [ ] Cross-platform mention tracking -- valuable but not urgent for 2-4 client scale
- [ ] Smart SerpAPI budget allocation (priority-weighted) -- simple equal distribution works for now
- [ ] Dashboard GEO metrics visualization -- report on GEO scores and citation trends in the Next.js dashboard

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SerpAPI integration + budget tracking | HIGH | MEDIUM | P1 |
| AI Overview detection | HIGH | LOW | P1 |
| AI Overview citation tracking | HIGH | LOW | P1 |
| PAA extraction | HIGH | LOW | P1 |
| GEO content score (simplified) | HIGH | MEDIUM | P1 |
| Answer block formatting | HIGH | LOW | P1 |
| Brain GEO integration | HIGH | MEDIUM | P1 |
| FAQ schema (aggressive application) | MEDIUM | LOW | P1 |
| Topical authority scoring | MEDIUM | MEDIUM | P2 |
| Entity graph building | MEDIUM | LOW | P2 |
| Question-to-content matching | MEDIUM | LOW | P2 |
| Featured snippet tracking | MEDIUM | LOW | P2 |
| Competitor AI Overview monitoring | MEDIUM | LOW | P2 |
| Content structure audit (existing pages) | MEDIUM | MEDIUM | P2 |
| Source diversity scoring | MEDIUM | MEDIUM | P3 |
| Cross-platform mention tracking | LOW | MEDIUM | P3 |
| Dashboard GEO visualization | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- enables GEO scoring and brain-driven optimization
- P2: Should have, add when core GEO loop is working
- P3: Nice to have, defer until ROI from P1/P2 is demonstrated

## Competitor Feature Analysis

| Feature | Frase ($39+/mo) | Surfer AI Tracker ($95-495/mo) | SE Ranking Visible ($varies) | Our Approach |
|---------|-----------------|-------------------------------|------------------------------|--------------|
| GEO content score | Authority + Readability + Structure (3 pillars) | Content Score (500+ signals) + AI Search Guidelines | AI visibility tied to search outcomes | Simplified 5-factor score: structure, schema, answer blocks, semantic richness, conversational relevance. Focused on local service content. |
| AI platform tracking | ChatGPT, Perplexity, Claude | ChatGPT, Google AIO, Perplexity, Gemini, AI Mode | ChatGPT, Perplexity, Google AIO, Gemini | Google AI Overviews only (via SerpAPI). Highest ROI for local search. Others deferred. |
| Content optimization | 40+ AI writing tools, real-time scoring | Auto-Optimize (one-click entity/fact injection) | Automated content creation | Brain-driven: scores page, decides action, executes (blog_post, page_edit, schema_update). Fully autonomous. |
| Tracking frequency | On-demand | Daily/weekly monitoring | Continuous | Weekly snapshots (Wed + Sat research days). Budget-conscious. |
| Action automation | None (suggestions only) | None (suggestions only) | Partial (content creation) | Full closed-loop: detect problem, score it, prioritize it, fix it, measure outcome. No human in the loop for routine fixes. |
| Local business focus | Generic | Generic | Generic | Purpose-built for local service businesses. GBP integration, location pages, local schema. |
| Pricing model | Per-seat SaaS | Per-seat SaaS + add-on | Per-seat SaaS | Built into existing engine. SerpAPI cost: ~$6/client/month (200 searches at $25/1000). |

## Sources

- [Frase GEO Scoring](https://www.frase.io/blog/geo-scoring-in-frase) -- Authority, Readability, Structure pillars (MEDIUM confidence)
- [GEO Content Score Methodology](https://eseospace.com/blog/geo-content-score-how-to-measure-ai-visibility/) -- 5-component weighted scoring framework (MEDIUM confidence)
- [SerpAPI AI Overview API](https://serpapi.com/ai-overview) -- Structured AI Overview extraction capabilities (HIGH confidence, official docs)
- [Surfer AI Tracker](https://surferseo.com/) -- AI Search Guidelines, multi-platform tracking ($95-495/mo) (MEDIUM confidence)
- [AI Overview Citation Stats](https://koanthic.com/en/ai-overview-citations-76-link-to-top-10-rankings/) -- 76% of citations from top-10 pages (MEDIUM confidence)
- [Content Structure Citation Impact](https://www.semrush.com/blog/how-to-optimize-content-for-ai-search-engines/) -- 2.8x citation increase with structured content (MEDIUM confidence)
- [Schema Markup Impact](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/) -- 36% more likely to appear in AI responses (MEDIUM confidence)
- [Entity Graph for GEO](https://agenxus.com/blog/building-entity-graph-organization-person-schema) -- Organization + sameAs for AI entity verification (MEDIUM confidence)
- [Source Diversity Data](https://www.incremys.com/en/resources/blog/geo-content-strategy) -- 48% of citations from community platforms (LOW confidence, single source)
- [Topical Authority for AI](https://www.keywordinsights.ai/blog/how-to-build-topical-authority-in-seo/) -- Coverage breadth matters more than backlinks for AI citation (MEDIUM confidence)
- [Fingerlakes GEO Tools Overview](https://www.fingerlakes1.com/2026/03/08/best-generative-engine-optimization-geo-tools-in-2026-what-actually-use-to-track-ai-visibility/) -- Tool landscape survey (LOW confidence)
- [Search Engine Land GEO Guide](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142) -- GEO best practices (MEDIUM confidence)

---
*Feature research for: GEO Module (Generative Engine Optimization)*
*Researched: 2026-03-10*
