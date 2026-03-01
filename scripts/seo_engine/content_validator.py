"""
Content Validator
=================
Runs on every piece of content before publishing.
Strips AI tells, em dashes, emojis, and checks minimum length.
"""

import re
import unicodedata


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
    "location_page": 1500,
    "page_edit": 50,
    "gbp_qanda_question": 20,
    "gbp_qanda_answer": 50,
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

    return cleaned, issues


def clean_content(text):
    """Quick clean without validation -- just strip em dashes and emojis."""
    return strip_emojis(strip_em_dashes(text))
