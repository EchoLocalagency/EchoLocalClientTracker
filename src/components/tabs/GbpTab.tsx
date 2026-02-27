'use client';

import { Report } from '@/lib/types';
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
}

export default function GbpTab({ reports, latestReport }: GbpTabProps) {
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
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          No GBP data available for this client yet.
        </div>
      </div>
    );
  }

  // Chart data
  const chartData = [...reports]
    .sort((a, b) => a.run_date.localeCompare(b.run_date))
    .map((r) => ({
      date: new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      impressions: r.gbp_total_impressions ?? 0,
      maps: r.gbp_maps_impressions ?? 0,
      search: r.gbp_search_impressions ?? 0,
      calls: r.gbp_call_clicks ?? 0,
      website: r.gbp_website_clicks ?? 0,
      directions: r.gbp_direction_requests ?? 0,
    }));

  // Sparkline data arrays
  const sorted = [...reports].sort((a, b) => a.run_date.localeCompare(b.run_date));
  const impressionsSpark = sorted.map((r) => r.gbp_total_impressions ?? 0);
  const callsSpark = sorted.map((r) => r.gbp_call_clicks ?? 0);
  const websiteSpark = sorted.map((r) => r.gbp_website_clicks ?? 0);
  const directionsSpark = sorted.map((r) => r.gbp_direction_requests ?? 0);

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
        <StatCard
          label="Direction Requests"
          value={latestReport.gbp_direction_requests}
          previous={latestReport.gbp_direction_requests_prev}
          sparklineData={directionsSpark}
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
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="search" name="Search" stroke="var(--accent-teal)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="maps" name="Maps" stroke="var(--accent-gold)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Actions chart */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>GBP Actions Over Time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="website" name="Website Clicks" stroke="var(--accent-teal)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="calls" name="Call Clicks" stroke="var(--success)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="directions" name="Directions" stroke="var(--accent-gold)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
