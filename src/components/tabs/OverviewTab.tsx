'use client';

import { Report, GscQuery } from '@/lib/types';
import StatCard from '@/components/StatCard';
import { parseMetricValue } from '@/lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartTooltip from '@/components/ChartTooltip';

interface OverviewTabProps {
  reports: Report[];
  latestReport: Report | null;
}

export default function OverviewTab({ reports, latestReport }: OverviewTabProps) {
  if (!latestReport) {
    return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>No data yet. Run your first report to see metrics here.</div>;
  }

  const r = latestReport;
  const mobileScore = r.psi_mobile_score;
  const lcpMobile = parseMetricValue(r.psi_lcp_mobile);

  const alerts: string[] = [];
  if (mobileScore != null && mobileScore < 50) alerts.push(`Mobile speed score is ${mobileScore} (below 50)`);
  if (lcpMobile != null && lcpMobile > 4) alerts.push(`Mobile LCP is ${r.psi_lcp_mobile} (above 4s)`);
  const organicDelta = r.ga4_organic != null && r.ga4_organic_prev != null && r.ga4_organic_prev > 0
    ? ((r.ga4_organic - r.ga4_organic_prev) / r.ga4_organic_prev) * 100
    : null;
  if (organicDelta != null && organicDelta < -20) alerts.push(`Organic sessions dropped ${Math.abs(organicDelta).toFixed(0)}%`);

  const chartData = reports
    .sort((a, b) => a.run_date.localeCompare(b.run_date))
    .map((rep) => ({
      date: new Date(rep.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      impressions: rep.gsc_impressions ?? 0,
    }));

  return (
    <div>
      {/* Hero chart: GSC impressions trend */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '24px',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
          Google Search Impressions Over Time
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
          How much more are you showing up on Google
        </div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00CED1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00CED1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="impressions"
                stroke="#00CED1"
                strokeWidth={2}
                fill="url(#impressionsGrad)"
                name="Impressions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Organic Sessions"
          value={r.ga4_organic}
          previous={r.ga4_organic_prev}
        />
        <StatCard
          label="Search Impressions"
          value={r.gsc_impressions}
          previous={r.gsc_impressions_prev}
        />
        <StatCard
          label="Phone Clicks"
          value={r.ga4_phone_clicks}
          previous={r.ga4_phone_clicks_prev}
        />
        <StatCard
          label="Mobile Speed Score"
          value={r.psi_mobile_score}
          format="score"
          alert={mobileScore != null && mobileScore < 50 ? 'Below threshold' : null}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div
          style={{
            background: 'rgba(255, 215, 0, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: 8,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 8 }}>
            Attention Needed
          </div>
          {alerts.map((alert, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, paddingLeft: 12 }}>
              - {alert}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
