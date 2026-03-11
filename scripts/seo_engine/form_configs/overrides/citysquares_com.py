"""
CitySquares.com Form Config Override
======================================
Submission URL: https://www.citysquares.com/signup

CitySquares requires account creation (signup) before any business
listing can be added. The submission URL goes directly to a signup
page, not a business listing form.

NOTE: This directory requires account creation. The submission engine
will skip it automatically when REQUIRES_ACCOUNT is True.
Manual signup and listing is recommended for CitySquares.
"""

# Flag: engine skips directories that require account creation
REQUIRES_ACCOUNT = True

# Field overrides for CitySquares' business listing form.
# These are based on typical CitySquares form patterns and should be
# verified manually once an account is created.
FIELD_OVERRIDES = {
    "business_name": [
        {"type": "label", "value": "Business Name"},
        {"type": "css", "value": "input[name='business_name']"},
        {"type": "css", "value": "#business_name"},
        {"type": "placeholder", "value": "Business name"},
    ],
    "phone": [
        {"type": "label", "value": "Phone"},
        {"type": "css", "value": "input[name='phone']"},
        {"type": "css", "value": "#phone"},
    ],
    "address_street": [
        {"type": "label", "value": "Address"},
        {"type": "label", "value": "Street Address"},
        {"type": "css", "value": "input[name='address']"},
    ],
    "website": [
        {"type": "label", "value": "Website"},
        {"type": "css", "value": "input[name='website']"},
        {"type": "css", "value": "#website"},
    ],
    "description": [
        {"type": "label", "value": "Description"},
        {"type": "label", "value": "About"},
        {"type": "css", "value": "textarea[name='description']"},
    ],
}
