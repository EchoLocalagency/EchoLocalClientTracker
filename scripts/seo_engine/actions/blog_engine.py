"""
Blog Engine
===========
Generates blog posts from the brain's output, writes HTML files,
updates sitemap.xml and blog/index.html, then commits + pushes via git.
"""

import os
import re
import subprocess
from datetime import date
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"


def generate_blog_post(title, slug, meta_description, body_content,
                       website_path, action_id=None, dry_run=True):
    """Generate a blog post HTML file and update sitemap + blog index.

    Args:
        title: Blog post title
        slug: URL slug (e.g. "how-to-clean-artificial-turf")
        meta_description: Under 160 chars
        body_content: Full HTML body content (goes inside <article>)
        website_path: Path to the website root directory
        action_id: seo_actions ID for commit message traceability
        dry_run: If True, generates file but doesn't commit/push

    Returns:
        dict with file_path and commit_sha (if live)
    """
    website_path = Path(website_path)
    blog_dir = website_path / "blog"
    blog_dir.mkdir(exist_ok=True)

    # Load template
    template_path = TEMPLATE_DIR / "blog_template.html"
    template = template_path.read_text()

    # Fill placeholders
    publish_date = str(date.today())
    canonical_url = f"https://mrgreenturfclean.com/blog/{slug}.html"
    breadcrumb_title = title.split("|")[0].strip() if "|" in title else title

    html = template.replace("{{title}}", title)
    html = html.replace("{{meta_description}}", meta_description)
    html = html.replace("{{canonical_url}}", canonical_url)
    html = html.replace("{{og_title}}", title)
    html = html.replace("{{breadcrumb_title}}", breadcrumb_title)
    html = html.replace("{{body_content}}", body_content)
    html = html.replace("{{publish_date}}", publish_date)

    # Write blog post
    post_path = blog_dir / f"{slug}.html"
    post_path.write_text(html)
    print(f"  [blog_engine] Written: {post_path}")

    # Update sitemap
    _update_sitemap(website_path, slug, publish_date)

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


def _update_sitemap(website_path, slug, publish_date):
    """Append blog post URL to sitemap.xml."""
    sitemap_path = website_path / "sitemap.xml"
    if not sitemap_path.exists():
        return

    content = sitemap_path.read_text()
    new_entry = f"""
    <!-- Blog: {slug} -->
    <url>
        <loc>https://mrgreenturfclean.com/blog/{slug}.html</loc>
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
        # Create a basic blog index if it doesn't exist
        _create_blog_index(website_path)

    content = index_path.read_text()

    # Create post card
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

    # Insert after the blog-grid opening div
    marker = '<!-- BLOG-POSTS -->'
    if marker in content:
        content = content.replace(marker, f"{marker}\n{card_html}")
    else:
        # Fallback: insert before the grid closing div
        content = content.replace("<!-- /BLOG-POSTS -->", f"{card_html}\n                <!-- /BLOG-POSTS -->")

    index_path.write_text(content)
    print(f"  [blog_engine] Blog index updated")


def _create_blog_index(website_path):
    """Create the blog/index.html listing page."""
    template_path = TEMPLATE_DIR / "blog_template.html"
    template = template_path.read_text()

    # Modify the template for the index page
    index_content = template.replace("{{title}}", "Blog | Mr. Green Turf Clean")
    index_content = index_content.replace("{{meta_description}}", "Tips, guides, and insights about artificial turf cleaning and maintenance from Mr. Green Turf Clean in San Diego County.")
    index_content = index_content.replace("{{canonical_url}}", "https://mrgreenturfclean.com/blog/")
    index_content = index_content.replace("{{og_title}}", "Blog | Mr. Green Turf Clean")
    index_content = index_content.replace("{{breadcrumb_title}}", "Blog")
    index_content = index_content.replace("{{publish_date}}", str(date.today()))

    # Replace the body_content placeholder with a blog grid
    blog_grid = """
                <div class="section-header fade-in">
                    <p class="section-header__label">From Our Team</p>
                    <h2 class="section-header__title">Turf Care Tips & Insights</h2>
                    <p class="section-header__subtitle">Expert advice on artificial turf cleaning, maintenance, and care from our San Diego team.</p>
                </div>
                <div class="grid grid--2" style="gap: var(--space-md);">
                <!-- BLOG-POSTS -->
                <!-- /BLOG-POSTS -->
                </div>"""

    index_content = index_content.replace("{{body_content}}", blog_grid)

    # Fix breadcrumbs for index (remove third level)
    index_content = index_content.replace(
        '<li class="breadcrumbs__item"><span class="breadcrumbs__current">Blog</span></li>',
        '<li class="breadcrumbs__item"><span class="breadcrumbs__current">Blog</span></li>'
    )

    # Remove the BlogPosting schema (not appropriate for index)
    index_content = re.sub(
        r'<script type="application/ld\+json">\s*\{[^}]*"@type":\s*"BlogPosting"[^<]*</script>',
        '',
        index_content,
        flags=re.DOTALL,
    )

    index_path = website_path / "blog" / "index.html"
    index_path.write_text(index_content)
    print(f"  [blog_engine] Created blog index: {index_path}")


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
