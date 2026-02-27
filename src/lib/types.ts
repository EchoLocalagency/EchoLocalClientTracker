export interface Client {
  id: string;
  name: string;
  slug: string;
  ga4_property: string | null;
  gsc_url: string | null;
  website: string | null;
  github: string | null;
  phone: string | null;
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

export type TabId = 'overview' | 'seo' | 'health' | 'conversions' | 'gbp' | 'summary';

export type TimeRange = '4w' | '3m' | '6m' | 'all';
