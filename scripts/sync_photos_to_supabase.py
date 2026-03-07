"""
Photo Sync Pipeline
===================
Autonomous script that runs on a schedule to:
1. Pull new photos from each client's Google Drive folder
2. Convert HEIC -> JPEG, resize to 1200px (via photo_manager)
3. Upload JPEGs to Supabase public storage (gbp-photos bucket)
4. Track uploads so the GBP media uploader can reference them by URL

Run: python3 sync_photos_to_supabase.py [optional-slug-filter...]
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

BASE_DIR = Path("/Users/brianegan/EchoLocalClientTracker")
CLIENTS_FILE = BASE_DIR / "clients.json"
ASSETS_DIR = BASE_DIR / "assets"
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
BUCKET = "gbp-photos"

sys.path.insert(0, str(BASE_DIR / "scripts"))
from seo_engine.photo_manager import sync_photos, get_photo_manifest


def get_supabase_files(sb, slug):
    """List files already in Supabase storage for a client."""
    try:
        files = sb.storage.from_(BUCKET).list(slug)
        return {f["name"] for f in files} if files else set()
    except Exception:
        return set()


def upload_to_supabase(sb, slug, photo_path):
    """Upload a single photo to Supabase storage. Returns the public URL."""
    storage_path = f"{slug}/{photo_path.name}"
    photo_bytes = photo_path.read_bytes()

    sb.storage.from_(BUCKET).upload(
        storage_path, photo_bytes, {"content-type": "image/jpeg"}
    )
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"


def main():
    slug_filter = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    with open(CLIENTS_FILE) as f:
        clients = json.load(f)

    if slug_filter:
        clients = [c for c in clients if c["slug"] in slug_filter]

    # Only process clients with Drive folders and GBP locations
    clients = [c for c in clients if c.get("drive_folder_id") and c.get("gbp_location")]
    print(f"Processing {len(clients)} clients: {[c['name'] for c in clients]}\n")

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    for client in clients:
        slug = client["slug"]
        name = client["name"]
        print(f"{'='*50}")
        print(f"  {name}")
        print(f"{'='*50}")

        # Step 1: Sync new photos from Drive -> local JPEG
        website_path = client.get("website_local_path", "")
        if not website_path or not Path(website_path).exists():
            print(f"  Skipping: website_local_path not found ({website_path})")
            continue

        try:
            sync_result = sync_photos(slug, client["drive_folder_id"], website_path)
            print(f"  Drive sync: {sync_result['synced']} new, {sync_result['total']} total")
        except Exception as e:
            print(f"  Drive sync error: {e}")
            continue

        # Step 2: Upload local JPEGs to Supabase that aren't already there
        images_dir = Path(website_path) / "blog" / "images"
        if not images_dir.exists():
            print(f"  No images dir at {images_dir}")
            continue

        existing = get_supabase_files(sb, slug)
        print(f"  Already in Supabase: {len(existing)} photos")

        local_jpgs = [f for f in images_dir.iterdir() if f.suffix == ".jpg"]
        to_upload = [f for f in local_jpgs if f.name not in existing]
        print(f"  Local JPEGs: {len(local_jpgs)}, new to upload: {len(to_upload)}")

        uploaded = 0
        for photo in to_upload:
            try:
                url = upload_to_supabase(sb, slug, photo)
                uploaded += 1
                print(f"    Uploaded: {photo.name}")
            except Exception as e:
                err = str(e)
                if "Duplicate" in err or "already exists" in err:
                    print(f"    Already exists: {photo.name}")
                else:
                    print(f"    Failed: {photo.name} - {err}")

        print(f"  Uploaded {uploaded} new photos to Supabase\n")

    # Step 3: Write a Supabase URL index for the GBP uploader
    print("Building URL index...")
    for client in clients:
        slug = client["slug"]
        manifest_path = ASSETS_DIR / slug / "photos.json"
        if not manifest_path.exists():
            continue

        manifest = json.loads(manifest_path.read_text())
        updated = 0

        for drive_id, info in manifest.items():
            filename = info.get("local_filename", "")
            if not filename:
                continue
            supabase_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{slug}/{filename}"
            if info.get("supabase_url") != supabase_url:
                info["supabase_url"] = supabase_url
                updated += 1

        if updated:
            manifest_path.write_text(json.dumps(manifest, indent=2))
            print(f"  {client['name']}: updated {updated} URLs in manifest")

    print("\nPhoto sync complete.")


if __name__ == "__main__":
    main()
