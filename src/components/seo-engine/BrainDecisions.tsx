'use client';

import { useState } from 'react';
import { SeoBrainDecision } from '@/lib/types';

interface BrainDecisionsProps {
  decisions: SeoBrainDecision[];
}

export default function BrainDecisions({ decisions }: BrainDecisionsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (decisions.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
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
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onClick={() => setExpandedId(isExpanded ? null : decision.id)}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {new Date(decision.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
              }}>
                {decision.actions_proposed} actions proposed
              </div>
            </div>

            {/* Chosen actions */}
            {decision.actions_chosen && decision.actions_chosen.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {decision.actions_chosen.map((action, i) => (
                  <span key={i} style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: 'rgba(232, 255, 0, 0.1)',
                    color: 'var(--accent)',
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
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
              }}>
                {/* Input stats */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Input Data
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 8,
                  }}>
                    {Object.entries(decision.input_stats).map(([key, val]) => (
                      <div key={key} style={{
                        background: 'var(--bg-depth)',
                        borderRadius: 6,
                        padding: '8px 12px',
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {typeof val === 'number' ? val.toLocaleString() : String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reasoning */}
                {decision.reasoning && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Reasoning
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'pre-wrap',
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
