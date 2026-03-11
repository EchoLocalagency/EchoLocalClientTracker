'use client';

import { Mention } from '@/lib/types';

const DIVERSITY_CATEGORIES = ['directory', 'forum', 'review', 'social'] as const;
type DiversityCategory = typeof DIVERSITY_CATEGORIES[number];

const CATEGORY_LABELS: Record<DiversityCategory, string> = {
  directory: 'Directories',
  forum: 'Forums',
  review: 'Review Sites',
  social: 'Social',
};

const PLATFORM_TO_CATEGORY: Record<string, DiversityCategory> = {
  yelp: 'directory',
  bbb: 'directory',
  homeadvisor: 'directory',
  thumbtack: 'directory',
  angi: 'directory',
  nextdoor: 'forum',
  'reddit.com': 'forum',
  reddit: 'forum',
  facebook: 'social',
  instagram: 'social',
  google: 'review',
};

interface SourceDiversityPanelProps {
  mentions: Mention[];
}

function calcDiversity(mentions: Mention[]) {
  const byCategory: Record<DiversityCategory, Map<string, Mention[]>> = {
    directory: new Map(),
    forum: new Map(),
    review: new Map(),
    social: new Map(),
  };

  for (const m of mentions) {
    const cat = PLATFORM_TO_CATEGORY[m.platform] ||
                (m.mention_type === 'directory_listing' ? 'directory' :
                 m.mention_type === 'forum_mention' ? 'forum' :
                 m.mention_type === 'review' ? 'review' : null);
    if (cat) {
      if (!byCategory[cat].has(m.platform)) byCategory[cat].set(m.platform, []);
      byCategory[cat].get(m.platform)!.push(m);
    }
  }

  const present = DIVERSITY_CATEGORIES.filter(c => byCategory[c].size > 0);
  const missing = DIVERSITY_CATEGORIES.filter(c => byCategory[c].size === 0);

  return { byCategory, present, missing, score: present.length, maxScore: 4 };
}

function scoreColor(score: number): string {
  if (score >= 4) return 'var(--success)';
  if (score >= 3) return 'var(--accent)';
  if (score >= 2) return '#0891B2';
  return 'var(--danger)';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SourceDiversityPanel({ mentions }: SourceDiversityPanelProps) {
  const { byCategory, present, missing, score } = calcDiversity(mentions);
  const color = scoreColor(score);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: 24,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Source Diversity
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Platform coverage across directories, forums, reviews, and social
          </div>
        </div>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: `3px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: color, fontFamily: 'var(--font-mono)' }}>
            {score}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>/4</span>
        </div>
      </div>

      {/* Empty state */}
      {mentions.length === 0 ? (
        <div style={{
          color: 'var(--text-secondary)',
          padding: 40,
          textAlign: 'center',
          fontSize: 13,
        }}>
          No mentions tracked yet. Run the mention tracker to discover platform coverage.
        </div>
      ) : (
        <>
          {/* Category grid */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            {DIVERSITY_CATEGORIES.map(cat => {
              const isPresent = present.includes(cat);
              const platforms = byCategory[cat];
              return (
                <div
                  key={cat}
                  style={{
                    minWidth: 240,
                    flex: 1,
                    background: isPresent ? 'var(--bg-depth)' : 'rgba(255,61,87,0.05)',
                    border: isPresent ? '1px solid var(--border)' : '1px solid rgba(255,61,87,0.2)',
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isPresent ? 'var(--text-primary)' : 'var(--danger)',
                    marginBottom: 8,
                  }}>
                    {CATEGORY_LABELS[cat]}
                  </div>
                  {isPresent ? (
                    <div>
                      {Array.from(platforms.entries()).map(([platform, platformMentions], idx, arr) => (
                        <div
                          key={platform}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 0',
                            borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          <a
                            href={platformMentions[0].source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--text-primary)',
                              fontSize: 13,
                              textDecoration: 'none',
                            }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                          >
                            {capitalize(platform)}
                          </a>
                          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            {platformMentions.length} mention{platformMentions.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>
                        Not found
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>
                        Build presence on {CATEGORY_LABELS[cat].toLowerCase()} platforms
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gap summary */}
          <div style={{ marginTop: 16 }}>
            {missing.length > 0 ? (
              <div style={{
                background: 'rgba(255,61,87,0.05)',
                border: '1px solid rgba(255,61,87,0.15)',
                borderRadius: 8,
                padding: '12px 16px',
              }}>
                <span style={{ color: 'var(--danger)', fontSize: 13 }}>
                  Missing from: {missing.map(c => CATEGORY_LABELS[c]).join(', ')}
                </span>
              </div>
            ) : (
              <div style={{
                background: 'rgba(16,185,129,0.05)',
                border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: 8,
                padding: '12px 16px',
              }}>
                <span style={{ color: 'var(--success)', fontSize: 13 }}>
                  Full platform coverage achieved
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
