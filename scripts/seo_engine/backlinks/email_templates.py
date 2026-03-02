"""
Email Templates for Backlink Outreach
======================================
4 templates: broken_link, brand_mention, haro_pitch, followup.
No em dashes, no emojis, short and direct.
All text runs through content_validator.clean_content() before sending.
"""

from ..content_validator import clean_content


def broken_link(contact_name, contact_url, broken_url, our_url, our_title):
    """Pitch to replace a broken outbound link with ours."""
    name = contact_name or "there"
    subject = f"Broken link on your site"

    body = f"""Hi {name},

I was reading through {contact_url} and noticed one of your outbound links is broken:

  {broken_url}

It returns a 404. We have a resource that covers the same topic:

  {our_url} - {our_title}

If it fits, feel free to swap it in. Either way, wanted to flag the dead link for you.

Best,
Brian Egan
Echo Local
Oceanside, CA
echolocalagency.com

If you'd prefer not to hear from us, just reply with "unsubscribe" and we'll remove you from our list.
"""
    return clean_content(subject), clean_content(body)


def brand_mention(contact_name, contact_url, mention_context, our_url):
    """Ask for a link where we're mentioned but not linked."""
    name = contact_name or "there"
    subject = f"Thanks for the mention"

    body = f"""Hi {name},

Saw you mentioned Echo Local on {contact_url} - appreciate it.

Would you be open to adding a link to our site? Here's the URL:

  {our_url}

No worries if not. Thanks for the shoutout either way.

Best,
Brian Egan
Echo Local
Oceanside, CA
echolocalagency.com

If you'd prefer not to hear from us, just reply with "unsubscribe" and we'll remove you from our list.
"""
    return clean_content(subject), clean_content(body)


def haro_pitch(journalist_name, query_topic, pitch_body):
    """Pitch response to a journalist query or contributor request."""
    name = journalist_name or "there"
    subject = f"Source for your {query_topic} piece"

    body = f"""Hi {name},

Saw you're working on something about {query_topic}. I run an SEO agency in San Diego that builds automated ranking systems for home service businesses.

{pitch_body}

Happy to provide more detail, screenshots, or data if any of this is useful.

Best,
Brian Egan
Founder, Echo Local
Oceanside, CA
echolocalagency.com

If you'd prefer not to hear from us, just reply with "unsubscribe" and we'll remove you from our list.
"""
    return clean_content(subject), clean_content(body)


def followup(contact_name, original_subject, followup_number):
    """Follow-up on a previous outreach email."""
    name = contact_name or "there"
    subject = f"Re: {original_subject}"

    if followup_number == 1:
        body = f"""Hi {name},

Just bumping this in case it got buried. Let me know if the link swap makes sense for your page.

Best,
Brian Egan
Echo Local

If you'd prefer not to hear from us, just reply with "unsubscribe" and we'll remove you from our list.
"""
    else:
        body = f"""Hi {name},

Last follow-up on this. If it's not a fit, no worries at all.

Best,
Brian Egan
Echo Local

If you'd prefer not to hear from us, just reply with "unsubscribe" and we'll remove you from our list.
"""
    return clean_content(subject), clean_content(body)


TEMPLATES = {
    "broken_link": broken_link,
    "brand_mention": brand_mention,
    "haro_pitch": haro_pitch,
    "followup": followup,
}
