"""
Content Validator
=================
Runs on every piece of content before publishing.
Strips AI tells, em dashes, emojis, and checks minimum length.
"""

import re
import unicodedata
from html.parser import HTMLParser


# Phrases that scream "AI wrote this"
AI_TELLS = [
    "i'd be happy to",
    "in conclusion",
    "it's worth noting",
    "at the end of the day",
    "let's dive in",
    "dive into",
    "here's the thing",
    "in today's world",
    "when it comes to",
    "without further ado",
    "game-changer",
    "game changer",
    "look no further",
    "whether you're a",
    "in this article",
    "rest assured",
    "buckle up",
    "navigating the",
    "straightforward",
    "it's important to note",
    "it is important to note",
    "furthermore",
    "moreover",
    "in summary",
    "to sum up",
    "all in all",
    "at the end of the day",
    "the bottom line is",
    "needless to say",
    "as a matter of fact",
    "as we all know",
    "interestingly enough",
    "comprehensive guide",
    "ultimate guide",
    "everything you need to know",
]

# Minimum character counts by content type
MIN_LENGTHS = {
    "gbp_post": 100,
    "blog_post": 2000,
    "newsjack_post": 1500,
    "location_page": 1500,
    "page_edit": 50,
    "gbp_qanda_question": 20,
    "gbp_qanda_answer": 50,
    "aeo_blog_post": 2000,
}


def strip_em_dashes(text):
    """Replace em dashes with commas or hyphens."""
    # U+2014 em dash, U+2013 en dash
    text = text.replace("\u2014", " - ")
    text = text.replace("\u2013", "-")
    return text


def strip_emojis(text):
    """Remove emoji characters."""
    return "".join(
        c for c in text
        if unicodedata.category(c) not in ("So", "Sk")
        or c in ("-", "'", '"', "/", "\\")
    )


def check_ai_tells(text):
    """Return list of AI tell phrases found in text."""
    lower = text.lower()
    found = []
    for tell in AI_TELLS:
        if tell in lower:
            found.append(tell)
    return found


def check_min_length(text, content_type):
    """Check if text meets minimum length for its type."""
    min_len = MIN_LENGTHS.get(content_type, 50)
    return len(text) >= min_len, min_len


def check_answer_capsule(html):
    """Verify the first content block after the first H2 is a 50-150 word answer capsule.

    An answer capsule is a self-contained paragraph that directly answers the target query.
    It should have no links inside it.

    Args:
        html: HTML body content string

    Returns:
        (has_capsule, issues) -- has_capsule is True if valid capsule found
    """
    issues = []

    # Find first H2 and the content immediately after it
    h2_match = re.search(r"</h2>", html, re.IGNORECASE)
    if not h2_match:
        issues.append("No H2 heading found -- answer capsule requires an H2 first")
        return False, issues

    after_h2 = html[h2_match.end():]

    # Extract the first paragraph or text block after the H2
    p_match = re.search(r"<p[^>]*>(.*?)</p>", after_h2, re.DOTALL | re.IGNORECASE)
    if not p_match:
        issues.append("No paragraph found after first H2 -- answer capsule should be the first <p> after H2")
        return False, issues

    capsule_html = p_match.group(1)

    # Check for links inside the capsule
    if re.search(r"<a\s", capsule_html, re.IGNORECASE):
        issues.append("Answer capsule contains links -- capsule should be self-contained with no links")

    # Strip HTML tags and count words
    capsule_text = re.sub(r"<[^>]+>", "", capsule_html).strip()
    word_count = len(capsule_text.split())

    if word_count < 50:
        issues.append(f"Answer capsule too short: {word_count} words (min 50)")
        return False, issues
    elif word_count > 150:
        issues.append(f"Answer capsule too long: {word_count} words (max 150)")
        return False, issues

    return len(issues) == 0, issues


def validate_content(text, content_type):
    """Run all validations. Returns (cleaned_text, issues).

    Issues is a list of strings. If empty, content is good to publish.
    """
    issues = []

    # Strip em dashes
    cleaned = strip_em_dashes(text)

    # Strip emojis
    cleaned = strip_emojis(cleaned)

    # Check AI tells
    tells_found = check_ai_tells(cleaned)
    if tells_found:
        issues.append(f"AI tells found: {', '.join(tells_found)}")

    # Check minimum length
    meets_min, min_len = check_min_length(cleaned, content_type)
    if not meets_min:
        issues.append(f"Content too short: {len(cleaned)} chars (min {min_len} for {content_type})")

    # Check answer capsule for blog and newsjack posts
    if content_type in ("blog_post", "newsjack_post", "aeo_blog_post"):
        has_capsule, capsule_issues = check_answer_capsule(cleaned)
        if not has_capsule:
            issues.extend(capsule_issues)

    return cleaned, issues


def clean_content(text):
    """Quick clean without validation -- just strip em dashes and emojis."""
    return strip_emojis(strip_em_dashes(text))
