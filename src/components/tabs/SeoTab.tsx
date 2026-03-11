'use client';

import { useState, useEffect, useMemo } from 'react';
import { Report, GscQuery, TrackedKeyword, KeywordSnapshot } from '@/lib/types';
import { supabase } from '@/lib/supabase';
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
  trackedKeywords?: TrackedKeyword[];
  keywordSnapshots?: KeywordSnapshot[];
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

function SourceBadge({ source }: { source: string }) {
  const isSerp = source === 'serpapi';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      background: isSerp ? 'rgba(0, 206, 209, 0.15)' : 'rgba(232, 255, 0, 0.12)',
      color: isSerp ? 'var(--accent)' : '#E8FF00',
      letterSpacing: 0.5,
    }}>
      {isSerp ? 'SERP' : 'GSC'}
    </span>
  );
}

interface ProcessedKeyword {
  keyword: string;
  latestPosition: number | null;
  latestSource: string;
  hasData: boolean;
  change: number | null;
  impressions: number;
  clicks: number;
  sparkData: number[];
  inMapPack: boolean;
  mapPackPosition: number | null;
  hasFeaturedSnippet: boolean;
  hasAiOverview: boolean;
  clientCitedInAio: boolean;
  serpUrl: string | null;
  history: Array<{ date: string; position: number; source: string }>;
}

export default function SeoTab({ reports, queries, latestReport, prevQueries, clientId, clientName, trackedKeywords, keywordSnapshots }: SeoTabProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [trackingKeyword, setTrackingKeyword] = useState<string | null>(null);

  // ── GSC-based Top 15 Keywords (original table) ──
  const [topKeywords, setTopKeywords] = useState<{ query: string; latestPosition: number; impressions: number; clicks: number }[]>([]);
  const [allHistory, setAllHistory] = useState<Record<string, { date: string; position: number }[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  const brandWords = (clientName || '').toLowerCase().split(/\s+/);
  const brandPrefix = brandWords.slice(0, 2).join(' ');
  const isBranded = (q: string) => {
    return brandPrefix.length > 0 && q.toLowerCase().includes(brandPrefix);
  };

  // Fetch top 15 keywords by current rank across ALL gsc_queries history
  useEffect(() => {
    if (!clientId) {
      setTopKeywords([]);
      setAllHistory({});
      return;
    }

    setHistoryLoading(true);

    supabase
      .from('gsc_queries')
      .select('query, run_date, position, impressions, clicks')
      .eq('client_id', clientId)
      .order('run_date', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) {
          setTopKeywords([]);
          setAllHistory({});
          setHistoryLoading(false);
          return;
        }

        const byQuery: Record<string, { dates: { date: string; position: number }[]; latestPosition: number; totalImpressions: number; totalClicks: number }> = {};
        for (const row of data) {
          if (isBranded(row.query)) continue;
          if (!byQuery[row.query]) {
            byQuery[row.query] = { dates: [], latestPosition: 100, totalImpressions: 0, totalClicks: 0 };
          }
          const entry = byQuery[row.query];
          entry.dates.push({
            date: new Date(row.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            position: row.position,
          });
          entry.latestPosition = row.position;
          entry.totalImpressions += row.impressions;
          entry.totalClicks += row.clicks;
        }

        const sorted = Object.entries(byQuery)
          .sort(([, a], [, b]) => a.latestPosition - b.latestPosition)
          .slice(0, 15);

        setTopKeywords(sorted.map(([query, d]) => ({
          query,
          latestPosition: d.latestPosition,
          impressions: d.totalImpressions,
          clicks: d.totalClicks,
        })));

        const history: Record<string, { date: string; position: number }[]> = {};
        for (const [query, d] of sorted) {
          history[query] = d.dates;
        }
        setAllHistory(history);
        setHistoryLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // ── Tracked keywords with snapshot data (only show ones that have been checked) ──
  const processedKeywords = useMemo<ProcessedKeyword[]>(() => {
    if (!trackedKeywords?.length || !keywordSnapshots) return [];

    const trackedSet = new Set(trackedKeywords.map(tk => tk.keyword.toLowerCase()));

    const byKeyword: Record<string, KeywordSnapshot[]> = {};
    for (const snap of keywordSnapshots) {
      const key = snap.keyword.toLowerCase();
      if (!trackedSet.has(key)) continue;
      if (!byKeyword[key]) byKeyword[key] = [];
      byKeyword[key].push(snap);
    }

    return trackedKeywords
      .filter(tk => {
        // Only show tracked keywords that have actual snapshot data
        const snaps = byKeyword[tk.keyword.toLowerCase()] || [];
        return snaps.length > 0;
      })
      .map(tk => {
        const snaps = byKeyword[tk.keyword.toLowerCase()] || [];

        const byDate: Record<string, KeywordSnapshot> = {};
        for (const s of snaps) {
          const existing = byDate[s.checked_at];
          if (!existing || (s.source === 'serpapi' && existing.source !== 'serpapi')) {
            byDate[s.checked_at] = s;
          }
        }

        const sorted = Object.values(byDate).sort((a, b) => a.checked_at.localeCompare(b.checked_at));
        const latest = sorted[sorted.length - 1] || null;
        const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

        const sparkData = sorted
          .filter(s => s.position != null)
          .map(s => s.position as number);

        let change: number | null = null;
        if (latest?.position != null && prev?.position != null) {
          change = prev.position - latest.position;
        }

        const totalImpressions = snaps.reduce((sum, s) => sum + (s.impressions || 0), 0);
        const totalClicks = snaps.reduce((sum, s) => sum + (s.clicks || 0), 0);

        return {
          keyword: tk.keyword,
          latestPosition: latest?.position ?? null,
          latestSource: latest?.source ?? 'gsc',
          hasData: true,
          change,
          impressions: totalImpressions,
          clicks: totalClicks,
          sparkData,
          inMapPack: latest?.in_map_pack ?? false,
          mapPackPosition: latest?.map_pack_position ?? null,
          hasFeaturedSnippet: latest?.has_featured_snippet ?? false,
          hasAiOverview: latest?.has_ai_overview ?? false,
          clientCitedInAio: latest?.client_cited_in_aio ?? false,
          serpUrl: latest?.serp_url ?? null,
          history: sorted.map(s => ({
            date: new Date(s.checked_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            position: s.position ?? 0,
            source: s.source,
          })),
        };
      })
      .sort((a, b) => {
        if (a.latestPosition == null && b.latestPosition == null) return 0;
        if (a.latestPosition == null) return 1;
        if (b.latestPosition == null) return -1;
        return a.latestPosition - b.latestPosition;
      });
  }, [trackedKeywords, keywordSnapshots]);

  // Keyword discovery: untracked GSC queries with 5+ impressions and position < 30
  const discoveredKeywords = useMemo(() => {
    if (!queries?.length || !trackedKeywords) return [];
    const trackedSet = new Set(trackedKeywords.map(tk => tk.keyword.toLowerCase()));

    return queries
      .filter(q =>
        !trackedSet.has(q.query.toLowerCase()) &&
        q.impressions >= 5 &&
        q.position < 30 &&
        !(brandPrefix.length > 0 && q.query.toLowerCase().includes(brandPrefix))
      )
      .sort((a, b) => a.position - b.position)
      .slice(0, 15);
  }, [queries, trackedKeywords, brandPrefix]);

  // Summary stats for tracked keywords (only ones with data)
  const summaryStats = useMemo(() => {
    const tracked = processedKeywords.length;
    const page1 = processedKeywords.filter(k => k.latestPosition != null && k.latestPosition <= 10).length;
    const ranked = processedKeywords.filter(k => k.latestPosition != null);
    const avgPos = ranked.length > 0 ? ranked.reduce((s, k) => s + (k.latestPosition ?? 0), 0) / ranked.length : null;
    const improving = processedKeywords.filter(k => k.change != null && k.change > 0).length;
    return { tracked, page1, avgPos, improving };
  }, [processedKeywords]);

  async function handleTrackKeyword(query: string) {
    if (!clientId) return;
    setTrackingKeyword(query);
    try {
      await supabase.from('tracked_keywords').upsert(
        { client_id: clientId, keyword: query, source: 'discovered', is_active: true },
        { onConflict: 'client_id,keyword' },
      );
    } catch (e) {
      console.error('Track keyword failed:', e);
    }
    setTrackingKeyword(null);
    window.location.reload();
  }

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
        <div style={sectionLabel}>Top 15 Keywords by Current Rank</div>
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

                    {isExpanded && (
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
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                                <YAxis reversed tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} domain={['dataMin - 2', 'dataMax + 2']} width={30} />
                                <Tooltip content={<ChartTooltip />} />
                                <Line type="monotone" dataKey="position" stroke="#E8FF00" strokeWidth={2} dot={false} name="Position" isAnimationActive={false} activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tracked Keywords with snapshot data (from keyword_snapshots -- GSC + SerpAPI) */}
      {processedKeywords.length > 0 && (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Keywords Tracked', value: summaryStats.tracked },
              { label: 'Page 1 Rankings', value: summaryStats.page1 },
              { label: 'Avg Position', value: summaryStats.avgPos != null ? summaryStats.avgPos.toFixed(1) : '--' },
              { label: 'Improving', value: summaryStats.improving },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: '16px 20px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Tracked keywords table */}
          <div style={chartStyle}>
            <div style={sectionLabel}>Tracked Keywords</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -10, marginBottom: 12 }}>
              Persistent keyword tracking from GSC (daily) + SerpAPI (Wed/Sat)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Keyword</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Position</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Change</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>30d Trend</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Impr.</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Clicks</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {processedKeywords.map((kw) => {
                  const isExpanded = expandedQuery === kw.keyword;

                  return (
                    <tr key={kw.keyword} style={{ verticalAlign: 'top' }}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <div
                          onClick={() => setExpandedQuery(isExpanded ? null : kw.keyword)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 70px 80px 90px 60px 60px 60px',
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
                            <span>{kw.keyword}</span>
                            {kw.inMapPack && (
                              <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,206,209,0.12)', color: 'var(--accent)' }}>
                                Map #{kw.mapPackPosition}
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              color: kw.latestPosition == null ? 'var(--text-secondary)' : kw.latestPosition <= 3 ? 'var(--success)' : kw.latestPosition <= 10 ? 'var(--success)' : kw.latestPosition <= 20 ? 'var(--accent)' : 'var(--text-secondary)',
                              fontWeight: kw.latestPosition != null && kw.latestPosition <= 3 ? 700 : kw.latestPosition != null && kw.latestPosition <= 10 ? 500 : 400,
                            }}>
                              {kw.latestPosition != null ? (kw.latestPosition % 1 === 0 ? kw.latestPosition : kw.latestPosition.toFixed(1)) : 'NR'}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                            {kw.change != null ? (
                              <span style={{ color: kw.change > 0 ? 'var(--success)' : kw.change < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                {kw.change > 0 ? `+${kw.change.toFixed(1)}` : kw.change.toFixed(1)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>--</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <PositionSparkline data={kw.sparkData} />
                          </div>
                          <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{kw.impressions.toLocaleString()}</div>
                          <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{kw.clicks.toLocaleString()}</div>
                          <div style={{ textAlign: 'center' }}>
                            <SourceBadge source={kw.latestSource} />
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{
                            padding: '12px 12px 16px 30px',
                            borderBottom: '1px solid var(--border)',
                            background: 'rgba(232, 255, 0, 0.04)',
                          }}>
                            {kw.history.length < 2 ? (
                              <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: '8px 0' }}>
                                Not enough history yet.
                              </div>
                            ) : (
                              <div style={{ height: 160 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={kw.history} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                                    <YAxis reversed tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} domain={['dataMin - 2', 'dataMax + 2']} width={30} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Line type="monotone" dataKey="position" stroke="#E8FF00" strokeWidth={2} dot={false} name="Position" isAnimationActive={false} activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                              {kw.serpUrl && (
                                <div>Ranking URL: <span style={{ color: 'var(--text-primary)' }}>{kw.serpUrl}</span></div>
                              )}
                              {kw.hasAiOverview && (
                                <div style={{ color: kw.clientCitedInAio ? 'var(--success)' : 'var(--text-secondary)' }}>
                                  AI Overview {kw.clientCitedInAio ? '(cited)' : '(not cited)'}
                                </div>
                              )}
                              {kw.hasFeaturedSnippet && (
                                <div>Featured Snippet present</div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Discovered Keywords (untracked GSC queries) */}
      {discoveredKeywords.length > 0 && (
        <div style={chartStyle}>
          <div style={sectionLabel}>Discovered Keywords</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -10, marginBottom: 12 }}>
            Untracked keywords from GSC with 5+ impressions and position under 30
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Query</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Position</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Impr.</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Clicks</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {discoveredKeywords.map(q => (
                <tr key={q.query} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>{q.query}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      color: q.position <= 10 ? 'var(--success)' : q.position <= 20 ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: q.position <= 10 ? 600 : 400,
                    }}>
                      {q.position.toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.impressions}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.clicks}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleTrackKeyword(q.query)}
                      disabled={trackingKeyword === q.query}
                      style={{
                        padding: '4px 12px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'transparent',
                        border: '1px solid var(--accent)',
                        borderRadius: 4,
                        color: 'var(--accent)',
                        cursor: trackingKeyword === q.query ? 'wait' : 'pointer',
                        opacity: trackingKeyword === q.query ? 0.5 : 1,
                      }}
                    >
                      {trackingKeyword === q.query ? '...' : 'Track'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
