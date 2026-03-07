export interface Client {
  id: string;
  name: string;
  slug: string;
  ga4_property: string | null;
  gsc_url: string | null;
  website: string | null;
  github: string | null;
  phone: string | null;
  target_keywords: string[] | null;
  service_areas: string[] | null;
  drive_folder_id: string | null;
  website_local_path: string | null;
  gbp_location: string | null;
  ghl_token: string | null;
  ghl_location_id: string | null;
  ghl_form_name: string | null;
  primary_market: string | null;
  conversion_events: Record<string, string> | null;
  ga4_measurement_id: string | null;
  seo_engine_enabled: boolean | null;
  created_at: string;
}

export interface Report {
  id: string;
  client_id: string;
  run_date: string;
  period_start: string;
  period_end: string;
  ga4_sessions: number | null;
  ga4_sessions_prev: number | null;
  ga4_organic: number | null;
  ga4_organic_prev: number | null;
  ga4_phone_clicks: number | null;
  ga4_phone_clicks_prev: number | null;
  ga4_form_submits: number | null;
  ga4_form_submits_prev: number | null;
  gsc_impressions: number | null;
  gsc_impressions_prev: number | null;
  gsc_clicks: number | null;
  gsc_clicks_prev: number | null;
  gsc_avg_position: number | null;
  gsc_avg_position_prev: number | null;
  psi_mobile_score: number | null;
  psi_desktop_score: number | null;
  psi_lcp_mobile: string | null;
  psi_lcp_desktop: string | null;
  psi_cls_mobile: string | null;
  psi_cls_desktop: string | null;
  psi_tbt_mobile: string | null;
  psi_tbt_desktop: string | null;
  gbp_maps_impressions: number | null;
  gbp_maps_impressions_prev: number | null;
  gbp_search_impressions: number | null;
  gbp_search_impressions_prev: number | null;
  gbp_total_impressions: number | null;
  gbp_total_impressions_prev: number | null;
  gbp_call_clicks: number | null;
  gbp_call_clicks_prev: number | null;
  gbp_website_clicks: number | null;
  gbp_website_clicks_prev: number | null;
  gbp_direction_requests: number | null;
  gbp_direction_requests_prev: number | null;
  created_at: string;
}

export interface GscQuery {
  id: string;
  report_id: string;
  client_id: string;
  run_date: string;
  query: string;
  impressions: number;
  clicks: number;
  position: number;
}

export interface GbpKeyword {
  id: string;
  report_id: string;
  client_id: string;
  run_date: string;
  keyword: string;
  impressions: number;
}

export interface SeoAction {
  id: string;
  client_id: string;
  action_type: string;
  action_date: string;
  description: string;
  target_keywords: string[];
  status: string;
  impact_score: number | null;
  content_summary: string | null;
  created_at: string;
}

export interface SeoBrainDecision {
  id: string;
  client_id: string;
  decision_date: string;
  input_summary: Record<string, unknown> | null;
  raw_response: string | null;
  parsed_actions: Array<{
    action_type: string;
    description: string;
    priority: number;
    reasoning: string;
    target_keywords?: string[];
    [key: string]: unknown;
  }> | null;
  execution_log: Record<string, unknown> | null;
  created_at: string;
}

export type TabId = 'overview' | 'seo' | 'conversions' | 'gbp' | 'seo-engine';
export type SeoEngineSubTab = 'action-feed' | 'brain-decisions' | 'keyword-tracker' | 'outcome-patterns';
export type SeoEngineTabId = 'clients' | 'actions' | 'brain' | 'keywords';
export type TimeRange = '4w' | '3m' | '6m' | 'all';
