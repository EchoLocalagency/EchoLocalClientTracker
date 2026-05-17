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

# Title patterns that scream AI slop
AI_TITLE_PATTERNS = [
    r"here'?s what .* should know",
    r"here'?s what you need to know",
    r"what .* need to know",
    r"everything you .* know",
    r"the ultimate guide",
    r"a comprehensive guide",
    r"why .* matters more than",
    r"the surprising truth about",
    r"you won'?t believe",
    r"\d+ things .* didn'?t know",
    r"\d+ reasons why",
    r"are spiking",
    r"are surging",
    r"are on the rise",
    r"is trending",
    r"is booming",
    r"searches are",
    r"what every .* should",
    r"what homeowners should",
    r"the complete guide to",
    r"a deep dive into",
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


def check_ai_title(title):
    """Check if a title matches AI slop patterns. Returns list of matched patterns."""
    lower = title.lower()
    found = []
    for pattern in AI_TITLE_PATTERNS:
        if re.search(pattern, lower):
            found.append(pattern)
    return found


def check_experience_signals(html):
    """Check if content has real experience signals, not generic filler.

    Looks for: specific numbers (PSI, sq ft, dollars, time),
    neighborhood/street names, first person plural (we/our),
    and technical details.

    Returns (signal_count, issues)
    """
    text = re.sub(r"<[^>]+>", " ", html).lower()
    signals = 0
    details = []

    # Numbers with units (PSI, sq ft, degrees, dollars, hours, minutes)
    if re.search(r"\d+\s*(psi|sq\s*ft|square\s*feet|degrees|gallons|\$|hours?|minutes?|feet|inches|yards?|pounds?|lbs)", text):
        signals += 1
        details.append("has measurements/specs")

    # First person plural
    if re.search(r"\b(we |we'|our |our\b)", text):
        signals += 1
        details.append("first person voice")

    # Specific street/neighborhood/landmark references (proper nouns after "in/near/at")
    if re.search(r"\b(in|near|at|off|along)\s+[A-Z][a-z]+\s+[A-Z]", html):
        signals += 1
        details.append("location reference")

    # Price ranges or cost mentions
    if re.search(r"\$\d+|\d+\s*(per|a)\s*(sq|square|foot|yard|hour|visit)", text):
        signals += 1
        details.append("pricing detail")

    # Job-specific details (last month, last week, on a job, on site, customer, client, homeowner called)
    if re.search(r"(last (month|week|year)|on a job|on site|one (customer|client|homeowner)|pulled up|showed up|we (cleaned|washed|finished|completed|installed))", text):
        signals += 1
        details.append("job reference")

    issues = []
    if signals < 3:
        issues.append(f"Only {signals} experience signals found ({', '.join(details) if details else 'none'}). Need at least 3: measurements, first person, location, pricing, or job references.")

    return signals, issues


def check_min_length(text, content_type):
    """Check if text meets minimum length for its type."""
    min_len = MIN_LENGTHS.get(content_type, 50)
    return len(text) >= min_len, min_len


def check_answer_capsule(html):
    """Verify the first content block after the first H2 is a 40-60 word answer capsule.

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

    if word_count < 40:
        issues.append(f"Answer capsule too short: {word_count} words (min 40)")
        return False, issues
    elif word_count > 60:
        issues.append(f"Answer capsule too long: {word_count} words (max 60)")
        return False, issues

    return len(issues) == 0, issues


def check_image_alt_texts(html, target_keywords=None):
    """Check that images have descriptive alt text, optionally containing target keywords.

    Returns (issues_list). Empty = all good.
    """
    issues = []
    images = re.findall(r'<img[^>]*>', html, re.IGNORECASE)

    for img in images:
        # Check for alt attribute
        alt_match = re.search(r'alt=["\']([^"\']*)["\']', img, re.IGNORECASE)
        src_match = re.search(r'src=["\']([^"\']*)["\']', img, re.IGNORECASE)
        src = src_match.group(1) if src_match else "unknown"

        if not alt_match:
            issues.append(f"Image missing alt text: {src}")
        elif not alt_match.group(1).strip():
            issues.append(f"Image has empty alt text: {src}")
        elif len(alt_match.group(1)) < 10:
            issues.append(f"Image alt text too short ({len(alt_match.group(1))} chars): {src}")

    return issues


# All client domains -- used to detect cross-client contamination
CLIENT_DOMAINS = {
    "mr-green-turf-clean": "mrgreenturfclean.com",
    "integrity-pro-washers": "integrityprowashers.com",
    "socal-artificial-turfs": "socalartificialturfs.com",
    "az-turf-cleaning": "azturfcleaningllc.com",
    "echo-local": "echolocalagency.com",
}

CLIENT_NAMES = {
    "mr-green-turf-clean": ["mr green turf clean", "mr. green turf clean", "mrgreenturfclean", "james peck", "jamespeck"],
    "integrity-pro-washers": ["integrity pro washers", "integrity pro", "integrityprowashers", "josh schauert"],
    "socal-artificial-turfs": ["socal artificial turfs", "socalartificialturfs"],
    "az-turf-cleaning": ["az turf cleaning", "azturfcleaning"],
    "echo-local": ["echo local", "echolocal"],
}


def check_cross_client_contamination(text, target_client_slug):
    """Check if content intended for one client contains references to another client.

    This catches the template reuse bug where blog posts or location pages
    generated for one client accidentally contain another client's domain,
    canonical URL, author name, or business name.

    Returns list of issues. Empty = clean.
    """
    issues = []
    lower = text.lower()

    for slug, domain in CLIENT_DOMAINS.items():
        if slug == target_client_slug:
            continue
        if domain.lower() in lower:
            issues.append(f"CROSS-CLIENT: Found '{domain}' in content meant for {target_client_slug}")

    for slug, names in CLIENT_NAMES.items():
        if slug == target_client_slug:
            continue
        for name in names:
            if name in lower:
                issues.append(f"CROSS-CLIENT: Found '{name}' in content meant for {target_client_slug}")
                break

    return issues


def validate_content(text, content_type, client_slug=None):
    """Run all validations. Returns (cleaned_text, issues).

    Issues is a list of strings. If empty, content is good to publish.
    """
    issues = []

    # Cross-client contamination check (CRITICAL -- blocks publishing)
    if client_slug:
        cross_issues = check_cross_client_contamination(text, client_slug)
        if cross_issues:
            issues.extend(cross_issues)
            # This is critical enough to return immediately -- don't publish contaminated content
            return text, issues

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

    # Check experience signals for long-form content
    if content_type in ("blog_post", "newsjack_post", "aeo_blog_post", "location_page"):
        _, signal_issues = check_experience_signals(cleaned)
        issues.extend(signal_issues)

    # Check image alt texts (warnings, non-blocking)
    if content_type in ("blog_post", "location_page", "newsjack_post"):
        alt_issues = check_image_alt_texts(cleaned)
        for issue in alt_issues:
            print(f"  [content_validator] WARNING: {issue}")

    return cleaned, issues


def validate_title(title):
    """Validate a blog/page title for AI slop patterns. Returns (title, issues)."""
    issues = []
    slop_patterns = check_ai_title(title)
    if slop_patterns:
        issues.append(f"AI slop title pattern: {', '.join(slop_patterns)}")
    return title, issues


def validate_gbp_post(text):
    """Validate GBP post text doesn't contain phone numbers, URLs, or review solicitation.

    Google rejects posts with phone numbers or URLs in the text body -- use CTA buttons only.
    Review solicitation in posts violates GBP policy and can trigger suspension.
    Arcadian was suspended 2026-05-16 after a post ended with: "we would appreciate a Google
    review with the area mentioned" -- which also violated the rule against requesting specific
    review content.

    Args:
        text: The GBP post text

    Returns:
        (cleaned_text, issues) -- issues is a list of strings
    """
    issues = []

    # Check for URLs
    if re.search(r"https?://|www\.", text, re.IGNORECASE):
        issues.append("GBP post contains URL (use cta_url instead)")

    # Check for phone numbers
    phone_patterns = [
        r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
        r"\+1\d{10}",
    ]
    for pattern in phone_patterns:
        if re.search(pattern, text):
            issues.append("GBP post contains phone number (Google rejects these in post text)")
            break

    # Check for review solicitation -- GBP posts cannot be used to ask for reviews,
    # and asking for specific review content (e.g. "mention the area") is a separate violation
    review_patterns = [
        r"(leave|write|drop|post|give)\s+(us\s+)?(a\s+)?(google\s+)?(review|rating|star)",
        r"google\s+review",
        r"appreciate\s+a\s+review",
        r"(we('d| would))\s+appreciate",
        r"review\s+(us|our\s+business|our\s+work|our\s+service)",
        r"(share|post)\s+(your\s+)?(experience|feedback)\s+on\s+google",
    ]
    for pattern in review_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            issues.append("GBP post contains review solicitation (not allowed in posts -- violates GBP policy and can trigger suspension)")
            break

    return text, issues


def validate_gbp_description(text):
    """Validate GBP business description text.

    Args:
        text: The business description

    Returns:
        (cleaned_text, issues) -- issues is a list of strings
    """
    issues = []

    if len(text) > 750:
        text = text[:750]
        issues.append("Description truncated to 750 chars")

    if re.search(r"https?://|www\.", text, re.IGNORECASE):
        issues.append("Description contains URL (not allowed)")

    phone_patterns = [
        r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
        r"\+1\d{10}",
    ]
    for pattern in phone_patterns:
        if re.search(pattern, text):
            issues.append("Description contains phone number (not allowed)")
            break

    if re.search(r"\$\d+|% off|free estimate|discount|coupon|promo", text, re.IGNORECASE):
        issues.append("Description contains prices or promotions (not allowed)")

    return text, issues


def clean_content(text):
    """Quick clean without validation -- just strip em dashes and emojis."""
    return strip_emojis(strip_em_dashes(text))
