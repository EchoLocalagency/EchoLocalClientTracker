#!/usr/bin/env python3
"""
One-off export before GHL agency-tier downgrade (2026-05-28).

Pulls every contact (with tags) and every form submission from
Mr Green's and Integrity Pro's sub-accounts. Writes JSON files
under ~/EchoLocalClientTracker/data/ so we keep a permanent
record of what was in GHL before the sub-accounts get deleted.

Read-only. Safe to re-run.
"""
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

GHL_BASE = "https://services.leadconnectorhq.com"
GHL_VERSION = "2021-07-28"

CLIENTS = [
    {
        "slug": "mrgreen",
        "location_id": "3m3jhkEz2xInUprxbRzX",
        "token": "pit-fb1003e4-66c8-4354-80e7-a8c4355d76e5",
    },
    {
        "slug": "integrity_pro",
        "location_id": "KwsH04X22oBXm8Ugdqb8",
        "token": "pit-89db996b-2e9b-48a8-bf3d-458eae1b1dd4",
    },
]

OUT_DIR = Path.home() / "EchoLocalClientTracker" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
STAMP = datetime.now().strftime("%Y-%m-%d")


def headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "Version": GHL_VERSION,
        "Accept": "application/json",
    }


def pull_contacts(token, location_id):
    """Pull all contacts. Uses offset-based pagination (limit=100)."""
    all_contacts = []
    page = 1
    while True:
        params = {"locationId": location_id, "limit": 100, "page": page}
        r = requests.get(f"{GHL_BASE}/contacts/", headers=headers(token), params=params, timeout=30)
        if r.status_code == 401:
            raise SystemExit(f"  401 Unauthorized -- token expired or wrong location ({location_id})")
        if r.status_code == 403:
            raise SystemExit(f"  403 Forbidden -- token cannot access location ({location_id})")
        r.raise_for_status()
        data = r.json()
        batch = data.get("contacts", [])
        if not batch:
            break
        all_contacts.extend(batch)
        print(f"    page {page}: +{len(batch)} (total {len(all_contacts)})")
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.25)
    return all_contacts


def pull_forms(token, location_id):
    """List forms in the location."""
    r = requests.get(
        f"{GHL_BASE}/forms/",
        headers=headers(token),
        params={"locationId": location_id},
        timeout=30,
    )
    if r.status_code in (401, 403):
        print(f"    forms: {r.status_code} -- skipping")
        return []
    r.raise_for_status()
    return r.json().get("forms", [])


def pull_form_submissions(token, location_id, form_id):
    """Pull all submissions for a given form."""
    all_subs = []
    page = 1
    while True:
        params = {
            "locationId": location_id,
            "formId": form_id,
            "page": page,
            "limit": 100,
        }
        r = requests.get(
            f"{GHL_BASE}/forms/submissions",
            headers=headers(token),
            params=params,
            timeout=30,
        )
        if r.status_code in (401, 403):
            print(f"      submissions: {r.status_code} -- skipping")
            break
        r.raise_for_status()
        data = r.json()
        batch = data.get("submissions", [])
        if not batch:
            break
        all_subs.extend(batch)
        print(f"      page {page}: +{len(batch)} (total {len(all_subs)})")
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.25)
    return all_subs


def main():
    for client in CLIENTS:
        slug = client["slug"]
        print(f"\n=== {slug} ({client['location_id']}) ===")

        print("  contacts...")
        contacts = pull_contacts(client["token"], client["location_id"])
        contacts_path = OUT_DIR / f"{slug}_ghl_contacts_{STAMP}.json"
        contacts_path.write_text(json.dumps(contacts, indent=2, default=str))
        print(f"  -> {contacts_path}  ({len(contacts)} contacts)")

        print("  forms...")
        forms = pull_forms(client["token"], client["location_id"])
        forms_path = OUT_DIR / f"{slug}_ghl_forms_{STAMP}.json"
        forms_path.write_text(json.dumps(forms, indent=2, default=str))
        print(f"  -> {forms_path}  ({len(forms)} forms)")

        all_submissions = {}
        for f in forms:
            fid = f.get("id")
            fname = f.get("name", "?")
            if not fid:
                continue
            print(f"    form '{fname}' ({fid})")
            subs = pull_form_submissions(client["token"], client["location_id"], fid)
            all_submissions[fid] = {"name": fname, "submissions": subs}

        subs_path = OUT_DIR / f"{slug}_ghl_form_submissions_{STAMP}.json"
        subs_path.write_text(json.dumps(all_submissions, indent=2, default=str))
        total = sum(len(v["submissions"]) for v in all_submissions.values())
        print(f"  -> {subs_path}  ({total} submissions across {len(all_submissions)} forms)")

    print("\nDone.")


if __name__ == "__main__":
    main()
