"""
Blog Engine
===========
Generates blog posts from the brain's output, writes HTML files,
updates sitemap.xml and blog/index.html, then commits + pushes via git.

Supports multiple client sites via SITE_CONFIG.
"""

import os
import re
import sys
import subprocess
from datetime import date
from pathlib import Path

# leak-proof renderer + cross-client guard live one dir up
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import blog_renderer
from identity import assert_no_cross_contamination

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"

# Site configs keyed by client slug
SITE_CONFIG = {
    "mr-green-turf-clean": {
        "domain": "mrgreenturfclean.com",
        "template": "blog_template.html",
        "website_path": "/Users/brianegan/Desktop/Mr green Wesbite 2/website",
    },
    "integrity-pro-washers": {
        "domain": "integrityprowashers.com",
        "template": "blog_template_integrity.html",
        "website_path": "/Users/brianegan/Desktop/Intergrity Pro Pressure Washing client File/Integrity Pro Pressure washing/website",
    },
    "echo-local": {
        "domain": "echolocalagency.com",
        "template": "blog_template_echo_local.html",
        "website_path": "/Users/brianegan/Desktop/Echo Local/Echo Local website",
    },
    "az-turf-cleaning": {
        "domain": "azturfcleaningllc.com",
        "template": "blog_template_az.html",
        "website_path": "/Users/brianegan/Desktop/AZ Turf Cleaning/AZ Turf Cleaning Website/website",
    },
    "socal-artificial-turfs": {
        "domain": "socalartificialturfs.com",
        "template": "blog_template_socal.html",
        "website_path": "/Users/brianegan/Desktop/SoCal Artificial Turfs",
    },
    "arcadian-landscape": {
        "domain": "arcadianlandscape.com",
        "template": "blog_template.html",
        "website_path": "/Users/brianegan/Desktop/Arcadian Landscape/website",
    },
    "ecosystem-landscaping": {
        "domain": "ecosystemlands.com",
        "template": "blog_template_ecosystem.html",
        "website_path": "/Users/brianegan/Desktop/Ecosystem Lands/website",
    },
    "top-tier-custom-floors": {
        "domain": "toptierfloors.com",
        "template": "blog_template.html",
        "website_path": "/Users/brianegan/Desktop/Top Tier Custom Floors/website",
    },
}


def generate_blog_post(title, slug, meta_description, body_content,
                       website_path=None, action_id=None, dry_run=True,
                       client_slug=None):
    """Generate a blog post HTML file and update sitemap + blog index.

    Args:
        title: Blog post title
        slug: URL slug (e.g. "how-to-clean-artificial-turf")
        meta_description: Under 160 chars
        body_content: Full HTML body content (goes inside <article>)
        website_path: Path to the website root directory (optional if client_slug given)
        action_id: seo_actions ID for commit message traceability
        dry_run: If True, generates file but doesn't commit/push
        client_slug: Client slug to look up site config

    Returns:
        dict with file_path and commit_sha (if live)
    """
    # Resolve site config
    config = SITE_CONFIG.get(client_slug, {}) if client_slug else {}
    domain = config.get("domain")
    if not domain:
        raise ValueError(f"No domain found for client_slug '{client_slug}'. Check SITE_CONFIG.")
    template_name = config.get("template", "blog_template.html")

    if website_path:
        website_path = Path(website_path)
    elif config.get("website_path"):
        website_path = Path(config["website_path"])
    else:
        raise ValueError("Either website_path or a valid client_slug is required")

    blog_dir = website_path / "blog"
    blog_dir.mkdir(exist_ok=True)

    publish_date = str(date.today())

    # Render via the leak-proof renderer: identity comes from clients.json
    # (keyed to client_slug) and chrome is read from THIS client's own homepage.
    # No per-client template file is used, so another client's identity can never
    # enter the output. render_post() runs the cross-contamination guard before
    # returning, raising CrossContaminationError if anything is off.
    if not client_slug:
        raise ValueError("client_slug is required (identity is keyed to it)")
    homepage_html = (website_path / "index.html").read_text(errors="ignore")
    html = blog_renderer.render_post(
        slug=slug,
        title=title.split("|")[0].strip() if "|" in title else title,
        meta_description=meta_description,
        body_content=body_content,
        publish_date=publish_date,
        homepage_html=homepage_html,
        client_slug=client_slug,
    )
    canonical_url = f"https://{domain}/blog/{slug}.html"

    # Write blog post
    post_path = blog_dir / f"{slug}.html"
    post_path.write_text(html)
    print(f"  [blog_engine] Written (guarded): {post_path}")

    # Update sitemap
    _update_sitemap(website_path, slug, publish_date, domain)

    # Update blog index
    _update_blog_index(website_path, title, slug, meta_description, publish_date)

    result = {
        "status": "generated",
        "file_path": str(post_path),
        "canonical_url": canonical_url,
    }

    if not dry_run:
        commit_sha = _git_commit_push(
            website_path,
            f"[SEO-AUTO] Add blog post: {title}",
            action_id,
        )
        result["commit_sha"] = commit_sha
        result["status"] = "published"

    return result


def _update_sitemap(website_path, slug, publish_date, domain):
    """Append blog post URL to sitemap.xml."""
    sitemap_path = website_path / "sitemap.xml"
    if not sitemap_path.exists():
        return

    content = sitemap_path.read_text()
    new_entry = f"""
    <!-- Blog: {slug} -->
    <url>
        <loc>https://{domain}/blog/{slug}.html</loc>
        <lastmod>{publish_date}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>"""

    # Check if already present
    if f"blog/{slug}.html" in content:
        return

    # Insert before closing </urlset>
    content = content.replace("</urlset>", f"{new_entry}\n</urlset>")
    sitemap_path.write_text(content)
    print(f"  [blog_engine] Sitemap updated")


def _update_blog_index(website_path, title, slug, description, publish_date):
    """Add a post card to blog/index.html."""
    index_path = website_path / "blog" / "index.html"
    if not index_path.exists():
        print(f"  [blog_engine] Warning: blog/index.html not found at {index_path}")
        return

    content = index_path.read_text()

    # Create post card. Echo Local's site has a dark theme but does NOT define
    # the --clr-primary-dark / --clr-accent-gold / --space-md vars that other
    # client templates assume, so it needs a different markup pattern with
    # inline hex fallbacks. Client sites (Mr Green, IP, etc.) DO define those
    # vars and rely on the original `card card--with-image` markup to fit their
    # branded look. Branch on path so each site renders correctly.
    is_echo_local = "Echo-local-website" in str(website_path)
    if is_echo_local:
        card_html = f"""
                <a href="{slug}.html" class="blog-card" style="background: var(--clr-card-bg, #131B2E); border-radius: 12px; padding: 2rem; text-decoration: none; transition: transform 0.2s; display: block;">
                  <p style="color: var(--clr-text-secondary, #94A3B8); font-size: 0.8rem; margin-bottom: 0.5rem;">{publish_date}</p>
                  <h3 style="color: var(--clr-text-primary, #F1F5F9); margin-bottom: 0.75rem;">{title}</h3>
                  <p style="color: var(--clr-text-secondary, #94A3B8); font-size: 0.9rem;">{description}</p>
                </a>"""
    else:
        card_html = f"""
                <article class="card card--with-image fade-in">
                    <div class="card__content" style="padding: var(--space-md);">
                        <p style="color: var(--clr-accent-gold); font-size: 0.85rem; margin-bottom: 0.5rem;">{publish_date}</p>
                        <h3 style="font-family: var(--font-header); color: var(--clr-primary-dark); margin-bottom: var(--space-xs);">
                            <a href="{slug}.html" style="color: inherit; text-decoration: none;">{title}</a>
                        </h3>
                        <p style="color: var(--clr-text-secondary); margin-bottom: var(--space-sm);">{description}</p>
                        <a href="{slug}.html" class="btn btn--secondary btn--sm">Read More</a>
                    </div>
                </article>"""

    # Check if already listed
    if f"{slug}.html" in content:
        return

    # Remove "no posts yet" placeholder if present
    content = re.sub(
        r'<p[^>]*class="[^"]*no-posts[^"]*"[^>]*>.*?</p>\s*',
        '',
        content,
        flags=re.DOTALL,
    )

    # Insert after the blog-grid opening marker
    marker = '<!-- BLOG-POSTS -->'
    if marker in content:
        content = content.replace(marker, f"{marker}\n{card_html}")
    else:
        content = content.replace("<!-- /BLOG-POSTS -->", f"{card_html}\n                <!-- /BLOG-POSTS -->")

    index_path.write_text(content)
    print(f"  [blog_engine] Blog index updated")


def _git_commit_push(website_path, message, action_id=None):
    """Git add, commit, push from the website directory."""
    if action_id:
        message += f"\n\nAction ID: {action_id}"

    try:
        subprocess.run(["git", "add", "-A"], cwd=website_path, check=True, capture_output=True)
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=website_path, check=True, capture_output=True, text=True,
        )
        # Extract commit SHA
        sha_match = re.search(r"\[[\w/-]+ ([a-f0-9]+)\]", result.stdout)
        commit_sha = sha_match.group(1) if sha_match else ""

        subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=website_path, check=True, capture_output=True,
        )
        print(f"  [blog_engine] Committed + pushed: {commit_sha}")
        return commit_sha
    except subprocess.CalledProcessError as e:
        print(f"  [blog_engine] Git error: {e.stderr[:200] if e.stderr else str(e)}")
        return ""
