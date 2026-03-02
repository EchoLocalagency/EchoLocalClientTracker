"""
AEO Crawler Check
==================
Verifies that AI crawlers can access client sites by checking robots.txt.
GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and Bingbot need access
for content to get cited in AI Overviews and chatbot answers.

Run standalone:
    python3 -m scripts.seo_engine.research.aeo_crawler_check
"""

import re

import requests


# AI crawlers that need access for AEO
AI_CRAWLERS = [
    "GPTBot",
    "ClaudeBot",
    "PerplexityBot",
    "Google-Extended",
    "Bingbot",
]


def check_crawlers(website_url):
    """Check if AI crawlers are allowed by robots.txt.

    Args:
        website_url: Client website URL (e.g. "https://mrgreenturfclean.com")

    Returns:
        dict with:
            - allowed: list of crawler names that can access the site
            - blocked: list of crawler names blocked by robots.txt
            - no_robots: True if no robots.txt found (all allowed by default)
            - recommendations: list of action items
    """
    url = website_url.rstrip("/")
    robots_url = f"{url}/robots.txt"

    result = {
        "allowed": [],
        "blocked": [],
        "no_robots": False,
        "recommendations": [],
    }

    try:
        resp = requests.get(robots_url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; EchoLocal SEO Engine)",
        })

        if resp.status_code == 404:
            result["no_robots"] = True
            result["allowed"] = list(AI_CRAWLERS)
            return result

        if resp.status_code != 200:
            result["recommendations"].append(
                f"Could not fetch robots.txt (HTTP {resp.status_code}). Verify the file is accessible."
            )
            result["allowed"] = list(AI_CRAWLERS)  # assume allowed if we can't check
            return result

        robots_text = resp.text
        blocked = _parse_blocked_crawlers(robots_text)

        for crawler in AI_CRAWLERS:
            if crawler.lower() in blocked:
                result["blocked"].append(crawler)
            else:
                result["allowed"].append(crawler)

        if result["blocked"]:
            result["recommendations"].append(
                f"Unblock these AI crawlers in robots.txt: {', '.join(result['blocked'])}. "
                "These crawlers index content for AI Overviews, ChatGPT, Perplexity, and Claude."
            )

    except requests.RequestException as e:
        result["recommendations"].append(f"Could not reach {robots_url}: {e}")
        result["allowed"] = list(AI_CRAWLERS)

    return result


def _parse_blocked_crawlers(robots_text):
    """Parse robots.txt and return set of blocked user-agent names (lowercased).

    Looks for patterns like:
        User-agent: GPTBot
        Disallow: /
    """
    blocked = set()
    current_agents = []

    for line in robots_text.splitlines():
        line = line.strip()
        # Skip comments and empty lines
        if not line or line.startswith("#"):
            continue

        ua_match = re.match(r"^user-agent:\s*(.+)$", line, re.IGNORECASE)
        if ua_match:
            current_agents.append(ua_match.group(1).strip().lower())
            continue

        disallow_match = re.match(r"^disallow:\s*/\s*$", line, re.IGNORECASE)
        if disallow_match and current_agents:
            # Disallow: / means full block for the current user-agents
            blocked.update(current_agents)
            continue

        # Any non-UA, non-Disallow line resets the agent list
        if not re.match(r"^(allow|disallow|crawl-delay|sitemap):", line, re.IGNORECASE):
            current_agents = []

    return blocked


def check_all_clients(clients):
    """Check AI crawler access for all clients.

    Args:
        clients: List of client config dicts with "website" key

    Returns:
        dict keyed by client slug with check results
    """
    results = {}
    for client in clients:
        website = client.get("website", "")
        slug = client.get("slug", "unknown")
        if not website:
            continue
        print(f"  [aeo-crawler] Checking {slug}: {website}")
        results[slug] = check_crawlers(website)
        blocked = results[slug]["blocked"]
        if blocked:
            print(f"    BLOCKED: {', '.join(blocked)}")
        else:
            print(f"    All AI crawlers allowed")
    return results


if __name__ == "__main__":
    import json
    from pathlib import Path

    clients_file = Path("/Users/brianegan/EchoLocalClientTracker/clients.json")
    with open(clients_file) as f:
        clients = json.load(f)

    eligible = [c for c in clients if c["slug"] in ("mr-green-turf-clean", "integrity-pro-washers")]
    results = check_all_clients(eligible)

    print("\n--- Results ---")
    for slug, result in results.items():
        print(f"\n{slug}:")
        print(f"  Allowed: {', '.join(result['allowed'])}")
        print(f"  Blocked: {', '.join(result['blocked']) or 'none'}")
        for rec in result.get("recommendations", []):
            print(f"  Recommendation: {rec}")
