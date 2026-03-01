"""
Location Pages
==============
Generates neighborhood/city landing pages for local SEO.
Each page targets a specific service area with unique content.
"""

import re
import subprocess
from datetime import date
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"


def create_location_page(city, slug, title, meta_description, body_content,
                         website_path, action_id=None, dry_run=True):
    """Generate a location landing page.

    Args:
        city: City name (e.g. "Rancho Bernardo")
        slug: URL slug (e.g. "turf-cleaning-rancho-bernardo")
        title: Page title
        meta_description: Under 160 chars
        body_content: Full HTML body content
        website_path: Path to website root
        action_id: seo_actions ID for commit traceability
        dry_run: If True, generates but doesn't commit/push

    Returns:
        dict with file_path and commit_sha (if live)
    """
    website_path = Path(website_path)
    areas_dir = website_path / "areas"
    areas_dir.mkdir(exist_ok=True)

    # Load template
    template_path = TEMPLATE_DIR / "location_template.html"
    template = template_path.read_text()

    publish_date = str(date.today())
    canonical_url = f"https://mrgreenturfclean.com/areas/{slug}.html"
    og_title = title.split("|")[0].strip() if "|" in title else title

    html = template.replace("{{title}}", title)
    html = html.replace("{{meta_description}}", meta_description)
    html = html.replace("{{canonical_url}}", canonical_url)
    html = html.replace("{{og_title}}", og_title)
    html = html.replace("{{city}}", city)
    html = html.replace("{{body_content}}", body_content)

    # Write page
    page_path = areas_dir / f"{slug}.html"
    page_path.write_text(html)
    print(f"  [location_pages] Written: {page_path}")

    # Update sitemap
    _update_sitemap(website_path, slug, publish_date)

    result = {
        "status": "generated",
        "file_path": str(page_path),
        "canonical_url": canonical_url,
    }

    if not dry_run:
        commit_sha = _git_commit_push(
            website_path,
            f"[SEO-AUTO] Add location page: {city}",
            action_id,
        )
        result["commit_sha"] = commit_sha
        result["status"] = "published"

    return result


def _update_sitemap(website_path, slug, publish_date):
    """Append location page URL to sitemap.xml."""
    sitemap_path = website_path / "sitemap.xml"
    if not sitemap_path.exists():
        return

    content = sitemap_path.read_text()
    new_entry = f"""
    <!-- Location: {slug} -->
    <url>
        <loc>https://mrgreenturfclean.com/areas/{slug}.html</loc>
        <lastmod>{publish_date}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>"""

    if f"areas/{slug}.html" in content:
        return

    content = content.replace("</urlset>", f"{new_entry}\n</urlset>")
    sitemap_path.write_text(content)
    print(f"  [location_pages] Sitemap updated")


def _git_commit_push(website_path, message, action_id=None):
    """Git add, commit, push."""
    if action_id:
        message += f"\n\nAction ID: {action_id}"

    try:
        subprocess.run(["git", "add", "-A"], cwd=website_path, check=True, capture_output=True)
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
        print(f"  [location_pages] Committed + pushed: {commit_sha}")
        return commit_sha
    except subprocess.CalledProcessError as e:
        print(f"  [location_pages] Git error: {e.stderr[:200] if e.stderr else str(e)}")
        return ""
