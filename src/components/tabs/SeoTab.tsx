'use client';

import { Report, GscQuery } from '@/lib/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from 'recharts';
import ChartTooltip from '@/components/ChartTooltip';

interface SeoTabProps {
  reports: Report[];
  queries: GscQuery[];
  latestReport: Report | null;
  prevQueries?: GscQuery[];
}

export default function SeoTab({ reports, queries, latestReport, prevQueries }: SeoTabProps) {
  if (!latestReport) {
    return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>No data yet.</div>;
  }

  // reports already sorted by useFilteredReports — no mutation
  const impressionsData = reports.map((r) => ({
    date: new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: r.gsc_impressions ?? 0,
    clicks: r.gsc_clicks ?? 0,
  }));

  const organicData = reports.map((r) => ({
    date: new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    organic: r.ga4_organic ?? 0,
    total: r.ga4_sessions ?? 0,
  }));

  const positionData = reports.map((r) => ({
    date: new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    position: r.gsc_avg_position ?? 0,
  }));

  const sortedQueries = [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 10);

  // Build prev query lookup for movement column
  const prevQueryMap = new Map<string, GscQuery>();
  if (prevQueries) {
    for (const q of prevQueries) {
      prevQueryMap.set(q.query, q);
    }
  }

  const chartStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)' as const,
    padding: '20px 24px',
    marginBottom: 20,
  };

  const sectionLabel = {
    fontSize: 13,
    fontWeight: 600 as const,
    color: 'var(--text-primary)',
    marginBottom: 16,
  };

  const brushStart = Math.max(0, impressionsData.length - 8);
  const showBrush = impressionsData.length > 6;

  return (
    <div>
      {/* Impressions + clicks chart */}
      <div style={chartStyle}>
        <div style={sectionLabel}>Search Impressions & Clicks</div>
        <div style={{ height: showBrush ? 260 : 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={impressionsData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="impressions" stroke="#00CED1" strokeWidth={2} dot={false} name="Impressions" isAnimationActive={false} activeDot={{ r: 4, stroke: '#00CED1', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
              <Line type="monotone" dataKey="clicks" stroke="#FFD700" strokeWidth={2} dot={false} name="Clicks" isAnimationActive={false} activeDot={{ r: 4, stroke: '#FFD700', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
              {showBrush && (
                <Brush dataKey="date" height={24} stroke="var(--border)" fill="var(--bg-depth)" startIndex={brushStart} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Organic sessions chart */}
      <div style={chartStyle}>
        <div style={sectionLabel}>Sessions (Organic vs Total)</div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={organicData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="total" stroke="var(--text-muted)" strokeWidth={1.5} dot={false} name="Total" isAnimationActive={false} />
              <Line type="monotone" dataKey="organic" stroke="#00CED1" strokeWidth={2} dot={false} name="Organic" isAnimationActive={false} activeDot={{ r: 4, stroke: '#00CED1', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Avg position trend */}
      <div style={chartStyle}>
        <div style={sectionLabel}>Average Keyword Position</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10, marginBottom: 12 }}>Lower is better</div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={positionData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis reversed tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="position" stroke="#00CED1" strokeWidth={2} dot={false} name="Avg Position" isAnimationActive={false} activeDot={{ r: 4, stroke: '#00CED1', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top keywords table */}
      <div style={chartStyle}>
        <div style={sectionLabel}>Top Keywords</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>Query</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>Impressions</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>Clicks</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>Position</th>
              {prevQueries && prevQueries.length > 0 && (
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}>Movement</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedQueries.map((q) => {
              const prev = prevQueryMap.get(q.query);
              const posMovement = prev ? prev.position - q.position : null;

              return (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>{q.query}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{q.impressions.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{q.clicks.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      color: q.position <= 10 ? 'var(--success)' : q.position <= 20 ? 'var(--accent-teal)' : 'var(--text-muted)',
                      fontWeight: q.position <= 10 ? 600 : 400,
                    }}>
                      {q.position.toFixed(1)}
                    </span>
                  </td>
                  {prevQueries && prevQueries.length > 0 && (
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {posMovement != null ? (
                        <span style={{
                          color: posMovement > 0 ? 'var(--success)' : posMovement < 0 ? 'var(--danger)' : 'var(--text-muted)',
                        }}>
                          {posMovement > 0 ? `+${posMovement.toFixed(1)}` : posMovement.toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>new</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
