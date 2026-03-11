"""
Manta.com Form Config Override
================================
Submission URL: https://www.manta.com/claim

Manta requires users to "claim" a business listing, which involves
an account creation / login flow. The submission URL redirects to
a claim verification process rather than a direct listing form.

NOTE: This directory requires account creation and claim verification.
The submission engine will skip it automatically when REQUIRES_ACCOUNT
is True. Manual claiming is recommended for Manta.
"""

# Flag: engine skips directories that require account creation
REQUIRES_ACCOUNT = True

# Field overrides for Manta's claim/edit form.
# These are based on typical Manta form patterns and should be
# verified manually once an account is created and a listing claimed.
FIELD_OVERRIDES = {
    "business_name": [
        {"type": "label", "value": "Business Name"},
        {"type": "css", "value": "input[name='companyName']"},
        {"type": "css", "value": "#companyName"},
        {"type": "placeholder", "value": "Company Name"},
    ],
    "phone": [
        {"type": "label", "value": "Phone"},
        {"type": "css", "value": "input[name='phoneNumber']"},
        {"type": "css", "value": "#phoneNumber"},
    ],
    "address_street": [
        {"type": "label", "value": "Address"},
        {"type": "css", "value": "input[name='address']"},
        {"type": "css", "value": "#address"},
    ],
    "website": [
        {"type": "label", "value": "Website"},
        {"type": "css", "value": "input[name='websiteUrl']"},
        {"type": "css", "value": "#websiteUrl"},
    ],
    "description": [
        {"type": "label", "value": "Description"},
        {"type": "css", "value": "textarea[name='companyDescription']"},
        {"type": "css", "value": "#companyDescription"},
    ],
}
