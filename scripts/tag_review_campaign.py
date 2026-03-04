"""
Review Campaign Tagger
======================
Cross-references each client's GHL past-customer contacts against their
GBP reviews. Tags 25% of past customers who haven't left a review with
the 'review campaign' tag in GHL.

Coordinates with tag_db_reactivation.py via shared campaign_tag_log.json
so no contact gets both campaigns in the same week.

Usage:
    python3 scripts/tag_review_campaign.py                       # runs all clients
    python3 scripts/tag_review_campaign.py integrity-pro-washers  # single client slug

Run weekly. 25% per run = full coverage in 4 weeks.
Already-tagged contacts are skipped so you won't double-tag.
"""

import warnings
warnings.filterwarnings('ignore')

import json, math, os, random, sys
from pathlib import Path
from dotenv import load_dotenv

import requests
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

load_dotenv()
BASE_DIR = Path('/Users/brianegan/EchoLocalClientTracker')
CLIENTS_FILE = BASE_DIR / 'clients.json'

sys.path.insert(0, str(BASE_DIR / 'scripts'))
from campaign_log import load_log, save_log, was_tagged_recently, record_tag, prune_old_entries

GBP_ACCOUNT = 'accounts/104544307189514761238'
REVIEW_TAG   = 'review campaign'
PAST_TAG     = 'past-customer'
SAMPLE_PCT   = 0.25

# ── Auth ────────────────────────────────────────────────────────────────

def get_gbp_token():
    creds = Credentials(
        token=None,
        refresh_token=os.getenv('GOOGLE_REFRESH_TOKEN'),
        client_id=os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
        token_uri='https://oauth2.googleapis.com/token',
        scopes=['https://www.googleapis.com/auth/business.manage']
    )
    creds.refresh(Request())
    return creds.token

# ── GHL ─────────────────────────────────────────────────────────────────

def ghl_headers(token):
    return {'Authorization': f'Bearer {token}', 'Version': '2021-07-28'}

def get_all_contacts(ghl_token, location_id):
    headers = ghl_headers(ghl_token)
    contacts = []
    start_after = start_after_id = None
    while True:
        params = {'locationId': location_id, 'limit': 100}
        if start_after:
            params['startAfter'] = start_after
            params['startAfterId'] = start_after_id
        r = requests.get('https://services.leadconnectorhq.com/contacts/',
                         headers=headers, params=params)
        batch = r.json().get('contacts', [])
        if not batch:
            break
        contacts.extend(batch)
        meta = r.json().get('meta', {})
        start_after = meta.get('startAfter')
        start_after_id = meta.get('startAfterId')
        if not start_after:
            break
    return contacts

def apply_tag(ghl_token, contact):
    headers = ghl_headers(ghl_token)
    new_tags = [t for t in contact.get('tags', []) if t != REVIEW_TAG] + [REVIEW_TAG]
    r = requests.put(
        f'https://services.leadconnectorhq.com/contacts/{contact["id"]}',
        headers=headers,
        json={'tags': new_tags}
    )
    return r.status_code == 200

# ── GBP ─────────────────────────────────────────────────────────────────

def get_reviewer_names(gbp_token, gbp_location):
    r = requests.get(
        f'https://mybusiness.googleapis.com/v4/{GBP_ACCOUNT}/{gbp_location}/reviews',
        headers={'Authorization': f'Bearer {gbp_token}'}
    )
    reviews = r.json().get('reviews', [])
    names = set()
    for rev in reviews:
        name = rev.get('reviewer', {}).get('displayName', '').lower().strip()
        if name:
            names.add(name)
    return names

def name_match(contact, reviewer_names):
    full  = (contact.get('contactName') or '').lower().strip()
    first = (contact.get('firstName') or '').lower().strip()
    last  = (contact.get('lastName') or '').lower().strip()
    for rname in reviewer_names:
        if full and (full in rname or rname in full):
            return True
        if first and last and first in rname and last in rname:
            return True
    return False

# ── Main ────────────────────────────────────────────────────────────────

def run_client(client, gbp_token, log):
    name        = client['name']
    slug        = client.get('slug', '')
    ghl_token   = client.get('ghl_token', '')
    location_id = client.get('ghl_location_id', '')
    gbp_location = client.get('gbp_location', '')

    if not ghl_token or not location_id or not gbp_location:
        print(f'  [{name}] Skipping -- missing ghl_token, ghl_location_id, or gbp_location')
        return log

    print(f'\n{name}')
    print('-' * 40)

    contacts = get_all_contacts(ghl_token, location_id)
    past = [c for c in contacts if PAST_TAG in c.get('tags', [])]
    print(f'  Past customers: {len(past)}')

    reviewer_names = get_reviewer_names(gbp_token, gbp_location)
    print(f'  GBP reviewers: {len(reviewer_names)}')

    eligible = [
        c for c in past
        if not name_match(c, reviewer_names)
        and REVIEW_TAG not in c.get('tags', [])
        and not was_tagged_recently(c['id'], log)
    ]
    print(f'  Eligible (no review, not yet tagged, not tagged this week): {len(eligible)}')

    if not eligible:
        print('  Nothing to tag.')
        return log

    target = max(1, math.ceil(len(eligible) * SAMPLE_PCT))
    batch = random.sample(eligible, min(target, len(eligible)))
    print(f'  Tagging {len(batch)} ({int(SAMPLE_PCT*100)}%):')

    ok = fail = 0
    for c in batch:
        if apply_tag(ghl_token, c):
            print(f'    Tagged: {c.get("contactName")}')
            log = record_tag(c['id'], 'review', slug, log)
            ok += 1
        else:
            print(f'    FAILED: {c.get("contactName")}')
            fail += 1

    print(f'  Done: {ok} tagged, {fail} failed.')
    return log

def main():
    clients = json.loads(CLIENTS_FILE.read_text())
    slug_filter = sys.argv[1] if len(sys.argv) > 1 else None

    gbp_token = get_gbp_token()
    log = load_log()
    log = prune_old_entries(log)

    for client in clients:
        if slug_filter and client.get('slug') != slug_filter:
            continue
        log = run_client(client, gbp_token, log)

    save_log(log)
    print('\nCampaign log saved.')

if __name__ == '__main__':
    main()
