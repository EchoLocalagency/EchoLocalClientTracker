"""
Shared campaign tag log.
Both tag_review_campaign.py and tag_db_reactivation.py read/write here
so neither campaign tags a contact who was already tagged this week.

Log file: scripts/campaign_tag_log.json
Format:   { "contact_id": { "campaign": "review"|"reactivation", "date": "2026-03-03", "client": "slug" } }
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

LOG_FILE = Path(__file__).parent / 'campaign_tag_log.json'
COOLDOWN_DAYS = 7


def load_log():
    if LOG_FILE.exists():
        return json.loads(LOG_FILE.read_text())
    return {}


def save_log(log):
    LOG_FILE.write_text(json.dumps(log, indent=2))


def was_tagged_recently(contact_id, log=None):
    """True if this contact was tagged for ANY campaign in the last 7 days."""
    if log is None:
        log = load_log()
    entry = log.get(contact_id)
    if not entry:
        return False
    tag_date = datetime.strptime(entry['date'], '%Y-%m-%d').date()
    return (datetime.now().date() - tag_date) < timedelta(days=COOLDOWN_DAYS)


def record_tag(contact_id, campaign, client_slug, log=None):
    """Record that a contact was tagged today."""
    if log is None:
        log = load_log()
    log[contact_id] = {
        'campaign': campaign,
        'date': datetime.now().strftime('%Y-%m-%d'),
        'client': client_slug,
    }
    return log


def prune_old_entries(log=None):
    """Remove entries older than 30 days to keep the file small."""
    if log is None:
        log = load_log()
    cutoff = datetime.now().date() - timedelta(days=30)
    pruned = {
        cid: entry for cid, entry in log.items()
        if datetime.strptime(entry['date'], '%Y-%m-%d').date() >= cutoff
    }
    return pruned
