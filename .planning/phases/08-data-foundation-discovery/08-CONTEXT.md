# Phase 8: Data Foundation + Discovery - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

All directory and client data lives in Supabase with dedup protection and CAPTCHA categorization locked in before any automation runs. Client profiles become the single source of truth for form fills. Directory master list seeded with tier, trade, CAPTCHA status. Pre-existing listing discovery prevents duplicate submissions. No submission automation in this phase -- that's Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Client profile sourcing
- Seed initial data from clients.json, then expand with new fields (NAP, services, descriptions, certifications, hours, payment methods, service areas, social links)
- Full profile depth -- cover every field any directory could ask for
- Supabase becomes the single source of truth; clients.json becomes a one-time seed file, not maintained ongoing
- Profile edits happen via a dashboard UI form -- not SQL or Supabase editor

### Directory master list
- Start with the 15 directories already in directory_audit.py, research and add ~40 more to reach 55 total
- Mix of universal directories (Yelp, BBB, Manta) and trade-specific directories (HomeAdvisor, Lawn Love, etc.) tagged by trade so only relevant clients get submitted
- Directory management UI in the dashboard -- add, edit, disable directories visually
- CAPTCHA status displayed as a column in the directory management view (green/yellow/red badges)

### Discovery mechanism
- Brave Search site: queries -- same proven approach as existing directory_audit.py
- On-demand per client -- triggered manually when ready to start submissions (button in dashboard or CLI command)
- Existing listings marked as 'existing_needs_review' so Brian can check if listing is claimed/accurate before deciding to skip or update

### Claude's Discretion
- Directory tier definitions (DA-based, effort-based, or hybrid) -- pick what makes sense for the submission engine workflow
- Brave Search match confidence threshold -- minimize false positives without missing real listings
- CAPTCHA automation eligibility rules -- determine what's safe to automate based on CAPTCHA type and bot detection risk
- CAPTCHA re-check cadence -- pick based on how often directory forms actually change
- CAPTCHA status visible in directory management view with color badges

</decisions>

<specifics>
## Specific Ideas

- Expand the existing directory_audit.py pattern (Brave Search site: queries) rather than building from scratch
- Existing backlink tables (backlink_targets, backlink_outreach) show the established Supabase schema pattern -- follow same conventions
- Submission tracking table needs UNIQUE(client_id, directory_id) constraint at database level

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/seo_engine/backlinks/directory_audit.py`: Brave Search site: query pattern for 15 directories -- extend for discovery
- `scripts/seo_engine/supabase_migration_v3_backlinks.sql`: Schema pattern for backlink tables (UUID PKs, client_id FK, status workflow, UNIQUE constraints, indexes)
- `src/lib/supabase.ts` / `supabase-middleware.ts`: Browser and server Supabase clients ready to use
- `src/components/StatCard.tsx`, `src/components/seo-engine/ClientManager.tsx`: Existing dashboard components to reference for new UI

### Established Patterns
- Inline styles with CSS variables (not Tailwind classes) -- all new components must follow this
- Data fetching via useEffect + Supabase client in components
- API routes use service role key for server-side Supabase access
- Python scripts handle data pipelines; Next.js handles dashboard reads
- `clients.json` currently holds client config (GA4 IDs, keywords, service areas, GHL tokens)

### Integration Points
- `src/lib/types.ts`: New TypeScript interfaces (ClientProfile, Directory, Submission) go here
- `src/components/tabs/`: New tab or sub-tab for directory management
- `supabase/migrations/`: New migration file for tables (client_profiles, directories, submissions)
- `scripts/`: New Python script for discovery + CAPTCHA audit

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 08-data-foundation-discovery*
*Context gathered: 2026-03-10*
