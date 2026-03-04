"""
Photo Manager
=============
Syncs client photos from Google Drive to the website's blog/images/ directory.
Downloads new photos, resizes with sips (no Homebrew needed), and builds
a manifest the brain can reference when creating blog posts.

Manifest stored at: assets/{slug}/photos.json
Photos synced to:   {website_local_path}/blog/images/
"""

import io
import json
import os
import re
import struct
import subprocess
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

try:
    from PIL import Image
    from PIL.ExifTags import IFD
    import piexif
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
ASSETS_DIR = BASE_DIR / "assets"

# Max width for blog images (height scales proportionally)
MAX_WIDTH = 1200

# Client GPS coordinates for EXIF geo-tagging
CLIENT_COORDS = {
    "mr-green-turf-clean": (32.9628, -117.0359),
    "integrity-pro-washers": (32.7157, -117.1611),
}

# Client context for SEO filenames and alt text when no folder context exists
CLIENT_PHOTO_CONTEXT = {
    "mr-green-turf-clean": {
        "service": "turf cleaning",
        "market": "poway",
        "business": "Mr Green Turf Clean",
    },
    "integrity-pro-washers": {
        "service": "pressure washing",
        "market": "san diego",
        "business": "Integrity Pro Washers",
    },
}


def _get_drive_service():
    """Build an authenticated Drive API service."""
    creds = Credentials(
        token=None,
        refresh_token=os.getenv("GOOGLE_REFRESH_TOKEN"),
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        token_uri="https://oauth2.googleapis.com/token",
    )
    creds.refresh(Request())
    return build("drive", "v3", credentials=creds)


def _sanitize_filename(name):
    """Turn a Drive filename into a clean, URL-safe filename."""
    # Strip extension, we'll force .jpg
    stem = Path(name).stem
    # Lowercase, replace non-alphanumeric with hyphens, collapse multiples
    clean = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return f"{clean}.jpg"


def _sanitize_folder_name(name):
    """Turn a Drive folder name into a clean prefix."""
    clean = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    # Cap length to keep filenames reasonable
    return clean[:40]


def list_drive_photos(folder_id, service=None):
    """List all image files in a Drive folder, recursing into subfolders.

    Returns list of dicts:
        [{id, name, mimeType, size, folder_name, folder_id}, ...]
    """
    if service is None:
        service = _get_drive_service()

    photos = []

    # Get direct children
    page_token = None
    while True:
        result = service.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields="nextPageToken, files(id, name, mimeType, size)",
            pageSize=100,
            pageToken=page_token,
        ).execute()

        for f in result.get("files", []):
            if f["mimeType"].startswith("image/"):
                f["folder_name"] = ""
                f["folder_id"] = folder_id
                photos.append(f)
            elif f["mimeType"] == "application/vnd.google-apps.folder":
                # Recurse into subfolder
                sub_photos = _list_subfolder_photos(
                    f["id"], f["name"], service
                )
                photos.extend(sub_photos)

        page_token = result.get("nextPageToken")
        if not page_token:
            break

    return photos


def _list_subfolder_photos(subfolder_id, subfolder_name, service):
    """List image files in a single subfolder (non-recursive)."""
    photos = []
    page_token = None

    while True:
        result = service.files().list(
            q=f"'{subfolder_id}' in parents and mimeType contains 'image/' and trashed = false",
            fields="nextPageToken, files(id, name, mimeType, size)",
            pageSize=100,
            pageToken=page_token,
        ).execute()

        for f in result.get("files", []):
            f["folder_name"] = subfolder_name
            f["folder_id"] = subfolder_id
            photos.append(f)

        page_token = result.get("nextPageToken")
        if not page_token:
            break

    return photos


def _download_photo(file_id, dest_path, service):
    """Download a photo from Drive and save to dest_path."""
    request = service.files().get_media(fileId=file_id)
    content = request.execute()

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_bytes(content)
    return dest_path


def _resize_photo(photo_path, max_width=MAX_WIDTH):
    """Resize a photo using sips (macOS built-in, no Homebrew needed).

    Resizes to max_width, maintaining aspect ratio.
    Converts to JPEG if not already.
    """
    try:
        # Get current width
        result = subprocess.run(
            ["sips", "-g", "pixelWidth", str(photo_path)],
            capture_output=True, text=True, check=True,
        )
        width_match = re.search(r"pixelWidth:\s*(\d+)", result.stdout)
        if not width_match:
            return

        current_width = int(width_match.group(1))
        if current_width <= max_width:
            # Already small enough, just ensure JPEG format
            if not str(photo_path).lower().endswith(".jpg"):
                subprocess.run(
                    ["sips", "-s", "format", "jpeg", str(photo_path),
                     "--out", str(photo_path)],
                    capture_output=True, check=True,
                )
            return

        # Resize to max_width
        subprocess.run(
            ["sips", "--resampleWidth", str(max_width),
             "-s", "format", "jpeg", str(photo_path),
             "--out", str(photo_path)],
            capture_output=True, check=True,
        )
    except subprocess.CalledProcessError as e:
        print(f"  [photo_manager] sips error on {photo_path.name}: {e}")


def _write_exif_gps(photo_path, lat, lng):
    """Write GPS coordinates into JPEG EXIF data using piexif.

    Uses piexif for EXIF writing. Falls back silently if not available.
    """
    try:
        import piexif
    except ImportError:
        return

    try:
        exif_dict = piexif.load(str(photo_path))
    except Exception:
        exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}}

    def _to_rational(val):
        """Convert a float to a piexif-compatible rational tuple."""
        d = abs(val)
        degrees = int(d)
        minutes = int((d - degrees) * 60)
        seconds = int(((d - degrees) * 60 - minutes) * 60 * 10000)
        return ((degrees, 1), (minutes, 1), (seconds, 10000))

    gps_ifd = {
        piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude: _to_rational(lat),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lng >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude: _to_rational(lng),
    }
    exif_dict["GPS"] = gps_ifd

    try:
        exif_bytes = piexif.dump(exif_dict)
        piexif.insert(exif_bytes, str(photo_path))
    except Exception as e:
        print(f"  [photo_manager] EXIF write failed for {photo_path.name}: {e}")


def _build_seo_filename(photo, client_slug):
    """Build a keyword-rich, SEO-friendly filename from folder context.

    e.g. "turf-cleaning-poway-job-1065.jpg" instead of "img-1065.jpg"
    """
    folder = photo.get("folder_name", "")
    original = photo.get("name", "unknown")

    # Extract a numeric suffix from the original for uniqueness
    nums = re.findall(r"\d+", Path(original).stem)
    unique_id = nums[-1] if nums else Path(original).stem[:8]

    if folder:
        folder_part = _sanitize_folder_name(folder)
        return f"{folder_part}-{unique_id}.jpg"
    else:
        # No folder context -- use client business type for SEO value
        ctx = CLIENT_PHOTO_CONTEXT.get(client_slug, {})
        service = ctx.get("service", "work").replace(" ", "-")
        market = ctx.get("market", "job").replace(" ", "-")
        return f"{service}-{market}-{unique_id}.jpg"


def _generate_alt_text_hint(photo, client_slug):
    """Generate an alt text hint from photo context for the brain to refine."""
    folder = photo.get("folder_name", "")
    ctx = CLIENT_PHOTO_CONTEXT.get(client_slug, {})
    service = ctx.get("service", "work")
    market = ctx.get("market", "")
    business = ctx.get("business", client_slug.replace("-", " "))

    if folder:
        return f"{service} job in {folder} by {business}"
    return f"professional {service} in {market} by {business}"


def _build_local_filename(photo, prefix=""):
    """Build a local filename from a Drive photo entry."""
    if photo.get("folder_name"):
        folder_prefix = _sanitize_folder_name(photo["folder_name"])
        return f"{folder_prefix}-{_sanitize_filename(photo['name'])}"
    elif prefix:
        return f"{prefix}-{_sanitize_filename(photo['name'])}"
    else:
        return _sanitize_filename(photo["name"])


def sync_photos(client_slug, folder_id, website_path, max_photos=30):
    """Sync photos from Drive to website's blog/images/ directory.

    Only downloads photos not already in the manifest.
    Resizes all new photos to MAX_WIDTH.

    Args:
        client_slug: e.g. "mr-green-turf-clean"
        folder_id: Google Drive folder ID
        website_path: Path to website root directory
        max_photos: Max total photos to keep synced (prevents bloat)

    Returns:
        dict with sync stats
    """
    website_path = Path(website_path)
    images_dir = website_path / "blog" / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    manifest_dir = ASSETS_DIR / client_slug
    manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = manifest_dir / "photos.json"

    # Refresh existing manifest metadata (SEO filenames, alt text)
    if manifest_path.exists():
        refresh_manifest_metadata(client_slug, str(website_path))

    # Load existing manifest
    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())

    service = _get_drive_service()

    # List all photos in Drive
    print(f"  [photo_manager] Listing photos in Drive folder {folder_id}...")
    drive_photos = list_drive_photos(folder_id, service)
    print(f"  [photo_manager] Found {len(drive_photos)} photos in Drive")

    # Filter to ones not already synced
    synced_ids = set(manifest.keys())
    new_photos = [p for p in drive_photos if p["id"] not in synced_ids]

    # Cap total photos
    slots_available = max_photos - len(synced_ids)
    if slots_available <= 0:
        print(f"  [photo_manager] Already at max ({max_photos} photos). Skipping sync.")
        return {"synced": 0, "total": len(synced_ids), "skipped": len(new_photos)}

    to_download = new_photos[:slots_available]
    downloaded = 0

    # Get GPS coords for this client
    coords = CLIENT_COORDS.get(client_slug)

    for photo in to_download:
        local_name = _build_seo_filename(photo, client_slug)
        dest = images_dir / local_name

        try:
            print(f"  [photo_manager] Downloading {photo['name']} -> {local_name}")
            _download_photo(photo["id"], dest, service)
            _resize_photo(dest)

            # Write EXIF GPS data
            if coords:
                _write_exif_gps(dest, coords[0], coords[1])

            alt_hint = _generate_alt_text_hint(photo, client_slug)

            # Add to manifest
            manifest[photo["id"]] = {
                "local_filename": local_name,
                "original_name": photo["name"],
                "folder_name": photo.get("folder_name", ""),
                "drive_id": photo["id"],
                "alt_text_hint": alt_hint,
                "gbp_uploaded": False,
            }
            downloaded += 1
        except Exception as e:
            print(f"  [photo_manager] Failed to download {photo['name']}: {e}")

    # Save manifest
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"  [photo_manager] Synced {downloaded} new photos. Total: {len(manifest)}")

    return {
        "synced": downloaded,
        "total": len(manifest),
        "skipped": len(new_photos) - len(to_download),
    }


def get_photo_manifest(client_slug):
    """Get the list of available photos for the brain.

    Returns list of dicts with filename, context, alt_text_hint, and gbp_uploaded:
        [{"filename": "bread-and-salt-img-1234.jpg",
          "context": "from job: Bread & Salt",
          "alt_text_hint": "Bread & Salt job photo",
          "gbp_uploaded": false},
         ...]
    """
    manifest_path = ASSETS_DIR / client_slug / "photos.json"
    if not manifest_path.exists():
        return []

    manifest = json.loads(manifest_path.read_text())
    photos = []

    for drive_id, info in manifest.items():
        context = ""
        if info.get("folder_name"):
            context = f"from job: {info['folder_name']}"
        else:
            context = f"original: {info['original_name']}"

        photos.append({
            "filename": info["local_filename"],
            "context": context,
            "alt_text_hint": info.get("alt_text_hint", ""),
            "gbp_uploaded": info.get("gbp_uploaded", False),
        })

    return photos


def get_gbp_upload_candidates(client_slug, max_candidates=3):
    """Get photos not yet uploaded to GBP.

    Returns list of photo dicts suitable for gbp_photo actions.
    """
    manifest_path = ASSETS_DIR / client_slug / "photos.json"
    if not manifest_path.exists():
        return []

    manifest = json.loads(manifest_path.read_text())
    candidates = []

    for drive_id, info in manifest.items():
        if not info.get("gbp_uploaded", False):
            candidates.append({
                "drive_id": drive_id,
                "filename": info["local_filename"],
                "context": info.get("folder_name", ""),
                "alt_text_hint": info.get("alt_text_hint", ""),
            })

    return candidates[:max_candidates]


def refresh_manifest_metadata(client_slug, website_path=None):
    """Re-generate SEO filenames and alt text hints for all photos in manifest.

    Call this after updating _build_seo_filename or _generate_alt_text_hint
    to apply the new logic to existing photos. Renames files on disk if website_path provided.
    """
    manifest_path = ASSETS_DIR / client_slug / "photos.json"
    if not manifest_path.exists():
        return

    manifest = json.loads(manifest_path.read_text())
    website_path = Path(website_path) if website_path else None
    images_dir = website_path / "blog" / "images" if website_path else None
    renamed = 0

    for drive_id, info in manifest.items():
        photo = {
            "name": info.get("original_name", ""),
            "folder_name": info.get("folder_name", ""),
        }
        new_filename = _build_seo_filename(photo, client_slug)
        new_alt = _generate_alt_text_hint(photo, client_slug)
        old_filename = info.get("local_filename", "")

        # Rename file on disk if it changed and exists
        if images_dir and old_filename != new_filename:
            old_path = images_dir / old_filename
            new_path = images_dir / new_filename
            if new_path.exists():
                # New name already exists on disk (previous partial rename)
                info["local_filename"] = new_filename
                renamed += 1
            elif old_path.exists():
                try:
                    old_path.rename(new_path)
                    info["local_filename"] = new_filename
                    renamed += 1
                except OSError as e:
                    print(f"  [photo_manager] Rename failed for {old_filename}: {e}")
                    # Keep old filename in manifest so it matches disk
            else:
                # Neither old nor new exists on disk -- keep whatever manifest says
                print(f"  [photo_manager] Warning: {old_filename} not found on disk")
        else:
            info["local_filename"] = new_filename

        info["alt_text_hint"] = new_alt

    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"  [photo_manager] Refreshed manifest metadata for {client_slug} ({renamed} files renamed)")


def mark_as_gbp_uploaded(client_slug, drive_id):
    """Mark a photo as uploaded to GBP in the manifest."""
    manifest_path = ASSETS_DIR / client_slug / "photos.json"
    if not manifest_path.exists():
        return

    manifest = json.loads(manifest_path.read_text())
    if drive_id in manifest:
        manifest[drive_id]["gbp_uploaded"] = True
        manifest_path.write_text(json.dumps(manifest, indent=2))
        print(f"  [photo_manager] Marked {manifest[drive_id]['local_filename']} as GBP uploaded")
