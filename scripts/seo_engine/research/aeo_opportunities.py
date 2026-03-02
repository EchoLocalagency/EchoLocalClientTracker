"""
AEO Opportunity Extraction
===========================
Scans GSC top queries for question-format patterns (how, what, why, etc.)
and scores them by AEO potential. Question queries = AI will answer them.

Cross-references with Reddit questions from research cache for validation.
Results cached in research_cache.json under "aeo_opportunities".
"""

import re


# Question patterns that signal AEO-ready queries
QUESTION_PREFIXES = re.compile(
    r"^(how|what|why|when|can|does|is|should|which|where|do|will|are)\b",
    re.IGNORECASE,
)


def extract_aeo_opportunities(gsc_queries, reddit_questions=None, target_keywords=None):
    """Extract question-format queries from GSC data and score by AEO potential.

    Args:
        gsc_queries: List of dicts from GSC (query, impressions, clicks, position)
        reddit_questions: Optional list of Reddit question dicts from research cache
        target_keywords: Optional list of current target keywords for relevance boost

    Returns:
        List of opportunity dicts sorted by AEO potential score
    """
    if not gsc_queries:
        return []

    target_set = set((kw.lower() for kw in target_keywords)) if target_keywords else set()

    # Build Reddit question lookup for cross-referencing
    reddit_lookup = {}
    if reddit_questions:
        for rq in reddit_questions:
            title = rq.get("title", "").lower().strip()
            if title:
                reddit_lookup[title] = rq

    opportunities = []

    for q in gsc_queries:
        query = q.get("query", "").strip()
        if not query:
            continue

        # Only question-format queries
        if not QUESTION_PREFIXES.match(query):
            continue

        impressions = q.get("impressions", 0)
        clicks = q.get("clicks", 0)
        position = q.get("position", 100)

        # Score: striking distance questions with high impressions = gold
        score = _score_aeo_potential(impressions, position)

        # Boost if query overlaps with target keywords
        query_lower = query.lower()
        if any(kw in query_lower or query_lower in kw for kw in target_set):
            score *= 1.5

        # Cross-reference with Reddit
        matching_reddit = _find_reddit_match(query_lower, reddit_lookup)
        if matching_reddit:
            score *= 1.3  # Real users asking = validated demand

        if impressions >= 3:  # lower threshold than keyword_discovery (questions are rarer)
            opp = {
                "query": query,
                "impressions": impressions,
                "clicks": clicks,
                "position": round(position, 1),
                "aeo_score": round(score),
                "category": _classify_question(query),
            }
            if matching_reddit:
                opp["reddit_match"] = {
                    "title": matching_reddit.get("title", ""),
                    "score": matching_reddit.get("score", 0),
                    "subreddit": matching_reddit.get("subreddit", ""),
                }
            opportunities.append(opp)

    opportunities.sort(key=lambda x: x["aeo_score"], reverse=True)
    return opportunities[:30]


def _score_aeo_potential(impressions, position):
    """Score a question query by its AEO potential.

    Striking distance (pos 5-20) with decent impressions = highest priority.
    Already ranking top 3 = defend the position.
    """
    if position <= 3:
        return impressions * 2  # already visible, defend
    elif 3 < position <= 10:
        return impressions * 4  # page 1 but not top -- high ROI
    elif 10 < position <= 20:
        return impressions * 3  # striking distance
    elif 20 < position <= 40:
        return impressions * 1.5  # within reach
    else:
        return impressions * 0.5  # long shot


def _find_reddit_match(query_lower, reddit_lookup):
    """Find a Reddit question that matches the GSC query (fuzzy)."""
    query_words = set(query_lower.split())
    # Need at least 3 meaningful words to match
    meaningful = {w for w in query_words if len(w) > 3}
    if len(meaningful) < 2:
        return None

    for title, rq in reddit_lookup.items():
        title_words = set(title.split())
        overlap = meaningful & title_words
        if len(overlap) >= 2:
            return rq
    return None


def _classify_question(query):
    """Classify a question query into content format categories."""
    q_lower = query.lower()
    if q_lower.startswith("how much") or q_lower.startswith("how long"):
        return "cost_time"
    elif q_lower.startswith("how to") or q_lower.startswith("how do"):
        return "how_to"
    elif q_lower.startswith("what is") or q_lower.startswith("what are"):
        return "definition"
    elif q_lower.startswith("is ") or q_lower.startswith("can ") or q_lower.startswith("does ") or q_lower.startswith("should "):
        return "yes_no"
    elif q_lower.startswith("why"):
        return "explainer"
    elif q_lower.startswith("which") or q_lower.startswith("where"):
        return "comparison"
    else:
        return "general"
