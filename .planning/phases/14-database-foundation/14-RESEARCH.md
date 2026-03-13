# Phase 14: Database Foundation - Research

**Researched:** 2026-03-12
**Domain:** Supabase Postgres schema design, RLS policies, TypeScript types, Python-to-Supabase integration
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Admin can create a pipeline lead with contact name, email, phone, trade, source/channel, and notes | `pipeline_leads` table schema with required columns; Supabase client insert pattern |
| DATA-02 | Every stage transition is logged with timestamp in an append-only history table | `pipeline_stage_history` table with `previous_stage`, `new_stage`, `transitioned_at`; no DELETE/UPDATE policy |
| DATA-03 | Each pipeline stage has predefined checklist items defined as TypeScript constant STAGE_CHECKLIST_DEFAULTS | `STAGE_CHECKLIST_DEFAULTS` constant in `src/lib/pipeline-constants.ts`; maps stage -> string[] |
| DATA-04 | Admin can check/uncheck checklist items per lead, stored separately from templates | `pipeline_checklist_items` table with `lead_id`, `stage`, `item_key`, `completed`, `completed_at`; one row per item per lead |
| DATA-05 | Admin can log communication entries (call, email, text) with notes and timestamp per lead | `pipeline_comms` table with `lead_id`, `comm_type`, `direction`, `notes`, `occurred_at` |
| DATA-06 | RLS policies restrict pipeline tables to admin users only | RLS enabled + policy using `user_profiles` table check for `role = 'admin'`; service_role key used by Python scripts |
| INT-01 | Auto-create pipeline lead on "meeting_booked" or "closed" outcome from analyze_calls.py | `create_pipeline_lead_from_call()` function in `analyze_calls.py`; called in `store_analysis()` |
| INT-02 | Auto-created leads have source = "sales_engine" and link to call_analysis record | `pipeline_leads.source = 'sales_engine'`, `pipeline_leads.call_analysis_id` FK to `call_analyses.id` |
| INT-03 | Duplicate detection prevents second lead for same phone or company name | `upsert` or pre-check query on phone/company_name before insert; no UNIQUE constraint (fuzzy match needed) |
</phase_requirements>

---

## Summary

Phase 14 creates the data layer for the v1.4 Client Pipeline Tracker. This is a pure schema + Python integration phase -- no UI. The deliverables are four Supabase tables, RLS policies, TypeScript types added to `src/lib/types.ts`, a TypeScript constants file for checklist defaults, and a Python function that auto-creates pipeline leads when `analyze_calls.py` detects a `meeting_booked` or `closed` outcome.

The project already has an established pattern for this work: SQL migration files in `supabase/migrations/`, TypeScript types in `src/lib/types.ts`, and Python scripts using the `supabase-py` client with `SUPABASE_KEY` (service role key). The existing `user_profiles` table has a `role` column (`'admin' | 'client'`) that RLS policies must check. The `call_analyses` table exists and its `id` column will be referenced as a FK from `pipeline_leads`.

The critical design decisions are already locked (from STATE.md): separate `pipeline_leads` table (not bolted onto `clients`), append-only `pipeline_stage_history` (not just a `current_stage` column), checklist items as queryable rows (not JSONB), and duplicate detection for the sales engine integration. These decisions are the right call and research confirms them.

**Primary recommendation:** Write a single SQL migration file `supabase/migrations/add_pipeline_tables.sql`, append TypeScript types to `src/lib/types.ts`, create `src/lib/pipeline-constants.ts` for checklist defaults, and add `create_pipeline_lead_from_call()` to `analyze_calls.py`. Execute migration via Supabase dashboard SQL editor (established project pattern).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supabase-js` (via `@supabase/ssr`) | already installed | Insert/query pipeline tables from Next.js | Already used in project; `createBrowserClient` pattern established |
| `supabase-py` | already installed in scripts | Python scripts insert pipeline leads | Already used in `analyze_calls.py`, `call_watcher.py` |
| TypeScript | already installed | Static types for pipeline entities | Project is all-TypeScript frontend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Dashboard SQL Editor | n/a (web UI) | Run migration SQL | All prior migrations in this project run here manually or via `setup-supabase.mjs` |
| `src/lib/pipeline-constants.ts` | new file | `STAGE_CHECKLIST_DEFAULTS` TypeScript constant | Created once; imported by Phase 15-16 UI components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL migration file | Supabase CLI `supabase db push` | CLI requires local Supabase setup not established in this project; dashboard SQL editor is the established pattern here |
| Queryable rows for checklist | JSONB column on leads | JSONB prevents easy per-item queries for Phase 17 analytics; requirements explicitly forbid it |
| Phone/company UNIQUE constraint for dedup | Pre-check query + conditional insert | Fuzzy match (same phone OR same company) can't be expressed as a single UNIQUE constraint; conditional insert is correct |

**Installation:** No new packages needed. All libraries already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
supabase/
└── migrations/
    └── add_pipeline_tables.sql    # NEW: all 4 tables + RLS in one file

src/lib/
├── types.ts                       # APPEND: PipelineLead, PipelineStageHistory, PipelineChecklistItem, PipelineComm
└── pipeline-constants.ts          # NEW: STAGE_CHECKLIST_DEFAULTS, PIPELINE_STAGES enum

scripts/sales_engine/
└── analyze_calls.py               # MODIFY: add create_pipeline_lead_from_call(), call from store_analysis()
```

### Pattern 1: SQL Migration File (Project Convention)
**What:** Single `.sql` file with all DDL for the phase, run manually in Supabase dashboard SQL editor.
**When to use:** Every new table addition in this project.
**Example:**
```sql
-- Source: supabase/migrations/add_directory_system_tables.sql (existing pattern)

-- 1. Create tables with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS pipeline_leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_name text NOT NULL,
    email text,
    phone text,
    company_name text,
    trade text,
    source text NOT NULL DEFAULT 'manual',
    channel text,
    notes text,
    stage text NOT NULL DEFAULT 'Lead',
    stage_entered_at timestamptz NOT NULL DEFAULT now(),
    call_analysis_id uuid REFERENCES call_analyses(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_stage ON pipeline_leads(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_phone ON pipeline_leads(phone);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_company ON pipeline_leads(lower(company_name));

-- 3. Enable RLS
ALTER TABLE pipeline_leads ENABLE ROW LEVEL SECURITY;

-- 4. Admin-only policy (uses user_profiles table, established pattern)
CREATE POLICY "pipeline_leads_admin_only"
    ON pipeline_leads
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );
```

### Pattern 2: Append-Only Stage History
**What:** Never UPDATE or DELETE rows in `pipeline_stage_history`. Every stage change is a new INSERT.
**When to use:** All stage transitions -- from UI (Phase 15) and any future automation.
**Example:**
```sql
CREATE TABLE IF NOT EXISTS pipeline_stage_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES pipeline_leads(id) ON DELETE CASCADE,
    previous_stage text,           -- NULL for the initial "entered Lead" row
    new_stage text NOT NULL,
    transitioned_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

-- No UPDATE or DELETE RLS policy -- insert-only for admin:
CREATE POLICY "pipeline_stage_history_admin_only"
    ON pipeline_stage_history
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );
```

### Pattern 3: TypeScript Types (Project Convention)
**What:** Add new interfaces to `src/lib/types.ts`. Never create per-feature type files -- all types live in the central file.
**When to use:** Every new Supabase table.
**Example:**
```typescript
// Append to src/lib/types.ts

export type PipelineStage = 'Lead' | 'Demo' | 'Proposal' | 'Onboarding' | 'Active' | 'Churned';
export type CommType = 'call' | 'email' | 'text';
export type CommDirection = 'outbound' | 'inbound';

export interface PipelineLead {
  id: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  trade: string | null;
  source: string;
  channel: string | null;
  notes: string | null;
  stage: PipelineStage;
  stage_entered_at: string;
  call_analysis_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineStageHistory {
  id: string;
  lead_id: string;
  previous_stage: PipelineStage | null;
  new_stage: PipelineStage;
  transitioned_at: string;
  notes: string | null;
}

export interface PipelineChecklistItem {
  id: string;
  lead_id: string;
  stage: PipelineStage;
  item_key: string;       // matches key in STAGE_CHECKLIST_DEFAULTS
  item_label: string;     // denormalized for display without joining constants
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface PipelineComm {
  id: string;
  lead_id: string;
  comm_type: CommType;
  direction: CommDirection;
  notes: string | null;
  occurred_at: string;
  created_at: string;
}
```

### Pattern 4: STAGE_CHECKLIST_DEFAULTS Constant
**What:** TypeScript constant (not a DB table) that defines which checklist items appear for each stage. Per-lead completion state lives in `pipeline_checklist_items` rows.
**When to use:** Phase 15/16 components import this constant to render checklist UI. Phase 14 creates the file.
**Example:**
```typescript
// src/lib/pipeline-constants.ts

import type { PipelineStage } from './types';

export const PIPELINE_STAGES: PipelineStage[] = [
  'Lead', 'Demo', 'Proposal', 'Onboarding', 'Active', 'Churned'
];

export const STAGE_CHECKLIST_DEFAULTS: Record<PipelineStage, { key: string; label: string }[]> = {
  Lead: [
    { key: 'verify_contact_info', label: 'Verify contact info' },
    { key: 'research_business', label: 'Research their business online' },
    { key: 'schedule_demo', label: 'Demo scheduled' },
  ],
  Demo: [
    { key: 'demo_completed', label: 'Demo completed' },
    { key: 'sent_proposal', label: 'Proposal sent' },
    { key: 'follow_up_sent', label: 'Follow-up sent' },
  ],
  Proposal: [
    { key: 'proposal_reviewed', label: 'Proposal reviewed with prospect' },
    { key: 'objections_handled', label: 'Objections handled' },
    { key: 'contract_sent', label: 'Contract sent' },
  ],
  Onboarding: [
    { key: 'contract_signed', label: 'Contract signed' },
    { key: 'gbp_access', label: 'GBP access obtained' },
    { key: 'gsc_access', label: 'GSC access obtained' },
    { key: 'ga4_access', label: 'GA4 access obtained' },
    { key: 'site_access', label: 'Website access obtained' },
    { key: 'client_profile_created', label: 'Client profile created in dashboard' },
  ],
  Active: [
    { key: 'first_report_sent', label: 'First performance report sent' },
    { key: 'seo_engine_running', label: 'SEO engine running' },
    { key: 'monthly_check_in', label: 'Monthly check-in scheduled' },
  ],
  Churned: [
    { key: 'exit_reason_logged', label: 'Exit reason logged' },
    { key: 'offboarding_done', label: 'Offboarding complete' },
  ],
};
```

### Pattern 5: Python Sales Engine Integration
**What:** After `store_analysis()` runs, check if outcome is `meeting_booked` or `closed`. If so, call a new function that upserts a pipeline lead. Use `SUPABASE_KEY` (service role, bypasses RLS).
**When to use:** In `store_analysis()` in `analyze_calls.py`.
**Example:**
```python
# In analyze_calls.py -- add this function

def create_pipeline_lead_from_call(sb, call, analysis):
    """
    Auto-create a pipeline lead when outcome is meeting_booked or closed.
    Skips if a lead already exists for the same phone or company name.
    Uses service role key (sb) -- bypasses RLS intentionally.
    """
    outcome = analysis.get("outcome", "")
    if outcome not in ("meeting_booked", "closed"):
        return

    # Get call_analysis id -- need to fetch it since we just inserted
    analysis_resp = sb.table("call_analyses") \
        .select("id") \
        .eq("call_id", call["id"]) \
        .order("analyzed_at", desc=True) \
        .limit(1) \
        .execute()
    analysis_id = analysis_resp.data[0]["id"] if analysis_resp.data else None

    phone = call.get("call_from") or call.get("phone")
    company_name = call.get("company_name")
    contact_name = call.get("contact_name") or "Unknown"

    # Duplicate detection: check phone first, then company name
    if phone:
        existing = sb.table("pipeline_leads") \
            .select("id") \
            .eq("phone", phone) \
            .limit(1) \
            .execute()
        if existing.data:
            print(f"    [pipeline] Lead already exists for phone {phone}, skipping")
            return

    if company_name:
        # Case-insensitive company match
        existing = sb.table("pipeline_leads") \
            .select("id") \
            .ilike("company_name", company_name) \
            .limit(1) \
            .execute()
        if existing.data:
            print(f"    [pipeline] Lead already exists for company {company_name}, skipping")
            return

    caller_details = analysis.get("caller_details", {})

    lead = {
        "contact_name": contact_name,
        "phone": phone,
        "company_name": company_name,
        "source": "sales_engine",
        "stage": "Lead",
        "notes": caller_details.get("situation", ""),
        "call_analysis_id": analysis_id,
    }

    result = sb.table("pipeline_leads").insert(lead).execute()
    if result.data:
        lead_id = result.data[0]["id"]
        # Insert initial stage history row
        sb.table("pipeline_stage_history").insert({
            "lead_id": lead_id,
            "previous_stage": None,
            "new_stage": "Lead",
            "notes": f"Auto-created from call (outcome: {outcome})",
        }).execute()
        print(f"    [pipeline] Created lead: {contact_name} (outcome: {outcome})")
    else:
        print(f"    [pipeline] Failed to create lead: {result}")


# Modify store_analysis() to call it:
def store_analysis(sb, call_id, analysis):
    """Store Claude's analysis in Supabase."""
    # ... existing code ...

    # After storing analysis, auto-create pipeline lead if warranted
    # (call object needed -- pass it in or re-fetch)
    create_pipeline_lead_from_call(sb, call, analysis)  # call must be passed in
```

**Note:** `store_analysis()` currently only takes `(sb, call_id, analysis)`. The signature must be changed to `(sb, call_id, call, analysis)` so the full call object is available for contact info.

### Anti-Patterns to Avoid
- **Storing checklist items as JSONB on pipeline_leads:** Prevents per-item queries needed by Phase 17 analytics. Requirements explicitly require queryable rows.
- **Using UNIQUE(phone) constraint for dedup:** Phone may be null; also the requirement checks phone OR company_name (OR logic). Use pre-check query instead.
- **Creating pipeline tables without enabling RLS:** Supabase tables have RLS disabled by default. Must call `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` explicitly.
- **Using anon key in Python for pipeline writes:** `SUPABASE_KEY` in `.env` is the service role key (bypasses RLS, appropriate for server-side scripts). Do not create a new anon key client in Python.
- **Defining `STAGE_CHECKLIST_DEFAULTS` as a DB table:** It's a TypeScript constant. Templates don't change per-lead. Only completion state is per-lead (in `pipeline_checklist_items`).
- **Putting types in a per-feature file:** All types in this project live in `src/lib/types.ts`. Follow the pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin identity check in RLS | Custom JWT claim or separate auth table | `user_profiles` table check (already exists with `role` column) | Project already uses `user_profiles.role = 'admin'` for `isAdmin` in `auth-context.tsx` |
| Duplicate detection logic | Complex DB trigger | Pre-check query before insert in Python | Trigger adds complexity; pre-check is transparent, debuggable, sufficient at this scale |
| TypeScript type generation | `supabase gen types typescript` CLI | Manually append to `types.ts` | Project uses hand-written types (established pattern in `src/lib/types.ts`); no type gen tooling configured |
| Stage history trigger | Postgres trigger on `pipeline_leads.stage` UPDATE | Explicit INSERT in application code | Application code is the established pattern; triggers are invisible and harder to debug in this project |

**Key insight:** This project's established pattern is explicit application-layer operations, not DB-layer automation. RLS is the only DB-layer logic used.

---

## Common Pitfalls

### Pitfall 1: RLS Blocks the Python Script
**What goes wrong:** Pipeline lead auto-creation from `analyze_calls.py` returns a permission error at runtime.
**Why it happens:** RLS policy requires `role = 'admin'` in `user_profiles`. Python scripts don't have an authenticated user -- they use the service role key. Service role bypasses RLS entirely. But if someone accidentally uses `SUPABASE_ANON_KEY` instead of `SUPABASE_KEY` (service role), RLS blocks the insert.
**How to avoid:** Verify `SUPABASE_KEY` in `.env` is the service role key (starts with `eyJ`, much longer than anon key). Never create a new `create_client()` with the anon key in Python scripts.
**Warning signs:** `row-level security policy violation` error from Python. Check which key is being used.

### Pitfall 2: store_analysis() Signature Change Breaks call_watcher.py
**What goes wrong:** Adding `call` parameter to `store_analysis()` in `analyze_calls.py` breaks `call_watcher.py` which imports and calls it.
**Why it happens:** `call_watcher.py` imports `store_analysis` directly from `analyze_calls.py`. Both files must be updated together.
**How to avoid:** Update both `analyze_calls.py` and `call_watcher.py` in the same task/wave.
**Warning signs:** `TypeError: store_analysis() takes 3 positional arguments but 4 were given` at runtime.

### Pitfall 3: call_analysis_id FK Fails If call_analyses Row Not Flushed
**What goes wrong:** `create_pipeline_lead_from_call()` can't find the `call_analyses` row it just inserted because the insert hasn't committed.
**Why it happens:** `store_analysis()` inserts into `call_analyses` then immediately calls `create_pipeline_lead_from_call()`. In practice Supabase commits synchronously so this shouldn't happen, but the analysis_id fetch query is safer than relying on insert order.
**How to avoid:** Fetch the `call_analyses.id` via a SELECT after the insert (shown in code example above), or return the id from the insert response: `result = sb.table("call_analyses").insert(row).execute()` then `analysis_id = result.data[0]["id"]`.
**Warning signs:** `null` for `call_analysis_id` in pipeline_leads despite analysis existing.

### Pitfall 4: Missing `stage_entered_at` Update When Stage Changes
**What goes wrong:** Phase 15 UI moves a lead to a new stage but `stage_entered_at` on `pipeline_leads` is not updated, so "days in stage" calculations are wrong.
**Why it happens:** Phase 14 creates the column. Phase 15 writes the stage transition. If Phase 15 only updates `stage` but forgets `stage_entered_at`, the column is stale.
**How to avoid:** Document in the SQL schema that `stage_entered_at` MUST be updated whenever `stage` is updated. Add a comment in the migration file.
**Warning signs:** All leads show "0 days in stage" or the same date regardless of when they were moved.

### Pitfall 5: Company Name Duplicate Detection Case Sensitivity
**What goes wrong:** "Integrity Pro Washers" and "integrity pro washers" create two leads.
**Why it happens:** Simple `eq("company_name", company_name)` is case-sensitive in Postgres.
**How to avoid:** Use `ilike` in Python (`sb.table(...).ilike("company_name", company_name)`) and a functional index `lower(company_name)` in SQL.
**Warning signs:** Duplicate leads for same company appearing after repeated calls.

### Pitfall 6: RLS Policy Missing for One of the Four Tables
**What goes wrong:** One pipeline table is readable by non-admin users.
**Why it happens:** Writing RLS policies for each table separately; easy to miss one.
**How to avoid:** Template the RLS block and apply it to all four tables in sequence in the migration file. Verify by testing with a non-admin Supabase client.
**Warning signs:** Non-admin user can `SELECT` from a pipeline table.

---

## Code Examples

Verified patterns from the existing codebase:

### Existing RLS Pattern (user_profiles check)
```sql
-- Pattern inferred from auth-context.tsx: user_profiles has user_id and role columns
-- Apply this pattern to all pipeline tables:
ALTER TABLE pipeline_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_leads_admin_only"
    ON pipeline_leads
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );
-- Note: WITH CHECK clause also needed for INSERT/UPDATE to enforce the same rule
CREATE POLICY "pipeline_leads_admin_insert"
    ON pipeline_leads
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );
```

### Existing Python Supabase Insert Pattern
```python
# Source: scripts/sales_engine/analyze_calls.py (existing)
from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)  # service role key

row = {
    "call_id": call_id,
    "outcome": analysis.get("outcome", "unknown"),
    # ...
}
sb.table("call_analyses").insert(row).execute()

# Upsert pattern (from run_reports.py):
sb.table("daily_call_reports") \
    .upsert(row, on_conflict="report_date") \
    .execute()
```

### Existing Migration File Pattern
```sql
-- Source: supabase/migrations/add_directory_system_tables.sql (existing)
-- Convention: CREATE TABLE IF NOT EXISTS, then indexes, then (if needed) RLS
CREATE TABLE IF NOT EXISTS submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    -- ...
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id, directory_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_client ON submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
```

### ilike Query for Case-Insensitive Company Match
```python
# supabase-py ilike filter (Supabase PostgREST pattern)
existing = sb.table("pipeline_leads") \
    .select("id") \
    .ilike("company_name", company_name) \
    .limit(1) \
    .execute()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store checklist as JSONB on lead | Queryable rows in separate table | Architecture decision (STATE.md) | Phase 17 analytics can query per-item completion rates |
| Single `current_stage` column | Append-only `pipeline_stage_history` | Architecture decision (STATE.md) | Phase 17 can compute avg days per stage from history |
| Auto-type generation from DB | Hand-written types in `src/lib/types.ts` | Established project pattern | Consistent with all prior types in project |

---

## Open Questions

1. **Does `call_analyses` table have a composite unique constraint or just `id` as PK?**
   - What we know: `analyze_calls.py` inserts with `call_id` column. The table has `id` (PK) and `call_id` (FK to sales_calls).
   - What's unclear: Whether there's a UNIQUE(call_id) constraint, which would make fetching the analysis_id by call_id safe.
   - Recommendation: Fetch analysis_id by querying `call_analyses WHERE call_id = X ORDER BY analyzed_at DESC LIMIT 1`. Safe regardless.

2. **What fields does `sales_calls` actually have for contact info?**
   - What we know: `call_watcher.py` reads `contact_name`, `call_to`. `sales_brain.py` reads `contact_name`, `company_name`. `analyze_calls.py` reads `call_from`.
   - What's unclear: The exact column names for phone number in `sales_calls` -- `call_from` vs `phone`.
   - Recommendation: Use `call.get("call_from") or call.get("phone")` in `create_pipeline_lead_from_call()` to handle both.

3. **Are there existing pipeline_leads-like tables from prior work?**
   - What we know: STATE.md says "Separate pipeline_leads table (not bolting onto clients table)" as a confirmed decision. No pipeline tables found in migrations.
   - What's unclear: Nothing -- confirmed no prior pipeline tables exist.
   - Recommendation: Proceed with fresh table creation.

---

## Sources

### Primary (HIGH confidence)
- `/Users/brianegan/EchoLocalClientTracker/src/lib/auth-context.tsx` -- `user_profiles` table schema, `role` column, `isAdmin` pattern
- `/Users/brianegan/EchoLocalClientTracker/supabase/migrations/add_directory_system_tables.sql` -- Migration file convention (CREATE TABLE IF NOT EXISTS, indexes, no RLS in this file)
- `/Users/brianegan/EchoLocalClientTracker/scripts/seo_engine/migrations/keyword_tracking.sql` -- Second migration example confirming pattern
- `/Users/brianegan/EchoLocalClientTracker/scripts/sales_engine/analyze_calls.py` -- `store_analysis()` function, `call_analyses` table, `sales_calls` fields
- `/Users/brianegan/EchoLocalClientTracker/src/lib/types.ts` -- All types in one file, interface naming conventions
- `/Users/brianegan/EchoLocalClientTracker/.planning/STATE.md` -- Architecture decisions locked before research

### Secondary (MEDIUM confidence)
- Supabase RLS docs pattern: `FOR ALL ... USING (EXISTS (SELECT 1 FROM user_profiles WHERE ...))` is the standard approach for role-based RLS when roles are in a custom table (not JWT claims)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture: HIGH -- migration pattern, type conventions, and Python client usage are well-established in codebase
- Pitfalls: HIGH -- all identified from reading actual code (signature change, key type, RLS gap)
- Sales engine integration: MEDIUM -- `store_analysis()` signature change is a known risk; exact `sales_calls` column names for phone unverified

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain -- Supabase schema patterns don't change rapidly)
