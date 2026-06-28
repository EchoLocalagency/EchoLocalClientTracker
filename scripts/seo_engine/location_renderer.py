"""
Location-page renderer (leak-proof)
===================================
Same model as blog_renderer: identity from clients.json (keyed to the client
being rendered) + chrome from that client's OWN homepage. Replaces the shared
location_template files, which leaked not just Mr Green's identity but his
SERVICE TYPE ("Turf Cleaning in {city}") onto landscapers/flooring clients.

The page H1, title, and schema are derived from the brain-supplied title/meta
(already per-client-appropriate), never a hardcoded service noun.
"""

import json

from identity import client_identity, assert_no_cross_contamination
from blog_renderer import (extract_chrome, _build_head, repair_body,
                           _mr_green_image_repair)


def render_location_page(city, slug, title, meta_description, body_content,
                         publish_date, homepage_html, client_slug,
                         areas_subdir="areas", website_path=None):
    """Render a location/area landing page. Returns guarded HTML."""
    ident = client_identity(client_slug)
    og_title = title.split("|")[0].strip() if "|" in title else title
    canonical_url = f"https://{ident['domain']}/{areas_subdir}/{slug}.html"

    head_inner, nav, foot = extract_chrome(homepage_html)
    head = _build_head(head_inner, ident, og_title, meta_description, canonical_url)

    # Resolve plain-relative body refs against /<areas_subdir>/ first, then /,
    # dropping anything that doesn't exist on disk. Same defense as blog posts.
    image_repair = _mr_green_image_repair if client_slug == "mr-green-turf-clean" else None
    body_content = repair_body(body_content, f"/{areas_subdir}", website_path,
                               image_repair=image_repair)

    # Generic, brand-correct local schema (no hardcoded service type)
    schema = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": og_title,
        "description": meta_description,
        "areaServed": {
            "@type": "City",
            "name": city,
            "containedInPlace": {"@type": "State", "name": "California"},
        },
        "provider": {
            "@type": "LocalBusiness",
            "name": ident["brand"],
            "url": f"https://{ident['domain']}/",
        },
        "url": canonical_url,
    }
    schema_tag = '<script type="application/ld+json">' + json.dumps(schema) + "</script>"

    page = f"""    <header class="page-header">
        <div class="container">
            <nav class="breadcrumbs" aria-label="Breadcrumb">
                <a href="../index.html">Home</a> / <span>{city}</span>
            </nav>
            <h1 class="page-header__title">{og_title}</h1>
        </div>
    </header>
    <main id="main-content">
        <article class="section">
            <div class="container">
                <div class="centered-block" style="max-width:820px;">
                    <p style="font-size:.85rem;color:var(--color-text-muted,#666);margin-bottom:1.5rem;">Last updated: {publish_date}</p>
{body_content}
                    <div style="margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid rgba(0,0,0,.1);">
                      <h2>Get a Free Quote in {city}</h2>
                      <p>{ident['brand']} serves {city} and the surrounding {ident.get('primary_market') or 'area'}. Contact us today for a free estimate.</p>
                      <p><a class="btn btn--primary" href="../contact.html">Request a Quote</a></p>
                    </div>
                </div>
            </div>
        </article>
    </main>
"""

    html = (f"<!DOCTYPE html>\n<html lang=\"en\">\n<head>{head}\n{schema_tag}\n</head>\n<body>\n"
            f"{nav}\n{page}\n{foot}\n</body>\n</html>\n")

    assert_no_cross_contamination(html, client_slug, where=f"{areas_subdir}/{slug}.html")
    return html
