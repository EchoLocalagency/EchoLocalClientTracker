'use client';

import { SeoAction } from '@/lib/types';
import { seo } from '@/lib/seo-theme';
import ClusterProgress from './ClusterProgress';
import KeywordOpportunities from './KeywordOpportunities';

interface KeywordDashboardProps {
  actions: SeoAction[];
}

interface KeywordRow {
  keyword: string;
  actionCount: number;
  totalImpact: number;
  impacts: number[];
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
  const color = last >= prev ? seo.accent : seo.danger;

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function KeywordDashboard({ actions }: KeywordDashboardProps) {
  // Build keyword data from actions
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
      totalImpact: data.impacts.reduce((sum, v) => sum + v, 0),
      impacts: data.impacts,
      actionTypes: Array.from(data.types),
    }))
    .sort((a, b) => b.totalImpact - a.totalImpact);

  // Compute cluster data for ClusterProgress
  const typeMap = new Map<string, { total: number; withImpact: number }>();
  for (const action of actions) {
    const existing = typeMap.get(action.action_type) || { total: 0, withImpact: 0 };
    existing.total++;
    if (action.impact_score != null && action.impact_score > 0) existing.withImpact++;
    typeMap.set(action.action_type, existing);
  }
  const clusters = Array.from(typeMap.entries()).map(([type, data]) => ({
    name: type.replace(/_/g, ' '),
    filled: data.withImpact,
    total: data.total,
  }));

  // Keyword opportunities: keywords with only 1 action (underserved)
  const opportunities = rows
    .filter(r => r.actionCount <= 2)
    .slice(0, 10);

  if (actions.length === 0) {
    return (
      <div style={{ color: seo.textMuted, padding: 40, textAlign: 'center' }}>
        No keyword data yet. Keywords will be tracked once SEO actions target specific terms.
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatBox label="Total Keywords" value={rows.length.toString()} />
        <StatBox label="Total Actions" value={actions.length.toString()} />
        <StatBox
          label="Avg Impact"
          value={rows.length > 0 ? (rows.reduce((s, r) => s + r.totalImpact, 0) / rows.length).toFixed(1) : '0'}
          color={rows.reduce((s, r) => s + r.totalImpact, 0) > 0 ? seo.accent : seo.danger}
        />
        <StatBox label="Action Types" value={new Set(actions.map(a => a.action_type)).size.toString()} />
      </div>

      {/* Two-column layout: Rankings + Clusters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Rankings table */}
        <div style={{
          background: seo.surface,
          border: `1px solid ${seo.border}`,
          borderRadius: seo.radiusCard,
          padding: '24px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: seo.text, marginBottom: 16 }}>
            Keyword Rankings
          </div>
          {rows.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${seo.border}` }}>
                  <th style={thStyle}>Keyword</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total Impact</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Trend</th>
                  <th style={thStyle}>Types</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.keyword} style={{ borderBottom: `1px solid ${seo.border}` }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: seo.text }}>
                      {row.keyword}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: seo.fontMono, color: seo.textMuted }}>
                      {row.actionCount}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{
                        fontFamily: seo.fontMono, fontWeight: 600,
                        color: row.totalImpact > 0 ? seo.accent : row.totalImpact < 0 ? seo.danger : seo.textMuted,
                      }}>
                        {row.totalImpact > 0 ? '+' : ''}{row.totalImpact}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {row.impacts.length >= 2 && <TrendSparkline values={row.impacts} />}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {row.actionTypes.map(type => (
                          <span key={type} style={{
                            fontSize: 9, fontFamily: seo.fontMono,
                            padding: '2px 6px', borderRadius: 4,
                            background: seo.deep, color: seo.textMuted,
                            textTransform: 'uppercase',
                          }}>
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: seo.textMuted, fontSize: 12 }}>No keyword data</div>
          )}
        </div>

        {/* Right column: Clusters + Opportunities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ClusterProgress clusters={clusters} />
          <KeywordOpportunities keywords={opportunities} />
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: seo.textMuted,
  fontWeight: 500,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: seo.surface,
      border: `1px solid ${seo.border}`,
      borderRadius: seo.radiusCard,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: seo.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: seo.fontMono, color: color || seo.accent }}>
        {value}
      </div>
    </div>
  );
}
