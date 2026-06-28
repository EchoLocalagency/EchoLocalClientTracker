"""
One-time remediation: re-render contaminated blog posts through the leak-proof
renderer (chrome from each client's own homepage + identity from clients.json +
cross-contamination guard). Also rebuilds each blog index. Idempotent: only
touches posts that currently fail the guard.

Usage: python rerender_blog_posts.py            # all active contaminated clients
       python rerender_blog_posts.py <slug>     # one client
"""
import re
import sys
import glob
import html as _html
from pathlib import Path

from identity import client_identity, assert_no_cross_contamination, scan_file
import blog_renderer

CLIENTS = {
    "arcadian-landscape":     "/Users/brianegan/Desktop/Arcadian Landscape/website",
    "ecosystem-landscaping":  "/Users/brianegan/Desktop/Ecosystem Lands/website",
    "top-tier-custom-floors": "/Users/brianegan/Desktop/Top Tier Custom Floors/website",
}

MONTHS = ["", "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]


def read(p):
    return Path(p).read_text(encoding="utf-8", errors="ignore")


def extract_post(path):
    t = read(path)
    m = re.search(r'<h1[^>]*page-header__title[^>]*>(.*?)</h1>', t, re.S)
    if not m:
        m = re.search(r'<title>(.*?)(?:\s*\|.*)?</title>', t, re.S)
    title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else Path(path).stem
    d = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', t, re.S | re.I)
    desc = re.sub(r"\s+", " ", d.group(1)).strip() if d else ""
    dt = re.search(r'Published\s+(\d{4}-\d{2}-\d{2})', t) or re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', t)
    date = dt.group(1) if dt else ""
    art = re.search(r'<article[^>]*>(.*?)</article>', t, re.S)
    body = art.group(1) if art else t
    inner = re.search(r'<div class="centered-block"[^>]*>(.*?)</div>\s*</div>\s*$', body.strip(), re.S)
    if inner:
        body = inner.group(1)
    else:
        c = re.search(r'<div class="container"[^>]*>(.*?)</div>\s*$', body.strip(), re.S)
        if c:
            body = c.group(1)
    # strip the leaked author-box (flex wrapper with bottom border holding the
    # old owner/byline, e.g. "James Peck / Owner, Mr. Green Turf Clean...")
    body = re.sub(r'<div style="display:\s*flex;[^"]*border-bottom[^"]*">.*?</div>\s*</div>',
                  '', body, flags=re.S, count=1)
    # safety: drop any stray <p> that still carries foreign owner/brand text
    body = re.sub(r'<p[^>]*>[^<]*(?:Turf Clean|Mr\.?\s*Green|James Peck)[^<]*</p>', '', body, flags=re.I)
    return title, desc, date, body.strip()


def nice_date(iso):
    if not iso:
        return ""
    y, m, d = iso.split("-")
    return f"{MONTHS[int(m)]} {int(d)}, {y}"


def rebuild_index(slug, repo, homepage_html, posts_meta):
    ident = client_identity(slug)
    head_inner, nav, foot = blog_renderer.extract_chrome(homepage_html)
    canonical = f"https://{ident['domain']}/blog/"
    blurb = f"Tips, guides, and local insights from the team at {ident['brand']}."
    head = blog_renderer._build_head(head_inner, ident, "Blog", blurb, canonical)

    cards = []
    for m in sorted(posts_meta, key=lambda x: x["iso"], reverse=True):
        dh = f'<time datetime="{m["iso"]}" class="blogcard__date">{nice_date(m["iso"])}</time>' if m["iso"] else ""
        cards.append(f'''        <a class="blogcard" href="{m['slug']}.html">
          {dh}
          <h2 class="blogcard__title">{_html.escape(m['title'])}</h2>
          <p class="blogcard__desc">{_html.escape(m['desc'])}</p>
          <span class="blogcard__more">Read more &rarr;</span>
        </a>''')
    style = ('<style>.blog-hero{padding:3.5rem 1.25rem 2rem;text-align:center;max-width:820px;margin:0 auto}'
             '.blog-hero h1{font-size:clamp(2rem,5vw,3rem);margin:0 0 .75rem}'
             '.blog-hero p{color:var(--color-text-muted,#666);font-size:1.125rem;max-width:620px;margin:0 auto}'
             '.blog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;max-width:1140px;margin:0 auto 4rem;padding:0 1.25rem}'
             '.blogcard{display:flex;flex-direction:column;background:var(--color-surface,#fff);border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:1.5rem;text-decoration:none;color:inherit;transition:transform .18s,box-shadow .18s;box-shadow:0 1px 3px rgba(0,0,0,.06)}'
             '.blogcard:hover{transform:translateY(-4px);box-shadow:0 10px 28px rgba(0,0,0,.12)}'
             '.blogcard__date{font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:var(--color-text-muted,#888);margin-bottom:.6rem}'
             '.blogcard__title{font-size:1.25rem;line-height:1.3;margin:0 0 .6rem}'
             '.blogcard__desc{color:var(--color-text-muted,#666);font-size:.97rem;line-height:1.55;margin:0 0 1rem;flex:1}'
             '.blogcard__more{font-weight:600;color:var(--color-primary,#2f7d4f)}</style>')
    main = (f'\n<main id="main-content"><section class="blog-hero"><h1>Blog</h1><p>{blurb}</p></section>'
            f'<section class="blog-grid">\n' + "\n".join(cards) + "\n</section></main>\n")
    page = (f"<!DOCTYPE html>\n<html lang=\"en\">\n<head>{head}\n{style}\n</head>\n<body>\n"
            f"{nav}\n{main}\n{foot}\n</body>\n</html>\n")
    assert_no_cross_contamination(page, slug, where="blog/index.html")
    out = Path(repo) / "blog" / "index.html"
    out.write_text(page, encoding="utf-8")
    return str(out)


def run_client(slug):
    repo = CLIENTS[slug]
    homepage = read(Path(repo) / "index.html")
    blog_dir = Path(repo) / "blog"
    posts = [p for p in glob.glob(str(blog_dir / "*.html")) if Path(p).name != "index.html"]

    fixed, meta_all = [], []
    for p in sorted(posts):
        slug_p = Path(p).stem
        title, desc, date, body = extract_post(p)
        meta_all.append({"slug": slug_p, "title": title, "desc": desc, "iso": date})
        ok, _ = scan_file(p, slug)
        if ok:
            continue  # already clean, leave it
        html = blog_renderer.render_post(slug_p, title, desc, body, date, homepage, slug, website_path=Path(repo))
        Path(p).write_text(html, encoding="utf-8")
        fixed.append(slug_p)

    idx = rebuild_index(slug, repo, homepage, meta_all)
    return fixed, idx, len(posts)


if __name__ == "__main__":
    targets = [sys.argv[1]] if len(sys.argv) > 1 else list(CLIENTS)
    for slug in targets:
        fixed, idx, total = run_client(slug)
        print(f"\n=== {slug} ===")
        print(f"  re-rendered {len(fixed)}/{total} posts; rebuilt index -> {idx}")
        # verify whole blog dir passes guard
        bad = 0
        for f in glob.glob(str(Path(CLIENTS[slug]) / "blog" / "*.html")):
            ok, msg = scan_file(f, slug)
            if not ok:
                bad += 1
                print(f"  STILL CONTAMINATED: {Path(f).name} -> {msg}")
        print(f"  guard: {'ALL CLEAN' if bad == 0 else str(bad)+' STILL BAD'}")
