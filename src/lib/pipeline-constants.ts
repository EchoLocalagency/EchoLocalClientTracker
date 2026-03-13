import type { PipelineStage } from './types';

export const PIPELINE_STAGES: PipelineStage[] = [
  'Lead',
  'Demo',
  'Proposal',
  'Onboarding',
  'Active',
  'Churned',
];

export const STAGE_CHECKLIST_DEFAULTS: Record<PipelineStage, Array<{ key: string; label: string }>> = {
  Lead: [
    { key: 'verify_contact_info', label: 'Verify contact info' },
    { key: 'research_business', label: 'Research business' },
    { key: 'schedule_demo', label: 'Schedule demo' },
  ],
  Demo: [
    { key: 'demo_completed', label: 'Demo completed' },
    { key: 'sent_proposal', label: 'Sent proposal' },
    { key: 'follow_up_sent', label: 'Follow-up sent' },
  ],
  Proposal: [
    { key: 'proposal_reviewed', label: 'Proposal reviewed' },
    { key: 'objections_handled', label: 'Objections handled' },
    { key: 'contract_sent', label: 'Contract sent' },
  ],
  Onboarding: [
    { key: 'contract_signed', label: 'Contract signed' },
    { key: 'gbp_access', label: 'GBP access granted' },
    { key: 'gsc_access', label: 'GSC access granted' },
    { key: 'ga4_access', label: 'GA4 access granted' },
    { key: 'site_access', label: 'Site access granted' },
    { key: 'client_profile_created', label: 'Client profile created' },
  ],
  Active: [
    { key: 'first_report_sent', label: 'First report sent' },
    { key: 'seo_engine_running', label: 'SEO engine running' },
    { key: 'monthly_check_in', label: 'Monthly check-in done' },
  ],
  Churned: [
    { key: 'exit_reason_logged', label: 'Exit reason logged' },
    { key: 'offboarding_done', label: 'Offboarding complete' },
  ],
};
