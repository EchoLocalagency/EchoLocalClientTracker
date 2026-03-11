# Architecture Research

**Domain:** v1.2 Directory Submission & Tracking System
**Researched:** 2026-03-10
**Confidence:** HIGH (based on direct codebase review + existing patterns)

## Existing Architecture (Baseline)

```
launchd (daily noon)
  |
  v
seo_loop.py (7-step orchestrator)
  |-- [1] data_collector.py       (GA4, GSC, GBP, PageSpeed)
  |-- [1b] geo_scorer.py          (local HTML -> geo_scores table)
  |-- [1c] geo_data.py            (geo_scores + serp_features for brain)
  |-- [2] research_runner.py      (Wed+Sat: 11 steps incl mention_tracker)
  |-- [3] outcome follow-ups
  |-- [4] photo sync
  |-- [5] brain.py                (claude -p -> prioritized actions)
  |-- [6] execute actions         (rate-limited via WEEKLY_LIMITS)
  |-- [7] summary
  |
  v
Supabase (Postgres)
  |-- clients, reports, seo_actions, seo_brain_decisions
  |-- geo_scores, serp_features, serpapi_usage
  |-- backlink_targets, backlink_outreach (existing outreach tables)
  |-- client_mentions (v1.1)
  |
  v
Next.js Dashboard (src/app/seo-engine/page.tsx)
  |-- SeoTabNav: clients | actions | brain | keywords | geo
  |-- Direct Supabase queries via @supabase/supabase-js
  |-- Recharts for charts
```

**Key existing modules relevant to v1.2:**
- `backlinks/directory_audit.py` -- Uses Brave Search to check if a business is listed on known directories. Currently hardcoded for Echo Local only. Pattern is reusable.
- `backlinks/outreach_executor.py` + `email_templates.py` + `gmail_sender.py` -- Existing outreach pipeline. Directory submissions are a different mechanism (form fill, not email) but status tracking patterns apply.
- `clients.json` -- Already has NAP data (name, phone, website, service_areas, primary_market). Missing: business description, certifications, license numbers, hours. These are needed for directory form fills.
- `WEEKLY_LIMITS` in seo_loop.py -- Rate-limiting pattern. Directory submissions need similar daily caps.
- `seo_actions` table -- Logs every action the engine takes. Directory submissions should also log here for brain visibility.

## New Components (v1.2)

### Supabase: 3 New Tables + 1 Extended Table

---

#### NEW TABLE: `directories`

Master list of all directories. Trade-agnostic. One row per directory, never per client.

```sql
CREATE TABLE directories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  tier INTEGER NOT NULL,             -- 1=manufacturer, 2=trade_assoc, 3=home_service, 4=government
  category TEXT NOT NULL,            -- 'turf_manufacturer', 'hardscape', 'trade_assoc', 'high_value', 'medium_value', 'low_value', 'government'
  domain_authority INTEGER,          -- estimated DA, NULL if unknown
  cost TEXT DEFAULT 'free',          -- 'free', '$95', '~$300-600/yr', 'unknown'
  submission_method TEXT NOT NULL,   -- 'form_fill', 'email_application', 'client_action_required', 'contact_sales'
  requires_client_input BOOLEAN DEFAULT FALSE,  -- true for Tier 1/2 needing certs, membership
  form_url TEXT,                     -- direct URL to submission form (if form_fill)
  notes TEXT,
  trades TEXT[] DEFAULT '{}',        -- which trades this applies to: '{turf,landscaping,pressure_washing,home_service}'
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_directories_tier ON directories(tier);
CREATE INDEX idx_directories_method ON directories(submission_method);
```

**Why a separate table (not JSON in code):** The master list has 50+ entries across 4 tiers. It needs to be queryable by tier, trade, submission_method. Supabase lets the dashboard read it directly. Adding new directories is an INSERT, not a code deploy.

**Population:** One-time seed script loads from the find-a-pro-directory-master-list.md data. ~55 directories total.

---

#### NEW TABLE: `directory_submissions`

Tracks every client-directory pair through the submission lifecycle.

```sql
CREATE TABLE directory_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL,
  directory_id UUID REFERENCES directories(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, submitted, approved, rejected, verified, skipped
  submitted_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  listing_url TEXT,                   -- URL of live listing once found
  retry_count INTEGER DEFAULT 0,
  error_log TEXT,                     -- last error if submission failed
  notes TEXT,
  metadata JSONB DEFAULT '{}',       -- form fields used, screenshots, etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, directory_id)
);

CREATE INDEX idx_dir_submissions_client ON directory_submissions(client_id);
CREATE INDEX idx_dir_submissions_status ON directory_submissions(status);
CREATE INDEX idx_dir_submissions_submitted ON directory_submissions(submitted_at);
```

**Status workflow:**
```
pending -> submitted -> approved -> verified
                    \-> rejected
pending -> skipped (client not eligible or directory down)
submitted -> pending (retry after failure, retry_count++)
```

**Why UNIQUE(client_id, directory_id):** One submission per client per directory. Retries update the same row (increment retry_count, update status back to pending). No duplicate tracking.

---

#### NEW TABLE: `client_profiles`

Extended business info needed for form fills that does not belong in clients.json (which is config, not data).

```sql
CREATE TABLE client_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) NOT NULL UNIQUE,
  business_description TEXT,          -- 2-3 sentence description for directory bios
  short_description TEXT,             -- 1 sentence / tagline
  services TEXT[],                    -- ['turf cleaning', 'artificial turf maintenance', ...]
  certifications TEXT[],              -- ['TurFresh Certified', 'CLCA Member', ...]
  license_number TEXT,
  year_established INTEGER,
  hours_of_operation TEXT,            -- 'Mon-Fri 8am-5pm, Sat 9am-2pm'
  owner_name TEXT,
  owner_email TEXT,
  categories TEXT[],                  -- standardized: ['landscaping', 'turf_cleaning', 'pressure_washing']
  trades TEXT[],                      -- which trades client operates in
  logo_url TEXT,
  cover_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Why a new table (not extending clients.json):**
- clients.json is checked into git and consumed by the SEO engine as config. Adding mutable profile data (descriptions that get refined, certs that change) does not belong there.
- Directory form fills need Supabase access at submission time. A Supabase table is directly queryable by both Python and the dashboard.
- The dashboard needs to display and eventually edit this data. Direct Supabase access matches existing patterns.

**Data source:** Brian populates this during client onboarding. The brain can suggest description improvements over time.

---

#### EXTENDED: `clients.json`

No schema change. But the existing fields map to form fill needs:

| Form Field | Source |
|------------|--------|
| Business Name | `clients.json -> name` |
| Phone | `clients.json -> phone` |
| Website | `clients.json -> website` |
| City / Market | `clients.json -> primary_market` |
| Service Areas | `clients.json -> service_areas` |
| Description | `client_profiles -> business_description` |
| Services | `client_profiles -> services` |
| Hours | `client_profiles -> hours_of_operation` |

---

### Python Side: 3 New Modules + 2 Modified Files

---

#### NEW: `scripts/seo_engine/backlinks/directory_submitter.py`

**Responsibility:** Playwright-based form submission for Tier 3 directories. Takes a client profile + directory record, navigates to form URL, fills fields, submits.

**Why Playwright (not requests):**
- Most directory submission forms are JS-rendered SPAs or have CAPTCHA challenges.
- Playwright handles dynamic forms, file uploads (logo), multi-step wizards.
- Headless Chromium runs fine on macOS via launchd.

**Core interface:**
```python
async def submit_to_directory(
    client_config: dict,
    client_profile: dict,
    directory: dict,
) -> dict:
    """
    Opens directory form_url in headless Playwright browser.
    Maps client data to form fields using field_mapping heuristics.
    Submits form. Takes screenshot of confirmation page.

    Returns {
        "success": bool,
        "listing_url": str or None,
        "screenshot_path": str,
        "error": str or None,
        "fields_filled": dict,
    }
    """
```

**Field mapping strategy:** Each Tier 3 directory has different form field names. Two approaches:

1. **Heuristic matching** (build first): Scan form for input labels/placeholders containing "business name", "phone", "website", "city", "description", "email". Map to client profile fields. Works for ~70% of simple forms.

2. **Per-directory config** (add as needed): For forms where heuristics fail, add a `field_mapping` JSON to the `directories` table metadata column. Maps CSS selectors to profile fields.

**Rate limiting:** Max 5 submissions per run. `time.sleep(3-5)` between submissions to avoid IP blocks. Playwright uses a real browser fingerprint which helps avoid bot detection.

**Error handling:**
- CAPTCHA detected -> skip, mark as `needs_manual`, alert Brian
- Form submission error -> log to `error_log`, increment `retry_count`
- Timeout -> retry next cycle
- Success but no confirmation URL -> mark `submitted`, verify later via Google site: search

---

#### NEW: `scripts/seo_engine/backlinks/directory_verifier.py`

**Responsibility:** Verify that submitted listings actually went live using Google `site:` search via Brave Search API.

**Core interface:**
```python
def verify_submissions(client_config: dict) -> list:
    """
    Queries Supabase for submissions with status='submitted' older than 7 days.
    For each, runs Brave Search: site:{directory_domain} "{client_name}"
    If found: updates status to 'verified', stores listing_url.
    If not found after 14+ days: alerts Brian.

    Returns list of verification results.
    """
```

**Why Brave Search (not SerpAPI):**
- SerpAPI budget is precious (950/month) and used for keyword tracking.
- Brave Search free tier (2,000/month) has plenty of headroom for verification queries.
- `site:` operator works well on Brave for this use case (already proven in directory_audit.py).

**Verification cadence:** Runs daily as part of seo_loop. Checks only submissions in `submitted` status older than 7 days. Estimated 2-5 Brave queries per client per day during active submission periods.

**Escalation logic:**
- 7 days after submission: first verification check
- 14 days, still unverified: log warning, alert Brian (print to summary)
- 21 days, still unverified: mark as `needs_review`, stop auto-checking

---

#### NEW: `scripts/seo_engine/backlinks/directory_manager.py`

**Responsibility:** Orchestrator for the directory submission system. Determines which directories to submit to, coordinates submitter + verifier, respects daily caps.

**Core interface:**
```python
def run_directory_cycle(client_config: dict, client_id: str, dry_run: bool = True) -> dict:
    """
    1. Load client_profile from Supabase
    2. Load directories matching client's trades
    3. Check existing submissions (skip already submitted/verified)
    4. For Tier 3 form_fill directories not yet submitted:
       - Queue up to 5 per run
       - Call directory_submitter for each
       - Log results to directory_submissions table
       - Log to seo_actions table (for brain visibility)
    5. For Tier 1/2 directories requiring client action:
       - Surface as recommendations (stored in directory_submissions as 'pending' with notes)
    6. Run verification checks on previously submitted entries
    7. Return summary

    Returns {
        "submitted": int,
        "verified": int,
        "pending_verification": int,
        "recommendations": list,  # Tier 1/2 needing client input
        "errors": list,
    }
    """
```

**Daily cap:** 5 submissions per client per run. With ~25 Tier 3 directories per client, this means 5 days to complete all form fills. Spreading submissions over days avoids spam detection patterns.

---

#### MODIFIED: `scripts/seo_engine/seo_loop.py`

**Changes:** Add Step 4b between photo sync and brain call.

```python
# ── Step 4b: Directory submissions ──
print(f"\n  [4b/7] Directory submission cycle...")
directory_summary = {}
try:
    from .backlinks.directory_manager import run_directory_cycle
    directory_summary = run_directory_cycle(client, client_id, dry_run=dry_run)
    submitted = directory_summary.get("submitted", 0)
    verified = directory_summary.get("verified", 0)
    pending = directory_summary.get("pending_verification", 0)
    print(f"  Submitted: {submitted}, Verified: {verified}, Pending: {pending}")
    recs = directory_summary.get("recommendations", [])
    if recs:
        print(f"  Recommendations for Brian: {len(recs)} directories need client input")
except Exception as e:
    print(f"  Directory cycle failed (non-fatal): {e}")
```

**Why Step 4b (not a new Step 8):** Directory submissions are independent of brain decisions. They follow a deterministic workflow (submit what hasn't been submitted yet). Placing before the brain call means the brain can see directory progress in its next cycle via seo_actions logs.

**Also pass directory_summary to brain.py** so the brain knows current directory coverage and can factor it into link-building priorities:
```python
actions = call_brain(
    ...existing params...,
    directory_summary=directory_summary,
)
```

---

#### MODIFIED: `scripts/seo_engine/brain.py`

**Changes:** New prompt section summarizing directory submission status.

```
DIRECTORY SUBMISSIONS:
  Total directories: 55 | Submitted: 18 | Verified: 12 | Pending: 6
  Tier 1 recommendations pending client input: 3 (SYNLawn, ForeverLawn, TurFresh)
  Recent verifications: Houzz (verified 2d ago), BuildZoom (verified 5d ago)
  Note: Directory submission is automated. Focus link-building efforts elsewhere.
```

This tells the brain not to waste actions on directory listings since the automated system handles it. The brain can focus on content, GBP posts, and other high-value work.

---

### Next.js Side: 1 New Tab + 3 New Components + 2 Modified Files

---

#### MODIFIED: `src/lib/types.ts`

```typescript
// Extend tab type
export type SeoEngineTabId = 'clients' | 'actions' | 'brain' | 'keywords' | 'geo' | 'directories';

// New interfaces
export interface Directory {
  id: string;
  name: string;
  url: string;
  tier: number;
  category: string;
  domain_authority: number | null;
  cost: string;
  submission_method: string;
  requires_client_input: boolean;
  form_url: string | null;
  trades: string[];
  active: boolean;
}

export interface DirectorySubmission {
  id: string;
  client_id: string;
  directory_id: string;
  status: string;
  submitted_at: string | null;
  verified_at: string | null;
  listing_url: string | null;
  retry_count: number;
  error_log: string | null;
  created_at: string;
  directory?: Directory;  // joined via directory_id
}

export interface ClientProfile {
  id: string;
  client_id: string;
  business_description: string | null;
  short_description: string | null;
  services: string[];
  certifications: string[];
  license_number: string | null;
  year_established: number | null;
  hours_of_operation: string | null;
  owner_name: string | null;
  owner_email: string | null;
  trades: string[];
}
```

---

#### MODIFIED: `src/components/seo-engine/SeoTabNav.tsx`

```typescript
const tabs: SeoTab[] = [
  { id: 'clients', label: 'Clients' },
  { id: 'actions', label: 'Action Feed' },
  { id: 'brain', label: 'Brain Decisions' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'geo', label: 'GEO' },
  { id: 'directories', label: 'Directories' },  // NEW
];
```

---

#### NEW: `src/components/seo-engine/DirectoryDashboard.tsx`

**Responsibility:** Container for the Directories tab. Fetches submission data joined with directory details.

```typescript
// Data fetching pattern (matches GeoDashboard)
const { data: submissions } = await supabase
  .from('directory_submissions')
  .select('*, directories(*)')
  .eq('client_id', clientId)
  .order('updated_at', { ascending: false });

const { data: allDirectories } = await supabase
  .from('directories')
  .select('*')
  .order('tier', { ascending: true });
```

**Renders:** DirectoryStatusGrid, DirectoryProgressBar, and a recommendations list for Tier 1/2 directories.

---

#### NEW: `src/components/seo-engine/DirectoryStatusGrid.tsx`

**Display:** Table of all directory submissions for the active client.

| Directory | Tier | Status | Submitted | Verified | Link |
|-----------|------|--------|-----------|----------|------|
| Houzz | 3 | verified | Mar 5 | Mar 12 | [view] |
| BuildZoom | 3 | submitted | Mar 8 | -- | -- |
| SYNLawn | 1 | pending | -- | -- | Needs client input |

**Color coding by status:**
- `verified` = green
- `submitted` = yellow (waiting)
- `pending` = grey (not yet attempted)
- `rejected` = red
- `skipped` = muted

**Filtering:** By tier, by status. Default: show all, sorted by tier then status.

---

#### NEW: `src/components/seo-engine/DirectoryProgressBar.tsx`

**Display:** Visual summary of directory coverage.

```
Tier 3 (Home Service):  ████████████████░░░░  18/25 (72%)
Tier 1 (Manufacturer):  ██░░░░░░░░░░░░░░░░░░  2/10  (20%)
Tier 2 (Trade Assoc):   ░░░░░░░░░░░░░░░░░░░░  0/8   (0%)
Tier 4 (Government):    ░░░░░░░░░░░░░░░░░░░░  0/3   (0%)

Total backlinks earned: 12 verified
```

Simple horizontal bars per tier. Count of verified+approved vs total applicable directories.

---

## Data Flow

### Complete Submission Flow

```
Client Onboarding
  |
  v
Brian populates client_profiles table (description, services, certs, hours)
  |
  v
Daily seo_loop.py Step 4b:
  |
  +-> directory_manager.py
        |
        +-> Load client_profile from Supabase
        +-> Load directories WHERE trades overlap with client trades
        +-> Filter out already submitted/verified (via directory_submissions)
        +-> For each queued Tier 3 directory (max 5/day):
        |     |
        |     +-> directory_submitter.py (Playwright)
        |     |     |
        |     |     +-> Navigate to form_url
        |     |     +-> Map client fields to form inputs
        |     |     +-> Submit form
        |     |     +-> Screenshot confirmation
        |     |     |
        |     |     v
        |     |   Return success/failure
        |     |
        |     +-> INSERT/UPDATE directory_submissions (status=submitted)
        |     +-> INSERT seo_actions (action_type='directory_submission')
        |
        +-> For submitted entries older than 7 days:
        |     |
        |     +-> directory_verifier.py
        |           |
        |           +-> Brave Search: site:{domain} "{client_name}"
        |           +-> If found: UPDATE status=verified, store listing_url
        |           +-> If 14+ days: alert Brian in summary
        |
        +-> Surface Tier 1/2 recommendations (requires_client_input=true)
        |
        v
      Return summary -> passed to brain.py as context
  |
  v
Dashboard reads directory_submissions + directories tables directly
```

### Verification Flow (Detail)

```
directory_submissions WHERE status='submitted' AND submitted_at < NOW() - 7 days
  |
  v
For each submission:
  |
  +-> Brave Search: site:{directory.url domain} "{client.name}"
  |     |
  |     +-> Found match -> status='verified', listing_url=match.url, verified_at=NOW()
  |     +-> No match, < 14 days -> no change (check again tomorrow)
  |     +-> No match, >= 14 days -> print warning in summary
  |     +-> No match, >= 21 days -> status='needs_review', stop auto-checking
  |
  v
Results logged, summary returned to directory_manager
```

## Component Boundaries Summary

| Component | Layer | New/Modified | Communicates With |
|-----------|-------|-------------|-------------------|
| `directories` table | Data | NEW | directory_manager, dashboard |
| `directory_submissions` table | Data | NEW | directory_manager, submitter, verifier, dashboard |
| `client_profiles` table | Data | NEW | directory_manager, submitter, dashboard |
| `directory_manager.py` | Orchestration | NEW | submitter, verifier, Supabase, seo_loop |
| `directory_submitter.py` | Execution | NEW | Playwright, Supabase, directory_manager |
| `directory_verifier.py` | Verification | NEW | Brave API, Supabase, directory_manager |
| `seo_loop.py` | Orchestration | MODIFIED | directory_manager (new Step 4b) |
| `brain.py` | Decision | MODIFIED | directory_summary in prompt |
| `types.ts` | Types | MODIFIED | Dashboard components |
| `SeoTabNav.tsx` | Navigation | MODIFIED | page.tsx |
| `DirectoryDashboard.tsx` | Container | NEW | Supabase, child components |
| `DirectoryStatusGrid.tsx` | Display | NEW | DirectoryDashboard (props) |
| `DirectoryProgressBar.tsx` | Display | NEW | DirectoryDashboard (props) |

## Recommended Project Structure

### New files only:

```
scripts/seo_engine/
  backlinks/
    directory_manager.py      # Orchestrator: what to submit, caps, coordination
    directory_submitter.py    # Playwright form fills
    directory_verifier.py     # Brave Search site: verification
    directory_audit.py        # EXISTING: Brave Search listing check (refactor to use new tables)

scripts/
  seed_directories.py        # One-time: loads master list into directories table

supabase/migrations/
  YYYYMMDD_directory_system.sql  # All 3 new tables + indexes

src/
  lib/types.ts                # MODIFIED: new interfaces
  components/seo-engine/
    SeoTabNav.tsx             # MODIFIED: add directories tab
    DirectoryDashboard.tsx    # NEW: container
    DirectoryStatusGrid.tsx   # NEW: submission table
    DirectoryProgressBar.tsx  # NEW: coverage bars
  app/seo-engine/
    page.tsx                  # MODIFIED: render DirectoryDashboard
```

## Architectural Patterns

### Pattern 1: Deterministic Automation (No Brain Needed)

**What:** Directory submissions follow a fixed workflow -- no AI decision-making required. The system submits to the next unsubmitted directory, verifies after 7 days, escalates after 14.

**When to use:** When the action is mechanical and the decision tree is simple enough to hardcode.

**Why not brain-driven:** The brain is for prioritizing between competing SEO actions (blog post vs GBP post vs page edit). Directory submissions are additive busywork with no tradeoffs. Having the brain "decide" to submit directories would waste brain call tokens on decisions that are always yes.

**Trade-off:** Less flexible (brain cannot deprioritize directories during high-priority weeks), but far simpler and cheaper.

### Pattern 2: Existing Supabase Table for Directory Audit Upgrade

**What:** The existing `directory_audit.py` hardcodes a DIRECTORIES list in Python. Migrate this to query the `directories` table instead, so both audit and submission share the same source of truth.

**When to use:** Whenever an existing module has hardcoded data that overlaps with a new Supabase table.

### Pattern 3: Playwright Per-Directory Adaptors

**What:** Start with heuristic form filling (scan labels/placeholders). When a specific directory's form is too complex, add a `field_mapping` JSON to its `directories.metadata` column that maps CSS selectors to client profile fields.

**Trade-off:** Heuristics handle 70% of forms with zero per-directory config. The 30% that need custom mappings get them iteratively as failures surface.

### Pattern 4: Screenshot Evidence

**What:** directory_submitter.py takes a screenshot of the confirmation page after each submission. Store path in `directory_submissions.metadata`.

**Why:** Proof of submission if a directory disputes it. Also useful for debugging when forms change layout.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Submitting All Directories on Day One

**What people do:** Queue 25+ directories and blast through them in one run.
**Why it's wrong:** Multiple directory signups from the same IP in minutes triggers fraud detection. Some directories share anti-spam infrastructure.
**Do this instead:** Max 5 per day per client, with 3-5 second delays between submissions.

### Anti-Pattern 2: Storing Directory Master List in Code

**What people do:** Hardcode the directory list in Python (like current directory_audit.py does).
**Why it's wrong:** Adding a directory requires a code change + deploy. The dashboard cannot read it. No way to toggle directories active/inactive.
**Do this instead:** `directories` Supabase table. Seed once. Update via SQL or future admin UI.

### Anti-Pattern 3: Using SerpAPI for Verification

**What people do:** Use SerpAPI `site:` searches to verify listings.
**Why it's wrong:** Burns precious SerpAPI budget (950/month cap) on verification queries that Brave handles fine for free.
**Do this instead:** Brave Search API for all verification queries. Reserve SerpAPI for keyword tracking.

### Anti-Pattern 4: One Giant Playwright Script

**What people do:** Single script with per-directory if/else blocks.
**Why it's wrong:** Unmaintainable. Adding a directory means editing a growing conditional tree.
**Do this instead:** Heuristic form filler as default, per-directory field_mapping overrides in database.

### Anti-Pattern 5: Mixing Client Profile Data into clients.json

**What people do:** Add business_description, hours, certifications to clients.json.
**Why it's wrong:** clients.json is git-tracked config used by the entire SEO engine. Mutable profile data that changes per-client (descriptions get refined, certs added/removed) creates noisy git diffs and merge conflicts.
**Do this instead:** `client_profiles` Supabase table for all mutable business data.

## Suggested Build Order

```
Phase 1: Database Foundation
  1a. Write + run Supabase migration (directories, directory_submissions, client_profiles tables)
  1b. Write seed_directories.py to load master list from research doc into directories table
  1c. Populate client_profiles for mr-green-turf-clean and integrity-pro-washers

Phase 2: Submission Engine
  2a. Build directory_manager.py (orchestrator: load profiles, filter directories, enforce caps)
  2b. Build directory_submitter.py (Playwright form fill with heuristic field matching)
  2c. Wire directory_manager into seo_loop.py as Step 4b
  2d. Test with 2-3 low-value Tier 3 directories in dry-run mode

Phase 3: Verification Engine
  3a. Build directory_verifier.py (Brave Search site: queries)
  3b. Wire verification into directory_manager cycle
  3c. Add escalation logic (14-day warning, 21-day needs_review)

Phase 4: Brain Integration
  4a. Add directory_summary prompt section to brain.py
  4b. Log directory submissions to seo_actions table

Phase 5: Dashboard
  5a. Add TypeScript types (Directory, DirectorySubmission, ClientProfile)
  5b. Extend SeoTabNav with 'directories' tab
  5c. Build DirectoryDashboard.tsx container
  5d. Build DirectoryStatusGrid.tsx
  5e. Build DirectoryProgressBar.tsx
  5f. Wire into page.tsx

Phase 6: Tier 1/2 Recommendations
  6a. Surface Tier 1/2 directories as recommendations in dashboard
  6b. Add notes/action-required indicators
  6c. Refactor directory_audit.py to use directories table
```

**Why this order:**
- Phase 1 first: tables must exist before anything writes to them. Seeding directories and profiles is a prerequisite for all automation.
- Phase 2 before Phase 3: submissions must happen before there is anything to verify. Verifier depends on submissions existing with `submitted` status.
- Phase 3 before Phase 4: brain should see real directory data, not empty summaries.
- Phase 5 after Phases 2-3: dashboard needs actual data to display. Building UI before data exists means testing with empty states only.
- Phase 6 last: Tier 1/2 recommendations are display-only (no automation) and lowest priority compared to automated Tier 3 submissions.

**Dependency graph:**
```
Phase 1 (tables + seed)
  |
  +-> Phase 2 (submitter) --> Phase 3 (verifier) --> Phase 4 (brain)
  |
  +-> Phase 5 (dashboard, can start after Phase 2 ships data)
  |
  +-> Phase 6 (Tier 1/2 recs, independent)
```

## Scalability Considerations

| Concern | 2 clients (current) | 10 clients | 50 clients |
|---------|---------------------|------------|------------|
| Playwright submissions/day | 10 (5 per client) | 50 | 250 (stagger across hours) |
| Brave verification queries/day | ~5 | ~25 | ~125 (still within 2K/mo free tier) |
| directory_submissions rows | ~110 (55 dirs x 2) | ~550 | ~2750 (fine, no retention needed) |
| Playwright runtime | ~5 min | ~25 min | Needs parallelization or queuing |
| Form mapping maintenance | Low (heuristics) | Medium (some custom mappings) | High (consider form-fill API service) |

**First bottleneck:** Playwright runtime at 10+ clients. Each form fill takes ~30-60 seconds (navigate + fill + submit + screenshot). At 50 submissions/day that's 25-50 minutes of browser time. Fix: run Playwright submissions in a separate launchd job, not inline with seo_loop.

**Second bottleneck:** Form mapping maintenance. As the directory list grows or forms change, heuristic failures increase. Fix: add a `form_status` column to directories (`working`, `broken`, `needs_mapping`) and a simple admin workflow to update mappings.

## Sources

- Existing codebase: seo_loop.py, brain.py, directory_audit.py, backlinks/*, clients.json, supabase migrations -- HIGH confidence (direct code review)
- PROJECT.md v1.2 milestone spec -- HIGH confidence
- find-a-pro-directory-master-list.md (55 directories across 4 tiers) -- HIGH confidence
- Playwright Python docs for form interaction patterns -- HIGH confidence (well-established library)
- Brave Search API for site: operator verification -- HIGH confidence (already used in directory_audit.py)

---
*Architecture research for v1.2 Directory Submission & Tracking System*
*Researched: 2026-03-10*
