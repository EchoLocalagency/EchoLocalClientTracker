'use client';

import { SeoAction } from '@/lib/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import ChartTooltip from '@/components/ChartTooltip';

interface OutcomePatternsProps {
  actions: SeoAction[];
}

interface TypeStats {
  type: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  avgImpact: number;
  successRate: number;
}

const PIE_COLORS = ['#E8FF00', '#00E676', '#F0F2F5', '#8A8F98', '#B8CC00', '#FF3D57'];

export default function OutcomePatterns({ actions }: OutcomePatternsProps) {
  if (actions.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        No outcome data yet. Patterns will emerge as the SEO Engine accumulates action results.
      </div>
    );
  }

  // Compute stats per action type
  const typeMap = new Map<string, { impacts: number[] }>();
  for (const action of actions) {
    const existing = typeMap.get(action.action_type) || { impacts: [] };
    if (action.impact_score != null) {
      existing.impacts.push(action.impact_score);
    } else {
      existing.impacts.push(0);
    }
    typeMap.set(action.action_type, existing);
  }

  const stats: TypeStats[] = Array.from(typeMap.entries()).map(([type, data]) => {
    const positive = data.impacts.filter(v => v > 0).length;
    const negative = data.impacts.filter(v => v < 0).length;
    const neutral = data.impacts.filter(v => v === 0).length;
    const total = data.impacts.length;
    const avg = total > 0 ? data.impacts.reduce((s, v) => s + v, 0) / total : 0;
    return {
      type,
      total,
      positive,
      negative,
      neutral,
      avgImpact: Math.round(avg * 10) / 10,
      successRate: total > 0 ? Math.round((positive / total) * 100) : 0,
    };
  }).sort((a, b) => b.avgImpact - a.avgImpact);

  // Bar chart data
  const barData = stats.map(s => ({
    name: s.type.replace(/_/g, ' '),
    impact: s.avgImpact,
  }));

  // Pie chart data
  const pieData = stats.map(s => ({
    name: s.type.replace(/_/g, ' '),
    value: s.total,
  }));

  // What's working / not
  const working = stats.filter(s => s.avgImpact > 0).sort((a, b) => b.avgImpact - a.avgImpact);
  const notWorking = stats.filter(s => s.avgImpact <= 0).sort((a, b) => a.avgImpact - b.avgImpact);

  return (
    <div>
      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Avg impact bar chart */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Avg Impact by Action Type</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="impact" name="Avg Impact" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.impact > 0 ? '#00E676' : entry.impact < 0 ? '#FF3D57' : '#8A8F98'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success rate donut */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Actions by Type</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div style={{
                        background: 'var(--bg-depth)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{d.value} actions</div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {pieData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(0, 230, 118, 0.2)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 12 }}>What's Working</div>
          {working.length > 0 ? working.map(s => (
            <div key={s.type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{s.type.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>+{s.avgImpact} avg ({s.successRate}% success)</span>
            </div>
          )) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No positive-impact actions yet</div>
          )}
        </div>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(255, 61, 87, 0.2)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 12 }}>What's Not</div>
          {notWorking.length > 0 ? notWorking.map(s => (
            <div key={s.type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{s.type.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>{s.avgImpact} avg ({s.successRate}% success)</span>
            </div>
          )) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>All action types are performing well</div>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Action Type Breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Type</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Total</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Positive</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Negative</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Avg Impact</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.type} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.type.replace(/_/g, ' ')}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{s.total}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{s.positive}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>{s.negative}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: s.avgImpact > 0 ? 'var(--success)' : s.avgImpact < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                  }}>
                    {s.avgImpact > 0 ? '+' : ''}{s.avgImpact}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{s.successRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
