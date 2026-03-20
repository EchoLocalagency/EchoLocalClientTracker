"""
Internal Linker
===============
Scans existing HTML pages and injects internal links to new content.
Only matches inside <p> text (not inside existing links, scripts, schema, headings).
Rate limited: max 3 links per page, 10 per run.
Logs all injected links to Supabase seo_internal_links table.
"""

import os
import re
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def find_link_opportunities(website_path, target_url, keywords):
    """Scan all pages for text matching keywords that could link to target_url.

    Args:
        website_path: Path to website root
        target_url: Relative URL of the new page (e.g. "blog/my-post.html")
        keywords: List of keyword phrases to match

    Returns:
        List of dicts: [{"page": "services.html", "keyword": "turf cleaning",
                         "count": 2, "existing_links_to_target": 0}, ...]
    """
    website_path = Path(website_path)
    opportunities = []

    html_files = _get_html_files(website_path)

    for html_file in html_files:
        rel_path = str(html_file.relative_to(website_path))

        # Skip the target page itself
        if rel_path == target_url or rel_path.replace("\\", "/") == target_url:
            continue

        content = html_file.read_text()

        # Check if page already links to target
        existing_links = content.count(target_url)

        # Extract only text inside <p> tags (strip HTML tags from matches)
        p_texts = re.findall(r"<p[^>]*>(.*?)</p>", content, re.DOTALL | re.IGNORECASE)
        p_text_combined = " ".join(p_texts)
        # Remove any existing HTML tags from inside <p>
        plain_text = re.sub(r"<[^>]+>", " ", p_text_combined).lower()

        for kw in keywords:
            kw_lower = kw.lower()
            count = plain_text.count(kw_lower)
            if count > 0:
                opportunities.append({
                    "page": rel_path,
                    "keyword": kw,
                    "count": count,
                    "existing_links_to_target": existing_links,
                })

    # Sort by count descending (most mentions first)
    opportunities.sort(key=lambda x: x["count"], reverse=True)
    return opportunities


def inject_links(website_path, target_url, keywords, max_per_page=3,
                 max_per_run=10, dry_run=True, client_id=None):
    """Inject internal links into existing pages.

    Only wraps text inside <p> tags. Skips text already inside <a> tags.

    Args:
        website_path: Path to website root
        target_url: Relative URL to link to
        keywords: List of keyword phrases to match and link
        max_per_page: Max links to inject per page
        max_per_run: Max total links across all pages
        dry_run: If True, returns what would be done without modifying files
        client_id: Supabase client ID for logging

    Returns:
        List of dicts describing injected links
    """
    website_path = Path(website_path)
    injected = []
    total_injected = 0

    html_files = _get_html_files(website_path)

    for html_file in html_files:
        if total_injected >= max_per_run:
            break

        rel_path = str(html_file.relative_to(website_path))

        # Skip the target page itself
        if rel_path == target_url or rel_path.replace("\\", "/") == target_url:
            continue

        # Allow homepage but with lower cap (1 link max)
        is_homepage = html_file.name == "index.html" and html_file.parent == website_path
        homepage_cap = 1
        max_for_page = homepage_cap if is_homepage else max_per_page

        content = html_file.read_text()
        original_content = content
        page_injected = 0

        for kw in keywords:
            if page_injected >= max_for_page or total_injected >= max_per_run:
                break

            # Build the link HTML
            # Compute relative path from source page to target
            link_href = _relative_path(rel_path, target_url)
            link_html = f'<a href="{link_href}">{kw}</a>'

            # Only replace inside <p> tags, and only if not already linked
            content, count = _inject_in_paragraphs(content, kw, link_html)

            if count > 0:
                injected.append({
                    "source_page": rel_path,
                    "target_page": target_url,
                    "anchor_text": kw,
                    "count": count,
                })
                page_injected += count
                total_injected += count

        # Write modified content
        if content != original_content and not dry_run:
            html_file.write_text(content)
            print(f"  [internal_linker] Injected {page_injected} links in {rel_path}")

            # Log to Supabase
            if client_id:
                _log_links(client_id, rel_path, target_url, keywords[:page_injected])

    if dry_run and injected:
        print(f"  [internal_linker] DRY RUN: Would inject {total_injected} links across {len(set(l['source_page'] for l in injected))} pages")

    return injected


def _inject_in_paragraphs(html, keyword, link_html):
    """Replace first occurrence of keyword inside <p> tags with a link.

    Skips matches already inside <a> tags, <script>, or <style>.
    Returns (modified_html, number_of_replacements).
    """
    count = 0

    def replace_in_p(match):
        nonlocal count
        if count >= 1:  # Only replace first occurrence per keyword
            return match.group(0)

        p_content = match.group(1)
        p_attrs = match.group(0)[:match.group(0).index(">")+1]

        # Check if keyword exists outside of existing <a> tags
        # Remove content inside <a> tags for matching
        clean = re.sub(r"<a[^>]*>.*?</a>", "", p_content, flags=re.DOTALL | re.IGNORECASE)

        kw_pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        if not kw_pattern.search(clean):
            return match.group(0)

        # Replace first occurrence that is NOT inside an <a> tag
        new_content = _replace_outside_links(p_content, keyword, link_html)
        if new_content != p_content:
            count += 1
            return f"{p_attrs}{new_content}</p>"

        return match.group(0)

    result = re.sub(
        r"<p([^>]*)>(.*?)</p>",
        lambda m: replace_in_p(type("Match", (), {
            "group": lambda self, n=0: m.group(n) if n != 1 else m.group(2),
        })()) if False else _do_replace(m, keyword, link_html, count_ref=[count]),
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )

    # Simpler approach: find <p> blocks and replace within them
    result = html
    count = 0

    for m in re.finditer(r"(<p[^>]*>)(.*?)(</p>)", html, re.DOTALL | re.IGNORECASE):
        if count >= 1:
            break

        p_open = m.group(1)
        p_content = m.group(2)
        p_close = m.group(3)

        new_content = _replace_outside_links(p_content, keyword, link_html)
        if new_content != p_content:
            old_full = m.group(0)
            new_full = f"{p_open}{new_content}{p_close}"
            result = result.replace(old_full, new_full, 1)
            count += 1

    return result, count


def _replace_outside_links(text, keyword, link_html):
    """Replace keyword in text, but only if it's not inside an <a> tag."""
    # Split text into segments: inside <a> tags and outside
    parts = re.split(r"(<a[^>]*>.*?</a>)", text, flags=re.DOTALL | re.IGNORECASE)
    replaced = False

    for i, part in enumerate(parts):
        if replaced:
            break
        # Skip parts that are <a> tags
        if part.startswith("<a ") or part.startswith("<a>"):
            continue

        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        if pattern.search(part):
            parts[i] = pattern.sub(link_html, part, count=1)
            replaced = True

    return "".join(parts)


def _do_replace(m, keyword, link_html, count_ref):
    """Helper for regex replacement."""
    return m.group(0)


def _relative_path(from_page, to_page):
    """Compute relative path from one HTML page to another."""
    from_parts = from_page.replace("\\", "/").split("/")
    to_parts = to_page.replace("\\", "/").split("/")

    # If same directory
    if len(from_parts) == 1 and len(to_parts) == 1:
        return to_page

    # Calculate relative path
    from_dir = "/".join(from_parts[:-1]) if len(from_parts) > 1 else ""
    to_dir = "/".join(to_parts[:-1]) if len(to_parts) > 1 else ""

    if from_dir == to_dir:
        return to_parts[-1]

    # Count how many levels up from source
    up_count = len(from_dir.split("/")) if from_dir else 0
    prefix = "../" * up_count

    return f"{prefix}{to_page}"


def _get_html_files(website_path):
    """Get all HTML files in website, excluding templates and hidden dirs."""
    files = []
    for pattern in ["*.html", "blog/*.html", "areas/*.html"]:
        files.extend(website_path.glob(pattern))

    # Remove blog/index.html duplicates and sort
    seen = set()
    unique = []
    for f in files:
        if str(f) not in seen:
            seen.add(str(f))
            unique.append(f)
    return sorted(unique)


def _log_links(client_id, source_page, target_page, anchor_texts):
    """Log injected links to Supabase."""
    try:
        sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
        rows = [
            {
                "client_id": client_id,
                "source_page": source_page,
                "target_page": target_page,
                "anchor_text": anchor,
            }
            for anchor in anchor_texts
        ]
        sb.table("seo_internal_links").insert(rows).execute()
    except Exception as e:
        print(f"  [internal_linker] Failed to log links: {e}")
