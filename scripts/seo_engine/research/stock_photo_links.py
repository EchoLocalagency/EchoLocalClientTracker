"""
Stock Photo Backlinks
=====================
Prepares client photos for upload to Unsplash, Flickr, and Pexels
with proper attribution metadata that links back to the client site.

Each uploaded photo becomes a passive backlink:
  - Flickr: description + tags contain client URL
  - Unsplash: photographer bio links to client site
  - Pexels: contributor profile links to client site

Usage:
    python3 -m scripts.seo_engine.research.stock_photo_links                  # all clients
    python3 -m scripts.seo_engine.research.stock_photo_links --client mr-green-turf-clean
"""

import csv
import json
import os
import re
import subprocess
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
ASSETS_DIR = BASE_DIR / "assets"
OUTPUT_DIR = BASE_DIR / "reports" / "stock-photo-uploads"

# Client metadata for attribution
CLIENT_META = {
    "mr-green-turf-clean": {
        "business_name": "Mr Green Turf Clean",
        "website": "https://mrgreenturfclean.com",
        "owner": "Mr Green Turf Clean",
        "market": "San Diego, CA",
        "services": ["artificial turf cleaning", "turf maintenance", "pet turf sanitizing"],
        "copyright_holder": "Mr Green Turf Clean",
        "tags": [
            "artificial turf", "turf cleaning", "synthetic grass", "pet turf",
            "san diego", "poway", "north county", "home service",
            "lawn maintenance", "artificial grass cleaning",
        ],
    },
    "integrity-pro-washers": {
        "business_name": "Integrity Pro Washers",
        "website": "https://integrityprowashers.com",
        "owner": "Integrity Pro Washers",
        "market": "San Diego, CA",
        "services": ["pressure washing", "soft washing", "solar panel cleaning"],
        "copyright_holder": "Integrity Pro Washers",
        "tags": [
            "pressure washing", "power washing", "soft washing", "solar panel cleaning",
            "san diego", "north park", "exterior cleaning", "home service",
            "driveway cleaning", "roof cleaning",
        ],
    },
}


def _write_iptc_metadata(photo_path, client_slug):
    """Write IPTC/XMP attribution metadata into a JPEG using sips + exiftool fallback.

    Embeds:
      - Copyright notice with client website
      - Credit line (business name)
      - Description with backlink URL
      - Keywords/tags for discoverability

    Uses sips for basic metadata. For full IPTC, generates a sidecar .json
    file that can be used with exiftool if available.
    """
    meta = CLIENT_META.get(client_slug, {})
    if not meta:
        return False

    business = meta["business_name"]
    website = meta["website"]
    copyright_text = f"(c) {date.today().year} {meta['copyright_holder']}. {website}"

    # sips can set some metadata fields
    try:
        subprocess.run(
            ["sips", "-s", "copyrightString", copyright_text, str(photo_path)],
            capture_output=True, check=True,
        )
    except subprocess.CalledProcessError:
        pass

    # Generate a sidecar metadata file for exiftool (if user installs it later)
    sidecar = {
        "SourceFile": str(photo_path),
        "IPTC:ObjectName": f"{business} - Professional Work Photo",
        "IPTC:Caption-Abstract": (
            f"Professional {meta['services'][0]} by {business} in {meta['market']}. "
            f"Learn more at {website}"
        ),
        "IPTC:CopyrightNotice": copyright_text,
        "IPTC:Credit": business,
        "IPTC:Source": website,
        "IPTC:Keywords": meta["tags"],
        "XMP:Creator": business,
        "XMP:Rights": copyright_text,
        "XMP:WebStatement": website,
        "XMP:Description": (
            f"Professional {meta['services'][0]} by {business} in {meta['market']}. "
            f"Visit {website} for a free estimate."
        ),
    }

    sidecar_path = photo_path.with_suffix(".json")
    sidecar_path.write_text(json.dumps(sidecar, indent=2))

    return True


def _build_upload_description(photo_info, client_slug):
    """Build a rich description for stock photo platforms."""
    meta = CLIENT_META.get(client_slug, {})
    if not meta:
        return ""

    folder = photo_info.get("folder_name", "")
    job_context = f" from a job in {folder}" if folder else ""

    return (
        f"Professional {meta['services'][0]}{job_context} "
        f"by {meta['business_name']} in {meta['market']}.\n\n"
        f"Free to use with attribution. Credit: {meta['business_name']} ({meta['website']})"
    )


def prepare_photos(client_slug, website_path=None):
    """Prepare all unprocessed photos for stock upload.

    Returns list of prepared photos with metadata.
    """
    manifest_path = ASSETS_DIR / client_slug / "photos.json"
    if not manifest_path.exists():
        print(f"  [stock_photos] No photo manifest for {client_slug}")
        return []

    manifest = json.loads(manifest_path.read_text())
    meta = CLIENT_META.get(client_slug, {})
    if not meta:
        print(f"  [stock_photos] No metadata configured for {client_slug}")
        return []

    # Find actual photo files
    if website_path:
        images_dir = Path(website_path) / "blog" / "images"
    else:
        images_dir = None

    prepared = []
    for drive_id, info in manifest.items():
        filename = info.get("local_filename", "")
        if not filename:
            continue

        # Check if photo exists on disk
        photo_path = images_dir / filename if images_dir else None
        exists = photo_path and photo_path.exists()

        # Build upload data
        description = _build_upload_description(info, client_slug)
        tags = meta["tags"].copy()

        # Add folder-specific tags
        folder = info.get("folder_name", "")
        if folder:
            folder_tags = re.sub(r"[^a-z0-9\s]", "", folder.lower()).split()
            tags.extend(folder_tags)

        entry = {
            "filename": filename,
            "drive_id": drive_id,
            "exists_on_disk": exists,
            "photo_path": str(photo_path) if photo_path else "",
            "title": f"{meta['business_name']} - {info.get('alt_text_hint', filename)}",
            "description": description,
            "tags": list(set(tags)),
            "credit": meta["business_name"],
            "website": meta["website"],
            "copyright": f"(c) {date.today().year} {meta['copyright_holder']}",
            "license": "Creative Commons Attribution 4.0 (CC BY 4.0)",
        }

        # Write IPTC metadata into the actual file if it exists
        if exists:
            _write_iptc_metadata(photo_path, client_slug)
            entry["metadata_written"] = True

        prepared.append(entry)

    return prepared


def generate_upload_csv(client_slug, prepared_photos):
    """Generate a CSV file for batch uploading to Flickr.

    Flickr supports CSV batch uploads with title, description, tags.
    This CSV can be used with Flickr Uploadr or the API.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUTPUT_DIR / f"{client_slug}-flickr-upload.csv"

    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "filename", "title", "description", "tags",
            "is_public", "content_type", "safety_level",
        ])
        writer.writeheader()

        for photo in prepared_photos:
            if not photo.get("exists_on_disk"):
                continue
            writer.writerow({
                "filename": photo["photo_path"],
                "title": photo["title"],
                "description": photo["description"],
                "tags": " ".join(f'"{t}"' for t in photo["tags"]),
                "is_public": 1,
                "content_type": 1,  # photo
                "safety_level": 1,  # safe
            })

    print(f"  [stock_photos] Flickr CSV: {csv_path}")
    return csv_path


def generate_upload_guide(client_slug, prepared_photos):
    """Generate a text guide with upload instructions for each platform."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    guide_path = OUTPUT_DIR / f"{client_slug}-upload-guide.txt"
    meta = CLIENT_META.get(client_slug, {})

    lines = [
        f"Stock Photo Upload Guide -- {meta.get('business_name', client_slug)}",
        f"Generated: {date.today()}",
        f"Photos ready: {len([p for p in prepared_photos if p.get('exists_on_disk')])}",
        "",
        "=" * 60,
        "FLICKR",
        "=" * 60,
        "1. Create a free Flickr account for the business",
        f"2. Set profile bio to: \"{meta.get('business_name', '')} - Professional {meta.get('services', [''])[0]} in {meta.get('market', '')}\"",
        f"3. Add website link: {meta.get('website', '')}",
        "4. Upload photos using the CSV file or manually",
        "5. Set license to 'Attribution (CC BY)' -- this encourages reuse with backlinks",
        "6. Use the tags and descriptions from the CSV",
        "",
        "=" * 60,
        "UNSPLASH",
        "=" * 60,
        "1. Apply for an Unsplash contributor account",
        f"2. Set bio: \"{meta.get('business_name', '')} -- Professional {meta.get('services', [''])[0]} serving {meta.get('market', '')}\"",
        f"3. Add portfolio link: {meta.get('website', '')}",
        "4. Upload photos individually (Unsplash doesn't support batch CSV)",
        "5. Add descriptions and tags from this guide",
        "6. Unsplash license is free-to-use, but your profile bio = permanent backlink",
        "",
        "=" * 60,
        "PEXELS",
        "=" * 60,
        "1. Apply to become a Pexels contributor",
        f"2. Set profile: \"{meta.get('business_name', '')}\"",
        f"3. Add website: {meta.get('website', '')}",
        "4. Upload photos with proper descriptions",
        "5. Pexels has stricter quality requirements -- submit best photos first",
        "",
        "=" * 60,
        "PHOTO DETAILS",
        "=" * 60,
        "",
    ]

    for i, photo in enumerate(prepared_photos, 1):
        if not photo.get("exists_on_disk"):
            continue
        lines.append(f"--- Photo {i}: {photo['filename']} ---")
        lines.append(f"  Title: {photo['title']}")
        lines.append(f"  Description: {photo['description']}")
        lines.append(f"  Tags: {', '.join(photo['tags'])}")
        lines.append(f"  Credit: {photo['credit']}")
        lines.append(f"  File: {photo['photo_path']}")
        lines.append("")

    guide_path.write_text("\n".join(lines))
    print(f"  [stock_photos] Upload guide: {guide_path}")
    return guide_path


def run_stock_photo_prep(client_slug=None):
    """Run the full stock photo preparation pipeline for one or all clients."""
    clients_file = BASE_DIR / "clients.json"
    clients = json.loads(clients_file.read_text())

    results = {}
    for client in clients:
        slug = client["slug"]
        if slug not in CLIENT_META:
            continue
        if client_slug and slug != client_slug:
            continue

        print(f"\n  [stock_photos] Preparing photos for {client['name']}...")
        website_path = client.get("website_local_path", "")

        prepared = prepare_photos(slug, website_path)
        if not prepared:
            print(f"  [stock_photos] No photos to prepare")
            continue

        on_disk = [p for p in prepared if p.get("exists_on_disk")]
        print(f"  [stock_photos] {len(on_disk)}/{len(prepared)} photos found on disk")

        if on_disk:
            csv_path = generate_upload_csv(slug, prepared)
            guide_path = generate_upload_guide(slug, prepared)
            results[slug] = {
                "total": len(prepared),
                "on_disk": len(on_disk),
                "csv": str(csv_path),
                "guide": str(guide_path),
            }

    return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Stock Photo Backlinks Prep")
    parser.add_argument("--client", type=str, help="Run for a specific client slug")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"  Stock Photo Backlinks Prep  |  {date.today()}")
    print(f"{'='*60}")

    results = run_stock_photo_prep(client_slug=args.client)

    if results:
        print(f"\n{'='*60}")
        print("  Summary")
        print(f"{'='*60}")
        for slug, r in results.items():
            print(f"  {slug}: {r['on_disk']} photos prepped")
            print(f"    Flickr CSV: {r['csv']}")
            print(f"    Upload guide: {r['guide']}")
    else:
        print("\n  No photos prepared. Make sure photo_manager has synced photos first.")

    print("\nDone.")
