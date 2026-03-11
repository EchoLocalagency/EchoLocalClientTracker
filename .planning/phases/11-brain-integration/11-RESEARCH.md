# Phase 11: Brain Integration - Research

**Researched:** 2026-03-11
**Domain:** Python data pipeline -- Supabase query aggregation, brain prompt injection, seo_actions logging
**Confidence:** HIGH

## Summary

Phase 11 has two requirements and zero new dependencies. BRAIN-01 injects a `directory_summary` section into the brain prompt so the brain knows current directory coverage per client without querying separately. BRAIN-02 logs each directory submission to the `seo_actions` table with `action_type='directory_submission'` so submissions appear in the same action log the brain already reads.

Both requirements touch existing files. `brain.py` holds `_build_prompt()` -- a single function that builds the full prompt string from named arguments. `seo_loop.py` gathers all context before calling `call_brain()` and is the right place to fetch the directory summary. `outcome_logger.py` has `log_action()` which writes to `seo_actions` -- it handles both insert and the 3 follow-up scheduling rows. The submission engine (`submission_engine.py`) already calls Supabase on every successful submission; it is the right place to also call `log_action()` after each submit.

The `seo_actions` table's existing columns cover everything needed: `action_type`, `description`, `target_keywords`, `metadata`, and `client_id`. No migration is required for BRAIN-02. BRAIN-01 requires a Supabase query against `submissions` grouped by `client_id` returning counts by status -- this is a pure aggregation query, no schema change needed.

**Primary recommendation:** (1) Add a `get_directory_summary()` function in `outcome_logger.py` that returns submitted/verified counts from `submissions`. (2) Call it in `seo_loop.py` before `call_brain()`, pass as `directory_summary` kwarg. (3) Add `directory_summary` section in `_build_prompt()` inside `brain.py`. (4) Call `log_action()` in `submission_engine.py` after each successful `submitted` transition, with `action_type='directory_submission'`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAIN-01 | Brain prompt includes directory_summary section showing current coverage per client (X/Y submitted, X/Y verified) | `_build_prompt()` in `brain.py` accepts named kwargs and renders them as labeled text sections. The pattern is used for geo_scores, paa_gaps, etc. New `get_directory_summary()` in `outcome_logger.py` queries `submissions` table. Supabase `count="exact"` with status filters gives submitted/verified counts. `directories` table total count gives denominator. No schema change needed. |
| BRAIN-02 | Directory submissions logged to seo_actions table with action_type='directory_submission' for full brain visibility | `log_action()` in `outcome_logger.py` is the established insert function. `seo_actions` table has `action_type` text column (no enum constraint -- any string value is valid). `submission_engine.py` sets status to 'submitted' after successful POST -- calling `log_action()` at that point fits the existing pattern. `get_action_history()` already returns all action_types, so directory_submission rows appear in the brain's RECENT ACTIONS section automatically. |
</phase_requirements>

## Standard Stack

### Core (All Existing -- No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | 2.28.0 | All DB reads and writes | Used in every seo_engine script |
| python-dotenv | 1.0.0 | Environment variable loading | Project-wide standard |

### No New Installs Required

Both requirements are pure Python edits to existing files. No pip installs, no migrations, no new modules.

## Architecture Patterns

### Relevant File Structure
```
scripts/seo_engine/
  brain.py               # _build_prompt() -- add directory_summary section here
  seo_loop.py            # run_client() -- fetch directory_summary, pass to call_brain()
  outcome_logger.py      # add get_directory_summary(), log_action() already exists
  submission_engine.py   # _submit_to_directory() -- call log_action() after status='submitted'
```

### Pattern 1: Adding a New Section to the Brain Prompt
**What:** Every brain prompt section follows the same structure in `_build_prompt()`. Accept a new optional kwarg (default None), guard with `if kwarg:`, and append a labeled text block.
**When to use:** BRAIN-01. The pattern is already used for `geo_scores`, `paa_gaps`, `aeo_opportunities`, and all other optional sections.
**Example:**
```python
# Source: scripts/seo_engine/brain.py -- _build_prompt() existing sections
# Add directory_summary as a new kwarg to _build_prompt() and call_brain()

def _build_prompt(..., directory_summary=None):
    # ... existing sections ...

    # ── Section N: Directory coverage ──
    if directory_summary:
        submitted = directory_summary.get("submitted", 0)
        verified = directory_summary.get("verified", 0)
        total = directory_summary.get("total_eligible", 0)
        prompt += "DIRECTORY COVERAGE (do NOT submit to directories already submitted):\n"
        prompt += f"  Submitted: {submitted}/{total} eligible directories\n"
        prompt += f"  Verified live: {verified}/{submitted} submitted\n"
        pending = total - submitted
        if pending > 0:
            prompt += f"  Pending: {pending} directories not yet submitted\n"
        prompt += "\n"

    return prompt
```

### Pattern 2: Fetching Directory Summary from Supabase
**What:** Two count queries against `submissions` (filtered by client_id and status), plus one count against `directories` for the total eligible denominator.
**When to use:** BRAIN-01. Called in `seo_loop.py` before `call_brain()`.
**Example:**
```python
# Source: scripts/seo_engine/outcome_logger.py -- _get_sb() pattern

def get_directory_summary(client_id):
    """Return directory submission counts for the brain prompt.

    Returns dict with submitted, verified, and total_eligible counts.
    """
    sb = _get_sb()

    submitted_resp = (
        sb.table("submissions")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .in_("status", ["submitted", "approved", "verified"])
        .execute()
    )
    submitted_count = submitted_resp.count or 0

    verified_resp = (
        sb.table("submissions")
        .select("id", count="exact")
        .eq("client_id", client_id)
        .eq("status", "verified")
        .execute()
    )
    verified_count = verified_resp.count or 0

    # Total eligible = all enabled directories (trade filtering not applied here --
    # brain gets total for awareness, not filtered list)
    total_resp = (
        sb.table("directories")
        .select("id", count="exact")
        .eq("enabled", True)
        .execute()
    )
    total_eligible = total_resp.count or 0

    return {
        "submitted": submitted_count,
        "verified": verified_count,
        "total_eligible": total_eligible,
    }
```

### Pattern 3: Logging a Directory Submission to seo_actions
**What:** Call `log_action()` from `outcome_logger.py` inside `submission_engine.py` after the `status='submitted'` update. Use `action_type='directory_submission'`, `description` as the directory name, `metadata` with the directory domain and submission_id.
**When to use:** BRAIN-02. Called once per successful submission inside `_submit_to_directory()`.
**Example:**
```python
# Source: scripts/seo_engine/outcome_logger.py -- log_action() signature
from scripts.seo_engine.outcome_logger import log_action

# Inside _submit_to_directory(), after the sb.table("submissions").update(status="submitted") call:
try:
    log_action(
        client_id=client_id,
        action_type="directory_submission",
        description=f"Submitted to {dir_domain}",
        target_keywords=[],          # directories don't target specific keywords
        content_summary=f"Auto-submitted to {directory['name']} ({dir_domain})",
        metadata={
            "directory_domain": dir_domain,
            "directory_name": directory.get("name", ""),
            "submission_id": submission_id,
            "da_score": directory.get("da_score"),
        },
        baseline_metrics={},         # no keyword baseline for directory submissions
    )
except Exception as e:
    # Non-fatal -- don't let logging failure block submission result
    print(f"  [WARN] Failed to log directory submission to seo_actions: {e}")
```

### Pattern 4: Wiring directory_summary in seo_loop.py
**What:** Fetch directory summary in `run_client()` before the `call_brain()` call. Pass it as a new kwarg to `call_brain()`.
**When to use:** BRAIN-01. The seo_loop already fetches geo_scores, paa_gaps, etc. in the same pre-brain block.
**Example:**
```python
# Source: scripts/seo_engine/seo_loop.py -- run_client() pre-brain data collection pattern

# Add to Step 5 data collection in run_client():
directory_summary = None
try:
    from .outcome_logger import get_directory_summary
    directory_summary = get_directory_summary(client_id)
    submitted = directory_summary.get("submitted", 0)
    total = directory_summary.get("total_eligible", 0)
    print(f"  Directory coverage: {submitted}/{total} submitted")
except Exception as e:
    print(f"  Directory summary failed (non-fatal): {e}")

# Then pass to call_brain():
actions = call_brain(
    ...,
    directory_summary=directory_summary,
    dry_run=dry_run,
)
```

### Anti-Patterns to Avoid
- **Calling log_action() in the outer submission loop (not inside _submit_to_directory()):** The function already returns the status string; the logging call must happen only when the return is 'submitted', not for 'skipped' or 'failed'.
- **Using a new action_type that includes a rate limit check:** The seo_loop's WEEKLY_LIMITS dict does not include 'directory_submission'. Do not add it -- directory submissions are not brain-driven actions and must not count against SEO content rate limits. The log_action call is purely for visibility, not rate limit tracking.
- **Adding directory_summary to the brain's output format rules:** The brain reads directory coverage as informational context only. It should never propose a 'directory_submission' action (that's the submission_engine's job). Do not add it to the RULES section or OUTPUT FORMAT section of the prompt.
- **Applying trade filtering in get_directory_summary():** The brain doesn't need per-trade breakdown. Total submitted and verified is sufficient. Over-engineering the summary makes the prompt larger and the brain less focused.
- **Fetching per-directory breakdown in the prompt:** The brain needs counts, not a list of directories. A long list of directory names is prompt noise. The submissions table already exists for the dashboard (Phase 12) to show per-directory detail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Counting submissions by status | Custom SQL via Supabase RPC | `supabase-py` `.select("id", count="exact").eq("status", ...)` | supabase-py's count parameter uses PostgREST's `Prefer: count=exact` header -- no raw SQL needed |
| Inserting seo_actions row | Direct Supabase insert | `log_action()` in `outcome_logger.py` | log_action also schedules 3 followup rows. Bypassing it leaves orphaned actions with no follow-up measurement |
| Adding new prompt section | New module | Inline string append in `_build_prompt()` | Every other section is inline. Extracting to a module adds indirection with no benefit |

**Key insight:** This phase is entirely glue code. The hard work (seo_actions schema, log_action function, call_brain signature, submissions table) is already done. The only risk is the wiring introducing subtle bugs -- wrong kwarg name, missing non-fatal exception handler, or logging before the status update is persisted.

## Common Pitfalls

### Pitfall 1: log_action() Schedules Followups -- Directory Submissions Don't Need Them
**What goes wrong:** `log_action()` always creates 3 `seo_action_followups` rows (+10d, +17d, +31d). For directory submissions, these followups will trigger GSC keyword measurement on an empty `target_keywords` list, producing null baseline metrics and meaningless follow-up rows.
**Why it happens:** `log_action()` is designed for keyword-targeted content actions. It unconditionally creates followups.
**How to avoid:** The followup rows won't cause errors -- they'll just measure nothing. Accept the orphaned followups as a known cost, or pass `target_keywords=[]` and ensure `_measure_keywords()` in seo_loop handles empty list gracefully (it does -- the function returns an empty dict when no keywords are present). The follow-up rows clutter the table but don't break anything.
**Warning signs:** `seo_action_followups` table accumulating rows with no measured_data after 28 days.

### Pitfall 2: client_id Not Available in submission_engine.py's Inner Function
**What goes wrong:** `_submit_to_directory()` accepts `profile`, `directory`, `submission_id`, and `sb` -- but not `client_id`. `log_action()` requires `client_id`.
**Why it happens:** The inner function was designed for minimal state. The client_id is available in `run_submission_engine()` (the outer function) but not passed down.
**How to avoid:** Pass `client_id` as a parameter to `_submit_to_directory()`. The function signature already has `sb` passed in -- adding `client_id` follows the same pattern.
**Warning signs:** NameError or KeyError when calling log_action inside _submit_to_directory.

### Pitfall 3: Counting 'submitted' Status Misses Approved/Verified
**What goes wrong:** `get_directory_summary()` counts only `status='submitted'`. A directory that progressed to `verified` or `approved` appears as not submitted, making the brain think there's more work to do.
**Why it happens:** Status workflow is: pending -> submitted -> approved -> verified. Each status replaces the previous one.
**How to avoid:** Use `.in_("status", ["submitted", "approved", "verified"])` for the submitted count. Use `.eq("status", "verified")` for the verified count. This matches the skip_statuses logic already in submission_engine.py.
**Warning signs:** Directory summary shows submitted=0 even after Phase 9/10 work, because all successful submissions are now 'verified'.

### Pitfall 4: Double-Counting in Brain's Action History
**What goes wrong:** After BRAIN-02 is live, every directory submission appears in the RECENT ACTIONS section. If a client has 10 submitted directories, that's 10 entries in the brain's context, consuming significant prompt tokens and potentially crowding out more actionable data.
**Why it happens:** `get_action_history()` returns all action_types with no filter. It shows up to 20 actions.
**How to avoid:** The brain's action history is already capped at 20 items (`for a in action_history[:20]`). If directory submissions dominate the log, consider filtering them out in the display (show summary count instead). For now, at 4-10 submissions per client over several weeks, this won't be a problem. Monitor prompt length in `reports/last_brain_prompt.txt` after BRAIN-02 ships.
**Warning signs:** Brain prompt growing past 15,000 chars with many `directory_submission` entries in RECENT ACTIONS.

### Pitfall 5: seo_loop.py call_brain() Call Site Has Many Positional Keywords
**What goes wrong:** `call_brain()` has 25+ keyword arguments. When adding `directory_summary`, it's easy to add it to `_build_prompt()` but forget to add it to `call_brain()`'s signature or the call site in `seo_loop.py`.
**Why it happens:** Three files need parallel changes: `brain.py` (_build_prompt signature + body + call_brain signature), `seo_loop.py` (fetch + pass), `outcome_logger.py` (new function).
**How to avoid:** Use a checklist: (1) `_build_prompt()` signature and body, (2) `call_brain()` signature passthrough to `_build_prompt()`, (3) `seo_loop.py` fetch and pass to call_brain(). Verify by checking `reports/last_brain_prompt.txt` after a dry run -- the DIRECTORY COVERAGE section should appear.
**Warning signs:** `call_brain()` TypeError about unexpected keyword argument, or dry run prompt missing the section.

## Code Examples

Verified patterns from existing codebase:

### Supabase Count Query Pattern (from outcome_logger.py)
```python
# Source: scripts/seo_engine/outcome_logger.py -- get_week_action_counts() pattern
# supabase-py count="exact" uses PostgREST Prefer: count=exact header

resp = (
    sb.table("submissions")
    .select("id", count="exact")
    .eq("client_id", client_id)
    .in_("status", ["submitted", "approved", "verified"])
    .execute()
)
count = resp.count or 0  # resp.count is None if no rows -- guard with 'or 0'
```

### log_action() Call for Non-Keyword Actions (from seo_loop.py pattern)
```python
# Source: scripts/seo_engine/outcome_logger.py -- log_action() signature
# baseline_metrics can be empty dict -- all fields are optional in the insert

action_id = log_action(
    client_id=client_id,
    action_type="directory_submission",
    description=f"Submitted to {directory['name']} ({dir_domain})",
    target_keywords=[],
    content_summary=f"Auto-submitted profile to {dir_domain}",
    metadata={
        "directory_domain": dir_domain,
        "directory_name": directory.get("name", ""),
        "submission_id": submission_id,
        "da_score": directory.get("da_score"),
        "tier": directory.get("tier"),
    },
    baseline_metrics={},
)
```

### _build_prompt() Optional Section Guard (from brain.py existing pattern)
```python
# Source: scripts/seo_engine/brain.py -- existing sections use the same if-guard pattern

# Example: the geo_scores section guard (lines 397-401 in brain.py)
if geo_scores or serp_features:
    from .geo_data import format_geo_section
    geo_section = format_geo_section(geo_scores or [], serp_features or [])
    if geo_section:
        prompt += geo_section
        prompt += "\n"

# Pattern for directory_summary: simpler, no external formatter needed
if directory_summary:
    submitted = directory_summary.get("submitted", 0)
    verified = directory_summary.get("verified", 0)
    total = directory_summary.get("total_eligible", 0)
    prompt += "DIRECTORY COVERAGE:\n"
    prompt += f"  {submitted}/{total} directories submitted | {verified}/{submitted if submitted else total} verified live\n"
    prompt += "  Do NOT propose directory_submission actions -- that is handled by submission_engine.py separately.\n"
    prompt += "\n"
```

### Adding kwargs to call_brain() (passthrough pattern from brain.py)
```python
# Source: scripts/seo_engine/brain.py -- call_brain() passes all kwargs to _build_prompt()
# Current signature (abbreviated):
def call_brain(client_config, performance_data, ..., paa_gaps=None, dry_run=True):
    prompt = _build_prompt(
        client_config, performance_data, ..., paa_gaps,
    )

# Updated signature -- add directory_summary to both call_brain and its _build_prompt call:
def call_brain(..., paa_gaps=None, directory_summary=None, dry_run=True):
    prompt = _build_prompt(
        ..., paa_gaps=paa_gaps, directory_summary=directory_summary,
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Brain has no awareness of directory work | Brain prompt includes directory coverage section | Phase 11 (new) | Brain stops suggesting duplicate directory work, sees submission progress |
| Directory submissions invisible to action log | Directory submissions logged to seo_actions | Phase 11 (new) | Action log shows complete picture of all SEO work across content and citations |

**Deprecated/outdated:**
- None -- this phase introduces new integrations, not replacements.

## Open Questions

1. **Whether to suppress directory_submission rows from the brain's RECENT ACTIONS display**
   - What we know: `get_action_history()` returns all action_types; brain shows `action_history[:20]`. Each submission is one row. A client with 10 submissions has 10 entries.
   - What's unclear: Whether 10-20 directory_submission rows in RECENT ACTIONS will crowd out SEO content actions and degrade brain output quality.
   - Recommendation: Ship as-is (no filtering) for Phase 11. The 20-item cap and the DIRECTORY COVERAGE section together give the brain what it needs. If prompt bloat becomes an issue after observation, add a filter in `get_action_history()` or limit directory_submission rows to 3 most recent. Monitor `reports/last_brain_prompt.txt`.

2. **Whether directory_submission action_type needs to be added to WEEKLY_LIMITS in seo_loop.py**
   - What we know: WEEKLY_LIMITS controls brain-proposed content actions. Directory submissions are automation-driven, not brain-driven.
   - What's unclear: Nothing -- directory submissions must NOT be added to WEEKLY_LIMITS. That dict drives the "WEEKLY RATE LIMITS remaining" section of the brain prompt. Adding directory_submission there would confuse the brain into thinking it can propose directory submissions.
   - Recommendation: Do not add. Confirmed not needed.

3. **Whether the get_directory_summary() total_eligible denominator should be trade-filtered**
   - What we know: Total directories = ~55 (some disabled). Trade-eligible directories per client = 4-18 depending on trades.
   - What's unclear: Whether showing "3/55 submitted" is less useful than "3/18 submitted" for a turf client.
   - Recommendation: Use trade-filtered count for the denominator. Query `directories` with `eq("enabled", True)` plus `overlaps("trades", client_trades)` union `eq("trades", [])` for universal directories. This requires passing `client_trades` to `get_directory_summary()`. Match the CLIENT_TRADE_MAP lookup from submission_engine.py. The brain gets more accurate coverage signal.

## Sources

### Primary (HIGH confidence)
- `/Users/brianegan/EchoLocalClientTracker/scripts/seo_engine/brain.py` -- full _build_prompt() signature, section pattern, call_brain() passthrough
- `/Users/brianegan/EchoLocalClientTracker/scripts/seo_engine/outcome_logger.py` -- log_action() signature, _get_sb() pattern, get_action_history() filter
- `/Users/brianegan/EchoLocalClientTracker/scripts/seo_engine/seo_loop.py` -- run_client() data collection pattern, call_brain() call site
- `/Users/brianegan/EchoLocalClientTracker/scripts/seo_engine/submission_engine.py` -- _submit_to_directory() status update location, run_submission_engine() client_id scope
- `/Users/brianegan/EchoLocalClientTracker/supabase/migrations/add_directory_system_tables.sql` -- submissions table schema (status text, no enum constraint confirmed)
- `.planning/REQUIREMENTS.md` -- BRAIN-01, BRAIN-02 exact requirement text

### Secondary (MEDIUM confidence)
- supabase-py `.select("id", count="exact")` -- count parameter behavior verified from existing usage in outcome_logger.py and submission_engine.py

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all libraries already installed and in use
- Architecture: HIGH -- all patterns verified directly from existing codebase files
- Pitfalls: HIGH -- client_id scope issue and status count issue verified by reading actual function signatures and status workflow

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable Python files, no external dependency changes)
