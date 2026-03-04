const INSTANTLY_API_KEY = 'Mzg2NzYyNjYtZGZhYS00ZjM2LTkyNzgtZGVlNjJkOGUzNmUxOm53Z0hUVUpxVlRSUw==';
const INSTANTLY_BASE = 'https://api.instantly.ai/api/v2';
const HEADERS = {
  'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
  'Content-Type': 'application/json',
};

const CAMPAIGN_ID = 'db447474-0044-4b75-b8f1-c437eaf7eef5';
const ALL_SENDERS = [
  'brian@echolocaldigital.com',
  'brian@echolocalseo.com',
  'brian@echolocalai.com',
  'brian@echolocalagency.com',
];

const LIST_IDS: Record<string, string> = {
  hot: 'fae33340-acbd-4aef-b95a-29a0cd2f0d47',
  warm: '2ecfc63a-118d-4bf9-8f78-43ce6414804d',
  moderate: '8cad391d-213e-4089-9262-0a38547c6cc7',
  archive: '01012169-3c49-4730-9736-a405b16ff47d',
};

async function instantlyGet(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${INSTANTLY_BASE}/${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) return null;
  return res.json();
}

async function instantlyPost(endpoint: string, body?: Record<string, unknown>) {
  const res = await fetch(`${INSTANTLY_BASE}/${endpoint}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  try {
    // Run all API calls in parallel
    const [warmupData, campaignData, analyticsRaw, unreadData] = await Promise.all([
      instantlyPost('accounts/warmup-analytics', { emails: ALL_SENDERS }),
      instantlyGet(`campaigns/${CAMPAIGN_ID}`),
      instantlyGet('campaigns/analytics', { id: CAMPAIGN_ID }),
      instantlyGet('emails/unread/count'),
    ]);

    // Fetch lead counts per list in parallel
    const listCounts: Record<string, number> = {};
    const listResults = await Promise.all(
      Object.entries(LIST_IDS).map(async ([tier, listId]) => {
        const data = await instantlyPost('leads/list', { list_id: listId, limit: 1 });
        return [tier, data?.total_count ?? data?.items?.length ?? 0] as const;
      })
    );
    for (const [tier, count] of listResults) {
      listCounts[tier] = count;
    }

    // Parse warmup
    const aggregate = warmupData?.aggregate_data || {};
    const accounts = ALL_SENDERS.map((email) => {
      const d = aggregate[email] || {};
      return {
        email,
        health_score: d.health_score ?? 0,
        label: d.health_score_label ?? 'unknown',
        sent: d.sent ?? 0,
        received: d.received ?? 0,
        inbox: d.landed_inbox ?? 0,
        is_primary: email === 'brian@echolocaldigital.com',
      };
    });

    // Parse campaign analytics
    const analytics = Array.isArray(analyticsRaw) ? analyticsRaw[0] : analyticsRaw;
    const sent = analytics?.emails_sent_count ?? 0;
    const opened = analytics?.open_count ?? 0;
    const replied = analytics?.reply_count ?? 0;
    const bounced = analytics?.bounced_count ?? 0;

    const statusMap: Record<number, string> = { 0: 'draft', 1: 'active', 2: 'paused', 3: 'completed', [-1]: 'error' };

    const result = {
      timestamp: new Date().toISOString(),
      campaign: {
        id: CAMPAIGN_ID,
        name: campaignData?.name ?? 'Echo Local Outreach',
        status: statusMap[campaignData?.status ?? -1] ?? 'unknown',
        status_code: campaignData?.status ?? -1,
      },
      analytics: {
        emails_sent: sent,
        opened,
        replied,
        bounced,
        open_rate: sent > 0 ? +(opened / sent * 100).toFixed(1) : 0,
        reply_rate: sent > 0 ? +(replied / sent * 100).toFixed(1) : 0,
        bounce_rate: sent > 0 ? +(bounced / sent * 100).toFixed(1) : 0,
      },
      accounts,
      unread_replies: unreadData?.count ?? unreadData?.unread_count ?? 0,
      lead_lists: listCounts,
      total_leads: Object.values(listCounts).reduce((a, b) => a + b, 0),
    };

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: 'Failed to fetch Instantly data' }, { status: 500 });
  }
}
