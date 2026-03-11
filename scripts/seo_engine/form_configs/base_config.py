"""
Default Form Field Configuration
=================================
Maps canonical client profile fields to common form label/placeholder
alternatives used by directory submission forms. Each field has a list
of locator strategies tried in priority order: label first, placeholder
second, CSS selector third.

Used by the submission engine to fill forms on Tier 3 no-CAPTCHA directories.
"""

# Each field maps to a list of locator strategies in priority order.
# Types: "label" (get_by_label), "placeholder" (get_by_placeholder), "css" (locator)
BASE_FIELD_MAP = {
    "business_name": [
        {"type": "label", "value": "Business Name"},
        {"type": "label", "value": "Company Name"},
        {"type": "label", "value": "Name"},
        {"type": "placeholder", "value": "Business Name"},
        {"type": "placeholder", "value": "Enter business name"},
        {"type": "placeholder", "value": "Company Name"},
        {"type": "css", "value": "#business-name"},
        {"type": "css", "value": "#company-name"},
        {"type": "css", "value": "input[name='business_name']"},
        {"type": "css", "value": "input[name='company_name']"},
    ],
    "phone": [
        {"type": "label", "value": "Phone"},
        {"type": "label", "value": "Phone Number"},
        {"type": "label", "value": "Telephone"},
        {"type": "placeholder", "value": "Phone Number"},
        {"type": "placeholder", "value": "(555) 555-5555"},
        {"type": "placeholder", "value": "Phone"},
        {"type": "css", "value": "#phone"},
        {"type": "css", "value": "input[name='phone']"},
        {"type": "css", "value": "input[type='tel']"},
    ],
    "address_street": [
        {"type": "label", "value": "Street Address"},
        {"type": "label", "value": "Address"},
        {"type": "label", "value": "Street"},
        {"type": "placeholder", "value": "Street Address"},
        {"type": "placeholder", "value": "Address"},
        {"type": "css", "value": "#address"},
        {"type": "css", "value": "#street"},
        {"type": "css", "value": "input[name='address']"},
        {"type": "css", "value": "input[name='street']"},
    ],
    "address_city": [
        {"type": "label", "value": "City"},
        {"type": "placeholder", "value": "City"},
        {"type": "css", "value": "#city"},
        {"type": "css", "value": "input[name='city']"},
    ],
    "address_state": [
        {"type": "label", "value": "State"},
        {"type": "label", "value": "Province"},
        {"type": "placeholder", "value": "State"},
        {"type": "css", "value": "#state"},
        {"type": "css", "value": "input[name='state']"},
        {"type": "css", "value": "select[name='state']"},
    ],
    "address_zip": [
        {"type": "label", "value": "Zip"},
        {"type": "label", "value": "Zip Code"},
        {"type": "label", "value": "Postal Code"},
        {"type": "placeholder", "value": "Zip Code"},
        {"type": "placeholder", "value": "Zip"},
        {"type": "placeholder", "value": "Postal Code"},
        {"type": "css", "value": "#zip"},
        {"type": "css", "value": "#zipcode"},
        {"type": "css", "value": "input[name='zip']"},
        {"type": "css", "value": "input[name='zipcode']"},
    ],
    "email": [
        {"type": "label", "value": "Email"},
        {"type": "label", "value": "Email Address"},
        {"type": "label", "value": "E-mail"},
        {"type": "placeholder", "value": "Email Address"},
        {"type": "placeholder", "value": "Email"},
        {"type": "placeholder", "value": "you@example.com"},
        {"type": "css", "value": "#email"},
        {"type": "css", "value": "input[name='email']"},
        {"type": "css", "value": "input[type='email']"},
    ],
    "website": [
        {"type": "label", "value": "Website"},
        {"type": "label", "value": "URL"},
        {"type": "label", "value": "Web Address"},
        {"type": "placeholder", "value": "Website"},
        {"type": "placeholder", "value": "https://example.com"},
        {"type": "placeholder", "value": "URL"},
        {"type": "css", "value": "#website"},
        {"type": "css", "value": "#url"},
        {"type": "css", "value": "input[name='website']"},
        {"type": "css", "value": "input[name='url']"},
    ],
    "description": [
        {"type": "label", "value": "Description"},
        {"type": "label", "value": "About"},
        {"type": "label", "value": "Business Description"},
        {"type": "placeholder", "value": "Description"},
        {"type": "placeholder", "value": "Tell us about your business"},
        {"type": "placeholder", "value": "About your business"},
        {"type": "css", "value": "#description"},
        {"type": "css", "value": "textarea[name='description']"},
        {"type": "css", "value": "textarea[name='about']"},
    ],
}


def get_base_config() -> dict:
    """Return the default form field mapping."""
    return BASE_FIELD_MAP.copy()
