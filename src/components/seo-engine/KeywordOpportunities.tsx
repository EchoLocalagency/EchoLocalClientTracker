'use client';

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
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        Opportunities
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Keywords with low action coverage
      </div>

      {keywords.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          No underserved keywords found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keywords.map(kw => (
            <div key={kw.keyword} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px',
              background: 'var(--bg-depth)',
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                {kw.keyword}
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                }}>
                  {kw.actionCount} action{kw.actionCount !== 1 ? 's' : ''}
                </span>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: kw.totalImpact > 0 ? 'var(--success)' : kw.totalImpact < 0 ? 'var(--danger)' : 'var(--text-secondary)',
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
