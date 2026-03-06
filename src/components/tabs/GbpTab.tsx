'use client';

import { Report, GbpKeyword } from '@/lib/types';
import { rollingSum14 } from '@/lib/utils';
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
  const hasData = reports.some((r) => (r.gbp_total_impressions ?? 0) > 0);

  // Use the most recent report that has actual GBP data (not zeros from a timeout)
  const gbpReport = [...reports]
    .sort((a, b) => b.run_date.localeCompare(a.run_date))
    .find((r) => (r.gbp_total_impressions ?? 0) > 0) ?? latestReport;

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

  const sorted = [...reports].sort((a, b) => a.run_date.localeCompare(b.run_date));
  const gbpTotalRaw = sorted.map((r) => r.gbp_total_impressions);
  const gbpMapsRaw = sorted.map((r) => r.gbp_maps_impressions);
  const gbpSearchRaw = sorted.map((r) => r.gbp_search_impressions);
  const gbpCallsRaw = sorted.map((r) => r.gbp_call_clicks);
  const gbpWebRaw = sorted.map((r) => r.gbp_website_clicks);

  const chartData = sorted.map((r, i) => ({
    date: new Date(r.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: rollingSum14(gbpTotalRaw, i),
    maps: rollingSum14(gbpMapsRaw, i),
    search: rollingSum14(gbpSearchRaw, i),
    calls: rollingSum14(gbpCallsRaw, i),
    website: rollingSum14(gbpWebRaw, i),
  }));

  const impressionsSpark = gbpTotalRaw.map((_, i) => rollingSum14(gbpTotalRaw, i));
  const mapsSpark = gbpMapsRaw.map((_, i) => rollingSum14(gbpMapsRaw, i));
  const searchSpark = gbpSearchRaw.map((_, i) => rollingSum14(gbpSearchRaw, i));
  const callsSpark = gbpCallsRaw.map((_, i) => rollingSum14(gbpCallsRaw, i));
  const websiteSpark = gbpWebRaw.map((_, i) => rollingSum14(gbpWebRaw, i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards -- values are 14-day rolling totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard
          label="GBP Impressions"
          value={impressionsSpark[impressionsSpark.length - 1] ?? null}
          previous={impressionsSpark[impressionsSpark.length - 2] ?? null}
          sparklineData={impressionsSpark}
        />
        <StatCard
          label="Maps Impressions"
          value={mapsSpark[mapsSpark.length - 1] ?? null}
          previous={mapsSpark[mapsSpark.length - 2] ?? null}
          sparklineData={mapsSpark}
        />
        <StatCard
          label="Search Impressions"
          value={searchSpark[searchSpark.length - 1] ?? null}
          previous={searchSpark[searchSpark.length - 2] ?? null}
          sparklineData={searchSpark}
        />
        <StatCard
          label="Call Clicks"
          value={callsSpark[callsSpark.length - 1] ?? null}
          previous={callsSpark[callsSpark.length - 2] ?? null}
          sparklineData={callsSpark}
        />
        <StatCard
          label="Website Clicks"
          value={websiteSpark[websiteSpark.length - 1] ?? null}
          previous={websiteSpark[websiteSpark.length - 2] ?? null}
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
              <Line
                type="monotone"
                dataKey="search"
                name="Search"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
              <Line
                type="monotone"
                dataKey="maps"
                name="Maps"
                stroke="var(--text-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--text-primary)', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
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
              <Line
                type="monotone"
                dataKey="calls"
                name="Call Clicks"
                stroke="var(--success)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--success)', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
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
              <Line
                type="monotone"
                dataKey="website"
                name="Website Clicks"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
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
