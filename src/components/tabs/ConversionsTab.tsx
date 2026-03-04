'use client';

import { Report } from '@/lib/types';
import { dailyRate } from '@/lib/utils';
import StatCard from '@/components/StatCard';
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

interface ConversionsTabProps {
  reports: Report[];
  latestReport: Report | null;
  hasFormTracking: boolean;
}

export default function ConversionsTab({ reports, latestReport, hasFormTracking }: ConversionsTabProps) {
  if (!latestReport) {
    return <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>No data yet.</div>;
  }

  const sorted = [...reports].sort((a, b) => a.run_date.localeCompare(b.run_date));

  const totalCalls = (r: Report) => (r.ga4_phone_clicks ?? 0) + (r.gbp_call_clicks ?? 0);
  const totalCallsPrev = (r: Report) => (r.ga4_phone_clicks_prev ?? 0) + (r.gbp_call_clicks_prev ?? 0);

  const phoneData = sorted.map((r) => ({
    date: new Date(r.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Website Calls': dailyRate(r.ga4_phone_clicks, r.period_start, r.period_end),
    'GBP Calls': dailyRate(r.gbp_call_clicks, r.period_start, r.period_end),
    forms: dailyRate(r.ga4_form_submits, r.period_start, r.period_end),
  }));

  const latestTotal = totalCalls(latestReport);
  const conversionRate = latestTotal > 0 && latestReport.ga4_sessions != null && latestReport.ga4_sessions > 0
    ? ((latestTotal / latestReport.ga4_sessions) * 100).toFixed(1) + '%'
    : '--';

  const chartStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)' as const,
    padding: '20px 24px',
    marginBottom: 20,
  };

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Total Phone Clicks"
          value={latestTotal}
          previous={totalCallsPrev(latestReport)}
        />
        <StatCard
          label="Website Calls"
          value={latestReport.ga4_phone_clicks}
          previous={latestReport.ga4_phone_clicks_prev}
        />
        <StatCard
          label="GBP Calls"
          value={latestReport.gbp_call_clicks}
          previous={latestReport.gbp_call_clicks_prev}
        />
        {hasFormTracking && (
          <StatCard
            label="Form Submissions"
            value={latestReport.ga4_form_submits}
            previous={latestReport.ga4_form_submits_prev}
          />
        )}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Conversion Rate
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{conversionRate}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Phone clicks / sessions</div>
        </div>
      </div>

      {/* Phone clicks over time */}
      <div style={chartStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Conversions Over Time</div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={phoneData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradWebsite" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8FF00" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#E8FF00" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradGBP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00CED1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00CED1" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradForms" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Website Calls" stroke="#E8FF00" strokeWidth={2} fill="url(#gradWebsite)" dot={{ r: 4, fill: '#E8FF00', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Area type="monotone" dataKey="GBP Calls" stroke="#00CED1" strokeWidth={2} fill="url(#gradGBP)" dot={{ r: 4, fill: '#00CED1', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              {hasFormTracking && (
                <Area type="monotone" dataKey="forms" name="Form Submits" stroke="#a78bfa" strokeWidth={2} fill="url(#gradForms)" dot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion history table */}
      <div style={chartStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Conversion History</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Period</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Sessions</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Website Calls</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>GBP Calls</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Total Calls</th>
              {hasFormTracking && <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Form Submits</th>}
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice().reverse().map((r) => {
              const total = totalCalls(r);
              const rate = total > 0 && r.ga4_sessions != null && r.ga4_sessions > 0
                ? ((total / r.ga4_sessions) * 100).toFixed(1) + '%'
                : '--';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>{r.run_date}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.ga4_sessions?.toLocaleString() ?? '--'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.ga4_phone_clicks ?? 0}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#00CED1' }}>{r.gbp_call_clicks ?? 0}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{total}</td>
                  {hasFormTracking && <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.ga4_form_submits ?? '--'}</td>}
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent)' }}>{rate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
