'use client';

import { useState, useEffect } from 'react';
import { Report, GscQuery } from '@/lib/types';
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
}

export default function SeoTab({ reports, queries, latestReport, prevQueries, clientId }: SeoTabProps) {
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<{ date: string; position: number }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!selectedQuery || !clientId) {
      setQueryHistory([]);
      return;
    }
    setHistoryLoading(true);
    supabase
      .from('gsc_queries')
      .select('run_date, position')
      .eq('client_id', clientId)
      .eq('query', selectedQuery)
      .order('run_date', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) {
          setQueryHistory([]);
        } else {
          setQueryHistory(
            data.map((d) => ({
              date: new Date(d.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              position: d.position,
            }))
          );
        }
        setHistoryLoading(false);
      });
  }, [selectedQuery, clientId]);
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

  const sortedQueries = [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 10);

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
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="impressions"
                stroke="#E8FF00"
                strokeWidth={2}
                dot={false}
                name="Impressions"
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="clicks"
                stroke="var(--text-primary)"
                strokeWidth={2}
                dot={false}
                name="Clicks"
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: 'var(--text-primary)', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
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

      {/* Top keywords table */}
      <div style={chartStyle}>
        <div style={sectionLabel}>Top Keywords</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Query</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Impressions</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Clicks</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Position</th>
              {prevQueries && prevQueries.length > 0 && (
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>Movement</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedQueries.map((q) => {
              const prev = prevQueryMap.get(q.query);
              const posMovement = prev ? prev.position - q.position : null;

              return (
                <tr
                  key={q.id}
                  onClick={() => setSelectedQuery(selectedQuery === q.query ? null : q.query)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selectedQuery === q.query ? 'rgba(232, 255, 0, 0.06)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 12px' }}>{q.query}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.impressions.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{q.clicks.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      color: q.position <= 10 ? 'var(--success)' : q.position <= 20 ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: q.position <= 10 ? 600 : 400,
                    }}>
                      {q.position.toFixed(1)}
                    </span>
                  </td>
                  {prevQueries && prevQueries.length > 0 && (
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {posMovement != null ? (
                        <span style={{
                          color: posMovement > 0 ? 'var(--success)' : posMovement < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                        }}>
                          {posMovement > 0 ? `+${posMovement.toFixed(1)}` : posMovement.toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>new</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Keyword position history */}
      {selectedQuery && (
        <div style={chartStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={sectionLabel}>Position History</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -12 }}>
                {selectedQuery}
              </div>
            </div>
            <button
              onClick={() => setSelectedQuery(null)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                fontSize: 11,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          {historyLoading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0' }}>Loading...</div>
          ) : queryHistory.length < 2 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0' }}>
              Not enough history yet. Position tracking starts appearing after multiple daily reports.
            </div>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={queryHistory} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    reversed
                    tick={{ fontSize: 11 }}
                    domain={['dataMin - 2', 'dataMax + 2']}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="position"
                    stroke="#E8FF00"
                    strokeWidth={2}
                    dot={false}
                    name="Position"
                    isAnimationActive={false}
                    activeDot={{ r: 4, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
