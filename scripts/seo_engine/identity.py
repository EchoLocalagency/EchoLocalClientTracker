"""
Client identity + cross-contamination guard
============================================
Single source of truth for per-client identity (brand, GA id, domain, founding
year) read from clients.json, plus a guard that makes it structurally impossible
to publish one client's identity onto another client's site.

WHY THIS EXISTS
---------------
Cross-client pollution (e.g. Mr Green's name + GA id stamped onto Arcadian /
Ecosystem / Top Tier blog posts) was caused by template-based generators that:
  1. shared a single template file whose DEFAULT was a real client's branded HTML
  2. never read identity from clients.json at render time
  3. created "per-client" templates by copy-pasting another client's file
This module removes the shared-identity surface (identity comes from clients.json,
keyed by the client being rendered) and adds assert_no_cross_contamination(), which
EVERY template-based action must call before writing a file or git-committing.

The engine runs autonomously daily, so the guard is the enforcement mechanism:
a leaked render raises CrossContaminationError and never reaches a client repo.
"""

import json
import re
from pathlib import Path

CLIENTS_JSON = Path(__file__).resolve().parent.parent.parent / "clients.json"


class CrossContaminationError(Exception):
    """Raised when a rendered page carries another client's identity, or is
    missing its own. Blocks the write/commit."""


class MissingIdentityError(Exception):
    """Raised when clients.json lacks the identity fields needed to render a
    client. Fail loud instead of silently falling back to a default brand."""


def _load_clients():
    raw = json.loads(CLIENTS_JSON.read_text())
    records = raw if isinstance(raw, list) else list(raw.values())
    return {c["slug"]: c for c in records if c.get("slug")}


def client_identity(slug):
    """Return the canonical identity for a client. Raises if brand or GA id is
    missing -- the engine must never guess a brand or GA id."""
    clients = _load_clients()
    c = clients.get(slug)
    if not c:
        raise MissingIdentityError(f"No clients.json entry for slug '{slug}'")
    brand = (c.get("name") or "").strip()
    ga = (c.get("ga4_measurement_id") or "").strip()
    if not brand:
        raise MissingIdentityError(f"'{slug}' has no name in clients.json")
    if not ga:
        raise MissingIdentityError(
            f"'{slug}' has no ga4_measurement_id in clients.json -- set it before rendering")
    website = (c.get("website") or "").strip()
    domain = re.sub(r"^https?://(www\.)?|/$", "", website)
    return {
        "slug": slug,
        "brand": brand,
        "ga_id": ga,
        "domain": domain,
        "website": website,
        "founded_year": c.get("founded_year"),
        "primary_market": c.get("primary_market"),
    }


def _brand_pattern(name):
    """Compile a punctuation/whitespace-insensitive regex for a brand name.
    'Mr Green Turf Clean' matches 'Mr. Green Turf Clean' too. Requires all
    word tokens in sequence, so a generic single token can't false-positive."""
    tokens = re.findall(r"[A-Za-z0-9]+", name or "")
    if len(tokens) < 2:
        return None
    return re.compile(r"\b" + r"[\s.,&'\-]*".join(re.escape(t) for t in tokens) + r"\b", re.I)


def slug_for_path(website_path):
    """Map a website directory to its client slug via clients.json
    website_local_path. Lets in-place editors resolve who they're editing."""
    wp = str(Path(website_path).resolve())
    for slug, c in _load_clients().items():
        lp = c.get("website_local_path")
        if lp and str(Path(lp).resolve()) == wp:
            return slug
    return None


def assert_no_cross_contamination(html, slug, where="", require_own=True):
    """Guard called before writing/committing any rendered page.

    Raises CrossContaminationError if the page contains ANY other client's GA id
    or distinctive brand name. When require_own is True (full-page generators),
    also requires this client's own brand + GA id to be present. In-place editors
    pass require_own=False -- they only need to avoid introducing foreign identity.
    """
    me = client_identity(slug)
    loc = f" [{where}]" if where else ""

    # 1. full-page generators must carry own identity
    if require_own:
        if me["ga_id"] not in html:
            raise CrossContaminationError(
                f"{slug}{loc}: own GA id {me['ga_id']} missing from output")
        own_pat = _brand_pattern(me["brand"])
        if own_pat and not own_pat.search(html):
            raise CrossContaminationError(
                f"{slug}{loc}: own brand '{me['brand']}' missing from output")

    # 2. must NOT carry any other client's identity (GA id or brand name,
    #    punctuation-insensitive so 'Mr. Green' == 'Mr Green')
    clients = _load_clients()
    for other_slug, c in clients.items():
        if other_slug == slug:
            continue
        other_ga = (c.get("ga4_measurement_id") or "").strip()
        if other_ga and other_ga in html:
            raise CrossContaminationError(
                f"{slug}{loc}: foreign GA id {other_ga} ({other_slug}) found in output")
        pat = _brand_pattern((c.get("name") or "").strip())
        if pat:
            hit = pat.search(html)
            if hit:
                raise CrossContaminationError(
                    f"{slug}{loc}: foreign brand '{hit.group(0)}' ({other_slug}) found in output")
    return True


def scan_file(path, slug):
    """Convenience: run the guard against an existing file. Returns (ok, msg)."""
    try:
        assert_no_cross_contamination(Path(path).read_text(errors="ignore"), slug, where=Path(path).name)
        return True, "clean"
    except (CrossContaminationError, MissingIdentityError) as e:
        return False, str(e)


if __name__ == "__main__":
    # CLI scanner: python identity.py <slug> <glob...>  -> report contamination
    import sys, glob
    if len(sys.argv) < 3:
        print("usage: python identity.py <client_slug> <file_or_glob> [...]")
        sys.exit(2)
    slug = sys.argv[1]
    files = []
    for pat in sys.argv[2:]:
        files.extend(glob.glob(pat))
    bad = 0
    for f in sorted(files):
        ok, msg = scan_file(f, slug)
        if not ok:
            bad += 1
            print(f"  CONTAMINATED  {f}\n                {msg}")
    print(f"\n{len(files)} scanned, {bad} contaminated, {len(files)-bad} clean")
    sys.exit(1 if bad else 0)
