# Requirements: Directory Submission & Tracking System (v1.2)

**Defined:** 2026-03-10
**Core Value:** Each client gains 20-30 new backlinks from niche directories GHL/Yext misses, tracked and verified automatically.

## v1.2 Requirements

### Data Foundation

- [x] **DATA-01**: Client profiles stored in Supabase with canonical NAP, services, descriptions, certifications, and hours -- one source of truth for all form fills
- [x] **DATA-02**: Directory master list seeded in Supabase from research doc with tier, trade, submission method, CAPTCHA status, DA score, and URL for all 55 directories
- [x] **DATA-03**: Submission tracking table with UNIQUE(client_id, directory_id) constraint and status workflow: pending / submitted / approved / rejected / verified / skipped
- [ ] **DATA-04**: Pre-existing listing discovery searches each target directory for client business name + phone before any submission to avoid duplicates
- [ ] **DATA-05**: CAPTCHA audit categorizes every directory form URL as no_captcha / simple_captcha / advanced_captcha to determine automation eligibility

### Submission Engine

- [ ] **SUB-01**: Playwright auto-submits client profiles to Tier 3 no-CAPTCHA directories with human-like typing delays and playwright-stealth anti-detection
- [ ] **SUB-02**: Submission rate limiter enforces max 5 submissions per client per day and 8 per client per week as hard caps
- [ ] **SUB-03**: Submission state machine tracks form_loaded / form_filled / post_sent stages so failures after POST never trigger re-submission
- [ ] **SUB-04**: NAP consistency audit runs before each submission to verify form data matches canonical client profile exactly
- [ ] **SUB-05**: Failed submissions store screenshot and error details for debugging, marked as failed (not retried automatically)

### Verification Loop

- [ ] **VER-01**: Brave Search site: query checks each submitted directory for client listing presence after 7 days
- [ ] **VER-02**: Verified listings update submission status to verified with live URL stored
- [ ] **VER-03**: Unverified submissions after 14 days trigger alert to Brian with directory name and client
- [ ] **VER-04**: Submissions unverified after 21 days marked as needs_review for manual investigation

### Brain Integration

- [ ] **BRAIN-01**: Brain prompt includes directory_summary section showing current coverage per client (X/Y submitted, X/Y verified)
- [ ] **BRAIN-02**: Directory submissions logged to seo_actions table with action_type='directory_submission' for full brain visibility

### Dashboard

- [ ] **DASH-01**: Directories tab in dashboard shows per-client directory status grid with color-coded badges (verified=green, submitted=yellow, pending=grey, rejected=red, skipped=muted)
- [ ] **DASH-02**: Tier progress bars show X/Y submitted and X/Y verified per tier per client
- [ ] **DASH-03**: Tier 1/2 directories displayed as actionable recommendation checklist requiring client input (not automated)
- [ ] **DASH-04**: Backlink value score per client calculated as DA-weighted sum of verified directory listings

## v1.1 Requirements (Complete)

All v1.1 requirements shipped. See milestones archive for details.

- INFRA-01, INFRA-02: Brave Search client + usage tracking
- MENT-01 through MENT-04: Mention tracking + source diversity + competitor AIO
- DASH-01 through DASH-06 (v1.1): GEO dashboard, citations, budget, snippets
- DEBT-01 through DEBT-03: Tech debt resolved

## v1.3 Requirements (Deferred)

### Email Verification

- **EMAIL-01**: Confirmation email processing via Gmail API for directories requiring email verification
- **EMAIL-02**: Automated link-clicking in confirmation emails via Playwright

### Advanced Tracking

- **ADV-01**: Sentiment/review tracking on directory listings
- **ADV-02**: Competitor directory presence comparison

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-submit to Tier 1/2 directories | Reputation risk -- requires real business relationships and certifications |
| CAPTCHA solving services | Adversarial, wasteful on free directory listings |
| Parallel browser farm | Infrastructure complexity for under 1-hour sequential runtime |
| Mass submission to DA < 10 directories | Pre-2015 spam pattern, harms rather than helps SEO |
| Real-time submission status updates | Polling waste; batch verification at 7-day intervals is sufficient |
| Confirmation email processing | HIGH complexity, defer to v1.3 after seeing which directories require it |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 8 | Complete |
| DATA-02 | Phase 8 | Complete |
| DATA-03 | Phase 8 | Complete |
| DATA-04 | Phase 8 | Pending |
| DATA-05 | Phase 8 | Pending |
| SUB-01 | Phase 9 | Pending |
| SUB-02 | Phase 9 | Pending |
| SUB-03 | Phase 9 | Pending |
| SUB-04 | Phase 9 | Pending |
| SUB-05 | Phase 9 | Pending |
| VER-01 | Phase 10 | Pending |
| VER-02 | Phase 10 | Pending |
| VER-03 | Phase 10 | Pending |
| VER-04 | Phase 10 | Pending |
| BRAIN-01 | Phase 11 | Pending |
| BRAIN-02 | Phase 11 | Pending |
| DASH-01 | Phase 12 | Pending |
| DASH-02 | Phase 12 | Pending |
| DASH-03 | Phase 12 | Pending |
| DASH-04 | Phase 12 | Pending |

**Coverage:**
- v1.2 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
