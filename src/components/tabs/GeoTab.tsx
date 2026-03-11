'use client';

import { GeoScore, SerpFeature, WeeklyTrendPoint } from '@/lib/types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import CitationTrendChart from '@/components/geo/CitationTrendChart';

interface GeoTabProps {
  geoScores: GeoScore[];
  serpFeatures: SerpFeature[];
  serpApiUsageCount: number;
  isAdmin: boolean;
  seoEngineEnabled: boolean;
  geoScoreTrends: Record<string, Array<{ score: number; scored_at: string }>>;
  citationTrends: WeeklyTrendPoint[];
}

const FACTOR_LABELS: Record<string, string> = {
  answer_block: 'Answer Block',
  stats_density: 'Stats Density',
  schema_present: 'Schema Present',
  heading_structure: 'Heading Structure',
  freshness_signal: 'Freshness Signal',
};

const BUDGET_LIMIT = 950;

function geoScoreColor(score: number): string {
  if (score >= 4) return 'var(--success)';
  if (score >= 3) return 'var(--accent)';
  if (score >= 2) return 'var(--accent-dim)';
  return 'var(--danger)';
}

function citationBadge(hasAio: boolean, cited: boolean): { label: string; color: string; bg: string } {
  if (!hasAio) return { label: 'No AI Overview', color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.1)' };
  if (cited) return { label: 'Cited', color: 'var(--success)', bg: 'rgba(16,185,129,0.1)' };
  return { label: 'Not Cited', color: 'var(--danger)', bg: 'rgba(255,61,87,0.1)' };
}

function budgetGaugeColor(pct: number): string {
  if (pct >= 90) return 'var(--danger)';
  if (pct >= 70) return 'var(--accent-dim)';
  return 'var(--success)';
}

export default function GeoTab({ geoScores, serpFeatures, serpApiUsageCount, isAdmin, seoEngineEnabled, geoScoreTrends, citationTrends }: GeoTabProps) {
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
            {geoScores.map((gs) => {
              const trendData = geoScoreTrends[gs.page_path];
              const hasSparkline = trendData && trendData.length >= 2;
              return (
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
                    {/* Left side: page info + score */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
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
                    </div>

                    {/* Right side: sparkline */}
                    {hasSparkline && (
                      <div style={{ width: 120, height: 40, marginLeft: 16, flexShrink: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendData}>
                            <Area
                              type="monotone"
                              dataKey="score"
                              stroke="var(--accent)"
                              fill="rgba(6,182,212,0.1)"
                              strokeWidth={1.5}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
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
              );
            })}
          </div>
        )}
      </section>

      {/* AI Overview Citation Status */}
      <section style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            AI Overview Citations
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Whether your pages appear in AI-generated answers
          </p>
        </div>

        {serpFeatures.length === 0 ? (
          <div style={{
            color: 'var(--text-secondary)',
            padding: 40,
            textAlign: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
          }}>
            No keyword tracking data yet.
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
          }}>
            {/* Header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 140px',
              padding: '12px 16px',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border)',
            }}>
              <div>Keyword</div>
              <div>AI Overview</div>
              <div>Citation Status</div>
            </div>
            {/* Data rows */}
            {serpFeatures.map((sf, i) => {
              const badge = citationBadge(sf.has_ai_overview, sf.client_cited_in_ai_overview);
              return (
                <div
                  key={sf.keyword}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 140px',
                    padding: '12px 16px',
                    alignItems: 'center',
                    background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderBottom: i < serpFeatures.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ color: 'var(--text-primary)', fontSize: 14 }}>{sf.keyword}</div>
                  <div style={{
                    color: sf.has_ai_overview ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 13,
                  }}>
                    {sf.has_ai_overview ? 'Yes' : 'None'}
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: badge.color,
                      background: badge.bg,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Citation Trend Chart -- DASH-03 */}
      <div style={{ marginTop: 32 }}>
        <CitationTrendChart data={citationTrends} />
      </div>

      {/* Featured Snippets */}
      <section style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            Featured Snippets
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Which site holds the answer box for each keyword
          </p>
        </div>

        {(() => {
          const snippetFeatures = serpFeatures.filter(sf => sf.has_featured_snippet);
          if (snippetFeatures.length === 0) {
            return (
              <div style={{
                color: 'var(--text-secondary)',
                padding: 40,
                textAlign: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
              }}>
                No featured snippets detected for tracked keywords.
              </div>
            );
          }
          return (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
            }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 120px',
                padding: '12px 16px',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border)',
              }}>
                <div>Keyword</div>
                <div>Snippet Holder</div>
                <div>Status</div>
              </div>
              {/* Data rows */}
              {snippetFeatures.map((sf, i) => (
                <div
                  key={sf.keyword}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 120px',
                    padding: '12px 16px',
                    alignItems: 'center',
                    background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderBottom: i < snippetFeatures.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ color: 'var(--text-primary)', fontSize: 14 }}>{sf.keyword}</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                  }}>
                    {sf.featured_snippet_holder}
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: sf.client_has_snippet ? 'var(--success)' : 'var(--danger)',
                      background: sf.client_has_snippet ? 'rgba(16,185,129,0.1)' : 'rgba(255,61,87,0.1)',
                    }}>
                      {sf.client_has_snippet ? 'You hold it' : 'Competitor'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* SerpAPI Budget Gauge (admin only) */}
      {isAdmin && (
        <section style={{ marginTop: 32 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              SerpAPI Budget
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Monthly search usage
            </p>
          </div>

          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {(() => {
              const pct = Math.round((serpApiUsageCount / BUDGET_LIMIT) * 100);
              const gaugeColor = budgetGaugeColor(pct);
              const size = 120;
              const strokeWidth = 8;
              const radius = (size - strokeWidth) / 2;
              const circumference = 2 * Math.PI * radius;
              const progress = (Math.min(pct, 100) / 100) * circumference;

              return (
                <>
                  <div style={{ position: 'relative', width: size, height: size }}>
                    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth={strokeWidth}
                      />
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={gaugeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - progress}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        fontSize: 28,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: gaugeColor,
                      }}>
                        {serpApiUsageCount}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                      }}>
                        / {BUDGET_LIMIT}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                  }}>
                    {serpApiUsageCount} of {BUDGET_LIMIT} searches used this month
                  </div>
                </>
              );
            })()}
          </div>
        </section>
      )}
    </div>
  );
}
