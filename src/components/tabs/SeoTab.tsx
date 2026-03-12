'use client';

import { useState } from 'react';
import { Report, GscQuery } from '@/lib/types';
import { rollingSum14 } from '@/lib/utils';
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
  clientId?: string;
  clientName?: string;
  gscHistory?: GscQuery[];
}

// Inline sparkline for position history (inverted: lower position = higher on chart)
function PositionSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const last = data[data.length - 1];
  const first = data[0];
  const color = last <= first ? 'var(--success)' : 'var(--danger)';

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SeoTab({ reports, queries, latestReport, prevQueries, clientId, clientName, gscHistory }: SeoTabProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  const brandWords = (clientName || '').toLowerCase().split(/\s+/);
  const brandPrefix = brandWords.slice(0, 2).join(' ');
  const isBranded = (q: string) => {
    return brandPrefix.length > 0 && q.toLowerCase().includes(brandPrefix);
  };

  // ── Derive top 15 keywords + history from gscHistory prop ──
  const historyData = gscHistory || [];
  const historyLoading = false;

  const byQuery: Record<string, { dates: { date: string; rawDate: string; position: number }[]; latestPosition: number; totalImpressions: number; totalClicks: number }> = {};
  for (const row of historyData) {
    if (isBranded(row.query)) continue;
    if (!byQuery[row.query]) {
      byQuery[row.query] = { dates: [], latestPosition: 100, totalImpressions: 0, totalClicks: 0 };
    }
    const entry = byQuery[row.query];
    entry.dates.push({
      date: new Date(row.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rawDate: row.run_date,
      position: row.position,
    });
    entry.latestPosition = row.position;
    entry.totalImpressions += row.impressions;
    entry.totalClicks += row.clicks;
  }

  const sorted = Object.entries(byQuery)
    .sort(([, a], [, b]) => a.latestPosition - b.latestPosition)
    .slice(0, 15);

  const topKeywords = sorted.map(([query, d]) => ({
    query,
    latestPosition: d.latestPosition,
    impressions: d.totalImpressions,
    clicks: d.totalClicks,
  }));

  const allHistory: Record<string, { date: string; rawDate: string; position: number }[]> = {};
  for (const [query, d] of sorted) {
    allHistory[query] = d.dates;
  }

  // Determine earliest date across all history for the date range indicator
  const earliestDate = historyData.length > 0 ? historyData[0].run_date : null;
  const earliestLabel = earliestDate
    ? new Date(earliestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  if (!latestReport) {
    return <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>No data yet.</div>;
  }

  const gscImpRaw = reports.map((r) => r.gsc_impressions);
  const gscClicksRaw = reports.map((r) => r.gsc_clicks);
  const impressionsData = reports.map((r, i) => ({
    date: new Date(r.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: rollingSum14(gscImpRaw, i),
    clicks: rollingSum14(gscClicksRaw, i),
  }));

  const organicRaw = reports.map((r) => r.ga4_organic);
  const sessionsRaw = reports.map((r) => r.ga4_sessions);
  const organicData = reports.map((r, i) => ({
    date: new Date(r.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    organic: rollingSum14(organicRaw, i),
    total: rollingSum14(sessionsRaw, i),
  }));

  const positionData = reports.map((r) => ({
    date: new Date(r.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    position: r.gsc_avg_position ?? 0,
  }));

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
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#E8FF00" strokeWidth={2} dot={false} name="Impressions" isAnimationActive={false} activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
              <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="var(--text-primary)" strokeWidth={2} dot={false} name="Clicks" isAnimationActive={false} activeDot={{ r: 4, stroke: 'var(--text-primary)', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
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
              <Line type="monotone" dataKey="total" stroke="var(--text-secondary)" strokeWidth={1.5} dot={false} name="Total" isAnimationActive={false} />
              <Line type="monotone" dataKey="organic" stroke="#E8FF00" strokeWidth={2} dot={false} name="Organic" isAnimationActive={false} activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Avg position trend */}
      <div style={chartStyle}>
        <div style={sectionLabel}>Average Keyword Position</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -10, marginBottom: 12 }}>Lower is better</div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={positionData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis reversed tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="position" stroke="#E8FF00" strokeWidth={2} dot={false} name="Avg Position" isAnimationActive={false} activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 15 Keywords by Current Rank (from GSC history) */}
      <div style={chartStyle}>
        <div style={sectionLabel}>
          Top 15 Keywords by Current Rank
          {earliestLabel && (
            <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
              since {earliestLabel}
            </span>
          )}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Query</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Position</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Movement</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Trend</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Impr.</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Clicks</th>
            </tr>
          </thead>
          <tbody>
            {topKeywords.map((q) => {
              const history = allHistory[q.query] || [];
              const sparkData = history.map((h) => h.position);
              const isExpanded = expandedQuery === q.query;
              const posMovement = history.length >= 2 ? history[history.length - 2].position - q.latestPosition : null;

              return (
                <tr key={q.query} style={{ verticalAlign: 'top' }}>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <div
                      onClick={() => setExpandedQuery(isExpanded ? null : q.query)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 70px 80px 90px 60px 60px',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                        background: isExpanded ? 'rgba(232, 255, 0, 0.04)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
                        <span>{q.query}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          color: q.latestPosition <= 10 ? 'var(--success)' : q.latestPosition <= 20 ? 'var(--accent)' : 'var(--text-secondary)',
                          fontWeight: q.latestPosition <= 10 ? 600 : 400,
                        }}>
                          {q.latestPosition.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {posMovement != null ? (
                          <span style={{
                            color: posMovement > 0 ? 'var(--success)' : posMovement < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                          }}>
                            {posMovement > 0 ? `+${posMovement.toFixed(1)}` : posMovement.toFixed(1)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>--</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {historyLoading ? (
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>...</span>
                        ) : (
                          <PositionSparkline data={sparkData} />
                        )}
                      </div>
                      <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.impressions.toLocaleString()}</div>
                      <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.clicks.toLocaleString()}</div>
                    </div>

                    {isExpanded && (() => {
                      // Determine if data spans more than 30 days for weekly tick logic
                      const spanDays = history.length >= 2
                        ? Math.round((new Date(history[history.length - 1].rawDate + 'T00:00:00').getTime() - new Date(history[0].rawDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const useWeeklyTicks = spanDays > 30;
                      // Build weekly tick indices: pick one data point per ~7 days
                      let tickIndices: number[] | undefined;
                      if (useWeeklyTicks && history.length > 7) {
                        tickIndices = [];
                        let lastTickDate = -Infinity;
                        for (let i = 0; i < history.length; i++) {
                          const d = new Date(history[i].rawDate + 'T00:00:00').getTime();
                          if (d - lastTickDate >= 6 * 24 * 60 * 60 * 1000) {
                            tickIndices.push(i);
                            lastTickDate = d;
                          }
                        }
                      }
                      const tickFormatter = useWeeklyTicks
                        ? (_val: string, idx: number) => {
                            if (tickIndices && !tickIndices.includes(idx)) return '';
                            return _val;
                          }
                        : undefined;

                      return (
                        <div style={{
                          padding: '12px 12px 16px 30px',
                          borderBottom: '1px solid var(--border)',
                          background: 'rgba(232, 255, 0, 0.04)',
                        }}>
                          {history.length < 2 ? (
                            <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: '8px 0' }}>
                              Not enough history yet.
                            </div>
                          ) : (
                            <div style={{ height: 160 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                  <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                                    tickFormatter={tickFormatter}
                                    interval={0}
                                  />
                                  <YAxis reversed tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} domain={['dataMin - 2', 'dataMax + 2']} width={30} />
                                  <Tooltip content={<ChartTooltip />} />
                                  <Line
                                    type="monotone"
                                    dataKey="position"
                                    stroke="#E8FF00"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                    name="Position"
                                    isAnimationActive={false}
                                    activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
