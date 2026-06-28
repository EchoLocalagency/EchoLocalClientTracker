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

_ABS = re.compile(r"^(https?:|//|/|#|mailto:|tel:|sms:|data:|javascript:|\.\./)", re.I)


def _prefix(val):
    return val if _ABS.match(val.strip()) else "../" + val.strip()


# ---------- per-client image path quirks ----------

def _mr_green_image_repair(src):
    """Mr Green's turf-cleaning-poway-*.jpg images live at /blog/images/,
    but the brain commonly writes them as /images/, /areas/images/, or
    ../images/. Normalize."""
    m = re.match(r'^(?:\.\./)?/?(?:areas/)?images/(turf-cleaning-poway-.+)$', src)
    if m:
        return f"/blog/images/{m.group(1)}"
    return None


# ---------- body content path repair (smart same-dir vs root resolution) ----------
#
# Body content authored by the brain almost always contains plain-relative
# references like `<a href="areas/foo.html">` or `<img src="images/x.jpg">`.
# Placed at /blog/post.html, those resolve to /blog/areas/foo.html (broken).
# Placed at /areas/X.html with images at /blog/images/, the image breaks too.
#
# Strategy: for each plain-relative href/src, try two interpretations and pick
# whichever resolves to a real file on disk:
#   1. same-dir:  /<page_subdir>/<value>   (browser default)
#   2. root:      /<value>                 (what the brain typically means)
# If neither exists, unwrap the <a> (keep text, drop link) or drop the <img>.
#
# Already-absolute (`/foo.html`), protocol URLs, anchors, mail/tel/sms/data/js,
# and explicit `./`/`../` paths are left untouched (chrome already handles ../).

_BODY_SKIP = re.compile(
    r'^(https?:|//|/|#|mailto:|tel:|sms:|data:|javascript:|\.\./|\./)', re.I)
_A_TAG = re.compile(r'<a\b([^>]*?)\bhref="([^"]+)"([^>]*)>(.*?)</a>',
                    re.I | re.S)
_IMG_TAG = re.compile(r'<img\b[^>]*?>', re.I)
_SOURCE_TAG = re.compile(r'<source\b[^>]*?>', re.I)


def _exists(website_path, href):
    if not href.startswith("/"):
        return False
    clean = href.split("#", 1)[0].split("?", 1)[0]
    p = website_path / clean.lstrip("/")
    if p.is_file():
        return True
    if clean.endswith("/") and (p / "index.html").is_file():
        return True
    return False


def _resolve(val, page_subdir, website_path):
    """Return (resolved_absolute_href, kind) where kind is 'samedir', 'root',
    or None (nothing on disk). page_subdir is like '/blog' or '/areas'."""
    cleaned = val.lstrip("./")
    same_dir = f"{page_subdir}/{cleaned}" if page_subdir else "/" + cleaned
    root = "/" + cleaned
    if _exists(website_path, same_dir):
        return same_dir, "samedir"
    if _exists(website_path, root):
        return root, "root"
    return None, None


def repair_body(body_html, page_subdir, website_path, image_repair=None):
    """Fix plain-relative anchor + image paths in body_html so they actually
    resolve when the page sits at /<page_subdir>/X.html. Drops <a>s and
    <img>s whose targets don't exist anywhere on disk."""
    if website_path is None:
        return body_html
    website_path = Path(website_path)
    if not page_subdir.startswith("/"):
        page_subdir = "/" + page_subdir.strip("/") if page_subdir.strip("/") else ""

    # ---- <a href> ----
    def fix_a(m):
        pre, href, post, anchor = m.group(1), m.group(2), m.group(3), m.group(4)
        if href.startswith("/") and not _exists(website_path, href):
            return anchor  # already absolute but dead: unwrap
        if _BODY_SKIP.match(href):
            return m.group(0)
        resolved, kind = _resolve(href, page_subdir, website_path)
        if kind == "samedir":
            return m.group(0)  # relative form already correct
        if kind == "root":
            return f'<a{pre}href="{resolved}"{post}>{anchor}</a>'
        return anchor  # dead link: unwrap
    body_html = _A_TAG.sub(fix_a, body_html)

    # ---- <img src> ----
    def fix_img(m):
        tag = m.group(0)
        sm = re.search(r'\bsrc="([^"]+)"', tag, re.I)
        if not sm:
            return tag
        src = sm.group(1)
        if image_repair:
            repaired = image_repair(src)
            if repaired and _exists(website_path, repaired):
                return tag.replace(f'src="{src}"', f'src="{repaired}"')
        if src.startswith("/") and not _exists(website_path, src):
            return ""  # absolute dead image: drop
        if _BODY_SKIP.match(src):
            return tag
        resolved, kind = _resolve(src, page_subdir, website_path)
        if kind == "samedir":
            return tag
        if kind == "root":
            return tag.replace(f'src="{src}"', f'src="{resolved}"')
        return ""  # dead image: drop
    body_html = _IMG_TAG.sub(fix_img, body_html)

    # ---- <source src=/srcset=> ----
    def fix_source(m):
        tag = m.group(0)
        for attr in ("src", "srcset"):
            am = re.search(rf'\b{attr}="([^"]+)"', tag, re.I)
            if not am:
                continue
            val = am.group(1)
            first = val.split(",")[0].split()[0] if val else val
            if image_repair:
                repaired = image_repair(first)
                if repaired and _exists(website_path, repaired):
                    tag = tag.replace(f'{attr}="{val}"', f'{attr}="{repaired}"')
                    continue
            if first.startswith("/") and not _exists(website_path, first):
                return ""
            if _BODY_SKIP.match(first):
                continue
            resolved, kind = _resolve(first, page_subdir, website_path)
            if kind == "root":
                tag = tag.replace(f'{attr}="{val}"', f'{attr}="{resolved}"')
            elif kind is None:
                return ""
        return tag
    body_html = _SOURCE_TAG.sub(fix_source, body_html)
    return body_html


# Backwards-compatible names (old callers in rerender_blog_posts.py etc.)
def absolutize_body(body_html, page_subdir="/blog", website_path=None):
    return repair_body(body_html, page_subdir, website_path)


def gate_dead_links(body_html, website_path):
    # Now folded into repair_body; kept as a pass-through so existing import
    # statements stay valid.
    return body_html


def gate_dead_images(body_html, website_path, image_repair=None):
    return body_html


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
    # og:title + twitter:title: replace the WHOLE tag with a clean double-quoted
    # version (apostrophe-safe) and add twitter:title if the homepage chrome
    # lacked one -- otherwise posts inherit the homepage's social title.
    h = re.sub(r'<meta\s+property=["\']og:title["\'][^>]*>',
               f'<meta property="og:title" content="{title}">', h, flags=re.I)
    if re.search(r'<meta\s+name=["\']twitter:title["\']', h, re.I):
        h = re.sub(r'<meta\s+name=["\']twitter:title["\'][^>]*>',
                   f'<meta name="twitter:title" content="{title}">', h, flags=re.I)
    else:
        h += f'\n    <meta name="twitter:title" content="{title}">'
    # guarantee own GA id present (homepage head should already carry it)
    if identity["ga_id"] not in h:
        h += (f'\n    <script async src="https://www.googletagmanager.com/gtag/js?id={identity["ga_id"]}"></script>'
              f'\n    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}'
              f'gtag("js",new Date());gtag("config","{identity["ga_id"]}");</script>')
    return h


def render_post(slug, title, meta_description, body_content, publish_date,
                homepage_html, client_slug, website_path=None):
    """Render a single blog post. Returns guarded HTML string."""
    ident = client_identity(client_slug)
    canonical_url = f"https://{ident['domain']}/blog/{slug}.html"
    head_inner, nav, foot = extract_chrome(homepage_html)
    head = _build_head(head_inner, ident, title, meta_description, canonical_url)

    # Body links authored by the brain are usually plain-relative; resolve
    # each to /blog/X or /X (whichever actually exists on disk) and drop any
    # whose target doesn't exist anywhere. Mr Green's images live under
    # /blog/images/ so apply that repair too.
    image_repair = _mr_green_image_repair if client_slug == "mr-green-turf-clean" else None
    body_content = repair_body(body_content, "/blog", website_path,
                               image_repair=image_repair)

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
