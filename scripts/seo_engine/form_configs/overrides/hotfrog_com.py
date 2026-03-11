"""
Hotfrog.com Form Config Override
=================================
Submission URL: https://www.hotfrog.com/add-business

Hotfrog requires account creation to add a business listing.
The "Add Business" page redirects to a signup/login flow before
reaching the actual business profile form.

Once authenticated, the profile form uses non-standard field names
that differ from the base config semantic locators.

NOTE: This directory requires account creation. The submission engine
will skip it automatically when REQUIRES_ACCOUNT is True.
Manual submission is recommended for Hotfrog.
"""

# Flag: engine skips directories that require account creation
REQUIRES_ACCOUNT = True

# Field overrides for Hotfrog's business profile form.
# These are based on typical Hotfrog form patterns and should be
# verified manually once an account is created.
FIELD_OVERRIDES = {
    "business_name": [
        {"type": "label", "value": "Business name"},
        {"type": "placeholder", "value": "Your business name"},
        {"type": "css", "value": "input[name='businessName']"},
        {"type": "css", "value": "#businessName"},
    ],
    "phone": [
        {"type": "label", "value": "Phone number"},
        {"type": "placeholder", "value": "Phone number"},
        {"type": "css", "value": "input[name='phone']"},
        {"type": "css", "value": "#phone"},
    ],
    "address_street": [
        {"type": "label", "value": "Street address"},
        {"type": "css", "value": "input[name='streetAddress']"},
        {"type": "css", "value": "#streetAddress"},
    ],
    "website": [
        {"type": "label", "value": "Website URL"},
        {"type": "placeholder", "value": "https://"},
        {"type": "css", "value": "input[name='website']"},
        {"type": "css", "value": "#website"},
    ],
    "description": [
        {"type": "label", "value": "Business description"},
        {"type": "placeholder", "value": "Describe your business"},
        {"type": "css", "value": "textarea[name='description']"},
        {"type": "css", "value": "#description"},
    ],
}
