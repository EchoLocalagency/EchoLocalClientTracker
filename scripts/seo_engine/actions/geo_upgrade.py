"""
GEO Content Upgrade Action
===========================
Executes geo_content_upgrade actions from the brain.
Applies answer blocks, stats injections, and freshness updates to client pages
using string-level insertion for HTML fidelity.
"""

import os
import re
import subprocess
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

# Pages that must never be auto-edited
PROTECTED_PAGES = {"index.html"}


def execute_geo_upgrade(website_path, filename, upgrades, dry_run=True):
    """Apply GEO content upgrades to a client page.

    Args:
        website_path: Path to the client website root directory
        filename: Target HTML file (relative to website_path)
        upgrades: List of upgrade dicts with type, content, and targeting info
        dry_run: If True, generate but don't write/commit

    Returns:
        Dict with status, upgrades_applied, upgrades_skipped, filename
    """
    if filename in PROTECTED_PAGES:
        return {"status": "blocked", "reason": "protected page"}

    filepath = Path(website_path) / filename
    if not filepath.exists():
        return {"status": "error", "reason": f"File not found: {filename}"}

    html = filepath.read_text()
    original = html
    applied = 0
    skipped = 0

    for upgrade in upgrades:
        upgrade_type = upgrade.get("type", "")
        try:
            if upgrade_type == "answer_block":
                html, ok = _apply_answer_block(html, upgrade)
            elif upgrade_type == "stats_injection":
                html, ok = _apply_stats_injection(html, upgrade)
            elif upgrade_type == "freshness_update":
                html, ok = _apply_freshness_update(html, upgrade)
            else:
                print(f"  [geo-upgrade] Unknown upgrade type: {upgrade_type}")
                ok = False

            if ok:
                applied += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  [geo-upgrade] Upgrade failed ({upgrade_type}): {e}")
            skipped += 1

    if html == original:
        return {
            "status": "no_changes",
            "upgrades_attempted": len(upgrades),
            "upgrades_applied": 0,
            "upgrades_skipped": skipped,
            "filename": filename,
        }

    if not dry_run:
        filepath.write_text(html)
        _update_sitemap_lastmod(website_path, filename)
        commit_sha = _git_commit_push(
            website_path,
            f"[SEO-AUTO] GEO content upgrade: {filename}",
        )
        return {
            "status": "published",
            "upgrades_applied": applied,
            "upgrades_skipped": skipped,
            "filename": filename,
            "commit_sha": commit_sha,
        }

    return {
        "status": "generated",
        "upgrades_applied": applied,
        "upgrades_skipped": skipped,
        "filename": filename,
    }


def _apply_answer_block(html, upgrade):
    """Insert answer block content after a target heading.

    Uses regex to find the heading and string slicing to insert content,
    preserving original HTML formatting.
    """
    heading_text = upgrade.get("after_heading", "")
    content = upgrade.get("content", "")
    if not heading_text or not content:
        return html, False

    pos = _find_heading_close_position(html, heading_text)
    if pos is None:
        print(f"  [geo-upgrade] Heading not found: {heading_text}")
        return html, False

    # Insert content after the closing heading tag
    html = html[:pos] + "\n" + content + html[pos:]
    return html, True


def _apply_stats_injection(html, upgrade):
    """Insert stats after the first paragraph in a target section.

    Finds the section heading, then locates the next </p> tag and inserts
    the stats content wrapped in <p> tags after it.
    """
    section_text = upgrade.get("target_section", "")
    content = upgrade.get("content", "")
    if not section_text or not content:
        return html, False

    pos = _find_heading_close_position(html, section_text)
    if pos is None:
        print(f"  [geo-upgrade] Section heading not found: {section_text}")
        return html, False

    # Find the next </p> after the heading
    p_close = html.find("</p>", pos)
    if p_close == -1:
        print(f"  [geo-upgrade] No paragraph found after: {section_text}")
        return html, False

    insert_pos = p_close + len("</p>")
    stat_html = f"\n<p>{content}</p>"
    html = html[:insert_pos] + stat_html + html[insert_pos:]
    return html, True


def _apply_freshness_update(html, upgrade):
    """Insert or update a freshness date element.

    If a .freshness-date element exists, replace its content.
    Otherwise insert after <main>, <article>, <div class="content">, or <body>.
    """
    content = upgrade.get("content", "")
    if not content:
        return html, False

    # Check for existing freshness element -- replace content if found
    existing = re.search(
        r'<p\s+class=["\']freshness-date["\'][^>]*>.*?</p>',
        html, re.DOTALL | re.IGNORECASE,
    )
    if existing:
        replacement = f'<p class="freshness-date">{content}</p>'
        html = html[:existing.start()] + replacement + html[existing.end():]
        return html, True

    # Find insertion point: <main...>, <article...>, <div class="content...>, or <body...>
    freshness_html = f'\n<p class="freshness-date">{content}</p>'

    for pattern in [
        r'<main[^>]*>',
        r'<article[^>]*>',
        r'<div\s+class=["\']content[^>]*>',
        r'<body[^>]*>',
    ]:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            insert_pos = match.end()
            html = html[:insert_pos] + freshness_html + html[insert_pos:]
            return html, True

    print("  [geo-upgrade] No suitable container found for freshness update")
    return html, False


def _find_heading_close_position(html, heading_text):
    """Find the position immediately after the closing tag of an H2/H3 containing heading_text.

    Uses regex for case-insensitive matching. Returns the character position
    after the closing </h2> or </h3> tag, or None if not found.
    """
    escaped = re.escape(heading_text)
    pattern = r'<h[23][^>]*>.*?' + escaped + r'.*?</h[23]>'
    match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
    if match:
        return match.end()
    return None


def _update_sitemap_lastmod(website_path, page_path):
    """Update lastmod for an existing page in sitemap.xml."""
    sitemap = Path(website_path) / "sitemap.xml"
    if not sitemap.exists():
        return

    content = sitemap.read_text()
    page_url_fragment = page_path.replace("\\", "/")

    today = str(date.today())
    pattern = rf'(<loc>[^<]*{re.escape(page_url_fragment)}[^<]*</loc>\s*<lastmod>)\d{{4}}-\d{{2}}-\d{{2}}(</lastmod>)'
    new_content = re.sub(pattern, rf'\g<1>{today}\2', content)

    if new_content != content:
        sitemap.write_text(new_content)
        print(f"  [geo-upgrade] Updated sitemap lastmod for {page_path}")


def _git_commit_push(website_path, message):
    """Git add, commit, push for GEO content upgrades."""
    try:
        subprocess.run(
            ["git", "add", "-A"],
            cwd=website_path, check=True, capture_output=True,
        )
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=website_path, check=True, capture_output=True, text=True,
        )
        sha_match = re.search(r"\[[\w/-]+ ([a-f0-9]+)\]", result.stdout)
        commit_sha = sha_match.group(1) if sha_match else ""

        subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=website_path, check=True, capture_output=True,
        )
        print(f"  [geo-upgrade] Committed + pushed: {commit_sha}")
        return commit_sha
    except subprocess.CalledProcessError as e:
        print(f"  [geo-upgrade] Git commit/push failed: {e}")
        return ""
