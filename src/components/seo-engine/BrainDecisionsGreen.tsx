'use client';

import { useState } from 'react';
import { SeoBrainDecision } from '@/lib/types';
import { seo } from '@/lib/seo-theme';

interface BrainDecisionsGreenProps {
  decisions: SeoBrainDecision[];
}

export default function BrainDecisionsGreen({ decisions }: BrainDecisionsGreenProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (decisions.length === 0) {
    return (
      <div style={{ color: seo.textMuted, padding: 40, textAlign: 'center' }}>
        No brain decisions recorded yet. Decisions will appear here after the SEO Engine analyzes data.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {decisions.map(decision => {
        const isExpanded = expandedId === decision.id;

        return (
          <div
            key={decision.id}
            style={{
              background: seo.surface,
              border: `1px solid ${seo.border}`,
              borderRadius: seo.radiusCard,
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onClick={() => setExpandedId(isExpanded ? null : decision.id)}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = seo.accentBorder; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = seo.border; }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: seo.textMuted, fontFamily: seo.fontMono }}>
                {new Date(decision.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, fontFamily: seo.fontMono, color: seo.accent,
              }}>
                {decision.actions_proposed} actions proposed
              </div>
              <span style={{ fontSize: 12, color: seo.textMuted, marginLeft: 'auto' }}>
                {isExpanded ? '\u25B2' : '\u25BC'}
              </span>
            </div>

            {/* Chosen actions */}
            {decision.actions_chosen && decision.actions_chosen.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {decision.actions_chosen.map((action, i) => (
                  <span key={i} style={{
                    fontSize: 10, fontWeight: 600, fontFamily: seo.fontMono,
                    padding: '3px 10px', borderRadius: 12,
                    background: seo.accentGlow, color: seo.accent,
                    textTransform: 'uppercase',
                  }}>
                    {action.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded: input stats + reasoning */}
            {isExpanded && (
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: `1px solid ${seo.border}`,
              }}>
                {/* Input stats */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: seo.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
                  }}>
                    Input Data
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 8,
                  }}>
                    {Object.entries(decision.input_stats).map(([key, val]) => (
                      <div key={key} style={{
                        background: seo.deep,
                        borderRadius: 6,
                        padding: '8px 12px',
                        border: `1px solid ${seo.border}`,
                      }}>
                        <div style={{ fontSize: 10, color: seo.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: seo.fontMono, color: seo.text }}>
                          {typeof val === 'number' ? val.toLocaleString() : String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reasoning */}
                {decision.reasoning && (
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: seo.textMuted,
                      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
                    }}>
                      Reasoning
                    </div>
                    <div style={{
                      fontSize: 12, color: seo.textMuted,
                      lineHeight: 1.6, fontFamily: seo.fontMono,
                      whiteSpace: 'pre-wrap',
                      background: seo.deep,
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: `1px solid ${seo.border}`,
                    }}>
                      {decision.reasoning}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
