# Requirements: Client Pipeline Tracker (v1.4)

**Defined:** 2026-03-12
**Core Value:** Track every client from first contact to active/churned so nothing falls through the cracks as the client base grows.

## v1.4 Requirements

### Data Foundation

- [x] **DATA-01**: Admin can create a pipeline lead with contact name, email, phone, trade, source/channel, and notes
- [x] **DATA-02**: Every stage transition is logged with timestamp in an append-only history table
- [x] **DATA-03**: Each pipeline stage has predefined checklist items that appear for every lead entering that stage
- [x] **DATA-04**: Admin can check/uncheck checklist items per lead, with completion stored separately from templates
- [x] **DATA-05**: Admin can log communication entries (call, email, text) with notes and timestamp per lead
- [x] **DATA-06**: RLS policies restrict pipeline tables to admin users only

### Pipeline UI

- [x] **UI-01**: Pipeline page accessible via top-level sidebar link (admin-only)
- [x] **UI-02**: Pipeline table view shows all leads with stage, days-in-stage, source, checklist progress, and last contact date
- [x] **UI-03**: Table is filterable by stage and sortable by any column
- [x] **UI-04**: Admin can move a lead to a different stage via dropdown, which creates a stage history entry
- [x] **UI-05**: Stage summary cards at top of page show count per stage

### Lead Detail

- [x] **DETAIL-01**: Clicking a lead opens a slide-out drawer with full profile, stage history timeline, checklist, and comms log
- [x] **DETAIL-02**: Admin can edit lead profile fields inline in the drawer
- [x] **DETAIL-03**: Admin can add communication log entries from the drawer
- [x] **DETAIL-04**: Checklist shows stage-specific items with check/uncheck in the drawer

### Sales Engine Integration

- [x] **INT-01**: When a call is analyzed with outcome "meeting_booked" or "closed", a pipeline lead is auto-created in the Lead stage with contact info from the call
- [x] **INT-02**: Auto-created leads have source set to "sales_engine" and link back to the originating call_analysis record
- [x] **INT-03**: Duplicate detection prevents creating a second lead if one already exists for the same phone number or company name

### Analytics

- [x] **ANAL-01**: Conversion funnel showing lead counts progressing through each stage
- [x] **ANAL-02**: Average days per stage metric
- [x] **ANAL-03**: Source/channel breakdown chart showing where leads come from
- [x] **ANAL-04**: Overdue follow-up highlighting for leads with no communication in 7+ days

## v1.5 Requirements: SEO Engine Hardening

### Self-Improve Safety
- [x] **HARD-01**: self_improve.py merges learned patterns into existing tuning without overwriting manual suppressions
- [x] **HARD-02**: engine_tuning.json has a `manual_overrides` section per client that self_improve never modifies

### Brain Intelligence
- [x] **HARD-03**: When all brain-recommended actions are suppressed, engine retries once with explicit available-type guidance
- [x] **HARD-04**: SoCal blog/index.html exists and SoCal is in blog_engine.py SITE_CONFIG
- [x] **HARD-05**: Brain prompt includes bottom-5 GEO-scored pages with missing factors listed
- [ ] **HARD-06**: Review velocity tracked daily in reports, surfaced to brain with warning when <1/week
- [x] **HARD-07**: Impact scores use per-action-type formulas (content: position+impressions+clicks, GBP: GBP metrics, photo: views)

### Data Signals
- [ ] **HARD-08**: Competitor top-3 positions stored per keyword snapshot
- [ ] **HARD-09**: Competitor position changes >3 places surfaced as alerts in brain prompt
- [ ] **HARD-10**: Content cluster health scored against GSC data, underperformers flagged to brain

### Content Quality
- [ ] **HARD-11**: Location pages with >70% trigram similarity to existing pages rejected before writing
- [ ] **HARD-12**: Image alt text validated (missing/empty/too-short flagged as warnings)

### Operational Reliability
- [x] **HARD-13**: Blog_engine.py SITE_CONFIG includes SoCal with correct domain and template
- [x] **HARD-14**: geo_scorer.py freshness check uses dynamic current year (no hardcoded 2025/2026)
- [ ] **HARD-15**: Sitemap lastmod updated when page_optimizer or geo_upgrade edits a page
- [ ] **HARD-16**: DNS pre-flight check in seo_loop.py with cache flush and retry
- [ ] **HARD-17**: Launchd plist has PYTHONUNBUFFERED=1 for real-time log output

## Previous Milestones (Complete)

- v1.3: GSC Keyword History (Phase 13)
- v1.2: Directory Submission & Tracking (20/20 requirements, Phases 8-12)
- v1.1: Mention Tracking + GEO Dashboard (Phases 5-7)
- v1.0: GEO Module (26/26 requirements, Phases 1-4)

## Future Requirements

### Automation

- **AUTO-01**: Auto-create pipeline lead from GHL webhook on new contact
- **AUTO-02**: Auto-log communications from GHL activity feed
- **AUTO-03**: Email/SMS reminders for overdue follow-ups

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kanban/drag-and-drop board | Table view with dropdowns is faster at 5-15 clients; add later if scale demands |
| Multi-user access / team CRM | Solo operator; admin-only is sufficient |
| Deal value / revenue tracking | Brian tracks pipeline progress, not deal amounts |
| Calendar integration | Overkill for current scale |
| Email/SMS sending from dashboard | GHL handles communication delivery |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 14 | Complete |
| DATA-02 | Phase 14 | Complete |
| DATA-03 | Phase 14 | Complete |
| DATA-04 | Phase 14 | Complete |
| DATA-05 | Phase 14 | Complete |
| DATA-06 | Phase 14 | Complete |
| UI-01 | Phase 15 | Complete |
| UI-02 | Phase 15 | Complete |
| UI-03 | Phase 15 | Complete |
| UI-04 | Phase 15 | Complete |
| UI-05 | Phase 15 | Complete |
| DETAIL-01 | Phase 16 | Complete |
| DETAIL-02 | Phase 16 | Complete |
| DETAIL-03 | Phase 16 | Complete |
| DETAIL-04 | Phase 16 | Complete |
| ANAL-01 | Phase 17 | Complete |
| ANAL-02 | Phase 17 | Complete |
| ANAL-03 | Phase 17 | Complete |
| INT-01 | Phase 14 | Complete |
| INT-02 | Phase 14 | Complete |
| INT-03 | Phase 14 | Complete |
| ANAL-04 | Phase 17 | Complete |

**Coverage:**
- v1.4 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after roadmap creation*
