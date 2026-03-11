# Phase 8: Data Foundation + Discovery - Research

**Researched:** 2026-03-10
**Domain:** Supabase schema design, Brave Search discovery, CAPTCHA classification, Next.js dashboard CRUD
**Confidence:** HIGH

## Summary

This phase creates three Supabase tables (client_profiles, directories, submissions), a Python discovery script leveraging the existing Brave Search budget-gated client, a CAPTCHA classification column on directories, and two dashboard UI views (client profile editor, directory management). The entire codebase already has proven patterns for each of these -- the backlink tables show exact schema conventions, brave_client.py shows how to do budget-gated searches, and ClientManager.tsx shows the inline-style CRUD UI pattern.

The primary risk is Brave Search budget consumption during discovery. With 55 directories per client and 4 active clients, a full discovery sweep costs 220 queries -- 27.5% of the monthly 800-query global budget. Discovery must be on-demand (not scheduled) and the script must use the existing brave_client.py budget gate.

**Primary recommendation:** Follow existing codebase patterns exactly. Schema mirrors backlink_targets conventions (UUID PKs, client_id FK, UNIQUE constraints, status workflow). Discovery script extends directory_audit.py pattern through brave_client.py. Dashboard UI follows ClientManager.tsx inline-style pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Seed initial client profile data from clients.json, then expand with new fields (NAP, services, descriptions, certifications, hours, payment methods, service areas, social links)
- Supabase becomes the single source of truth; clients.json becomes a one-time seed file
- Profile edits happen via a dashboard UI form -- not SQL or Supabase editor
- Start with the 15 directories already in directory_audit.py, research and add ~40 more to reach 55 total
- Mix of universal directories and trade-specific directories tagged by trade
- Directory management UI in the dashboard -- add, edit, disable directories visually
- CAPTCHA status displayed as a column in the directory management view (green/yellow/red badges)
- Brave Search site: queries for discovery -- same approach as directory_audit.py
- On-demand per client discovery -- triggered manually
- Existing listings marked as 'existing_needs_review' so Brian can check before deciding to skip or update
- Submission tracking table needs UNIQUE(client_id, directory_id) constraint at database level

### Claude's Discretion
- Directory tier definitions (DA-based, effort-based, or hybrid) -- pick what makes sense for the submission engine workflow
- Brave Search match confidence threshold -- minimize false positives without missing real listings
- CAPTCHA automation eligibility rules -- determine what's safe to automate based on CAPTCHA type and bot detection risk
- CAPTCHA re-check cadence -- pick based on how often directory forms actually change
- CAPTCHA status visible in directory management view with color badges

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Client profiles in Supabase with canonical NAP, services, descriptions, certifications, hours | Schema design section: client_profiles table. Seed script reads clients.json. Dashboard form for edits. |
| DATA-02 | Directory master list seeded with tier, trade, submission method, CAPTCHA status, DA, URL for all 55 directories | Schema: directories table. Seed SQL/script with 55 rows. Directory management UI. |
| DATA-03 | Submission tracking table with UNIQUE(client_id, directory_id) and status workflow | Schema: submissions table with UNIQUE constraint and status enum. |
| DATA-04 | Pre-existing listing discovery via search before submission | Discovery script using brave_client.py site: queries. Budget analysis section. |
| DATA-05 | CAPTCHA audit categorizes every directory form URL | captcha_status column on directories table. Manual audit workflow documented. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase (Postgres) | Current project instance | All new tables | Already hosts clients, reports, seo_actions, backlink_targets, brave_usage |
| Next.js | Current project version | Dashboard UI for profile editor + directory management | Existing frontend |
| Python 3 + supabase-py | Current project version | Discovery script, seed scripts | All data pipelines are Python |
| brave_client.py | Project module | Budget-gated Brave Search for discovery | Already wraps API with per-client + global caps |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/ssr | Current | Browser Supabase client for dashboard reads/writes | Client profile form, directory management UI |
| requests | Current | HTTP calls in Python scripts | Brave API calls via brave_client.py |
| dotenv | Current | Environment variable loading | All Python scripts |

### No New Dependencies Needed
This phase requires zero new npm packages or Python libraries. Everything builds on existing infrastructure.

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
  add_directory_system_tables.sql    # client_profiles, directories, submissions

scripts/seo_engine/
  seed_client_profiles.py            # One-time: clients.json -> client_profiles table
  seed_directories.py                # One-time: 55 directories -> directories table
  discovery.py                       # On-demand: Brave Search site: queries per client
  backlinks/
    directory_audit.py               # EXISTING: reference pattern for discovery

src/lib/
  types.ts                           # ADD: ClientProfile, Directory, Submission interfaces

src/components/
  directories/
    ClientProfileForm.tsx            # Edit client canonical profile
    DirectoryManager.tsx             # List/add/edit/disable directories
    DirectoryRow.tsx                 # Single directory with CAPTCHA badge
```

### Pattern 1: Supabase Table Schema (from backlink_targets)
**What:** UUID PK, client_id FK with ON DELETE CASCADE, status workflow column, UNIQUE constraints, indexes on FK + status
**When to use:** Every new table in this project
**Example:**
```sql
-- Source: scripts/seo_engine/supabase_migration_v3_backlinks.sql (existing pattern)
CREATE TABLE IF NOT EXISTS client_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    -- NAP fields
    business_name text NOT NULL,
    phone text,
    address_street text,
    address_city text,
    address_state text,
    address_zip text,
    email text,
    website text,
    -- Extended profile
    description text,
    short_description text,
    services text[],
    certifications text[],
    payment_methods text[],
    hours jsonb DEFAULT '{}',
    social_links jsonb DEFAULT '{}',
    logo_url text,
    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id)  -- One profile per client
);
```

### Pattern 2: Dashboard CRUD Component (from ClientManager.tsx)
**What:** 'use client' component, useState for form toggle, inline styles with CSS variables, supabase client for reads/writes
**When to use:** Both the client profile editor and directory management UI
**Example:**
```tsx
// Source: src/components/seo-engine/ClientManager.tsx (existing pattern)
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Inline styles with CSS variables -- NOT Tailwind
<div style={{
  padding: '8px 20px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  background: 'var(--accent)',
  color: '#000',
  border: 'none',
  borderRadius: 8,
}}>
```

### Pattern 3: Budget-Gated Brave Search (from brave_client.py)
**What:** Import search_brave from brave_client, pass client_id for budget tracking, handle blocked responses
**When to use:** Discovery script
**Example:**
```python
# Source: scripts/seo_engine/brave_client.py (existing pattern)
from scripts.seo_engine.brave_client import search_brave

result = search_brave(
    query=f"site:yelp.com \"{business_name}\" \"{city}\"",
    client_id=client_id,
    count=3,
)
if result.get("blocked"):
    print(f"Budget exceeded: {result['reason']}")
    return
web_results = result.get("web", {}).get("results", [])
```

### Anti-Patterns to Avoid
- **Direct Brave API calls:** Never call Brave Search API directly. Always go through brave_client.py which enforces budget caps and logs usage.
- **Tailwind classes:** Project uses inline styles with CSS variables. No Tailwind.
- **API routes for simple CRUD:** Project pattern is direct Supabase client calls from components, not API routes.
- **clients.json as ongoing source of truth:** After seeding, client_profiles in Supabase is the source of truth. clients.json is not maintained.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Budget-gated search | Custom Brave API wrapper | `brave_client.search_brave()` | Already handles per-client + global monthly caps, usage logging |
| Supabase client setup | New client initialization | `src/lib/supabase.ts` (browser) or `_get_supabase()` (Python) | Already configured with project credentials |
| Dedup protection | Application-level checks | UNIQUE(client_id, directory_id) constraint in Postgres | Database-level enforcement is bulletproof; app-level checks have race conditions |
| UUID generation | Custom ID schemes | `gen_random_uuid()` in Postgres | Project standard for all PKs |

## Common Pitfalls

### Pitfall 1: Brave Search Budget Blowout During Discovery
**What goes wrong:** Running discovery for all clients against all 55 directories uses 220 queries (55 * 4 clients) -- 27.5% of the 800/month global budget in one run.
**Why it happens:** Discovery is per-client, per-directory. The query count multiplies fast.
**How to avoid:** (1) Discovery is on-demand per client, never batch-all. (2) Show budget usage before/after in CLI output. (3) Use search_brave() which enforces caps. (4) Consider caching discovery results -- if a directory was checked for a client within 30 days, skip it.
**Warning signs:** Global budget approaching 600+ queries mid-month.

### Pitfall 2: False Positive Matches in Discovery
**What goes wrong:** Brave Search returns a result for site:yelp.com "Mr Green" but it's a different business with a similar name.
**Why it happens:** Common business names, partial name matches, businesses in nearby cities.
**How to avoid:** (1) Search with business name + phone number or business name + city. (2) Mark discoveries as 'existing_needs_review' (never 'verified') so Brian manually confirms. (3) Store the matched URL for easy human verification.
**Warning signs:** Discovery returns "found" for directories the business definitely isn't on.

### Pitfall 3: Schema Mismatch with Existing clients Table
**What goes wrong:** client_profiles duplicates fields already on the clients table (phone, service_areas, etc.).
**Why it happens:** clients table already has phone, service_areas, primary_market from earlier migrations.
**How to avoid:** client_profiles should hold directory-submission-specific fields that expand beyond what clients has. Use client_id FK to join back. Don't duplicate -- extend. The canonical NAP for form fills lives in client_profiles; the operational config (GA4 IDs, GHL tokens) stays in clients.
**Warning signs:** Two different "phone" values for the same client across tables.

### Pitfall 4: CAPTCHA Status Goes Stale
**What goes wrong:** A directory marked no_captcha adds CAPTCHA protection, and the submission engine fails.
**Why it happens:** Directory websites change their forms periodically.
**How to avoid:** (1) Store captcha_checked_at timestamp alongside captcha_status. (2) Discovery script can optionally re-check CAPTCHA during runs. (3) Recommended re-check cadence: every 90 days (directory forms rarely change faster). (4) Submission engine (Phase 9) should gracefully handle unexpected CAPTCHAs.
**Warning signs:** captcha_checked_at is more than 90 days old.

### Pitfall 5: Missing ON DELETE CASCADE on FKs
**What goes wrong:** Deleting a client leaves orphaned rows in client_profiles, submissions, etc.
**Why it happens:** Forgetting CASCADE on foreign keys.
**How to avoid:** Every client_id FK must have ON DELETE CASCADE, matching the pattern in seo_actions and backlink_targets.
**Warning signs:** Foreign key violation errors when deleting test data.

## Code Examples

### Migration SQL: All Three Tables
```sql
-- Source: follows pattern from supabase_migration_v3_backlinks.sql

-- Client canonical profiles for directory submissions
CREATE TABLE IF NOT EXISTS client_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    business_name text NOT NULL,
    phone text,
    address_street text,
    address_city text,
    address_state text,
    address_zip text,
    email text,
    website text,
    description text,
    short_description text,
    services text[] DEFAULT '{}',
    certifications text[] DEFAULT '{}',
    payment_methods text[] DEFAULT '{}',
    hours jsonb DEFAULT '{}',
    social_links jsonb DEFAULT '{}',
    year_established integer,
    logo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id)
);

-- Master directory list
CREATE TABLE IF NOT EXISTS directories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    domain text NOT NULL,
    submission_url text,
    tier integer NOT NULL DEFAULT 3,  -- 1=manual-only premium, 2=semi-auto, 3=auto-eligible
    trades text[] DEFAULT '{}',       -- empty = universal, otherwise ['turf','pressure_washing',etc]
    submission_method text DEFAULT 'web_form',  -- web_form, api, email, manual
    captcha_status text DEFAULT 'unknown',      -- no_captcha, simple_captcha, advanced_captcha, unknown
    captcha_checked_at timestamptz,
    da_score integer,
    enabled boolean DEFAULT true,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(domain)
);

-- Submission tracking (links clients to directories)
CREATE TABLE IF NOT EXISTS submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    directory_id uuid REFERENCES directories(id) ON DELETE CASCADE NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    -- Status workflow: pending -> submitted -> approved/rejected -> verified | skipped | existing_needs_review
    live_url text,
    submitted_at timestamptz,
    verified_at timestamptz,
    notes text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id, directory_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_profiles_client ON client_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_directories_tier ON directories(tier);
CREATE INDEX IF NOT EXISTS idx_directories_trades ON directories USING gin(trades);
CREATE INDEX IF NOT EXISTS idx_submissions_client ON submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_submissions_directory ON submissions(directory_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
```

### Discovery Script Pattern
```python
# Source: extends scripts/seo_engine/backlinks/directory_audit.py pattern
# Uses brave_client.py for budget-gated searches

from scripts.seo_engine.brave_client import search_brave

def discover_existing_listings(client_id: str, business_name: str, phone: str, city: str):
    """Check all enabled directories for existing listings."""
    sb = _get_supabase()

    # Get enabled directories
    dirs = sb.table("directories").select("*").eq("enabled", True).execute()

    for directory in dirs.data:
        # Build query: site:domain.com "Business Name" "City"
        query = f'site:{directory["domain"]} "{business_name}" "{city}"'
        result = search_brave(query=query, client_id=client_id, count=3)

        if result.get("blocked"):
            print(f"Budget exceeded, stopping discovery")
            return

        web_results = result.get("web", {}).get("results", [])
        if web_results:
            # Found existing listing -- mark for review
            sb.table("submissions").upsert({
                "client_id": client_id,
                "directory_id": directory["id"],
                "status": "existing_needs_review",
                "live_url": web_results[0].get("url", ""),
                "notes": f"Discovered via Brave Search: {web_results[0].get('title', '')}",
            }, on_conflict="client_id,directory_id").execute()
```

### TypeScript Interfaces
```typescript
// Source: follows pattern from src/lib/types.ts

export interface ClientProfile {
  id: string;
  client_id: string;
  business_name: string;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  short_description: string | null;
  services: string[];
  certifications: string[];
  payment_methods: string[];
  hours: Record<string, string>;
  social_links: Record<string, string>;
  year_established: number | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Directory {
  id: string;
  name: string;
  domain: string;
  submission_url: string | null;
  tier: number;
  trades: string[];
  submission_method: string;
  captcha_status: string;
  captcha_checked_at: string | null;
  da_score: number | null;
  enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  client_id: string;
  directory_id: string;
  status: string;
  live_url: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

## Discretion Recommendations

### Directory Tier Definitions
**Recommendation: Hybrid (effort + DA + automation eligibility)**

| Tier | Definition | Examples | Automation |
|------|-----------|----------|------------|
| 1 | DA 50+, requires verification/accreditation, high reputation risk | BBB, Angi/HomeAdvisor, Houzz | Manual only -- Brian or client handles |
| 2 | DA 30-50, simple signup but needs review/approval | Thumbtack, Expertise.com, UpCity | Semi-auto -- form fill assisted, human submits |
| 3 | DA 10-30, open registration, low risk | Manta, Hotfrog, CitySquares | Full auto eligible (if no_captcha) |

**Why hybrid:** Pure DA-based tiers miss the point. A DA-60 directory with open registration (rare but exists) is safe to automate. A DA-20 directory that requires business license upload is not. The submission engine (Phase 9) needs tier to determine automation eligibility, so tier must encode that.

### Brave Search Match Confidence
**Recommendation: Search with business_name + city, require URL domain match, mark all as needs_review**

No automated confidence scoring. The search pattern `site:yelp.com "Integrity Pro Washers" "San Diego"` is specific enough to avoid most false positives. When a result is found, store it as `existing_needs_review` with the URL. Brian verifies in the dashboard. This eliminates false positive risk entirely at the cost of a few minutes of manual review per client.

### CAPTCHA Automation Eligibility Rules
**Recommendation:**

| CAPTCHA Status | Automation Eligibility | Reasoning |
|---------------|----------------------|-----------|
| no_captcha | Full auto (Phase 9) | Safe to submit via Playwright |
| simple_captcha | Skip for now | Simple CAPTCHAs (checkbox reCAPTCHA) could be solved but add complexity and risk |
| advanced_captcha | Manual only | Image/puzzle CAPTCHAs, invisible reCAPTCHA v3 with high threshold -- not worth fighting |
| unknown | Must audit first | Cannot determine until form is manually checked |

### CAPTCHA Re-check Cadence
**Recommendation: Every 90 days.** Directory submission forms rarely change. The `captcha_checked_at` timestamp enables filtering for stale checks. During Phase 8, the initial audit is manual (Brian visits each form URL). Future re-checks can be more targeted -- only re-check directories where submissions recently failed.

## Budget Impact Analysis

### Brave Search Query Costs for Discovery

| Scenario | Queries Used | % of Monthly Budget (800) |
|----------|-------------|--------------------------|
| 1 client, 55 directories | 55 | 6.9% |
| 4 clients, 55 directories each | 220 | 27.5% |
| 4 clients + normal SEO engine usage (~200/mo) | 420 | 52.5% |

**Mitigation:** Discovery is on-demand. Run one client at a time, not all at once. Show budget status before and after each run. Cache results -- if directory was checked for this client within 30 days, skip the query.

### CAPTCHA Audit Time Estimate
Manual inspection of 55 directory form URLs: ~2-3 hours. This is a one-time task during Phase 8. The audit involves:
1. Visit each directory's submission URL
2. Check if form has CAPTCHA (none, checkbox, image, invisible)
3. Update captcha_status and captcha_checked_at in Supabase

This can be partially automated -- a script can load each URL via requests and check for known CAPTCHA markers (recaptcha script tags, hcaptcha elements), but manual verification is needed for invisible CAPTCHAs and JS-rendered forms.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded DIRECTORIES list in directory_audit.py | Supabase directories table with UI management | Phase 8 | Directories can be added/edited without code changes |
| clients.json as source of truth | client_profiles table in Supabase | Phase 8 | Enables dashboard editing, richer fields, single source for form fills |
| No submission tracking | submissions table with UNIQUE constraint | Phase 8 | Database-level dedup, status workflow for Phase 9 |

## Open Questions

1. **Which 40 additional directories to add beyond the existing 15?**
   - What we know: Need ~40 more to reach 55. Mix of universal + trade-specific (turf, pressure washing, landscaping).
   - What's unclear: Exact list needs research. DA scores need lookup.
   - Recommendation: Create a research task that builds the full 55-directory list with DA, trade tags, and submission URLs. The backlink-research.md already identifies key categories (industry associations, local directories, data aggregators).

2. **Should the CAPTCHA audit be a script or purely manual?**
   - What we know: Manual audit takes 2-3 hours. A script could detect obvious CAPTCHA markers (reCAPTCHA script tags).
   - What's unclear: How many directories use invisible/JS-only CAPTCHAs that a simple HTTP check would miss.
   - Recommendation: Build a lightweight Python script that fetches each submission URL and checks for common CAPTCHA patterns (recaptcha, hcaptcha, turnstile script tags). Flag unknowns for manual review. This cuts manual work to ~30-40 minutes for edge cases.

3. **What happens to existing same_as_urls in clients.json?**
   - What we know: clients.json already has same_as_urls (GBP, Yelp, BBB, Facebook, Instagram links).
   - What's unclear: Should these seed the submissions table as pre-existing listings?
   - Recommendation: Yes. During the seed script, for each client's same_as_urls that have a value, create a submission row with status='existing_needs_review' and the URL. This gives Brian a head start on the discovery data.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `scripts/seo_engine/supabase_migration_v3_backlinks.sql` -- schema conventions
- Existing codebase: `scripts/seo_engine/brave_client.py` -- budget-gated search pattern
- Existing codebase: `scripts/seo_engine/backlinks/directory_audit.py` -- discovery query pattern
- Existing codebase: `src/components/seo-engine/ClientManager.tsx` -- dashboard CRUD UI pattern
- Existing codebase: `clients.json` -- seed data structure with 4 active clients
- Existing codebase: `src/lib/types.ts` -- TypeScript interface conventions

### Secondary (MEDIUM confidence)
- `.planning/research/backlink-research.md` -- directory categories and tier reasoning
- Brave Search API: 1 req/sec rate limit, $5/1k queries, enforced via brave_client.py

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing infrastructure
- Architecture: HIGH -- every pattern directly mirrors existing codebase patterns
- Pitfalls: HIGH -- budget math is deterministic, schema risks are well-understood
- Directory list (the 40 additions): MEDIUM -- requires research task during implementation

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependencies changing)
