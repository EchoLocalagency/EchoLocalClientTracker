"""
Schema Injector
===============
Injects JSON-LD structured data into client HTML pages.
Supports FAQ, Service, and LocalBusiness schemas.
Audits existing pages for schema coverage.
"""

import json
import re
from pathlib import Path


def audit_page_schemas(website_path):
    """Scan all HTML pages and report which schemas each has.

    Returns list of dicts:
        [{"filename": "services.html", "schemas": ["LocalBusiness"]}, ...]
    """
    website_path = Path(website_path)
    results = []

    html_files = sorted(website_path.glob("*.html"))
    html_files += sorted((website_path / "blog").glob("*.html")) if (website_path / "blog").exists() else []
    html_files += sorted((website_path / "areas").glob("*.html")) if (website_path / "areas").exists() else []

    for f in html_files:
        if f.name == "index.html" and f.parent != website_path:
            rel = f"{f.parent.name}/{f.name}"
        else:
            rel = str(f.relative_to(website_path))

        schemas = _extract_schema_types(f.read_text())
        results.append({"filename": rel, "schemas": schemas})

    return results


def _extract_schema_types(html):
    """Extract @type values from all JSON-LD script blocks."""
    types = []
    pattern = r'<script\s+type=["\']application/ld\+json["\']>(.*?)</script>'
    for match in re.finditer(pattern, html, re.DOTALL | re.IGNORECASE):
        try:
            data = json.loads(match.group(1))
            if isinstance(data, dict):
                t = data.get("@type", "")
                if t:
                    types.append(t)
            elif isinstance(data, list):
                for item in data:
                    t = item.get("@type", "")
                    if t:
                        types.append(t)
        except (json.JSONDecodeError, AttributeError):
            continue
    return types


def inject_faq_schema(html, qa_pairs):
    """Inject FAQPage schema into HTML.

    Args:
        html: Full HTML string
        qa_pairs: List of {"question": "...", "answer": "..."} dicts

    Returns:
        Modified HTML string, or original if FAQ schema already exists
    """
    if _has_schema_type(html, "FAQPage"):
        return html

    if not qa_pairs:
        return html

    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": qa["question"],
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": qa["answer"],
                },
            }
            for qa in qa_pairs
        ],
    }

    return _inject_json_ld(html, schema)


def inject_service_schema(html, service_name, description, provider_name,
                          provider_url, provider_phone, area_served):
    """Inject Service schema into HTML.

    Args:
        html: Full HTML string
        service_name: e.g. "Pressure Washing in North Park"
        description: Service description
        provider_name: Business name
        provider_url: Business website URL
        provider_phone: Business phone
        area_served: City/neighborhood name

    Returns:
        Modified HTML string, or original if Service schema already exists
    """
    if _has_schema_type(html, "Service"):
        return html

    schema = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": service_name,
        "description": description,
        "provider": {
            "@type": "HomeAndConstructionBusiness",
            "name": provider_name,
            "url": provider_url,
            "telephone": provider_phone,
        },
        "areaServed": {
            "@type": "City",
            "name": area_served,
            "containedInPlace": {
                "@type": "State",
                "name": "California",
            },
        },
    }

    return _inject_json_ld(html, schema)


def inject_local_business_schema(html, name, url, phone, address,
                                 geo_lat, geo_lng, description="",
                                 services=None):
    """Inject LocalBusiness schema into HTML.

    Args:
        html: Full HTML string
        name: Business name
        url: Business URL
        phone: Phone number
        address: Dict with streetAddress, addressLocality, addressRegion, postalCode
        geo_lat: Latitude
        geo_lng: Longitude
        description: Business description
        services: Optional list of service names

    Returns:
        Modified HTML string, or original if LocalBusiness schema already exists
    """
    if _has_schema_type(html, "LocalBusiness") or _has_schema_type(html, "HomeAndConstructionBusiness"):
        return html

    schema = {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        "name": name,
        "url": url,
        "telephone": phone,
        "description": description,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": address.get("streetAddress", ""),
            "addressLocality": address.get("addressLocality", ""),
            "addressRegion": address.get("addressRegion", "CA"),
            "postalCode": address.get("postalCode", ""),
            "addressCountry": "US",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": geo_lat,
            "longitude": geo_lng,
        },
    }

    if services:
        schema["hasOfferCatalog"] = {
            "@type": "OfferCatalog",
            "name": "Services",
            "itemListElement": [
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": s}}
                for s in services
            ],
        }

    return _inject_json_ld(html, schema)


def inject_article_schema(html, title, description, date_published,
                          date_modified, author_name, author_url,
                          publisher_name, publisher_url):
    """Inject BlogPosting schema with rich author/publisher info and speakable.

    Upgrades basic BlogPosting to include Person author (not just Organization),
    dateModified, and speakable property for voice assistant citation.

    Returns:
        Modified HTML string, or original if BlogPosting schema already exists
    """
    if _has_schema_type(html, "BlogPosting"):
        return html

    schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "description": description,
        "datePublished": date_published,
        "dateModified": date_modified,
        "author": {
            "@type": "Person",
            "name": author_name,
            "url": author_url,
        },
        "publisher": {
            "@type": "Organization",
            "name": publisher_name,
            "url": publisher_url,
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": publisher_url,
        },
        "speakable": {
            "@type": "SpeakableSpecification",
            "cssSelector": [".answer-capsule", "h1", "h2"],
        },
    }

    return _inject_json_ld(html, schema)


def inject_person_schema(html, name, url, job_title, description):
    """Inject Person schema for author bio pages.

    Args:
        html: Full HTML string
        name: Author name
        url: Author profile URL
        job_title: e.g. "Owner" or "Lead Technician"
        description: 1-line bio

    Returns:
        Modified HTML string, or original if Person schema already exists
    """
    if _has_schema_type(html, "Person"):
        return html

    schema = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": name,
        "url": url,
        "jobTitle": job_title,
        "description": description,
    }

    return _inject_json_ld(html, schema)


def detect_faq_candidates(html):
    """Find question-format H2 headings and their answer paragraphs.

    A heading is considered a question if it ends with '?' or starts with
    a question word (how, what, why, when, where, is, can, do, does, should, will, are).

    Returns:
        List of {"question": str, "answer": str} dicts.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    candidates = []
    question_pattern = re.compile(
        r'^(how|what|why|when|where|is|can|do|does|should|will|are)\b', re.IGNORECASE
    )

    for h2 in soup.find_all("h2"):
        text = h2.get_text(strip=True)
        if not text:
            continue

        is_question = text.endswith("?") or bool(question_pattern.match(text))
        if not is_question:
            continue

        # Collect answer from next 1-2 sibling <p> tags (stop at next heading)
        answer_parts = []
        for sibling in h2.find_next_siblings():
            if sibling.name in ("h2", "h3"):
                break
            if sibling.name == "p":
                p_text = sibling.get_text(strip=True)
                if p_text:
                    answer_parts.append(p_text)
                if len(answer_parts) >= 2:
                    break

        if not answer_parts:
            continue

        question = text.rstrip("?") + "?"
        answer = " ".join(answer_parts)
        candidates.append({"question": question, "answer": answer})

    return candidates


def _has_schema_type(html, schema_type):
    """Check if HTML already contains a JSON-LD block with the given @type."""
    existing = _extract_schema_types(html)
    return schema_type in existing


def _inject_json_ld(html, schema_dict):
    """Inject a JSON-LD script block before </head>."""
    script = f"""    <script type="application/ld+json">
    {json.dumps(schema_dict, indent=4)}
    </script>"""

    if "</head>" in html:
        return html.replace("</head>", f"{script}\n</head>")
    return html


def inject_schemas_for_page(html, page_path, client_config):
    """Auto-detect and inject appropriate schemas based on page type and client.

    Called by seo_loop after schema_update actions or as a post-action hook.

    Returns:
        (modified_html, list_of_injected_types)
    """
    injected = []
    name = client_config["name"]
    url = client_config.get("website", "")
    phone = client_config.get("phone", "")

    # Client-specific coordinates
    coords = {
        "mr-green-turf-clean": (32.9628, -117.0359),
        "integrity-pro-washers": (32.7157, -117.1611),
    }
    lat, lng = coords.get(client_config["slug"], (32.7157, -117.1611))

    # Client-specific addresses
    addresses = {
        "mr-green-turf-clean": {
            "addressLocality": "Poway",
            "addressRegion": "CA",
        },
        "integrity-pro-washers": {
            "streetAddress": "2962 Laurel St",
            "addressLocality": "San Diego",
            "addressRegion": "CA",
            "postalCode": "92104",
        },
    }
    address = addresses.get(client_config["slug"], {})

    page_lower = page_path.lower()

    # Service pages and area pages get LocalBusiness + Service schema
    if "service" in page_lower or "areas/" in page_lower:
        before = html
        html = inject_local_business_schema(
            html, name, url, phone, address, lat, lng,
        )
        if html != before:
            injected.append("LocalBusiness")

    return html, injected
