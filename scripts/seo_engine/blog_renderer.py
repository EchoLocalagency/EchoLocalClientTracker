"""
Blog renderer (leak-proof)
==========================
Renders a blog post by combining:
  - identity (brand, GA, founding year) from clients.json, via identity.py
  - chrome (head, nav, footer) read from the CLIENT'S OWN homepage at render time

Because the only HTML ever loaded is the client's own site + clients.json values
keyed to that client, no other client's identity can enter the output. Every
render is checked by assert_no_cross_contamination() before it is returned.

This replaces the old per-client template files in blog_engine, which were the
source of the Mr-Green-identity-on-other-clients leak.
"""

import re
from pathlib import Path

from identity import client_identity, assert_no_cross_contamination


# ---------- path rewriting (homepage paths -> /blog/ subdir paths) ----------

_ABS = re.compile(r"^(https?:|//|/|#|mailto:|tel:|data:|\.\./)", re.I)


def _prefix(val):
    return val if _ABS.match(val.strip()) else "../" + val.strip()


def _rewrite_paths(fragment):
    """Prefix site-relative href/src/srcset with ../ so chrome lifted from the
    homepage resolves correctly from inside /blog/."""
    def href_src(m):
        return f'{m.group(1)}="{_prefix(m.group(2))}"'
    fragment = re.sub(r'\b(href|src)="([^"]+)"', href_src, fragment)

    def srcset(m):
        parts = []
        for item in m.group(1).split(","):
            item = item.strip()
            if not item:
                continue
            bits = item.split()
            bits[0] = _prefix(bits[0])
            parts.append(" ".join(bits))
        return 'srcset="' + ", ".join(parts) + '"'
    fragment = re.sub(r'srcset="([^"]+)"', srcset, fragment)
    return fragment


# ---------- chrome extraction from homepage ----------

def extract_chrome(homepage_html):
    """Return (head_inner, nav, footer_plus_scripts) with paths rewritten for /blog/.

    Header block handling is site-agnostic: prefer a <nav>...</nav>, else fall
    back to <header>...</header> (plus a preceding .topbar strip if present)."""
    lo = homepage_html.lower()
    head = homepage_html[lo.index("<head") + homepage_html[lo.index("<head"):].index(">") + 1: lo.index("</head>")]

    if "<nav" in lo:
        nav = homepage_html[lo.index("<nav"): lo.index("</nav>") + len("</nav>")]
    elif "<header" in lo:
        h_start, h_end = lo.index("<header"), lo.index("</header>") + len("</header>")
        tb = lo.rfind('<div class="topbar', 0, h_start)
        if tb != -1:
            h_start = tb
        nav = homepage_html[h_start:h_end]
    else:
        raise ValueError("no <nav> or <header> found in homepage chrome")

    foot = homepage_html[lo.index("<footer"): lo.rindex("</body>")]
    return _rewrite_paths(head), _rewrite_paths(nav), _rewrite_paths(foot)


# ---------- head meta normalization ----------

def _build_head(head_inner, identity, title, meta_description, canonical_url):
    h = head_inner
    h = re.sub(r"<title>.*?</title>", f"<title>{title} | {identity['brand']}</title>", h, flags=re.S | re.I)
    h = re.sub(r'(<meta\s+name=["\']description["\']\s+content=["\']).*?(["\'])',
               lambda m: m.group(1) + meta_description + m.group(2), h, count=1, flags=re.S | re.I)
    if "rel=\"canonical\"" in h or "rel='canonical'" in h:
        h = re.sub(r'(<link\s+rel=["\']canonical["\']\s+href=["\']).*?(["\'])',
                   lambda m: m.group(1) + canonical_url + m.group(2), h, count=1, flags=re.S | re.I)
    else:
        h += f'\n    <link rel="canonical" href="{canonical_url}">'
    h = re.sub(r'(<meta\s+property=["\']og:url["\']\s+content=["\']).*?(["\'])',
               lambda m: m.group(1) + canonical_url + m.group(2), h, flags=re.S | re.I)
    h = re.sub(r'(<meta\s+property=["\']og:title["\']\s+content=["\']).*?(["\'])',
               lambda m: m.group(1) + title + m.group(2), h, flags=re.S | re.I)
    # guarantee own GA id present (homepage head should already carry it)
    if identity["ga_id"] not in h:
        h += (f'\n    <script async src="https://www.googletagmanager.com/gtag/js?id={identity["ga_id"]}"></script>'
              f'\n    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}'
              f'gtag("js",new Date());gtag("config","{identity["ga_id"]}");</script>')
    return h


def render_post(slug, title, meta_description, body_content, publish_date,
                homepage_html, client_slug):
    """Render a single blog post. Returns guarded HTML string."""
    ident = client_identity(client_slug)
    canonical_url = f"https://{ident['domain']}/blog/{slug}.html"
    head_inner, nav, foot = extract_chrome(homepage_html)
    head = _build_head(head_inner, ident, title, meta_description, canonical_url)

    if ident.get("founded_year"):
        bio = (f"Written by the team at <strong>{ident['brand']}</strong>, "
               f"serving {ident.get('primary_market') or 'the local area'} since {ident['founded_year']}.")
    else:
        bio = (f"Written by the team at <strong>{ident['brand']}</strong>, "
               f"serving {ident.get('primary_market') or 'the local area'}.")

    page = f"""    <header class="page-header">
        <div class="container">
            <nav class="breadcrumbs" aria-label="Breadcrumb">
                <a href="../index.html">Home</a> / <a href="index.html">Blog</a> / <span>{title}</span>
            </nav>
            <h1 class="page-header__title">{title}</h1>
            <p class="page-header__subtitle">Published {publish_date} by {ident['brand']}</p>
        </div>
    </header>
    <main id="main-content">
        <article class="section">
            <div class="container">
                <div class="centered-block" style="max-width:800px;">
{body_content}
                </div>
            </div>
        </article>
        <aside class="section" style="background:var(--color-surface,#f5f5f0);">
          <div class="container"><div class="centered-block" style="max-width:800px;">
            <p style="font-size:.9rem;color:var(--color-text-muted,#666);margin:0;">{bio}</p>
          </div></div>
        </aside>
    </main>
"""

    html = (f"<!DOCTYPE html>\n<html lang=\"en\">\n<head>{head}\n</head>\n<body>\n"
            f"{nav}\n{page}\n{foot}\n</body>\n</html>\n")

    assert_no_cross_contamination(html, client_slug, where=f"blog/{slug}.html")
    return html
