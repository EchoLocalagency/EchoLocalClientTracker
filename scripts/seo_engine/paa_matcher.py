"""
PAA Matcher
===========
Matches People Also Ask questions against existing page content to
identify which questions the site already answers and which are gaps.

Uses difflib for fuzzy heading matching and substring checks on page text.
"""

from difflib import SequenceMatcher
from pathlib import Path

from bs4 import BeautifulSoup


def extract_page_headings(website_path):
    """Extract H2 headings and text content from HTML pages.

    Collects HTML files from root, blog/, and areas/ directories
    (non-recursive glob, same pattern as geo_scorer).

    Args:
        website_path: Path or str to website root directory.

    Returns:
        List of dicts: {"path": str, "headings": [str], "text": str}
    """
    root = Path(website_path)
    pages = []

    # Collect HTML files: root/*.html, blog/*.html, areas/*.html
    html_files = list(root.glob("*.html"))
    blog_dir = root / "blog"
    if blog_dir.exists():
        html_files.extend(blog_dir.glob("*.html"))
    areas_dir = root / "areas"
    if areas_dir.exists():
        html_files.extend(areas_dir.glob("*.html"))

    for filepath in html_files:
        try:
            html = filepath.read_text(errors="ignore")
            soup = BeautifulSoup(html, "html.parser")

            # Extract H2 headings
            headings = []
            for h2 in soup.find_all("h2"):
                text = h2.get_text(strip=True)
                if text:
                    headings.append(text)

            # Grab first 2000 chars of text content for deeper matching
            page_text = soup.get_text(separator=" ", strip=True)[:2000]

            rel_path = str(filepath.relative_to(root))
            pages.append({
                "path": rel_path,
                "headings": headings,
                "text": page_text,
            })
        except (OSError, UnicodeDecodeError):
            continue

    return pages


def match_paa_to_content(paa_questions, pages):
    """Match PAA questions to page headings via fuzzy matching.

    For each question, finds the best matching H2 heading across all pages
    using difflib.SequenceMatcher. Also checks if question text appears
    as a substring in page text as a secondary match signal.

    Args:
        paa_questions: List of question strings.
        pages: List of page dicts from extract_page_headings().

    Returns:
        Dict with:
            "matched": [{"question": str, "page": str, "heading": str, "score": float}]
            "gaps": [str]  -- questions with no match above threshold
    """
    matched = []
    gaps = []
    threshold = 0.6

    for question in paa_questions:
        q_norm = question.lower().rstrip("?").strip()
        best_score = 0.0
        best_page = ""
        best_heading = ""

        for page in pages:
            # Check H2 heading similarity
            for heading in page.get("headings", []):
                h_norm = heading.lower().rstrip("?").strip()
                score = SequenceMatcher(None, q_norm, h_norm).ratio()
                if score > best_score:
                    best_score = score
                    best_page = page["path"]
                    best_heading = heading

            # Secondary: check if question appears as substring in page text
            page_text_lower = page.get("text", "").lower()
            if q_norm in page_text_lower and best_score < threshold:
                # Substring match counts as a weak match (0.65)
                best_score = 0.65
                best_page = page["path"]
                best_heading = "(text match)"

        if best_score >= threshold:
            matched.append({
                "question": question,
                "page": best_page,
                "heading": best_heading,
                "score": round(best_score, 2),
            })
        else:
            gaps.append(question)

    return {"matched": matched, "gaps": gaps}
