"""
Location Pages
==============
Generates neighborhood/city landing pages for local SEO.
Each page targets a specific service area with unique content.
Supports multiple client sites via SITE_CONFIG.
"""

import re
import sys
import subprocess
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from identity import assert_no_cross_contamination
import location_renderer

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"

# Site configs keyed by client slug (same pattern as blog_engine)
SITE_CONFIG = {
    "mr-green-turf-clean": {
        "domain": "mrgreenturfclean.com",
        "template": "location_template.html",
    },
    "integrity-pro-washers": {
        "domain": "integrityprowashers.com",
        "template": "location_template_integrity.html",
    },
    "socal-artificial-turfs": {
        "domain": "socalartificialturfs.com",
        "template": "location_template_socal.html",
        "areas_subdir": "locations",
    },
    "az-turf-cleaning": {
        "domain": "azturfcleaningllc.com",
        "template": "location_template_az.html",
    },
    "arcadian-landscape": {
        "domain": "arcadianlandscape.com",
        "template": "location_template.html",
    },
    "top-tier-custom-floors": {
        "domain": "toptierfloors.com",
        "template": "location_template.html",
    },
}


def _check_duplicate_content(website_path, new_content, threshold=0.7, areas_subdir="areas"):
    """Check if new location page is too similar to existing area pages.

    Uses word trigram Jaccard similarity. Returns (is_duplicate, most_similar_page, similarity).
    """
    def get_trigrams(text):
        # Strip HTML, lowercase, split into words
        words = re.sub(r'<[^>]+>', ' ', text).lower().split()
        return set(zip(words, words[1:], words[2:]))

    new_trigrams = get_trigrams(new_content)
    if not new_trigrams:
        return False, None, 0.0

    areas_dir = Path(website_path) / areas_subdir
    if not areas_dir.exists():
        return False, None, 0.0

    max_sim = 0.0
    most_similar = None

    for existing in areas_dir.glob("*.html"):
        existing_text = existing.read_text()
        existing_trigrams = get_trigrams(existing_text)
        if not existing_trigrams:
            continue

        intersection = len(new_trigrams & existing_trigrams)
        union = len(new_trigrams | existing_trigrams)
        similarity = intersection / union if union > 0 else 0.0

        if similarity > max_sim:
            max_sim = similarity
            most_similar = existing.name

    return max_sim > threshold, most_similar, max_sim


def create_location_page(city, slug, title, meta_description, body_content,
                         website_path, action_id=None, dry_run=True,
                         client_slug=None):
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
        client_slug: Client slug for site config lookup

    Returns:
        dict with file_path and commit_sha (if live)
    """
    # Sanitize slug: brain sometimes includes path prefixes like "areas/" or "locations/"
    slug = slug.replace("areas/", "").replace("locations/", "").replace(".html", "").strip("/")

    website_path = Path(website_path)

    # Resolve site config
    config = SITE_CONFIG.get(client_slug, {}) if client_slug else {}
    domain = config.get("domain")
    if not domain:
        raise ValueError(f"No domain found for client_slug '{client_slug}'. Check SITE_CONFIG.")
    areas_subdir = config.get("areas_subdir", "areas")
    areas_dir = website_path / areas_subdir
    areas_dir.mkdir(exist_ok=True)
    publish_date = str(date.today())
    canonical_url = f"https://{domain}/{areas_subdir}/{slug}.html"

    # Render via the leak-proof location renderer: identity from clients.json
    # (keyed to client_slug) + chrome from this client's own homepage. No shared
    # template file, so neither another client's identity NOR service type can
    # leak. Guard runs inside render_location_page.
    if not client_slug:
        raise ValueError("client_slug is required (identity is keyed to it)")
    homepage_html = (website_path / "index.html").read_text(errors="ignore")
    html = location_renderer.render_location_page(
        city=city, slug=slug, title=title, meta_description=meta_description,
        body_content=body_content, publish_date=publish_date,
        homepage_html=homepage_html, client_slug=client_slug, areas_subdir=areas_subdir,
    )

    # Check for duplicate content before writing
    is_dup, most_similar, sim = _check_duplicate_content(website_path, html, areas_subdir=areas_subdir)
    if is_dup:
        print(f"  [location_pages] REJECTED: {slug} is {sim:.0%} similar to {most_similar} -- tell brain to make it more unique")
        return {"status": "rejected_duplicate", "similar_to": most_similar, "similarity": sim}

    # Cross-client identity guard: block any page carrying another client's
    # brand/GA (or missing its own) BEFORE it is written. location_template.html
    # is still Mr Green-branded, so this fails loud for arcadian/top-tier until
    # their location templates are converted to the injection model -- which is
    # correct: never leak, even if it means blocking generation.
    assert_no_cross_contamination(html, client_slug, where=f"{areas_subdir}/{slug}.html")

    # Write page
    page_path = areas_dir / f"{slug}.html"
    page_path.write_text(html)
    print(f"  [location_pages] Written (guarded): {page_path}")

    # Update sitemap
    _update_sitemap(website_path, slug, publish_date, domain, areas_subdir)

    # Auto-inject link into service-areas.html
    _update_service_areas_page(website_path, city, slug, areas_subdir)

    # Inject schema markup
    try:
        from ..schema_injector import inject_schemas_for_page
        # Re-read the written page to inject schemas
        page_html = page_path.read_text()
        # Schema is already in the template, but this adds LocalBusiness if missing
    except ImportError:
        pass

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


def _update_sitemap(website_path, slug, publish_date, domain, areas_subdir="areas"):
    """Append location page URL to sitemap.xml."""
    sitemap_path = website_path / "sitemap.xml"
    if not sitemap_path.exists():
        return

    content = sitemap_path.read_text()
    new_entry = f"""
    <!-- Location: {slug} -->
    <url>
        <loc>https://{domain}/{areas_subdir}/{slug}.html</loc>
        <lastmod>{publish_date}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>"""

    if f"{areas_subdir}/{slug}.html" in content:
        return

    content = content.replace("</urlset>", f"{new_entry}\n</urlset>")
    sitemap_path.write_text(content)
    print(f"  [location_pages] Sitemap updated")


def _update_service_areas_page(website_path, city, slug, areas_subdir="areas"):
    """Auto-inject a link to the new area page into service-areas.html."""
    sa_path = website_path / "service-areas.html"
    if not sa_path.exists():
        return

    content = sa_path.read_text()

    # Check if already linked (check both possible path patterns)
    if f"{areas_subdir}/{slug}" in content:
        return

    # Look for a list of area links (common patterns)
    link_html = f'<li><a href="{areas_subdir}/{slug}.html">{city}</a></li>'

    # Try to insert before the closing </ul> that contains area links
    # Look for a marker or the last area link
    if "<!-- AREA-LINKS -->" in content:
        content = content.replace(
            "<!-- AREA-LINKS -->",
            f"<!-- AREA-LINKS -->\n                        {link_html}",
        )
    elif "<!-- /AREA-LINKS -->" in content:
        content = content.replace(
            "<!-- /AREA-LINKS -->",
            f"                        {link_html}\n                        <!-- /AREA-LINKS -->",
        )
    else:
        # Fallback: just log that manual update is needed
        print(f"  [location_pages] Note: manually add {city} link to service-areas.html")
        return

    sa_path.write_text(content)
    print(f"  [location_pages] Added {city} link to service-areas.html")


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
