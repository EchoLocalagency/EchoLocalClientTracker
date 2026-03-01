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

from .content_validator import validate_content
from .outcome_logger import log_brain_decision


def _build_prompt(client_config, performance_data, keyword_rankings,
                  gbp_keywords, gsc_queries, page_inventory,
                  action_history, outcome_patterns, recent_keywords,
                  week_counts, research_data=None):
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

    # ── Section 3: Target keyword rankings ──
    if keyword_rankings:
        prompt += "TARGET KEYWORD RANKINGS:\n"
        prompt += f"  {'Keyword':<45} {'Position':<10} {'Impressions':<12} {'Clicks':<8} {'Status'}\n"
        prompt += f"  {'-'*95}\n"
        for kw in keyword_rankings:
            pos = f"{kw['position']:.1f}" if kw.get("position") else "--"
            prompt += f"  {kw['keyword']:<45} {pos:<10} {kw.get('impressions', 0):<12} {kw.get('clicks', 0):<8} {kw.get('status', '')}\n"
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

    # ── Section 6: Page inventory ──
    if page_inventory:
        prompt += "EXISTING PAGES:\n"
        for p in page_inventory:
            prompt += f"  {p['filename']}: {p.get('title', '(no title)')}\n"
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
            prompt += "  Trending news hooks:\n"
            for n in news[:3]:
                prompt += f"    - {n.get('title', '')} ({n.get('source', '')})\n"
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

    # ── Section 12: Rules ──
    prompt += """RULES (follow exactly):
1. Return ONLY a JSON array of action objects. No other text.
2. Each action must have: action_type, target_keywords (array), priority (1-5, 1=highest), reasoning (1 sentence), and type-specific content fields.
3. Action types: gbp_post, gbp_qanda, blog_post, page_edit, location_page
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
    "priority": 2,
    "reasoning": "High-impression keyword needs supporting content.",
    "title": "How to Keep Your Artificial Turf Clean in San Diego",
    "slug": "how-to-keep-artificial-turf-clean-san-diego",
    "meta_description": "Learn the best methods for artificial turf cleaning in San Diego...",
    "body_content": "<h2>Why Artificial Turf Needs Regular Cleaning</h2><p>...</p>"
  },
  {
    "action_type": "gbp_qanda",
    "target_keywords": ["pet turf cleaning"],
    "priority": 3,
    "reasoning": "Common customer question, seeds FAQ with target keyword.",
    "question": "How often should I have my pet turf cleaned?",
    "answer": "We recommend professional pet turf cleaning every 4-6 weeks..."
  },
  {
    "action_type": "page_edit",
    "target_keywords": ["turf cleaning near me"],
    "priority": 4,
    "reasoning": "Adding FAQ section with schema markup to services page.",
    "filename": "services.html",
    "edits": [
      {"old_text": "</main>", "new_text": "<section class='faq'>...</section></main>"}
    ]
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
               recent_keywords, week_counts, research_data=None, dry_run=True):
    """Build prompt, call claude -p, parse response, return actions."""

    prompt = _build_prompt(
        client_config, performance_data, keyword_rankings, gbp_keywords,
        gsc_queries, page_inventory, action_history, outcome_patterns,
        recent_keywords, week_counts, research_data
    )

    print(f"  [brain] Prompt built ({len(prompt)} chars). Calling Claude...")

    if dry_run:
        print(f"  [brain] DRY RUN -- prompt saved but not executed")
        # In dry run, still log the decision with empty response
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
        "location_page": [("body_content", "location_page"), ("title", "gbp_post"), ("meta_description", "gbp_post")],
        "page_edit": [],
        "gbp_qanda": [("question", "gbp_qanda_question"), ("answer", "gbp_qanda_answer")],
    }

    for field, vtype in content_fields.get(action_type, []):
        text = action.get(field, "")
        if text:
            cleaned, field_issues = validate_content(text, vtype)
            action[field] = cleaned
            issues.extend(field_issues)

    return action, issues
