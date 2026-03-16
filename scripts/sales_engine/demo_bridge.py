"""
Demo Bridge
============
Fires after sales_brain detects meeting_booked.
1. Parses demo date/time from transcript
2. Books appointment on GHL "Demo Call" calendar
3. Runs competitor research (Brave Search)
4. Generates personalized follow-up text via claude -p (Brian's voice)
5. Writes text to GHL custom field
6. Tags contact demo-booked (triggers GHL workflow)

The GHL workflow handles the actual SMS sequence:
  - 30 min after booking: personalized text (from Demo Bridge Text field)
  - Next day: urgency text (slot scarcity or results timeline)
  - 3 hours before demo: reminder + Zoom link
  - 30 min before demo: short nudge
"""

import json
import os
import re
import subprocess
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

# ── Config ──

GHL_TOKEN = "pit-c0736cdd-df6d-4285-9afa-b372861415e3"
GHL_LOCATION_ID = "1QUBKRg2rCS9K1lZFSI7"
GHL_CALENDAR_ID = "gSUeKUqVgBB0b3wXxA9W"
BRAVE_API_KEY = "BSA1ma1biQtoz8HPJBKnBLaCcBgw5U2"
MEET_LINK = "https://meet.google.com/waq-feyi-nfp"

GHL_HEADERS = {
    "Authorization": f"Bearer {GHL_TOKEN}",
    "Content-Type": "application/json",
    "Version": "2021-07-28",
}

# Custom field IDs
FIELD_DEMO_TEXT = "4ylSuWZSwJXAEtqREf9l"
FIELD_DEMO_URGENCY = "Gs9mWzb35aBXbUzBYukk"
FIELD_DEMO_DATETIME = "kV3ADo7Uheoa3CtaIgrF"
FIELD_CALL_HOOK = "CGGf5d400kbkBe3sxBmf"
FIELD_REVIEW_COUNT = "qCunuXALsjDMwoHIbVLA"
FIELD_ADDITIONAL_NOTES = "ynq73nmDIG6d72VDWWbu"


# ── Helpers ──

def parse_demo_datetime(caller_details, transcript):
    """Extract demo date/time from caller_details.next_step or transcript.

    Uses claude -p to parse natural language into a structured datetime.
    """
    next_step = ""
    if isinstance(caller_details, dict):
        next_step = caller_details.get("next_step", "")

    if not next_step and not transcript:
        return None

    today = datetime.now().strftime("%A, %B %d, %Y")
    prompt = f"""Today is {today}. The timezone is Pacific (America/Los_Angeles).

From a sales call, extract the agreed meeting date and time. Return ONLY a JSON object:
{{"datetime": "YYYY-MM-DDTHH:MM:SS", "confidence": "high" or "low"}}

If you can't determine the exact time, make your best guess based on context. Evening demos are usually 5:00 PM or 5:30 PM. Morning demos are usually 9:00 AM or 10:00 AM.

Next step from call analysis: "{next_step}"

Relevant transcript excerpt (last 500 chars): "{(transcript or '')[-500:]}"

Return ONLY the JSON. No explanation."""

    try:
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json",
             "--disable-slash-commands", "--setting-sources", ""],
            capture_output=True, text=True, timeout=30,
            cwd="/tmp", env=env,
        )
        if result.returncode != 0:
            return None

        outer = json.loads(result.stdout)
        text = outer.get("result", result.stdout)
        if "```" in text:
            text = text.split("```json")[-1].split("```")[0].strip()

        parsed = json.loads(text)
        dt_str = parsed.get("datetime")
        if dt_str:
            return datetime.fromisoformat(dt_str)
    except Exception as e:
        print(f"  [demo_bridge] datetime parse error: {e}")

    return None


def brave_search(query):
    """Search Brave for competitor data."""
    try:
        resp = requests.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={
                "Accept": "application/json",
                "X-Subscription-Token": BRAVE_API_KEY,
            },
            params={"q": query, "count": 5},
            timeout=10,
        )
        return resp.json() if resp.status_code == 200 else None
    except Exception:
        return None


def get_competitor_intel(trade, city):
    """Search for the top competitor in [trade] [city] and extract their info."""
    query = f"{trade} {city}"
    data = brave_search(query)
    if not data:
        return None

    results = (data.get("web") or {}).get("results", [])
    for r in results:
        title = r.get("title", "")
        url = r.get("url", "")
        desc = r.get("description", "")
        # Skip directories, yelp, etc
        if any(skip in url.lower() for skip in [
            "yelp.com", "yellowpages", "angi.com", "thumbtack",
            "homeadvisor", "bbb.org", "facebook.com", "instagram.com",
            "nextdoor.com", "google.com/maps",
        ]):
            continue
        return {"name": title.split("|")[0].split("-")[0].strip(), "url": url}

    return None


def get_competitor_reviews(competitor_name, city):
    """Get review count for the top competitor."""
    query = f'"{competitor_name}" {city} google reviews'
    data = brave_search(query)
    if not data:
        return None

    snippets = " ".join(
        r.get("description", "") for r in
        (data.get("web") or {}).get("results", [])
    )

    # Try to extract review count from snippets
    patterns = [
        r"(\d+)\s*(?:google\s*)?reviews?",
        r"rated\s*[\d.]+\s*(?:stars?\s*)?(?:with\s*)?(\d+)",
    ]
    for pat in patterns:
        match = re.search(pat, snippets, re.IGNORECASE)
        if match:
            count = int(match.group(1))
            if count > 0:
                return count

    return None


def generate_personalized_text(contact, call_data, competitor_intel):
    """Generate a casual, Brian-style follow-up text via claude -p."""
    contact_name = (contact.get("firstName") or
                    contact.get("contactName", "").split()[0] or "there")
    company = contact.get("companyName", "your business")
    city = contact.get("city", "your area")

    # Pull enrichment data
    fields = {f["id"]: f.get("value", "") for f in contact.get("customFields", [])}
    review_count = fields.get(FIELD_REVIEW_COUNT, "")
    notes = fields.get(FIELD_ADDITIONAL_NOTES, "")
    call_hook = fields.get(FIELD_CALL_HOOK, "")

    # Parse some signals from notes
    no_website = "WEBSITE: None" in notes or "Status: none" in notes
    no_responses = "Owner responds: no" in notes
    no_posts = "Active posts: no" in notes
    no_local_kw = "Local keywords: no" in notes

    # Build context for Claude
    competitor_context = ""
    if competitor_intel:
        comp_name = competitor_intel.get("name", "")
        comp_reviews = competitor_intel.get("reviews")
        if comp_name and comp_reviews:
            competitor_context = f"Top competitor: {comp_name} with {comp_reviews} Google reviews."
        elif comp_name:
            competitor_context = f"Top competitor in the area: {comp_name}."

    demo_day = call_data.get("demo_day", "our call")

    prompt = f"""You are Brian Egan. You're 22, student at Cal State San Marcos, you run Echo Local. You just got off a cold call where you booked a demo with a prospect. You need to send them a follow up text 30 minutes later.

RULES FOR YOUR VOICE:
- Super casual and laid back. Like texting a friend about business.
- Short sentences. No fluff.
- NEVER use dashes (--) or em dashes. Use periods or commas instead.
- NEVER use exclamation marks.
- Never say "I wanted to reach out" or "I hope this finds you" or any corporate speak.
- Never use the word "leverage" or "optimize" or "utilize."
- Don't capitalize things that don't need capitalizing.
- Sign off casually or don't sign off at all. No "Best regards" or "Looking forward to it!"
- 2-3 sentences max. Maybe 4 if you need to land a point.
- Reference 1-2 SPECIFIC things about their business, not generic stuff.

PROSPECT INFO:
- Name: {contact_name}
- Business: {company}
- City: {city}
- Reviews: {review_count}
- No website: {no_website}
- Not responding to reviews: {no_responses}
- No GBP posts: {no_posts}
- No local keywords on site: {no_local_kw}
- {competitor_context}
- Meeting scheduled for: {demo_day}

CALL HOOK (what you already know about them):
{call_hook}

Write the follow-up text. Return ONLY the text message, nothing else. No quotes around it."""

    try:
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json",
             "--disable-slash-commands", "--setting-sources", ""],
            capture_output=True, text=True, timeout=60,
            cwd="/tmp", env=env,
        )
        if result.returncode != 0:
            print(f"  [demo_bridge] claude error: {result.stderr[:200]}")
            return None

        outer = json.loads(result.stdout)
        text = outer.get("result", "").strip()

        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("```")[1].strip()
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]

        # Safety: reject if it has AI tells
        ai_tells = ["--", "!", "leverage", "optimize", "utilize", "reach out",
                     "hope this finds", "Best regards", "Looking forward"]
        for tell in ai_tells:
            text = text.replace(tell, "")

        return text.strip()

    except Exception as e:
        print(f"  [demo_bridge] text generation error: {e}")
        return None


def generate_urgency_text(contact, call_data, competitor_intel, personalized_text):
    """Generate a next-day urgency text that hits a DIFFERENT pain point than the first text."""
    contact_name = (contact.get("firstName") or
                    contact.get("contactName", "").split()[0] or "there")
    company = contact.get("companyName", "your business")
    city = contact.get("city", "your area")

    fields = {f["id"]: f.get("value", "") for f in contact.get("customFields", [])}
    review_count = fields.get(FIELD_REVIEW_COUNT, "")
    notes = fields.get(FIELD_ADDITIONAL_NOTES, "")

    no_website = "WEBSITE: None" in notes or "Status: none" in notes
    no_responses = "Owner responds: no" in notes
    no_posts = "Active posts: no" in notes
    no_local_kw = "Local keywords: no" in notes

    competitor_context = ""
    if competitor_intel:
        comp_name = competitor_intel.get("name", "")
        comp_reviews = competitor_intel.get("reviews")
        if comp_name and comp_reviews:
            competitor_context = f"Top competitor: {comp_name} with {comp_reviews} Google reviews."

    demo_day = call_data.get("demo_day", "our call")

    prompt = f"""You are Brian Egan. You're 22, student at Cal State San Marcos, you run Echo Local. You sent a prospect a personalized text yesterday after booking a demo. Now you need to send a NEXT DAY follow up that creates urgency.

RULES FOR YOUR VOICE:
- Super casual and laid back. Like texting a friend about business.
- Short sentences. No fluff.
- NEVER use dashes or em dashes. Use periods or commas instead.
- NEVER use exclamation marks.
- Never use corporate speak.
- Never use "leverage" or "optimize" or "utilize."
- 2-3 sentences max.

URGENCY APPROACH (use ONE of these, whichever fits best):
- Slot scarcity: you're only taking on 2 more businesses this month
- Results timeline: the system takes 30 days to show results, sooner they start the sooner the phone rings

CRITICAL RULE: You already sent this text yesterday, so DO NOT repeat the same pain points:
"{personalized_text}"

Hit a DIFFERENT specific finding about their business. If the first text was about reviews, talk about their website or GBP posts. If it was about rankings, talk about reviews.

PROSPECT INFO:
- Name: {contact_name}
- Business: {company}
- City: {city}
- Reviews: {review_count}
- No website: {no_website}
- Not responding to reviews: {no_responses}
- No GBP posts: {no_posts}
- No local keywords on site: {no_local_kw}
- {competitor_context}
- Meeting scheduled for: {demo_day}

Write the urgency text. Return ONLY the text message, nothing else. No quotes."""

    try:
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        result = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json",
             "--disable-slash-commands", "--setting-sources", ""],
            capture_output=True, text=True, timeout=60,
            cwd="/tmp", env=env,
        )
        if result.returncode != 0:
            return None

        outer = json.loads(result.stdout)
        text = outer.get("result", "").strip()

        if text.startswith("```"):
            text = text.split("```")[1].strip()
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]

        ai_tells = ["--", "!", "leverage", "optimize", "utilize", "reach out",
                     "hope this finds", "Best regards", "Looking forward"]
        for tell in ai_tells:
            text = text.replace(tell, "")

        return text.strip()

    except Exception as e:
        print(f"  [demo_bridge] urgency text error: {e}")
        return None


def book_ghl_appointment(contact_id, contact, demo_dt):
    """Book an appointment on the Demo Call calendar in GHL."""
    start = demo_dt.strftime("%Y-%m-%dT%H:%M:%S-07:00")
    end = (demo_dt + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S-07:00")

    contact_name = contact.get("contactName", contact.get("firstName", ""))
    company = contact.get("companyName", "")
    title = f"Demo: {company or contact_name}"

    payload = {
        "calendarId": GHL_CALENDAR_ID,
        "locationId": GHL_LOCATION_ID,
        "contactId": contact_id,
        "startTime": start,
        "endTime": end,
        "title": title,
        "appointmentStatus": "confirmed",
        "address": MEET_LINK,
        "notes": f"Google Meet: {MEET_LINK}",
    }

    try:
        resp = requests.post(
            "https://services.leadconnectorhq.com/calendars/events/appointments",
            headers=GHL_HEADERS,
            json=payload,
            timeout=15,
        )
        if resp.status_code in [200, 201]:
            appt = resp.json()
            print(f"  [demo_bridge] Appointment booked: {title} at {start}")
            return appt
        else:
            print(f"  [demo_bridge] Appointment failed {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  [demo_bridge] Appointment error: {e}")
        return None


def update_contact_fields(contact_id, demo_text, urgency_text, demo_dt):
    """Write the personalized text, urgency text, and demo datetime to GHL custom fields."""
    custom_fields = [
        {"id": FIELD_DEMO_TEXT, "value": demo_text or ""},
        {"id": FIELD_DEMO_URGENCY, "value": urgency_text or ""},
        {"id": FIELD_DEMO_DATETIME, "value": demo_dt.strftime("%Y-%m-%d %I:%M %p") if demo_dt else ""},
    ]

    try:
        resp = requests.put(
            f"https://services.leadconnectorhq.com/contacts/{contact_id}",
            headers=GHL_HEADERS,
            json={"customFields": custom_fields},
            timeout=15,
        )
        return resp.status_code in [200, 201]
    except Exception:
        return False


def tag_contact(contact_id, tag):
    """Add a tag to a GHL contact."""
    # First get existing tags
    try:
        resp = requests.get(
            f"https://services.leadconnectorhq.com/contacts/{contact_id}",
            headers=GHL_HEADERS,
            timeout=15,
        )
        if resp.status_code != 200:
            return False

        existing_tags = resp.json().get("contact", {}).get("tags", [])
        if tag in existing_tags:
            return True

        resp = requests.put(
            f"https://services.leadconnectorhq.com/contacts/{contact_id}",
            headers=GHL_HEADERS,
            json={"tags": existing_tags + [tag]},
            timeout=15,
        )
        return resp.status_code in [200, 201]
    except Exception:
        return False


def get_ghl_contact(phone=None, company_name=None):
    """Find a GHL contact by phone or company name."""
    query = phone or company_name or ""
    if not query:
        return None, None

    try:
        resp = requests.get(
            f"https://services.leadconnectorhq.com/contacts/"
            f"?locationId={GHL_LOCATION_ID}&query={query}&limit=1",
            headers=GHL_HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            contacts = resp.json().get("contacts", [])
            if contacts:
                return contacts[0].get("id"), contacts[0]
    except Exception:
        pass

    return None, None


# ── Main Entry Point ──

def run_demo_bridge(call_data, analysis):
    """Run the full demo bridge flow for a meeting_booked call.

    Called from call_watcher.py after a call is analyzed with outcome=meeting_booked.
    """
    contact_name = call_data.get("contact_name", "Unknown")
    company_name = call_data.get("company_name", "")
    phone = call_data.get("call_from") or call_data.get("phone", "")
    transcript = call_data.get("call_transcript", "")

    print(f"\n  [demo_bridge] Starting for {contact_name} ({company_name})")

    # 1. Find the GHL contact
    contact_id, contact = get_ghl_contact(phone, company_name)
    if not contact_id:
        print(f"  [demo_bridge] Contact not found in GHL for {phone} / {company_name}")
        return False

    # 2. Parse demo date/time
    caller_details = analysis.get("caller_details", {})
    demo_dt = parse_demo_datetime(caller_details, transcript)
    if demo_dt:
        demo_day = demo_dt.strftime("%A")
        print(f"  [demo_bridge] Parsed demo time: {demo_dt.strftime('%A %B %d at %I:%M %p')}")
    else:
        demo_day = "our call"
        print(f"  [demo_bridge] Could not parse demo time, skipping appointment booking")

    # 3. Book the GHL appointment
    if demo_dt:
        book_ghl_appointment(contact_id, contact, demo_dt)

    # 4. Get competitor intel
    city = contact.get("city", "")
    trade = "turf cleaning"  # default, could pull from custom fields
    fields = {f["id"]: f.get("value", "") for f in contact.get("customFields", [])}
    trade_field = fields.get("wGgdHu3izRJkcmr0eTB0", "")
    if trade_field:
        trade = trade_field.lower()

    competitor = get_competitor_intel(trade, city)
    if competitor:
        comp_reviews = get_competitor_reviews(competitor["name"], city)
        competitor["reviews"] = comp_reviews
        print(f"  [demo_bridge] Competitor: {competitor['name']} ({comp_reviews or '?'} reviews)")

    # 5. Generate personalized text
    call_context = {**call_data, "demo_day": demo_day}
    demo_text = generate_personalized_text(contact, call_context, competitor)
    if demo_text:
        print(f"  [demo_bridge] Generated text: {demo_text[:100]}...")
    else:
        print(f"  [demo_bridge] Text generation failed, using fallback")
        review_count = fields.get(FIELD_REVIEW_COUNT, "")
        demo_text = (f"Hey {contact.get('firstName', 'man')}, was looking into "
                     f"{company_name or 'your business'} on Google. "
                     f"Found a few things I want to show you {demo_day}. Talk then")

    # 5b. Generate urgency text (hits a different pain point)
    urgency_text = generate_urgency_text(contact, call_context, competitor, demo_text)
    if urgency_text:
        print(f"  [demo_bridge] Urgency text: {urgency_text[:100]}...")
    else:
        # Fallback to generic urgency
        urgency_text = (f"Hey {contact.get('firstName', 'man')}, just a heads up "
                        f"I'm only taking on 2 more businesses this month so wanted "
                        f"to make sure you're still locked in for {demo_day}. "
                        f"Looking forward to showing you what I found")

    # 6. Write custom fields
    ok = update_contact_fields(contact_id, demo_text, urgency_text, demo_dt)
    print(f"  [demo_bridge] Custom fields: {'OK' if ok else 'FAILED'}")

    # 7. Tag contact to trigger GHL workflow
    tagged = tag_contact(contact_id, "demo-booked")
    print(f"  [demo_bridge] Tag demo-booked: {'OK' if tagged else 'FAILED'}")

    return True
