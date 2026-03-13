# Requirements: Client Pipeline Tracker (v1.4)

**Defined:** 2026-03-12
**Core Value:** Track every client from first contact to active/churned so nothing falls through the cracks as the client base grows.

## v1.4 Requirements

### Data Foundation

- [ ] **DATA-01**: Admin can create a pipeline lead with contact name, email, phone, trade, source/channel, and notes
- [ ] **DATA-02**: Every stage transition is logged with timestamp in an append-only history table
- [ ] **DATA-03**: Each pipeline stage has predefined checklist items that appear for every lead entering that stage
- [ ] **DATA-04**: Admin can check/uncheck checklist items per lead, with completion stored separately from templates
- [ ] **DATA-05**: Admin can log communication entries (call, email, text) with notes and timestamp per lead
- [ ] **DATA-06**: RLS policies restrict pipeline tables to admin users only

### Pipeline UI

- [ ] **UI-01**: Pipeline page accessible via top-level sidebar link (admin-only)
- [ ] **UI-02**: Pipeline table view shows all leads with stage, days-in-stage, source, checklist progress, and last contact date
- [ ] **UI-03**: Table is filterable by stage and sortable by any column
- [ ] **UI-04**: Admin can move a lead to a different stage via dropdown, which creates a stage history entry
- [ ] **UI-05**: Stage summary cards at top of page show count per stage

### Lead Detail

- [ ] **DETAIL-01**: Clicking a lead opens a slide-out drawer with full profile, stage history timeline, checklist, and comms log
- [ ] **DETAIL-02**: Admin can edit lead profile fields inline in the drawer
- [ ] **DETAIL-03**: Admin can add communication log entries from the drawer
- [ ] **DETAIL-04**: Checklist shows stage-specific items with check/uncheck in the drawer

### Sales Engine Integration

- [ ] **INT-01**: When a call is analyzed with outcome "meeting_booked" or "closed", a pipeline lead is auto-created in the Lead stage with contact info from the call
- [ ] **INT-02**: Auto-created leads have source set to "sales_engine" and link back to the originating call_analysis record
- [ ] **INT-03**: Duplicate detection prevents creating a second lead if one already exists for the same phone number or company name

### Analytics

- [ ] **ANAL-01**: Conversion funnel showing lead counts progressing through each stage
- [ ] **ANAL-02**: Average days per stage metric
- [ ] **ANAL-03**: Source/channel breakdown chart showing where leads come from
- [ ] **ANAL-04**: Overdue follow-up highlighting for leads with no communication in 7+ days

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
| DATA-01 | Phase 14 | Pending |
| DATA-02 | Phase 14 | Pending |
| DATA-03 | Phase 14 | Pending |
| DATA-04 | Phase 14 | Pending |
| DATA-05 | Phase 14 | Pending |
| DATA-06 | Phase 14 | Pending |
| UI-01 | Phase 15 | Pending |
| UI-02 | Phase 15 | Pending |
| UI-03 | Phase 15 | Pending |
| UI-04 | Phase 15 | Pending |
| UI-05 | Phase 15 | Pending |
| DETAIL-01 | Phase 16 | Pending |
| DETAIL-02 | Phase 16 | Pending |
| DETAIL-03 | Phase 16 | Pending |
| DETAIL-04 | Phase 16 | Pending |
| ANAL-01 | Phase 17 | Pending |
| ANAL-02 | Phase 17 | Pending |
| ANAL-03 | Phase 17 | Pending |
| INT-01 | Phase 14 | Pending |
| INT-02 | Phase 14 | Pending |
| INT-03 | Phase 14 | Pending |
| ANAL-04 | Phase 17 | Pending |

**Coverage:**
- v1.4 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after roadmap creation*
