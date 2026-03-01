'use client';

import { useState } from 'react';
import { SeoAction } from '@/lib/types';

interface ActionFeedProps {
  actions: SeoAction[];
}

const typeColors: Record<string, string> = {
  blog_post: '#E8FF00',
  gbp_post: '#00E676',
  meta_update: '#8A8F98',
  internal_link: '#F0F2F5',
  schema_markup: '#B8CC00',
};

function getTypeColor(type: string): string {
  return typeColors[type] || 'var(--accent)';
}

function getStatusStyle(status: string): { bg: string; color: string } {
  switch (status) {
    case 'completed': return { bg: 'rgba(0, 230, 118, 0.12)', color: 'var(--success)' };
    case 'pending': return { bg: 'rgba(232, 255, 0, 0.12)', color: 'var(--accent)' };
    case 'failed': return { bg: 'rgba(255, 61, 87, 0.12)', color: 'var(--danger)' };
    case 'dry_run': return { bg: 'rgba(138, 143, 152, 0.12)', color: 'var(--text-secondary)' };
    default: return { bg: 'rgba(138, 143, 152, 0.12)', color: 'var(--text-secondary)' };
  }
}

export default function ActionFeed({ actions }: ActionFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const actionTypes = ['all', ...new Set(actions.map(a => a.action_type))];
  const filtered = filterType === 'all' ? actions : actions.filter(a => a.action_type === filterType);

  if (actions.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        No SEO actions recorded yet. Actions will appear here once the SEO Engine runs.
      </div>
    );
  }

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {actionTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              border: '1px solid',
              borderColor: filterType === type ? 'var(--accent)' : 'var(--border)',
              borderRadius: 20,
              background: filterType === type ? 'rgba(232, 255, 0, 0.1)' : 'transparent',
              color: filterType === type ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {type === 'all' ? 'All' : type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(action => {
          const isExpanded = expandedId === action.id;
          const statusStyle = getStatusStyle(action.status);
          const typeColor = getTypeColor(action.action_type);

          return (
            <div
              key={action.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
              onClick={() => setExpandedId(isExpanded ? null : action.id)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {new Date(action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: `${typeColor}20`,
                  color: typeColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {action.action_type.replace(/_/g, ' ')}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  textTransform: 'uppercase',
                  marginLeft: 'auto',
                }}>
                  {action.status.replace(/_/g, ' ')}
                </span>
                {action.impact_score != null && (
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: action.impact_score > 0 ? 'var(--success)' : action.impact_score < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                  }}>
                    {action.impact_score > 0 ? '+' : ''}{action.impact_score}
                  </span>
                )}
              </div>

              {/* Description */}
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>
                {action.description}
              </div>

              {/* Keyword tags */}
              {action.target_keywords && action.target_keywords.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {action.target_keywords.map((kw, i) => (
                    <span key={i} style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--bg-depth)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}>
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded content */}
              {isExpanded && action.content_summary && (
                <div style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {action.content_summary}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
