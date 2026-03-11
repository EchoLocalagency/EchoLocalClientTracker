# Technology Stack

**Project:** EchoLocal ClientTracker v1.2 -- Directory Submission & Tracking
**Researched:** 2026-03-10
**Confidence:** HIGH

## Existing Stack (validated, NOT changing)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | Dashboard frontend |
| React | 19.2.3 | UI framework |
| Recharts | 3.7.0 | Charts |
| Supabase JS | 2.97.0 | Browser client for dashboard |
| Tailwind CSS | 4.x | Styling |
| Python 3 | 3.9.6 | SEO engine backend |
| supabase-py | 2.28.0 | Python Supabase client |
| SerpAPI (`google-search-results`) | installed | SERP data, budget-gated |
| Brave Search API | via raw `requests` | Mention tracking, directory audit |
| `requests` | 2.31.0 | HTTP calls |
| `httpx` | 0.28.1 | HTTP calls (already installed) |
| `beautifulsoup4` | 4.14.3 | HTML parsing |
| `python-dotenv` | installed | Env var loading |

## New Stack Additions

### 1. Playwright for Python (CORE NEW DEPENDENCY)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `playwright` | 1.58.0 | Browser automation for directory form submission | Only viable option for reliable cross-site form filling. Handles JS-rendered forms, file uploads, dropdowns, CAPTCHAs requiring human viewport. Superior to Selenium in speed, reliability, and API ergonomics. Already Python 3.9+ compatible. |

**Verified details (PyPI, 2026-01-30 release):**
- Requires Python >=3.9 (matches our 3.9.6)
- Supports Chromium, Firefox, WebKit
- Async and sync APIs available -- use sync (`sync_playwright`) to match existing codebase pattern
- Headless by default, headful mode for debugging/CAPTCHA intervention
- Built-in auto-waiting eliminates flaky `time.sleep()` hacks

**Installation:**
```bash
pip install playwright==1.58.0
playwright install chromium  # Only Chromium needed. ~200MB download. Firefox/WebKit unnecessary.
```

**Why Chromium only:** Directory forms are standard web forms. No cross-browser testing needed. Chromium is the fastest Playwright engine and the most battle-tested for automation.

### 2. playwright-stealth (ANTI-DETECTION)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `playwright-stealth` | 2.0.2 | Mask automation fingerprints | Some directories (Houzz, Porch) use bot detection. Without stealth patches, `navigator.webdriver=true` gets flagged immediately. Lightweight -- just patches browser properties at launch. |

**Verified details (PyPI, 2026-02-13 release):**
- Requires Python >=3.9
- Patches `navigator.webdriver`, `chrome.runtime`, WebGL fingerprint, and other telltale properties
- Apply once at browser launch, transparent to all subsequent page operations
- Known limitation: Will NOT bypass Cloudflare Turnstile or advanced CAPTCHAs. Those directories need manual flagging, not stealth hacking.

**Usage pattern:**
```python
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    stealth_sync(page)  # One call, patches all fingerprints
    page.goto("https://example-directory.com/submit")
    page.fill("#business-name", "Mr. Green Turf Clean")
    page.click("button[type=submit]")
```

### 3. SerpAPI for Listing Verification (EXISTING -- NEW USE)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SerpAPI (existing `serpapi_client.py`) | installed | Google `site:` search to verify directory listings went live | Already budget-gated, already integrated. A `site:directoryname.com "Business Name"` query costs 1 SerpAPI credit and definitively proves indexing. Cheaper and more reliable than Google URL Inspection API (requires per-site GSC verification). |

**Verification query pattern:**
```python
# Uses existing serpapi_client.search_google()
result = search_google(
    query='site:houzz.com "Mr. Green Turf Clean"',
    client_id="mr-green-turf-clean",
    location="Oceanside, California",
    search_type="directory_verify"
)
# If organic_results has entries -> listing is indexed
```

**Budget impact:** ~30 directories per client x 4 clients = 120 verification queries/month. At current 950 global cap with ~400 used for SEO, leaves 550 -- plenty of headroom. Run verification once per week, not daily.

### 4. Brave Search for Pre-Submission Audit (EXISTING -- ENHANCED USE)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Brave Search API (existing `brave_client.py`) | via raw `requests` | Check if client is already listed before submitting | Existing `directory_audit.py` already does this with Brave. Extend the pattern to the full 30+ directory master list. Cheaper than SerpAPI for bulk "does this listing exist?" checks. |

**Enhancement:** The current `directory_audit.py` hardcodes 15 directories for Echo Local (the agency). Refactor to accept any client + any directory list. Same API, same budget, broader scope.

### 5. No New Dashboard Libraries

| Dashboard Feature | Implementation | Why No New Deps |
|-------------------|---------------|-----------------|
| Directory submission status table | Standard JSX table with status badges | Tailwind `bg-green-500/10 text-green-400` for approved, `bg-yellow-500/10` for pending, etc. No table library needed for ~30 rows. |
| Per-client directory coverage progress | Recharts `BarChart` (horizontal) | Show X of Y directories submitted per tier. Standard Recharts. |
| Backlink count from directories | Stat card (existing pattern) | Single number with trend. Matches `StatCard.tsx`. |
| Submission timeline | Recharts `AreaChart` or simple list | Submissions over time. Existing chart pattern. |

## Supabase: New Tables

Python writes, Next.js reads. Both use existing Supabase clients.

| New Table | Purpose | Key Columns |
|-----------|---------|-------------|
| `directories` | Master list of all directories with metadata | `id, name, url, tier (1-4), category, form_url, submission_method (form/email/manual), da_range, cost, notes, active` |
| `client_profiles` | Client NAP + business details for form filling | `id, client_id, business_name, phone, email, address, city, state, zip, website, services[], description_short, description_long, certifications[], logo_url, owner_name` |
| `directory_submissions` | Submission tracking with status workflow | `id, client_id, directory_id, status (pending/submitted/approved/rejected/verified/failed), submitted_at, verified_at, listing_url, retry_count, last_retry_at, error_notes, screenshot_path` |
| `directory_verifications` | Google site: search verification results | `id, submission_id, client_id, directory_id, query_used, found (bool), result_url, checked_at, serpapi_credits_used` |

**Status workflow:**
```
pending -> submitted -> approved -> verified
                    -> rejected -> (retry) -> submitted
                    -> failed (after max retries)
```

**Existing tables NOT changing:** `geo_scores`, `serp_features`, `serpapi_usage`, `brave_search_usage`, `mentions`, `mention_sources`

## Integration Points with Existing Codebase

### Python Side

```
scripts/seo_engine/backlinks/
  directory_audit.py    (EXISTS -- refactor to accept any client + directory list)
  directory_submitter.py (NEW -- Playwright form filler)
  directory_verifier.py  (NEW -- SerpAPI site: verification)
  directory_runner.py    (NEW -- orchestrates audit -> submit -> verify cycle)

scripts/seo_engine/seo_loop.py
  |-- Add directory_runner to weekly cycle (not daily -- submissions are weekly)
```

**Scheduling:** Extend existing launchd plist, do NOT add APScheduler or any scheduling library. The SEO engine already runs on launchd at noon daily. Add a day-of-week check for directory runs (e.g., Mondays only).

### Dashboard Side

```
src/app/seo-engine/
  |-- Existing tab system via SeoTabNav.tsx
  |-- Add "Directories" tab
  |-- Components:
      DirectoryStatus.tsx    -- table of all submissions with status badges
      DirectoryCoverage.tsx  -- per-tier progress bars
      DirectoryTimeline.tsx  -- recent submission activity feed
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Browser automation | Playwright | Selenium | Playwright is faster (no WebDriver protocol overhead), has better auto-wait, cleaner Python API, and native stealth plugin ecosystem. Selenium's Python bindings feel dated. |
| Browser automation | Playwright | Puppeteer (via pyppeteer) | Puppeteer is Node.js native. The `pyppeteer` Python port is unmaintained (last release 2021). |
| Browser automation | Playwright | requests + BeautifulSoup | Cannot handle JS-rendered forms, dropdowns, file uploads, or client-side validation. Most modern directory forms require a real browser. |
| Anti-detection | playwright-stealth | No stealth patches | Directories like Houzz and BuildZoom use basic bot detection. Without stealth, submissions fail silently or get flagged. Low-effort insurance. |
| Anti-detection | playwright-stealth | Selenium undetected-chromedriver | Selenium ecosystem. We chose Playwright. |
| Listing verification | SerpAPI site: query | Google URL Inspection API | URL Inspection API requires GSC ownership verification per domain -- impossible for third-party directories. SerpAPI site: search works universally. |
| Listing verification | SerpAPI site: query | Brave Search site: query | SerpAPI returns structured organic_results with exact URLs. Better for programmatic matching. Brave works but SerpAPI is more reliable for exact URL verification. |
| Pre-submission audit | Brave Search | SerpAPI | Brave is cheaper for bulk "does listing exist?" checks. Reserve SerpAPI credits for post-submission verification. |
| CAPTCHA handling | Flag for manual intervention | 2captcha / Anti-Captcha services | Paying to solve CAPTCHAs for free directory listings is wasteful. Most Tier 3 directories have no CAPTCHA or simple honeypot fields. Flag the exceptions. |
| Scheduling | launchd (existing) | APScheduler / Celery | Existing engine runs on launchd. Adding a Python scheduler creates two competing scheduling systems. Keep it simple. |
| Form field mapping | JSON config per directory | AI/LLM to auto-detect fields | Premature complexity. 30 directories is manageable with static JSON configs. LLM form detection is unreliable and adds latency + cost per submission. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Selenium / WebDriver | Slower, clunkier API, worse auto-waiting | Playwright 1.58.0 |
| `pyppeteer` | Unmaintained since 2021 | Playwright |
| 2captcha / Anti-Captcha | Paying for CAPTCHA solving on free directories is silly | Flag CAPTCHA directories for manual submission |
| APScheduler / Celery | Already have launchd scheduling | Day-of-week check in existing seo_loop.py |
| Google URL Inspection API | Requires GSC ownership per directory domain | SerpAPI `site:` query |
| Puppeteer (Node.js) | Would split automation between Python and Node.js | Playwright Python keeps everything in one language |
| Any form-detection AI/ML | 30 directories need static configs, not ML | JSON config files mapping form fields per directory |
| `pandas` for tracking | Supabase handles all storage and querying | Direct Supabase table operations |
| Screenshot comparison libs (Pillow, OpenCV) | Overkill for verifying submissions | Store Playwright screenshots as simple PNGs in Supabase Storage |

## Environment Variables

```bash
# New (none needed -- Playwright uses no API keys)
# All existing env vars remain unchanged.

# Already configured:
SERPAPI_KEY=already_configured
BRAVE_API_KEY=already_configured
SUPABASE_URL=already_configured
SUPABASE_KEY=already_configured
NEXT_PUBLIC_SUPABASE_URL=already_configured
NEXT_PUBLIC_SUPABASE_ANON_KEY=already_configured
```

**Total new env vars: 0**

## Installation

```bash
# Python: Two new packages
pip install playwright==1.58.0 playwright-stealth==2.0.2

# Install Chromium browser binary (~200MB one-time download)
playwright install chromium

# Next.js: Nothing to install
# npm packages unchanged
```

**Total new pip packages: 2** (`playwright`, `playwright-stealth`)
**Total new npm packages: 0**
**Total new env vars: 0**

## Disk/Resource Impact

- Chromium binary: ~200MB in `~/Library/Caches/ms-playwright/`
- Each submission screenshot: ~200KB PNG, stored in Supabase Storage
- Memory during submission: ~300MB per Chromium instance (one at a time, not concurrent)
- Submission runtime: ~30 seconds per directory (navigate + fill + submit + screenshot)
- Full run for 1 client (30 directories): ~15 minutes

## Sources

- [Playwright Python on PyPI](https://pypi.org/project/playwright/) -- v1.58.0, Jan 30 2026 (HIGH confidence)
- [Playwright Python Installation Docs](https://playwright.dev/python/docs/intro) -- Python >=3.9, browser install (HIGH confidence)
- [playwright-stealth on PyPI](https://pypi.org/project/playwright-stealth/) -- v2.0.2, Feb 13 2026 (HIGH confidence)
- [SerpAPI Google Search API](https://serpapi.com/search-api) -- site: operator support (HIGH confidence)
- [Brave Search API](https://brave.com/search/api/) -- existing integration (HIGH confidence)
- [Playwright Form Actions Docs](https://playwright.dev/python/docs/input) -- fill(), click(), select_option() (HIGH confidence)
- [Avoiding Bot Detection with Playwright Stealth](https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth) -- stealth techniques overview (MEDIUM confidence)
- Existing codebase: `directory_audit.py`, `serpapi_client.py`, `brave_client.py`, `seo_loop.py` -- established patterns (HIGH confidence)

---
*v1.2 stack research -- Directory Submission & Tracking*
*Supersedes v1.1 stack research (Mention Tracking + GEO Dashboard) from 2026-03-10*
