'use client';

import { Report } from '@/lib/types';
import { parseMetricValue } from '@/lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartTooltip from '@/components/ChartTooltip';

interface HealthTabProps {
  reports: Report[];
  latestReport: Report | null;
}

function ScoreIndicator({ label, value, thresholds }: { label: string; value: number | null; thresholds: { good: number; mid: number } }) {
  let color = 'var(--text-muted)';
  let status = '--';
  if (value != null) {
    if (value <= thresholds.good) {
      color = 'var(--success)';
      status = 'Good';
    } else if (value <= thresholds.mid) {
      color = 'var(--accent-gold)';
      status = 'Needs Work';
    } else {
      color = 'var(--danger)';
      status = 'Poor';
    }
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color }}>{value ?? '--'}</span>
        <span style={{ fontSize: 12, color, fontWeight: 500 }}>{value != null ? status : ''}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, unit, good, mid }: { label: string; value: string | null; unit?: string; good: number; mid: number }) {
  const num = parseMetricValue(value);
  let color = 'var(--text-muted)';
  if (num != null) {
    if (num <= good) color = 'var(--success)';
    else if (num <= mid) color = 'var(--accent-gold)';
    else color = 'var(--danger)';
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color }}>{value ?? '--'}</span>
    </div>
  );
}

export default function HealthTab({ reports, latestReport }: HealthTabProps) {
  if (!latestReport) {
    return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>No data yet.</div>;
  }

  const sorted = reports.sort((a, b) => a.run_date.localeCompare(b.run_date));

  const scoreData = sorted.map((r) => ({
    date: new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    mobile: r.psi_mobile_score ?? 0,
    desktop: r.psi_desktop_score ?? 0,
  }));

  const chartStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '20px 24px',
    marginBottom: 20,
  };

  return (
    <div>
      {/* Score indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <ScoreIndicator label="Mobile Score" value={latestReport.psi_mobile_score} thresholds={{ good: 89, mid: 49 }} />
        <ScoreIndicator label="Desktop Score" value={latestReport.psi_desktop_score} thresholds={{ good: 89, mid: 49 }} />
      </div>

      {/* Score over time chart */}
      <div style={chartStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>PageSpeed Score Over Time</div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="mobile" stroke="#00CED1" strokeWidth={2} dot={false} name="Mobile" />
              <Line type="monotone" dataKey="desktop" stroke="#FFD700" strokeWidth={2} dot={false} name="Desktop" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={chartStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Mobile Metrics</div>
          <MetricRow label="LCP (Largest Contentful Paint)" value={latestReport.psi_lcp_mobile} good={2.5} mid={4} />
          <MetricRow label="CLS (Cumulative Layout Shift)" value={latestReport.psi_cls_mobile} good={0.1} mid={0.25} />
          <MetricRow label="TBT (Total Blocking Time)" value={latestReport.psi_tbt_mobile} good={200} mid={600} />
        </div>
        <div style={chartStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Desktop Metrics</div>
          <MetricRow label="LCP (Largest Contentful Paint)" value={latestReport.psi_lcp_desktop} good={2.5} mid={4} />
          <MetricRow label="CLS (Cumulative Layout Shift)" value={latestReport.psi_cls_desktop} good={0.1} mid={0.25} />
          <MetricRow label="TBT (Total Blocking Time)" value={latestReport.psi_tbt_desktop} good={200} mid={600} />
        </div>
      </div>

      {/* Run history table */}
      <div style={{ ...chartStyle, marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Run History</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Date</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Mobile</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>Desktop</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>LCP (M)</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 500 }}>CLS (M)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice().reverse().map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px' }}>{r.run_date}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: (r.psi_mobile_score ?? 0) >= 50 ? 'var(--success)' : 'var(--danger)' }}>{r.psi_mobile_score ?? '--'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: (r.psi_desktop_score ?? 0) >= 50 ? 'var(--success)' : 'var(--danger)' }}>{r.psi_desktop_score ?? '--'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.psi_lcp_mobile ?? '--'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.psi_cls_mobile ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
