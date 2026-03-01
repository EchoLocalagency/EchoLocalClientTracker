'use client';

import { seo } from '@/lib/seo-theme';

interface KeywordOpp {
  keyword: string;
  actionCount: number;
  totalImpact: number;
}

interface KeywordOpportunitiesProps {
  keywords: KeywordOpp[];
}

export default function KeywordOpportunities({ keywords }: KeywordOpportunitiesProps) {
  return (
    <div style={{
      background: seo.surface,
      border: `1px solid ${seo.border}`,
      borderRadius: seo.radiusCard,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: seo.text, marginBottom: 4 }}>
        Opportunities
      </div>
      <div style={{ fontSize: 10, color: seo.textMuted, marginBottom: 16 }}>
        Keywords with low action coverage
      </div>

      {keywords.length === 0 ? (
        <div style={{ color: seo.textMuted, fontSize: 12 }}>
          No underserved keywords found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keywords.map(kw => (
            <div key={kw.keyword} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px',
              background: seo.deep,
              borderRadius: 6,
              border: `1px solid ${seo.border}`,
            }}>
              <span style={{ fontSize: 12, color: seo.text, fontWeight: 500 }}>
                {kw.keyword}
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, fontFamily: seo.fontMono, color: seo.textMuted,
                }}>
                  {kw.actionCount} action{kw.actionCount !== 1 ? 's' : ''}
                </span>
                <span style={{
                  fontSize: 11, fontFamily: seo.fontMono, fontWeight: 600,
                  color: kw.totalImpact > 0 ? seo.accent : kw.totalImpact < 0 ? seo.danger : seo.textMuted,
                }}>
                  {kw.totalImpact > 0 ? '+' : ''}{kw.totalImpact}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
