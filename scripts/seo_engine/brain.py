"""
Brain
=====
Builds a prompt from performance data + action history + outcome patterns,
calls `claude -p` via subprocess, and parses the JSON response.

Claude is the brain, not the orchestrator. This module treats it as one
function call in the pipeline.
"""

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

from .content_validator import validate_content
from .outcome_logger import log_brain_decision


def _build_prompt(client_config, performance_data, keyword_rankings,
                  gbp_keywords, gsc_queries, page_inventory,
                  action_history, outcome_patterns, recent_keywords,
                  week_counts, research_data=None, photo_manifest=None,
                  schema_audit=None, clusters=None, cluster_gaps=None,
                  gbp_candidates=None, service_areas=None,
                  existing_area_pages=None, keyword_opportunities=None,
                  aeo_opportunities=None):
    """Build the full prompt string for Claude."""

    name = client_config["name"]
    slug = client_config["slug"]
    market = client_config.get("primary_market", "San Diego, CA")
    website = client_config.get("website", "")
    target_kws = client_config.get("target_keywords", [])

    # ── Section 1: Identity ──
    prompt = f"""You are the SEO strategist for {name}, a local service business in {market}.
Website: {website}
Today: {date.today()}

Your job: analyze the data below and return a JSON array of SEO actions to take this cycle.

"""

    # ── Section 2: Performance snapshot ──
    ga4 = performance_data.get("ga4", {})
    gsc = performance_data.get("gsc", {})
    gbp = performance_data.get("gbp", {})

    prompt += f"""CURRENT PERFORMANCE (14-day window):
  GA4: {ga4.get('sessions', 0)} sessions ({ga4.get('organic', 0)} organic) | {ga4.get('phone_clicks', 0)} calls, {ga4.get('form_submits', 0)} forms
  GSC: {gsc.get('impressions', 0)} impressions, {gsc.get('clicks', 0)} clicks, avg pos {gsc.get('avg_position', 0)}
"""
    if gbp:
        prompt += f"  GBP: {gbp.get('total_impressions', 0)} impressions (maps: {gbp.get('maps_impressions', 0)}, search: {gbp.get('search_impressions', 0)}) | {gbp.get('website_clicks', 0)} website clicks, {gbp.get('call_clicks', 0)} calls\n"
    prompt += "\n"

    # ── Section 3: Target keyword rankings (merged GSC organic + SERP actual) ──
    if keyword_rankings:
        # Build SERP lookup from research data to fill gaps in GSC data
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
        prompt += f"  {'Keyword':<45} {'Organic':<10} {'SERP':<8} {'Impressions':<12} {'Clicks':<8} {'Status'}\n"
        prompt += f"  {'-'*105}\n"
        for kw in keyword_rankings:
            organic_pos = f"{kw['position']:.1f}" if kw.get("position") else "--"
            serp_pos = serp_lookup.get(kw["keyword"].lower())
            serp_str = f"#{serp_pos}" if serp_pos else "--"

            # Determine true status: if SERP shows we rank, that overrides GSC "not ranking"
            status = kw.get("status", "")
            if status == "not ranking" and serp_pos:
                if serp_pos <= 3:
                    status = f"SERP #{serp_pos} (dominating)"
                elif serp_pos <= 10:
                    status = f"SERP #{serp_pos} (page 1)"
                else:
                    status = f"SERP #{serp_pos}"

            prompt += f"  {kw['keyword']:<45} {organic_pos:<10} {serp_str:<8} {kw.get('impressions', 0):<12} {kw.get('clicks', 0):<8} {status}\n"
        prompt += "  Note: 'Organic' = GSC website ranking. 'SERP' = actual Google search position (includes map pack). Low organic impressions with high SERP rank = low search volume but you own it.\n"
        prompt += "\n"

    # ── Section 4: GSC top queries ──
    if gsc_queries:
        prompt += "TOP GSC QUERIES (by impressions):\n"
        for q in gsc_queries[:15]:
            prompt += f"  {q['query']:<45} pos {q.get('position', 0):.1f}  {q.get('impressions', 0)} impr  {q.get('clicks', 0)} clicks\n"
        prompt += "\n"

    # ── Section 5: GBP search keywords ──
    if gbp_keywords:
        prompt += "GBP SEARCH KEYWORDS (what people search on Maps):\n"
        for kw in gbp_keywords[:10]:
            prompt += f"  {kw['keyword']}: {kw['impressions']} impressions\n"
        prompt += "\n"

    # ── Section 6: Page inventory (with schema audit) ──
    if page_inventory:
        # Build schema lookup from audit
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

    # ── Section 7: Research data (if available) ──
    if research_data:
        prompt += "MARKET RESEARCH (updated Saturday):\n"
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

        news = research_data.get("trending_news", [])
        if news:
            # Only show news that has some keyword relevance to the client
            kw_words = set()
            for kw in target_kws:
                kw_words.update(kw.lower().split())
            kw_words.discard("")
            # Filter: title or description must contain at least one keyword word > 3 chars
            relevant_news = []
            for n in news:
                title_lower = (n.get("title", "") + " " + n.get("description", "")).lower()
                hits = [w for w in kw_words if w in title_lower and len(w) > 3]
                if hits:
                    relevant_news.append(n)
            if relevant_news:
                prompt += "  Trending news hooks (relevant to your keywords):\n"
                for n in relevant_news[:3]:
                    prompt += f"    - {n.get('title', '')} ({n.get('source', '')})\n"

        # Newsjack alerts (high-urgency trends/news matching target keywords)
        newsjack = research_data.get("newsjack_alerts", [])
        high_urgency = [a for a in newsjack if a.get("urgency_score", 0) >= 7]
        if high_urgency:
            prompt += "  NEWSJACK ALERTS (urgency >= 7 -- consider a newsjack_post):\n"
            for alert in high_urgency[:5]:
                if alert.get("type") == "news":
                    prompt += f"    [NEWS urgency:{alert['urgency_score']}] {alert.get('title', '')} ({alert.get('source', '')})\n"
                else:
                    prompt += f"    [TREND urgency:{alert['urgency_score']}] \"{alert.get('query', '')}\" - {alert.get('reason', '')}\n"

        prompt += "\n"

    # ── Section 8: Action history with outcomes ──
    if action_history:
        prompt += "RECENT ACTIONS (last 90 days):\n"
        for a in action_history[:20]:
            score = a.get("impact_score")
            score_str = f"impact: {score:+.1f}" if score is not None else "measuring..."
            prompt += f"  [{a['action_date']}] {a['action_type']}: {a['description'][:60]} ({score_str})\n"
        prompt += "\n"

    # ── Section 9: Outcome patterns ──
    if outcome_patterns and outcome_patterns.get("patterns"):
        prompt += "OUTCOME PATTERNS (what works):\n"
        for p in outcome_patterns["patterns"]:
            prompt += f"  {p['action_type']}: avg impact {p['avg_impact']:+.1f} ({p['positive_count']}/{p['total_actions']} positive)\n"
        prompt += "\n"
    elif outcome_patterns and outcome_patterns.get("summary"):
        prompt += f"OUTCOME PATTERNS: {outcome_patterns['summary']}\n\n"

    # ── Section 10: Rate limits remaining ──
    limits = {
        "gbp_post": 3,
        "gbp_qanda": 2,
        "blog_post": 2,
        "page_edit": 1,
        "location_page": 1,
        "gbp_photo": 3,
        "schema_update": 2,
        "newsjack_post": 1,
    }
    prompt += "WEEKLY RATE LIMITS (remaining this week):\n"
    for action_type, max_count in limits.items():
        used = week_counts.get(action_type, 0)
        remaining = max(0, max_count - used)
        prompt += f"  {action_type}: {remaining} remaining (used {used}/{max_count})\n"
    prompt += "\n"

    # ── Section 11: Recent keywords (dedup) ──
    if recent_keywords:
        prompt += "RECENTLY TARGETED (do NOT repeat within 14 days):\n"
        for rk in recent_keywords:
            prompt += f"  {rk['action_type']}: {rk['keyword']}\n"
        prompt += "\n"

    # ── Section 12: Available photos ──
    if photo_manifest:
        prompt += "AVAILABLE PHOTOS (use in blog posts via <img src=\"images/FILENAME\" alt=\"...\">):\n"
        for photo in photo_manifest:
            alt_hint = f" | alt hint: \"{photo.get('alt_text_hint', '')}\"" if photo.get("alt_text_hint") else ""
            gbp_status = " [GBP: uploaded]" if photo.get("gbp_uploaded") else ""
            prompt += f"  {photo['filename']} ({photo['context']}){alt_hint}{gbp_status}\n"
        prompt += "\n"

    # GBP photo upload candidates (not yet on Google Business Profile)
    if gbp_candidates:
        prompt += "GBP PHOTO UPLOAD CANDIDATES (not yet uploaded to Google Business Profile):\n"
        for c in gbp_candidates:
            prompt += f"  {c['filename']} ({c.get('context', 'general')}) | alt: {c.get('alt_text_hint', '')}\n"
        prompt += "  Use action_type 'gbp_photo' to upload 2-3 of these per cycle.\n\n"

    # ── Section 16: Keyword opportunities (discovered, not in target list) ──
    if keyword_opportunities:
        gsc_opps = [o for o in keyword_opportunities if o.get("source") == "gsc"]
        brave_opps = [o for o in keyword_opportunities if o.get("source") != "gsc"]

        prompt += "KEYWORD OPPORTUNITIES (not in your target list yet -- consider targeting these):\n"
        if gsc_opps:
            prompt += "  From GSC (you already rank for these, just need dedicated content):\n"
            for o in gsc_opps[:10]:
                prompt += f"    \"{o['keyword']}\" pos:{o.get('position','?')} impr:{o.get('impressions',0)} -- {o.get('reason','')}\n"
        if brave_opps:
            prompt += "  From related searches (real user queries you could rank for):\n"
            for o in brave_opps[:10]:
                prompt += f"    \"{o['keyword']}\" -- {o.get('reason','')}\n"
        prompt += "  You MAY target these in blog posts, location pages, or GBP content. They are valid targets.\n\n"

    # ── Section 17: AEO opportunities ──
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

    # ── Section 14: Content clusters ──
    if clusters or cluster_gaps:
        prompt += "CONTENT CLUSTERS (topic silos -- plan posts as part of clusters, not random topics):\n"
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

    # ── Section 15: Service area page candidates ──
    if service_areas:
        covered = set()
        if existing_area_pages:
            # Normalize existing page slugs for comparison
            covered = set(p.lower().replace("-", " ") for p in existing_area_pages)

        uncovered = [a for a in service_areas if a.lower() not in covered]
        if uncovered:
            prompt += "AREA PAGE CANDIDATES (neighborhoods without dedicated pages):\n"
            for area in uncovered:
                prompt += f"  {area}\n"
            prompt += "  Roll out 1 location_page per week, pick based on keyword data and search volume.\n\n"

    # ── Section 13: Rules ──
    prompt += """RULES (follow exactly):
1. Return ONLY a JSON array of action objects. No other text.
2. Each action must have: action_type, target_keywords (array), priority (1-5, 1=highest), reasoning (1 sentence), and type-specific content fields.
3. Action types: gbp_post, gbp_qanda, blog_post, page_edit, location_page, gbp_photo, schema_update, newsjack_post
4. Content style: no em dashes (use commas or hyphens), no emojis, no AI tells ("dive in", "comprehensive guide", "everything you need to know", "in conclusion", "game-changer", etc.)
5. Do NOT target the same keyword with the same action type if it appears in RECENTLY TARGETED.
6. Do NOT exceed the remaining weekly rate limits shown above. If a type shows 0 remaining, do not propose that type.
7. Prioritize striking-distance keywords (position 5-20) -- these have the highest ROI.
8. Never edit index.html (homepage is off-limits).
9. GBP posts must include a call_to_action URL and be 100-300 words.
10. Blog posts must include: title, slug, meta_description (under 160 chars), and body_content (2000+ chars of HTML).
11. Location pages must include: city, slug, title, meta_description, and body_content (1500+ chars of HTML).
12. Page edits must include: filename (from EXISTING PAGES), and an array of edits with old_text/new_text pairs.
13. Q&A pairs must include: question and answer (natural language, not salesy).
14. Write content from the business's perspective. Use "we", "our team", the business name. Sound human.
15. For blog posts and location pages, write the full HTML body content (everything that goes inside the main content area). Include proper heading hierarchy (H2, H3), paragraphs, and internal links where relevant.
16. If AVAILABLE PHOTOS are listed, include 1-3 relevant photos in blog posts using <img src="images/FILENAME" alt="descriptive alt text"> tags. Place images between sections for visual flow. Write descriptive alt text with target keywords where natural. Do not use every photo -- pick the most relevant ones.
17. gbp_photo actions must include: filename (from GBP UPLOAD CANDIDATES), category (AT_WORK, EXTERIOR, INTERIOR, or PRODUCT), and description. Pick 2-3 photos per cycle that showcase recent work.
18. schema_update actions must include: filename (from EXISTING PAGES), schema_type (faq, local_business, or service). For faq: include qa_pairs array. For service: include service_name, description, area_served. Prioritize pages showing "schemas: NONE".
19. newsjack_post: same fields as blog_post but must be inspired by a NEWSJACK ALERT. Only propose when urgency >= 7. Does NOT count against blog_post limit.
20. Content clusters: if clusters are listed above, every blog_post MUST specify a cluster_name field matching an existing cluster. Prioritize filling gap topics over creating random content. If no clusters are listed, you may omit cluster_name.
21. Location pages: pick neighborhoods from AREA PAGE CANDIDATES. Each page must include local references. Roll out max 1 per week.
22. Location page content must mention specific local landmarks, cross-streets, or nearby areas for that neighborhood. Include photos from jobs in that area if available.
23. Schema priorities: services.html and area pages with "schemas: NONE" should get schema_update actions before other action types.
24. When NEWSJACK ALERTS show urgency >= 7, seriously consider a newsjack_post. These are time-sensitive.
25. Blog posts should link to relevant existing pages (services, area pages) using relative paths.
26. Target hyperlocal neighborhoods and niche keywords, not broad city terms. Dominate small ponds first.
27. AEO (Answer Engine Optimization): Every blog post MUST start with a 50-150 word "answer capsule" after the first H2 -- a self-contained answer to the target query. No links inside the capsule. This is what AI engines will cite.
28. Use question-format H2s where natural (e.g. "How much does turf cleaning cost in San Diego?"). This maps directly to how people query AI assistants.
29. Include comparison tables for "X vs Y" queries (e.g. "Artificial Turf vs Natural Grass Maintenance"). Tables get pulled into AI Overviews.
30. Add "Last updated: {date}" visible text near the top of blog content. Freshness signals matter for AI citation.
31. Keep paragraphs short (1 idea each). Use descriptive headings. For how-to content, use numbered steps. AI engines prefer scannable, structured content.
32. If AEO OPPORTUNITIES are listed above, prioritize creating content that directly answers those question queries. Use the exact question as an H2 heading.

OUTPUT FORMAT:
[
  {
    "action_type": "gbp_post",
    "target_keywords": ["turf cleaning poway"],
    "priority": 1,
    "reasoning": "Striking distance keyword at position 8, GBP post will reinforce local relevance.",
    "summary": "The full post text goes here...",
    "cta_url": "https://mrgreenturfclean.com/services.html"
  },
  {
    "action_type": "blog_post",
    "target_keywords": ["artificial turf cleaning san diego"],
    "cluster_name": "Turf Care Guide",
    "priority": 2,
    "reasoning": "High-impression keyword needs supporting content.",
    "title": "How to Keep Your Artificial Turf Clean in San Diego",
    "slug": "how-to-keep-artificial-turf-clean-san-diego",
    "meta_description": "Learn the best methods for artificial turf cleaning in San Diego...",
    "body_content": "<h2>Why Artificial Turf Needs Regular Cleaning</h2><p>...</p>"
  },
  {
    "action_type": "gbp_photo",
    "target_keywords": ["pressure washing san diego"],
    "priority": 2,
    "reasoning": "Fresh job photos boost GBP engagement and local relevance.",
    "filename": "north-park-driveway-clean.jpg",
    "drive_id": "DRIVE_FILE_ID",
    "category": "AT_WORK",
    "description": "Driveway pressure washing completed in North Park, San Diego"
  },
  {
    "action_type": "schema_update",
    "target_keywords": ["pressure washing san diego"],
    "priority": 1,
    "reasoning": "services.html has zero schema markup -- critical gap.",
    "filename": "services.html",
    "schema_type": "faq",
    "qa_pairs": [
      {"question": "How much does pressure washing cost in San Diego?", "answer": "Our pressure washing services start at..."}
    ]
  },
  {
    "action_type": "newsjack_post",
    "target_keywords": ["turf cleaning san diego"],
    "cluster_name": "Turf Care Guide",
    "priority": 1,
    "reasoning": "Trending news about artificial turf bans -- timely content opportunity.",
    "title": "What San Diego Turf Owners Need to Know About the New HOA Rules",
    "slug": "san-diego-turf-hoa-rules-2026",
    "meta_description": "New HOA rules affecting artificial turf owners in San Diego...",
    "body_content": "<h2>Breaking Down the New Rules</h2><p>...</p>"
  },
  {
    "action_type": "location_page",
    "target_keywords": ["turf cleaning rancho bernardo"],
    "priority": 5,
    "reasoning": "No dedicated page for this service area yet.",
    "city": "Rancho Bernardo",
    "slug": "turf-cleaning-rancho-bernardo",
    "title": "Turf Cleaning in Rancho Bernardo | Mr. Green Turf Clean",
    "meta_description": "Professional artificial turf cleaning in Rancho Bernardo...",
    "body_content": "<h2>Turf Cleaning Services in Rancho Bernardo</h2><p>...</p>"
  }
]
"""

    return prompt


def call_brain(client_config, performance_data, keyword_rankings, gbp_keywords,
               gsc_queries, page_inventory, action_history, outcome_patterns,
               recent_keywords, week_counts, research_data=None,
               photo_manifest=None, schema_audit=None, clusters=None,
               cluster_gaps=None, gbp_candidates=None, service_areas=None,
               existing_area_pages=None, keyword_opportunities=None,
               aeo_opportunities=None, dry_run=True):
    """Build prompt, call claude -p, parse response, return actions."""

    prompt = _build_prompt(
        client_config, performance_data, keyword_rankings, gbp_keywords,
        gsc_queries, page_inventory, action_history, outcome_patterns,
        recent_keywords, week_counts, research_data, photo_manifest,
        schema_audit, clusters, cluster_gaps, gbp_candidates,
        service_areas, existing_area_pages, keyword_opportunities,
        aeo_opportunities,
    )

    print(f"  [brain] Prompt built ({len(prompt)} chars). Calling Claude...")

    if dry_run:
        # Save prompt to file so you can inspect it
        dump_path = Path("/Users/brianegan/EchoLocalClientTracker/reports") / "last_brain_prompt.txt"
        dump_path.parent.mkdir(parents=True, exist_ok=True)
        dump_path.write_text(prompt)
        print(f"  [brain] DRY RUN -- prompt saved to {dump_path}")
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
            print(f"  [brain] Claude CLI error: {result.stderr[:200]}")
            return []

        raw_response = result.stdout.strip()

        # Parse the claude CLI JSON output to get the actual result text
        try:
            cli_output = json.loads(raw_response)
            # claude --output-format json returns {"result": "...", ...}
            response_text = cli_output.get("result", raw_response)
        except json.JSONDecodeError:
            response_text = raw_response

    except subprocess.TimeoutExpired:
        print(f"  [brain] Claude CLI timed out (300s)")
        return []
    except FileNotFoundError:
        print(f"  [brain] 'claude' CLI not found in PATH")
        return []

    # Extract JSON array from response
    actions = _parse_actions(response_text)

    if actions is None:
        print(f"  [brain] Failed to parse actions from response")
        actions = []

    # Validate content in each action
    validated_actions = []
    for action in actions:
        action, issues = _validate_action(action)
        if issues:
            print(f"  [brain] Validation issues for {action.get('action_type', '?')}: {', '.join(issues)}")
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

    print(f"  [brain] Returned {len(validated_actions)} actions")
    return validated_actions


def _parse_actions(response_text):
    """Extract a JSON array from Claude's response text."""
    # Try direct parse first
    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Try to find JSON array in the text
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

    # Map action type to content fields and validation types
    content_fields = {
        "gbp_post": [("summary", "gbp_post")],
        "blog_post": [("body_content", "blog_post"), ("title", "gbp_post"), ("meta_description", "gbp_post")],
        "newsjack_post": [("body_content", "newsjack_post"), ("title", "gbp_post"), ("meta_description", "gbp_post")],
        "location_page": [("body_content", "location_page"), ("title", "gbp_post"), ("meta_description", "gbp_post")],
        "page_edit": [],
        "gbp_qanda": [("question", "gbp_qanda_question"), ("answer", "gbp_qanda_answer")],
        "gbp_photo": [],
        "schema_update": [],
    }

    for field, vtype in content_fields.get(action_type, []):
        text = action.get(field, "")
        if text:
            cleaned, field_issues = validate_content(text, vtype)
            action[field] = cleaned
            issues.extend(field_issues)

    return action, issues
