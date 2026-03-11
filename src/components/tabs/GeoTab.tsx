'use client';

import { GeoScore, SerpFeature } from '@/lib/types';

interface GeoTabProps {
  geoScores: GeoScore[];
  serpFeatures: SerpFeature[];
  serpApiUsageCount: number;
  isAdmin: boolean;
  seoEngineEnabled: boolean;
}

const FACTOR_LABELS: Record<string, string> = {
  answer_block: 'Answer Block',
  stats_density: 'Stats Density',
  schema_present: 'Schema Present',
  heading_structure: 'Heading Structure',
  freshness_signal: 'Freshness Signal',
};

function geoScoreColor(score: number): string {
  if (score >= 4) return 'var(--success)';
  if (score >= 3) return 'var(--accent)';
  if (score >= 2) return 'var(--accent-dim)';
  return 'var(--danger)';
}

export default function GeoTab({ geoScores, seoEngineEnabled }: GeoTabProps) {
  if (!seoEngineEnabled) {
    return (
      <div style={{
        color: 'var(--text-secondary)',
        padding: 40,
        textAlign: 'center',
      }}>
        SEO Engine is not enabled for this client.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* GEO Scores Section */}
      <section>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-primary)',
          }}>
            GEO Scores
          </h2>
          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: '4px 0 0 0',
          }}>
            Citation-readiness score per page (0-5)
          </p>
        </div>

        {geoScores.length === 0 ? (
          <div style={{
            color: 'var(--text-secondary)',
            padding: 40,
            textAlign: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
          }}>
            No GEO scores recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {geoScores.map((gs) => (
              <div
                key={gs.page_path}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  padding: 20,
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 12,
                }}>
                  <div>
                    <div style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}>
                      {gs.page_path}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      marginTop: 2,
                    }}>
                      {new Date(gs.scored_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: geoScoreColor(gs.score),
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {gs.score}
                    </span>
                    <span style={{
                      fontSize: 14,
                      color: 'var(--text-secondary)',
                      fontWeight: 400,
                    }}>
                      /5
                    </span>
                  </div>
                </div>

                {/* Factor pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(gs.factors).map(([key, value]) => (
                    <span
                      key={key}
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                        color: value === 1 ? 'var(--success)' : 'var(--danger)',
                        background: value === 1
                          ? 'rgba(16,185,129,0.1)'
                          : 'rgba(255,61,87,0.1)',
                      }}
                    >
                      {FACTOR_LABELS[key] || key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Citation Status section -- Plan 06-02 */}
      {/* Budget Gauge section -- Plan 06-02 */}
      {/* Snippet Ownership section -- Plan 06-02 */}
    </div>
  );
}
