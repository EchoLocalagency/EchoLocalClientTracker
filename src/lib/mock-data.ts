import { Client, Report, GscQuery } from './types';

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'Integrity Pro Washers',
    slug: 'integrity-pro-washers',
    ga4_property: 'properties/523647807',
    gsc_url: 'https://integrityprowashers.com/',
    website: 'https://integrityprowashers.com/',
    github: 'https://github.com/EchoLocalagency/IntegrityProWashing',
    phone: '+16198874442',
    created_at: '2025-02-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Mr Green Turf Clean',
    slug: 'mr-green-turf-clean',
    ga4_property: 'properties/524866087',
    gsc_url: 'https://mrgreenturfclean.com/',
    website: 'https://mrgreenturfclean.com/',
    github: 'https://github.com/EchoLocalagency/MrGreenTurfClean',
    phone: '+18587035676',
    created_at: '2025-02-01T00:00:00Z',
  },
];

// Generate realistic bi-weekly report data over several months
function generateReports(clientId: string, baseMetrics: {
  sessions: number;
  organic: number;
  impressions: number;
  clicks: number;
  position: number;
  mobileScore: number;
  desktopScore: number;
}): Report[] {
  const reports: Report[] = [];
  const startDate = new Date('2025-06-01');
  const now = new Date('2026-02-20');
  let i = 0;

  while (startDate < now) {
    const runDate = new Date(startDate);
    const periodEnd = new Date(startDate);
    periodEnd.setDate(periodEnd.getDate() - 1);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 13);
    const prevEnd = new Date(periodStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 13);

    // Add some growth trend + noise
    const growth = 1 + (i * 0.06);
    const noise = () => 0.85 + Math.random() * 0.3;

    const sessions = Math.round(baseMetrics.sessions * growth * noise());
    const sessionsPrev = Math.round(baseMetrics.sessions * (growth - 0.06) * noise());
    const organic = Math.round(baseMetrics.organic * growth * noise());
    const organicPrev = Math.round(baseMetrics.organic * (growth - 0.06) * noise());
    const impressions = Math.round(baseMetrics.impressions * growth * noise());
    const impressionsPrev = Math.round(baseMetrics.impressions * (growth - 0.06) * noise());
    const clicks = Math.round(baseMetrics.clicks * growth * noise());
    const clicksPrev = Math.round(baseMetrics.clicks * (growth - 0.06) * noise());
    const position = +(baseMetrics.position / growth * noise()).toFixed(1);
    const positionPrev = +(baseMetrics.position / (growth - 0.06) * noise()).toFixed(1);
    const phoneClicks = Math.round(3 * growth * noise());
    const phoneClicksPrev = Math.round(3 * (growth - 0.06) * noise());
    const formSubmits = clientId === '1' ? Math.round(2 * growth * noise()) : 0;
    const formSubmitsPrev = clientId === '1' ? Math.round(2 * (growth - 0.06) * noise()) : 0;

    const mobileScore = Math.min(100, Math.round(baseMetrics.mobileScore + i * 2 + (Math.random() * 6 - 3)));
    const desktopScore = Math.min(100, Math.round(baseMetrics.desktopScore + i * 1 + (Math.random() * 4 - 2)));

    reports.push({
      id: `${clientId}-${i}`,
      client_id: clientId,
      run_date: runDate.toISOString().split('T')[0],
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      ga4_sessions: sessions,
      ga4_sessions_prev: sessionsPrev,
      ga4_organic: organic,
      ga4_organic_prev: organicPrev,
      ga4_phone_clicks: phoneClicks,
      ga4_phone_clicks_prev: phoneClicksPrev,
      ga4_form_submits: formSubmits,
      ga4_form_submits_prev: formSubmitsPrev,
      gsc_impressions: impressions,
      gsc_impressions_prev: impressionsPrev,
      gsc_clicks: clicks,
      gsc_clicks_prev: clicksPrev,
      gsc_avg_position: position,
      gsc_avg_position_prev: positionPrev,
      psi_mobile_score: mobileScore,
      psi_desktop_score: desktopScore,
      psi_lcp_mobile: (4.5 - i * 0.3 + Math.random()).toFixed(1) + ' s',
      psi_lcp_desktop: (2.1 - i * 0.1 + Math.random() * 0.5).toFixed(1) + ' s',
      psi_cls_mobile: (0.15 - i * 0.01 + Math.random() * 0.05).toFixed(3),
      psi_cls_desktop: (0.05 + Math.random() * 0.03).toFixed(3),
      psi_tbt_mobile: Math.round(800 - i * 50 + Math.random() * 100) + ' ms',
      psi_tbt_desktop: Math.round(200 - i * 15 + Math.random() * 50) + ' ms',
      gbp_maps_impressions: 0,
      gbp_maps_impressions_prev: 0,
      gbp_search_impressions: 0,
      gbp_search_impressions_prev: 0,
      gbp_total_impressions: 0,
      gbp_total_impressions_prev: 0,
      gbp_call_clicks: 0,
      gbp_call_clicks_prev: 0,
      gbp_website_clicks: 0,
      gbp_website_clicks_prev: 0,
      gbp_direction_requests: 0,
      gbp_direction_requests_prev: 0,
      created_at: runDate.toISOString(),
    });

    startDate.setDate(startDate.getDate() + 14);
    i++;
  }

  return reports;
}

export const mockReports: Report[] = [
  ...generateReports('1', {
    sessions: 87,
    organic: 19,
    impressions: 320,
    clicks: 18,
    position: 28.5,
    mobileScore: 55,
    desktopScore: 78,
  }),
  ...generateReports('2', {
    sessions: 58,
    organic: 17,
    impressions: 280,
    clicks: 14,
    position: 32.0,
    mobileScore: 60,
    desktopScore: 82,
  }),
];

const queryTemplates: Record<string, string[]> = {
  '1': [
    'pressure washing san diego',
    'pressure washing near me',
    'power washing san diego',
    'house washing san diego',
    'driveway cleaning san diego',
    'roof cleaning san diego',
    'commercial pressure washing',
    'pressure washing services',
    'exterior cleaning san diego',
    'concrete cleaning near me',
  ],
  '2': [
    'artificial turf cleaning san diego',
    'turf cleaning near me',
    'synthetic grass cleaning',
    'artificial grass maintenance',
    'turf sanitizing san diego',
    'pet turf cleaning',
    'artificial lawn cleaning service',
    'turf deep clean',
    'fake grass cleaning near me',
    'turf odor removal',
  ],
};

export function getMockQueries(clientId: string, reportId: string, runDate: string): GscQuery[] {
  const templates = queryTemplates[clientId] || queryTemplates['1'];
  return templates.map((query, i) => ({
    id: `${reportId}-q${i}`,
    report_id: reportId,
    client_id: clientId,
    run_date: runDate,
    query,
    impressions: Math.round(80 - i * 7 + Math.random() * 20),
    clicks: Math.round(12 - i * 1 + Math.random() * 5),
    position: +(5 + i * 3 + Math.random() * 5).toFixed(1),
  }));
}
