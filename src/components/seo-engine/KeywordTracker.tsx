'use client';

import { SeoAction } from '@/lib/types';

interface KeywordTrackerProps {
  actions: SeoAction[];
}

interface KeywordRow {
  keyword: string;
  actionCount: number;
  latestImpact: number | null;
  totalImpact: number;
  actionTypes: string[];
}

function TrendSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 20;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const color = last >= prev ? 'var(--success)' : 'var(--danger)';

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function KeywordTracker({ actions }: KeywordTrackerProps) {
  // Build keyword rows from action data
  const keywordMap = new Map<string, { impacts: number[]; types: Set<string> }>();

  for (const action of actions) {
    if (!action.target_keywords) continue;
    for (const kw of action.target_keywords) {
      const existing = keywordMap.get(kw) || { impacts: [], types: new Set() };
      if (action.impact_score != null) {
        existing.impacts.push(action.impact_score);
      }
      existing.types.add(action.action_type);
      keywordMap.set(kw, existing);
    }
  }

  const rows: KeywordRow[] = Array.from(keywordMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      actionCount: data.impacts.length || 1,
      latestImpact: data.impacts.length > 0 ? data.impacts[data.impacts.length - 1] : null,
      totalImpact: data.impacts.reduce((sum, v) => sum + v, 0),
      actionTypes: Array.from(data.types),
    }))
    .sort((a, b) => b.totalImpact - a.totalImpact);

  if (rows.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        No keyword data yet. Keywords will be tracked once SEO actions target specific terms.
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '24px',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keyword</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Impact</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trend</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action Types</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const impactData = keywordMap.get(row.keyword)?.impacts || [];

            return (
              <tr key={row.keyword} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                  {row.keyword}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {row.actionCount}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: row.totalImpact > 0 ? 'var(--success)' : row.totalImpact < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                  }}>
                    {row.totalImpact > 0 ? '+' : ''}{row.totalImpact}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {impactData.length >= 2 && <TrendSparkline values={impactData} />}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {row.actionTypes.map(type => (
                      <span key={type} style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--bg-depth)',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                      }}>
                        {type.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
