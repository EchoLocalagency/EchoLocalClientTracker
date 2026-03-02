"""
Agency Brain
============
Builds an agency-specific prompt for Echo Local's own SEO.
Focus: thought leadership, SEO guides, case study breakdowns,
trade-specific SEO advice. References real client data as proof points.

Same output format (JSON action array) as the client engine brain.
"""

import json
import subprocess
from datetime import date
from pathlib import Path

from ..seo_engine.content_validator import validate_content
from ..seo_engine.outcome_logger import log_brain_decision


def _build_prompt(client_config, performance_data, keyword_rankings,
                  gsc_queries, page_inventory, action_history,
                  outcome_patterns, recent_keywords, week_counts,
                  research_data=None, schema_audit=None, clusters=None,
                  cluster_gaps=None, keyword_opportunities=None,
                  aeo_opportunities=None):
    """Build the agency brain prompt."""

    website = client_config.get("website", "")
    target_kws = client_config.get("target_keywords", [])
    market = client_config.get("primary_market", "San Diego County, CA")

    # -- Section 1: Identity --
    prompt = f"""You are the SEO strategist for Echo Local, a digital consulting agency in Oceanside, CA.
Website: {website}
Today: {date.today()}
Primary market: {market}

Echo Local builds automated SEO systems ("Echo Engine") for home service businesses --
plumbers, HVAC, pressure washers, landscapers, turf cleaners, and more.
Our differentiator: we use AI-powered automation to compound organic growth over time.
No ad spend, no vanity metrics. Real rankings, real calls.

Your job: analyze the data below and return a JSON array of SEO actions.
Content strategy: thought leadership, SEO guides, case study breakdowns,
and trade-specific SEO advice. Everything should position Echo Local as
the go-to SEO partner for home service businesses in San Diego County.

REAL CLIENT DATA (use as proof points in content):
  - Mr Green Turf Clean: 0 to 451+ search impressions, #1 for "turf cleaning san diego",
    130+ GBP impressions from zero. Poway-based, serves North County SD.
  - Integrity Pro Washers: 167 search impressions in month one, 81 GBP impressions,
    LCP optimized 18.1s to 8.9s. San Diego (North Park area).

"""

    # -- Section 2: Performance snapshot --
    ga4 = performance_data.get("ga4", {})
    gsc = performance_data.get("gsc", {})

    prompt += f"""CURRENT PERFORMANCE (14-day window):
  GA4: {ga4.get('sessions', 0)} sessions ({ga4.get('organic', 0)} organic) | {ga4.get('phone_clicks', 0)} calls, {ga4.get('form_submits', 0)} forms
  GSC: {gsc.get('impressions', 0)} impressions, {gsc.get('clicks', 0)} clicks, avg pos {gsc.get('avg_position', 0)}
  Note: No GBP for Echo Local yet -- organic search and blog content are our primary channels.

"""

    # -- Section 3: Target keyword rankings --
    if keyword_rankings:
        serp_lookup = {}
        if research_data and research_data.get("competitor_serps"):
            client_domain = (website or "").replace("https://", "").replace("http://", "").rstrip("/")
            for kw_str, results in research_data["competitor_serps"].items():
                for r in results:
                    url = r.get("url", "")
                    if client_domain and client_domain in url:
                        serp_lookup[kw_str.lower()] = r.get("position", 0)
                        break

        prompt += "TARGET KEYWORD RANKINGS:\n"
        prompt += f"  {'Keyword':<50} {'Organic':<10} {'SERP':<8} {'Impressions':<12} {'Clicks':<8} {'Status'}\n"
        prompt += f"  {'-'*110}\n"
        for kw in keyword_rankings:
            organic_pos = f"{kw['position']:.1f}" if kw.get("position") else "--"
            serp_pos = serp_lookup.get(kw["keyword"].lower())
            serp_str = f"#{serp_pos}" if serp_pos else "--"
            status = kw.get("status", "")
            if status == "not ranking" and serp_pos:
                if serp_pos <= 3:
                    status = f"SERP #{serp_pos} (dominating)"
                elif serp_pos <= 10:
                    status = f"SERP #{serp_pos} (page 1)"
                else:
                    status = f"SERP #{serp_pos}"
            prompt += f"  {kw['keyword']:<50} {organic_pos:<10} {serp_str:<8} {kw.get('impressions', 0):<12} {kw.get('clicks', 0):<8} {status}\n"
        prompt += "\n"

    # -- Section 4: GSC top queries --
    if gsc_queries:
        prompt += "TOP GSC QUERIES (by impressions):\n"
        for q in gsc_queries[:15]:
            prompt += f"  {q['query']:<50} pos {q.get('position', 0):.1f}  {q.get('impressions', 0)} impr  {q.get('clicks', 0)} clicks\n"
        prompt += "\n"

    # -- Section 5: Page inventory --
    if page_inventory:
        schema_map = {}
        if schema_audit:
            for sa in schema_audit:
                schema_map[sa["filename"]] = sa.get("schemas", [])

        prompt += "EXISTING PAGES:\n"
        for p in page_inventory:
            fname = p['filename']
            schemas = schema_map.get(fname, [])
            schema_str = f" | schemas: [{', '.join(schemas)}]" if schemas else " | schemas: NONE"
            prompt += f"  {fname}: {p.get('title', '(no title)')}{schema_str}\n"
        prompt += "\n"

    # -- Section 6: Research data --
    if research_data:
        prompt += "MARKET RESEARCH:\n"
        trends = research_data.get("trends", {})
        if trends.get("seasonal_interest"):
            items = [f'"{k}" at {v}/100' for k, v in trends["seasonal_interest"].items()]
            prompt += f"  Seasonal trends: {', '.join(items)}\n"
        if trends.get("rising_queries"):
            prompt += f"  Rising searches: {', '.join(trends['rising_queries'][:5])}\n"

        reddit = research_data.get("reddit_questions", [])
        if reddit:
            prompt += "  Real user questions from Reddit:\n"
            for q in reddit[:5]:
                prompt += f"    - \"{q['title']}\" ({q.get('score', 0)} upvotes, r/{q.get('subreddit', '')})\n"

        competitors = research_data.get("competitor_serps", {})
        if competitors:
            prompt += "  Competitor insights:\n"
            for kw, results in list(competitors.items())[:3]:
                if results:
                    top = results[0]
                    prompt += f"    #{top.get('position', '?')} for \"{kw}\": {top.get('title', '')} ({top.get('url', '')})\n"

        newsjack = research_data.get("newsjack_alerts", [])
        high_urgency = [a for a in newsjack if a.get("urgency_score", 0) >= 7]
        if high_urgency:
            prompt += "  NEWSJACK ALERTS (urgency >= 7):\n"
            for alert in high_urgency[:5]:
                if alert.get("type") == "news":
                    prompt += f"    [NEWS urgency:{alert['urgency_score']}] {alert.get('title', '')} ({alert.get('source', '')})\n"
                else:
                    prompt += f"    [TREND urgency:{alert['urgency_score']}] \"{alert.get('query', '')}\" - {alert.get('reason', '')}\n"

        prompt += "\n"

    # -- Section 7: Action history --
    if action_history:
        prompt += "RECENT ACTIONS (last 90 days):\n"
        for a in action_history[:20]:
            score = a.get("impact_score")
            score_str = f"impact: {score:+.1f}" if score is not None else "measuring..."
            prompt += f"  [{a['action_date']}] {a['action_type']}: {a['description'][:60]} ({score_str})\n"
        prompt += "\n"

    # -- Section 8: Outcome patterns --
    if outcome_patterns and outcome_patterns.get("patterns"):
        prompt += "OUTCOME PATTERNS (what works):\n"
        for p in outcome_patterns["patterns"]:
            prompt += f"  {p['action_type']}: avg impact {p['avg_impact']:+.1f} ({p['positive_count']}/{p['total_actions']} positive)\n"
        prompt += "\n"

    # -- Section 9: Rate limits --
    limits = {
        "blog_post": 3,
        "page_edit": 2,
        "schema_update": 2,
        "newsjack_post": 1,
    }
    prompt += "WEEKLY RATE LIMITS (remaining this week):\n"
    for action_type, max_count in limits.items():
        used = week_counts.get(action_type, 0)
        remaining = max(0, max_count - used)
        prompt += f"  {action_type}: {remaining} remaining (used {used}/{max_count})\n"
    prompt += "\n"

    # -- Section 10: Recent keywords --
    if recent_keywords:
        prompt += "RECENTLY TARGETED (do NOT repeat within 14 days):\n"
        for rk in recent_keywords:
            prompt += f"  {rk['action_type']}: {rk['keyword']}\n"
        prompt += "\n"

    # -- Section 11: Keyword opportunities --
    if keyword_opportunities:
        gsc_opps = [o for o in keyword_opportunities if o.get("source") == "gsc"]
        brave_opps = [o for o in keyword_opportunities if o.get("source") != "gsc"]

        prompt += "KEYWORD OPPORTUNITIES (not in your target list yet):\n"
        if gsc_opps:
            prompt += "  From GSC (already ranking, need dedicated content):\n"
            for o in gsc_opps[:10]:
                prompt += f"    \"{o['keyword']}\" pos:{o.get('position','?')} impr:{o.get('impressions',0)} -- {o.get('reason','')}\n"
        if brave_opps:
            prompt += "  From related searches:\n"
            for o in brave_opps[:10]:
                prompt += f"    \"{o['keyword']}\" -- {o.get('reason','')}\n"
        prompt += "\n"

    # -- Section 11b: AEO opportunities --
    if aeo_opportunities:
        prompt += "AEO OPPORTUNITIES (question queries -- AI engines will answer these):\n"
        for opp in aeo_opportunities[:15]:
            reddit_str = ""
            if opp.get("reddit_match"):
                rm = opp["reddit_match"]
                reddit_str = f" | Reddit: \"{rm.get('title', '')[:40]}\" ({rm.get('score', 0)} upvotes)"
            prompt += f"  \"{opp['query']}\" pos:{opp.get('position','?')} impr:{opp.get('impressions',0)} aeo_score:{opp.get('aeo_score',0)} [{opp.get('category','general')}]{reddit_str}\n"
        prompt += "  These are AEO gold -- use question-format H2s, write answer capsules, and target these in blog content.\n\n"

    # AEO crawler status
    if research_data and research_data.get("aeo_crawler_check"):
        crawler_check = research_data["aeo_crawler_check"]
        blocked = crawler_check.get("blocked", [])
        if blocked:
            prompt += f"AEO CRAWLER WARNING: These AI crawlers are BLOCKED by robots.txt: {', '.join(blocked)}\n"
            prompt += "  Recommend unblocking to get cited in AI Overviews and chatbot answers.\n\n"

    # -- Section 12: Content clusters --
    if clusters or cluster_gaps:
        prompt += "CONTENT CLUSTERS:\n"
        if clusters:
            for c in clusters:
                supporting = c.get("supporting_count", 0)
                gaps = c.get("gap_count", 0)
                prompt += f"  {c['cluster_name']}: pillar={c.get('pillar_page', 'none')} | {supporting} posts | {gaps} gaps remaining\n"
                if c.get("gap_topics"):
                    for gap in c["gap_topics"][:5]:
                        prompt += f"    GAP: {gap}\n"
        if cluster_gaps:
            prompt += "  PRIORITY GAPS (clusters needing content most):\n"
            for cg in cluster_gaps[:3]:
                prompt += f"    {cg['cluster_name']}: {cg['gap_count']} gaps ({', '.join(cg['gap_topics'][:3])})\n"
        prompt += "\n"

    # -- Section 14: Backlink opportunities --
    if research_data:
        backlink_prospects = research_data.get("backlink_prospects", [])
        broken_link_opps = research_data.get("broken_link_opportunities", [])
        brand_mention_opps = research_data.get("brand_mentions", [])
        journalist_opps = research_data.get("journalist_opportunities", [])

        has_backlink_data = backlink_prospects or broken_link_opps or brand_mention_opps or journalist_opps
        if has_backlink_data:
            prompt += "BACKLINK OPPORTUNITIES:\n"
            if backlink_prospects:
                prompt += f"  Competitor gap: {len(backlink_prospects)} sites link to competing SD SEO agencies but not us\n"
                for p in backlink_prospects[:5]:
                    prompt += f"    {p.get('domain', '')} (relevance: {p.get('relevance_score', 0)}/10)\n"
            if broken_link_opps:
                prompt += f"  Broken links: {len(broken_link_opps)} broken outbound links found on resource pages\n"
            if brand_mention_opps:
                prompt += f"  Unlinked mentions: {len(brand_mention_opps)} pages mention Echo Local without a backlink\n"
            if journalist_opps:
                prompt += f"  Journalist queries: {len(journalist_opps)} relevant contributor/HARO opportunities\n"
                for j in journalist_opps[:3]:
                    prompt += f"    {j.get('title', '')[:60]} (relevance: {j.get('relevance_score', 0)}/10)\n"
            prompt += "  Note: Outreach is handled automatically by the backlink system. Factor this data into content decisions.\n"
            prompt += "\n"

    # -- Section 13: Rules --
    prompt += """RULES (follow exactly):
1. Return ONLY a JSON array of action objects. No other text.
2. Each action must have: action_type, target_keywords (array), priority (1-5, 1=highest), reasoning (1 sentence), and type-specific content fields.
3. Action types: blog_post, page_edit, schema_update, newsjack_post
4. Content style: no em dashes (use commas or hyphens), no emojis, no AI tells ("dive in", "comprehensive guide", "everything you need to know", "in conclusion", "game-changer", "buckle up", etc.)
5. Do NOT target the same keyword with the same action type if it appears in RECENTLY TARGETED.
6. Do NOT exceed the remaining weekly rate limits. If a type shows 0 remaining, do not propose that type.
7. Prioritize striking-distance keywords (position 5-20) for highest ROI.
8. Never edit index.html (homepage is off-limits).
9. Blog posts must include: title, slug, meta_description (under 160 chars), and body_content (2000+ chars of HTML).
10. Page edits must include: filename (from EXISTING PAGES), and an array of edits with old_text/new_text pairs.
11. Write from Echo Local's perspective. Use "we", "our team". Sound human and direct.
12. For blog posts, write full HTML body content. Include proper heading hierarchy (H2, H3), paragraphs, and internal links to existing pages where relevant.
13. Schema updates must include: filename, schema_type (faq or service). For faq: include qa_pairs array. For service: include service_name, description, area_served.
14. newsjack_post: same fields as blog_post but must be inspired by a NEWSJACK ALERT. Only when urgency >= 7.
15. Content clusters: every blog_post MUST specify a cluster_name field matching an existing cluster. Prioritize filling gap topics.
16. CONTENT TONE: position Echo Local as a practitioner, not a traditional agency. We build systems, show real data, and explain our process. Reference real client results (Mr Green, Integrity Pro) as proof points where relevant. Write like a founder who actually does the work, not a marketing team.
17. Blog posts should link to relevant existing pages (services, results, how-it-works) using relative paths like ../services.html.
18. Target San Diego County and SoCal geography in content. Mention specific cities and neighborhoods where relevant.
19. National long-tail keywords (like "SEO for home service businesses") should be addressed with broader content that still references San Diego examples.
20. AEO (Answer Engine Optimization): Every blog post MUST start with a 50-150 word "answer capsule" after the first H2 -- a self-contained answer to the target query. No links inside the capsule. This is what AI engines will cite.
21. Use question-format H2s where natural (e.g. "How much does local SEO cost for home service businesses?"). This maps directly to how people query AI assistants.
22. Include comparison tables for "X vs Y" queries (e.g. "Traditional SEO Agency vs Automated SEO System"). Tables get pulled into AI Overviews.
23. Add "Last updated: {date}" visible text near the top of blog content. Freshness signals matter for AI citation.
24. Keep paragraphs short (1 idea each). Use descriptive headings. For how-to content, use numbered steps. AI engines prefer scannable, structured content.
25. If AEO OPPORTUNITIES are listed above, prioritize creating content that directly answers those question queries. Use the exact question as an H2 heading.

OUTPUT FORMAT:
[
  {
    "action_type": "blog_post",
    "target_keywords": ["SEO for plumbers san diego"],
    "cluster_name": "Trade-Specific SEO in San Diego",
    "priority": 2,
    "reasoning": "High-value keyword with no dedicated content yet.",
    "title": "SEO for Plumbers in San Diego: What Actually Moves the Needle",
    "slug": "seo-for-plumbers-san-diego",
    "meta_description": "What San Diego plumbers need to know about local SEO...",
    "body_content": "<h2>Why Most Plumber SEO Strategies Fail</h2><p>...</p>"
  },
  {
    "action_type": "schema_update",
    "target_keywords": ["SEO agency san diego"],
    "priority": 1,
    "reasoning": "services.html has zero schema markup.",
    "filename": "services.html",
    "schema_type": "faq",
    "qa_pairs": [
      {"question": "How does Echo Local's SEO engine work?", "answer": "We build an automated system that..."}
    ]
  },
  {
    "action_type": "newsjack_post",
    "target_keywords": ["local SEO for contractors"],
    "cluster_name": "AI and SEO Automation",
    "priority": 1,
    "reasoning": "Trending news about Google algorithm update -- timely content.",
    "title": "What the Latest Google Update Means for Contractors",
    "slug": "google-update-contractors-2026",
    "meta_description": "How the latest Google algorithm change affects local contractors...",
    "body_content": "<h2>Breaking Down the Update</h2><p>...</p>"
  }
]
"""

    return prompt


def call_agency_brain(client_config, performance_data, keyword_rankings,
                      gsc_queries, page_inventory, action_history,
                      outcome_patterns, recent_keywords, week_counts,
                      research_data=None, schema_audit=None, clusters=None,
                      cluster_gaps=None, keyword_opportunities=None,
                      aeo_opportunities=None, dry_run=True):
    """Build prompt, call claude -p, parse response, return actions."""

    prompt = _build_prompt(
        client_config, performance_data, keyword_rankings, gsc_queries,
        page_inventory, action_history, outcome_patterns, recent_keywords,
        week_counts, research_data, schema_audit, clusters, cluster_gaps,
        keyword_opportunities, aeo_opportunities,
    )

    print(f"  [agency-brain] Prompt built ({len(prompt)} chars). Calling Claude...")

    if dry_run:
        dump_path = Path("/Users/brianegan/EchoLocalClientTracker/reports") / "last_agency_brain_prompt.txt"
        dump_path.parent.mkdir(parents=True, exist_ok=True)
        dump_path.write_text(prompt)
        print(f"  [agency-brain] DRY RUN -- prompt saved to {dump_path}")
        return []

    try:
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json"],
            capture_output=True,
            text=True,
            timeout=300,
            cwd="/Users/brianegan/EchoLocalClientTracker",
        )

        if result.returncode != 0:
            print(f"  [agency-brain] Claude CLI error: {result.stderr[:200]}")
            return []

        raw_response = result.stdout.strip()

        try:
            cli_output = json.loads(raw_response)
            response_text = cli_output.get("result", raw_response)
        except json.JSONDecodeError:
            response_text = raw_response

    except subprocess.TimeoutExpired:
        print(f"  [agency-brain] Claude CLI timed out (300s)")
        return []
    except FileNotFoundError:
        print(f"  [agency-brain] 'claude' CLI not found in PATH")
        return []

    # Extract JSON array from response
    actions = _parse_actions(response_text)

    if actions is None:
        print(f"  [agency-brain] Failed to parse actions from response")
        actions = []

    # Validate content
    validated_actions = []
    for action in actions:
        action, issues = _validate_action(action)
        if issues:
            print(f"  [agency-brain] Validation issues for {action.get('action_type', '?')}: {', '.join(issues)}")
        validated_actions.append(action)

    # Log the brain decision
    client_id = client_config.get("_supabase_id")
    if client_id:
        input_summary = {
            "date": str(performance_data.get("date")),
            "gsc_impressions": performance_data.get("gsc", {}).get("impressions"),
            "gsc_clicks": performance_data.get("gsc", {}).get("clicks"),
            "ga4_organic": performance_data.get("ga4", {}).get("organic"),
            "action_count": len(validated_actions),
        }
        log_brain_decision(
            client_id=client_id,
            input_summary=input_summary,
            raw_response=response_text[:5000],
            parsed_actions=validated_actions,
            execution_log=None,
        )

    print(f"  [agency-brain] Returned {len(validated_actions)} actions")
    return validated_actions


def _parse_actions(response_text):
    """Extract a JSON array from Claude's response text."""
    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    start = response_text.find("[")
    end = response_text.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(response_text[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None


def _validate_action(action):
    """Validate and clean content fields in an action."""
    issues = []
    action_type = action.get("action_type", "")

    content_fields = {
        "blog_post": [("body_content", "blog_post"), ("title", "gbp_post"), ("meta_description", "gbp_post")],
        "newsjack_post": [("body_content", "newsjack_post"), ("title", "gbp_post"), ("meta_description", "gbp_post")],
        "page_edit": [],
        "schema_update": [],
    }

    for field, vtype in content_fields.get(action_type, []):
        text = action.get(field, "")
        if text:
            cleaned, field_issues = validate_content(text, vtype)
            action[field] = cleaned
            issues.extend(field_issues)

    return action, issues
