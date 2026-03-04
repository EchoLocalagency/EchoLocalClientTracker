"""
DB Reactivation Tagger
======================
Tags 25% of past customers with 're-activation start' in GHL.
Coordinates with the review campaign tagger via shared campaign_tag_log.json
so no contact gets both campaigns in the same week.

Usage:
    python3 scripts/tag_db_reactivation.py                       # runs all clients
    python3 scripts/tag_db_reactivation.py integrity-pro-washers  # single client slug
    python3 scripts/tag_db_reactivation.py mr-green-turf-clean

Run weekly. 25% per run = full coverage in 4 weeks.
"""

import warnings
warnings.filterwarnings('ignore')

import json, math, os, random, sys
from pathlib import Path
from dotenv import load_dotenv

import requests

load_dotenv()
BASE_DIR = Path('/Users/brianegan/EchoLocalClientTracker')
CLIENTS_FILE = BASE_DIR / 'clients.json'

REACTIVATION_TAG = 're-activation start'
PAST_TAG         = 'past-customer'
SAMPLE_PCT       = 0.25

# Contacts to NEVER reactivate (already on recurring service or monthly plans).
# Keyed by client slug. Values are lowercase first-name fragments to match.
EXCLUSIONS = {
    'integrity-pro-washers': ['maybeth', 'isabel'],
    'mr-green-turf-clean': [
        # TPP (Turf Protection Plan)
        'rebecca pomedick', 'brady richardson', 'johnny ballesteros',
        'gordan', 'kristin freitas', 'diana ryer', 'kelly', 'josh hall',
        # High-frequency recurring (3M or more often, not on TPP)
        'dustin', 'lindsay pakulat', 'aaron russel', 'emily hester', 'jessica',
    ],
}

sys.path.insert(0, str(BASE_DIR / 'scripts'))
from campaign_log import load_log, save_log, was_tagged_recently, record_tag, prune_old_entries

# -- GHL -----------------------------------------------------------------

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
    new_tags = [t for t in contact.get('tags', []) if t != REACTIVATION_TAG] + [REACTIVATION_TAG]
    r = requests.put(
        f'https://services.leadconnectorhq.com/contacts/{contact["id"]}',
        headers=headers,
        json={'tags': new_tags}
    )
    return r.status_code == 200


# -- Main ----------------------------------------------------------------

def is_excluded(contact, slug):
    """Check if contact name matches any exclusion for this client."""
    excluded_names = EXCLUSIONS.get(slug, [])
    if not excluded_names:
        return False
    full = (contact.get('contactName') or '').lower().strip()
    first = (contact.get('firstName') or '').lower().strip()
    last = (contact.get('lastName') or '').lower().strip()
    for exc in excluded_names:
        if exc in full or exc in first or (first and last and exc == f'{first} {last}'):
            return True
    return False


def run_client(client, log):
    name        = client['name']
    slug        = client.get('slug', '')
    ghl_token   = client.get('ghl_token', '')
    location_id = client.get('ghl_location_id', '')

    if not ghl_token or not location_id:
        print(f'  [{name}] Skipping -- missing ghl_token or ghl_location_id')
        return log

    print(f'\n{name}')
    print('-' * 40)

    contacts = get_all_contacts(ghl_token, location_id)
    past = [c for c in contacts if PAST_TAG in c.get('tags', [])]
    print(f'  Past customers: {len(past)}')

    excluded = [c for c in past if is_excluded(c, slug)]
    if excluded:
        print(f'  Excluded (recurring/monthly): {", ".join(c.get("contactName", "?") for c in excluded)}')

    eligible = [
        c for c in past
        if REACTIVATION_TAG not in c.get('tags', [])
        and not was_tagged_recently(c['id'], log)
        and not is_excluded(c, slug)
    ]
    print(f'  Eligible (no reactivation tag, not tagged this week, not excluded): {len(eligible)}')

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
            log = record_tag(c['id'], 'reactivation', slug, log)
            ok += 1
        else:
            print(f'    FAILED: {c.get("contactName")}')
            fail += 1

    print(f'  Done: {ok} tagged, {fail} failed.')
    return log


def main():
    clients = json.loads(CLIENTS_FILE.read_text())
    slug_filter = sys.argv[1] if len(sys.argv) > 1 else None

    log = load_log()
    log = prune_old_entries(log)

    for client in clients:
        if slug_filter and client.get('slug') != slug_filter:
            continue
        if not client.get('ghl_token'):
            continue
        log = run_client(client, log)

    save_log(log)
    print('\nCampaign log saved.')


if __name__ == '__main__':
    main()
