'use client';

import { Report, GbpKeyword } from '@/lib/types';
import StatCard from '@/components/StatCard';
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

interface GbpTabProps {
  reports: Report[];
  latestReport: Report | null;
  gbpKeywords?: GbpKeyword[];
}

export default function GbpTab({ reports, latestReport, gbpKeywords = [] }: GbpTabProps) {
  const hasData = latestReport && (latestReport.gbp_total_impressions ?? 0) > 0;

  if (!hasData) {
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '40px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Google Business Profile</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          No GBP data available for this client yet.
        </div>
      </div>
    );
  }

  const chartData = [...reports]
    .sort((a, b) => a.run_date.localeCompare(b.run_date))
    .map((r) => ({
      date: new Date(r.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      impressions: r.gbp_total_impressions ?? 0,
      maps: r.gbp_maps_impressions ?? 0,
      search: r.gbp_search_impressions ?? 0,
      calls: r.gbp_call_clicks ?? 0,
      website: r.gbp_website_clicks ?? 0,
    }));

  const sorted = [...reports].sort((a, b) => a.run_date.localeCompare(b.run_date));
  const impressionsSpark = sorted.map((r) => r.gbp_total_impressions ?? 0);
  const callsSpark = sorted.map((r) => r.gbp_call_clicks ?? 0);
  const websiteSpark = sorted.map((r) => r.gbp_website_clicks ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard
          label="GBP Impressions"
          value={latestReport.gbp_total_impressions}
          previous={latestReport.gbp_total_impressions_prev}
          sparklineData={impressionsSpark}
        />
        <StatCard
          label="Maps Impressions"
          value={latestReport.gbp_maps_impressions}
          previous={latestReport.gbp_maps_impressions_prev}
        />
        <StatCard
          label="Search Impressions"
          value={latestReport.gbp_search_impressions}
          previous={latestReport.gbp_search_impressions_prev}
        />
        <StatCard
          label="Call Clicks"
          value={latestReport.gbp_call_clicks}
          previous={latestReport.gbp_call_clicks_prev}
          sparklineData={callsSpark}
        />
        <StatCard
          label="Website Clicks"
          value={latestReport.gbp_website_clicks}
          previous={latestReport.gbp_website_clicks_prev}
          sparklineData={websiteSpark}
        />
      </div>

      {/* Impressions chart */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>GBP Impressions Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="search" name="Search" stroke="var(--accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="maps" name="Maps" stroke="var(--text-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Call Clicks chart */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Call Clicks Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="calls" name="Call Clicks" stroke="var(--success)" strokeWidth={2} dot={{ r: 3, fill: 'var(--success)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Website Clicks chart */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Website Clicks Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="website" name="Website Clicks" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Search Keywords table */}
      {gbpKeywords.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>GBP Search Keywords</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            What people searched to find this listing
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keyword</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impressions</th>
              </tr>
            </thead>
            <tbody>
              {gbpKeywords.map((kw, i) => (
                <tr key={kw.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{kw.keyword}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{kw.impressions.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
