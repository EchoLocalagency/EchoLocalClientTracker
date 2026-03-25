'use client';

import { useState } from 'react';
import { SeoAction, TrackedKeyword, KeywordSnapshot, GscQuery } from '@/lib/types';
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

interface KeywordTrackerProps {
  actions: SeoAction[];
  trackedKeywords: TrackedKeyword[];
  keywordSnapshots: KeywordSnapshot[];
  gscHistory: GscQuery[];
  clientName?: string;
}

// Same sparkline as SeoTab -- inverted: lower position = higher on chart
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
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function KeywordTracker({ trackedKeywords, gscHistory, clientName }: KeywordTrackerProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  // Brand filter (same logic as SeoTab)
  const brandWords = (clientName || '').toLowerCase().split(/\s+/);
  const brandPrefix = brandWords.slice(0, 2).join(' ');
  const isBranded = (q: string) => brandPrefix.length > 0 && q.toLowerCase().includes(brandPrefix);

  // Build a set of tracked keyword strings for filtering
  const trackedSet = new Set(trackedKeywords.filter(tk => tk.is_active).map(tk => tk.keyword));

  // Build history from gscHistory, filtered to tracked keywords only
  const historyData = gscHistory || [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const byQuery: Record<string, { dates: { date: string; rawDate: string; position: number }[]; bestPosition7d: number; totalImpressions: number; totalClicks: number }> = {};
  for (const row of historyData) {
    // Only include tracked keywords
    if (!trackedSet.has(row.query)) continue;
    if (!byQuery[row.query]) {
      byQuery[row.query] = { dates: [], bestPosition7d: 100, totalImpressions: 0, totalClicks: 0 };
    }
    const entry = byQuery[row.query];
    entry.dates.push({
      date: new Date(row.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rawDate: row.run_date,
      position: row.position,
    });
    if (row.run_date >= cutoff) {
      entry.bestPosition7d = Math.min(entry.bestPosition7d, row.position);
    }
    entry.totalImpressions += row.impressions;
    entry.totalClicks += row.clicks;
  }

  // Include tracked keywords that appeared in the last 7 days, sorted by best rank
  const sorted = Object.entries(byQuery)
    .filter(([, d]) => d.bestPosition7d < 100)
    .sort(([, a], [, b]) => a.bestPosition7d - b.bestPosition7d || b.totalImpressions - a.totalImpressions);

  const topKeywords = sorted.map(([query, d]) => ({
    query,
    bestPosition7d: d.bestPosition7d,
    impressions: d.totalImpressions,
    clicks: d.totalClicks,
  }));

  const allHistory: Record<string, { date: string; rawDate: string; position: number }[]> = {};
  for (const [query, d] of sorted) {
    allHistory[query] = d.dates;
  }

  // Tracked keywords with no GSC data yet
  const noDataKeywords = [...trackedSet].filter(kw => !byQuery[kw] || byQuery[kw].bestPosition7d >= 100);

  const earliestDate = historyData.length > 0 ? historyData[0].run_date : null;
  const earliestLabel = earliestDate
    ? new Date(earliestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  // Stats
  const top3 = topKeywords.filter(q => q.bestPosition7d <= 3).length;
  const top10 = topKeywords.filter(q => q.bestPosition7d <= 10).length;
  const branded = topKeywords.filter(q => isBranded(q.query)).length;

  if (trackedSet.size === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        No tracked keywords configured. Run seed_tracked_keywords.py to populate.
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatBox label="Tracked" value={trackedSet.size.toString()} />
        <StatBox label="Ranking (7d)" value={topKeywords.length.toString()} color="var(--accent)" />
        <StatBox label="Top 3" value={top3.toString()} color="var(--success)" />
        <StatBox label="Top 10" value={top10.toString()} color="var(--success)" />
      </div>

      {/* Keyword rankings table -- same layout as SeoTab */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Tracked Keyword Rankings
            {earliestLabel && (
              <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                since {earliestLabel}
              </span>
            )}
          </span>
          {noDataKeywords.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
              {noDataKeywords.length} not yet ranking
            </span>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Keyword</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Best (7d)</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Latest</th>
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
              const latestPos = history.length > 0 ? history[history.length - 1].position : null;

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
                        {isBranded(q.query) && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: 3, background: 'rgba(232, 255, 0, 0.1)', color: 'var(--accent)' }}>BRAND</span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          color: q.bestPosition7d <= 10 ? 'var(--success)' : q.bestPosition7d <= 20 ? 'var(--accent)' : 'var(--text-secondary)',
                          fontWeight: q.bestPosition7d <= 10 ? 600 : 400,
                        }}>
                          {q.bestPosition7d.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {latestPos != null ? (
                          <span style={{
                            color: latestPos <= 10 ? 'var(--success)' : latestPos <= 20 ? 'var(--accent)' : 'var(--text-secondary)',
                          }}>
                            {latestPos.toFixed(1)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>--</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <PositionSparkline data={sparkData} />
                      </div>
                      <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.impressions.toLocaleString()}</div>
                      <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.clicks.toLocaleString()}</div>
                    </div>

                    {isExpanded && (() => {
                      const spanDays = history.length >= 2
                        ? Math.round((new Date(history[history.length - 1].rawDate + 'T00:00:00').getTime() - new Date(history[0].rawDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const useWeeklyTicks = spanDays > 30;
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

            {/* Show tracked keywords not yet ranking */}
            {noDataKeywords.map(kw => (
              <tr key={kw} style={{ borderBottom: '1px solid var(--border)' }}>
                <td colSpan={6} style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 90px 60px 60px', alignItems: 'center' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>{kw}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 11 }}>--</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 11 }}>--</div>
                    <div />
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>0</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>0</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--accent)' }}>
        {value}
      </div>
    </div>
  );
}
