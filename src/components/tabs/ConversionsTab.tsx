'use client';

import { Report } from '@/lib/types';
import StatCard from '@/components/StatCard';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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

  const sorted = reports.sort((a, b) => a.run_date.localeCompare(b.run_date));

  const phoneData = sorted.map((r) => ({
    date: new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    calls: r.ga4_phone_clicks ?? 0,
    forms: r.ga4_form_submits ?? 0,
  }));

  const conversionRate = latestReport.ga4_phone_clicks != null && latestReport.ga4_sessions != null && latestReport.ga4_sessions > 0
    ? ((latestReport.ga4_phone_clicks / latestReport.ga4_sessions) * 100).toFixed(1) + '%'
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
          label="Phone Clicks"
          value={latestReport.ga4_phone_clicks}
          previous={latestReport.ga4_phone_clicks_prev}
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
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Phone Clicks Per Period</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={phoneData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="calls" fill="#E8FF00" radius={[4, 4, 0, 0]} name="Phone Clicks" />
              {hasFormTracking && (
                <Bar dataKey="forms" fill="var(--text-primary)" radius={[4, 4, 0, 0]} name="Form Submits" />
              )}
            </BarChart>
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
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Phone Clicks</th>
              {hasFormTracking && <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Form Submits</th>}
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice().reverse().map((r) => {
              const rate = r.ga4_phone_clicks != null && r.ga4_sessions != null && r.ga4_sessions > 0
                ? ((r.ga4_phone_clicks / r.ga4_sessions) * 100).toFixed(1) + '%'
                : '--';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>{r.run_date}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.ga4_sessions?.toLocaleString() ?? '--'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.ga4_phone_clicks ?? '--'}</td>
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
