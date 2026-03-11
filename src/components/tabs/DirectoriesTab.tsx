'use client';

import { SubmissionWithDirectory } from '@/lib/types';

interface DirectoriesTabProps {
  submissions: SubmissionWithDirectory[];
  seoEngineEnabled: boolean;
  isAdmin: boolean;
}

const SUBMITTED_STATUSES = ['submitted', 'approved', 'verified'];

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  verified:  { bg: 'rgba(16,185,129,0.15)', color: '#10B981',               label: 'Verified' },
  submitted: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B',               label: 'Submitted' },
  approved:  { bg: 'rgba(16,185,129,0.10)', color: '#10B981',               label: 'Approved' },
  pending:   { bg: 'rgba(148,163,184,0.1)', color: 'var(--text-secondary)', label: 'Pending' },
  rejected:  { bg: 'rgba(255,61,87,0.15)',  color: '#FF3D57',               label: 'Rejected' },
  skipped:   { bg: 'rgba(148,163,184,0.05)', color: 'rgba(148,163,184,0.4)', label: 'Skipped' },
  failed:    { bg: 'rgba(255,61,87,0.10)',  color: '#FF3D57',               label: 'Failed' },
  existing_needs_review: { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B',    label: 'Needs Review' },
};

const STATUS_PRIORITY: Record<string, number> = {
  verified: 0,
  approved: 1,
  submitted: 2,
  pending: 3,
  existing_needs_review: 4,
  rejected: 5,
  failed: 6,
  skipped: 7,
};

const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 (DA 50+)',
  2: 'Tier 2 (DA 30-50)',
  3: 'Tier 3 (DA 10-30)',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-secondary)',
  marginBottom: 16,
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  display: 'inline-block',
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{ ...badgeStyle, background: config.bg, color: config.color }}>
      {config.label}
    </span>
  );
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <div style={{
        flex: 1,
        height: 6,
        borderRadius: 3,
        background: 'var(--bg-depth, rgba(148,163,184,0.08))',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 3,
          background: color,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'right' }}>
        {value}/{total}
      </span>
    </div>
  );
}

export default function DirectoriesTab({ submissions, seoEngineEnabled }: DirectoriesTabProps) {
  if (!seoEngineEnabled) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        Directory submissions are available with SEO Engine.
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        No directory submissions yet.
      </div>
    );
  }

  // Backlink Value Score
  const backlinkScore = submissions
    .filter(s => s.status === 'verified' && s.directories?.da_score != null)
    .reduce((sum, s) => sum + (s.directories!.da_score ?? 0), 0);
  const verifiedCount = submissions.filter(s => s.status === 'verified').length;

  // Tier stats
  const tiers = [1, 2, 3];
  const tierStats = tiers.map(tier => {
    const tierSubs = submissions.filter(s => s.directories?.tier === tier);
    const submitted = tierSubs.filter(s => SUBMITTED_STATUSES.includes(s.status)).length;
    const verified = tierSubs.filter(s => s.status === 'verified').length;
    const total = tierSubs.length;
    return { tier, submitted, verified, total };
  });

  // Tier 1/2 recommendations (pending manual submissions)
  const recommendations = submissions.filter(
    s => (s.directories?.tier === 1 || s.directories?.tier === 2) && s.status === 'pending'
  );

  // Group submissions by tier for grid, sorted by status priority
  const groupedByTier = tiers.map(tier => {
    const tierSubs = submissions
      .filter(s => s.directories?.tier === tier)
      .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99));
    return { tier, subs: tierSubs };
  }).filter(g => g.subs.length > 0);

  return (
    <div>
      {/* Section 1: Backlink Value Score */}
      <div style={{
        background: 'var(--card-bg, rgba(148,163,184,0.04))',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '24px 28px',
        marginBottom: 32,
      }}>
        <div style={{ ...sectionHeaderStyle, marginBottom: 12 }}>DA-Weighted Backlink Authority</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{
            fontSize: 48,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: backlinkScore > 0 ? 'var(--accent)' : 'var(--text-secondary)',
          }}>
            {backlinkScore}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            from {verifiedCount} verified listing{verifiedCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Section 2: Tier Progress Bars */}
      <div style={{ marginBottom: 32 }}>
        <div style={sectionHeaderStyle}>Tier Progress</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {tierStats.map(({ tier, submitted, verified, total }) => (
            <div key={tier} style={{
              background: 'var(--card-bg, rgba(148,163,184,0.04))',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                {TIER_LABELS[tier] || `Tier ${tier}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Submitted</div>
              <ProgressBar value={submitted} total={total} color="var(--accent)" />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, marginTop: 8 }}>Verified</div>
              <ProgressBar value={verified} total={total} color="#10B981" />
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Tier 1/2 Recommendations */}
      <div style={{ marginBottom: 32 }}>
        <div style={sectionHeaderStyle}>Tier 1/2 Recommendations</div>
        {recommendations.length === 0 ? (
          <div style={{
            color: 'var(--text-secondary)',
            fontSize: 13,
            padding: '16px 20px',
            background: 'var(--card-bg, rgba(148,163,184,0.04))',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}>
            All Tier 1/2 directories have been submitted or skipped.
          </div>
        ) : (
          <div style={{
            background: 'var(--card-bg, rgba(148,163,184,0.04))',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {recommendations.map((s, i) => (
              <div key={s.id} style={{
                padding: '12px 20px',
                borderBottom: i < recommendations.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {s.directories?.name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {s.directories?.domain}
                    {s.directories?.da_score != null && (
                      <span style={{ marginLeft: 8 }}>DA {s.directories.da_score}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 260, textAlign: 'right' }}>
                  Requires manual submission -- contact client for credentials/verification
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Directory Status Grid */}
      <div>
        <div style={sectionHeaderStyle}>Directory Status</div>
        {groupedByTier.map(({ tier, subs }) => (
          <div key={tier} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {TIER_LABELS[tier] || `Tier ${tier}`}
            </div>
            <div style={{
              background: 'var(--card-bg, rgba(148,163,184,0.04))',
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 60px 100px 2fr 100px',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <div>Directory</div>
                <div>Domain</div>
                <div>DA</div>
                <div>Status</div>
                <div>Live URL</div>
                <div>Submitted</div>
              </div>
              {/* Data rows */}
              {subs.map((s, i) => (
                <div key={s.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 60px 100px 2fr 100px',
                  padding: '10px 16px',
                  borderBottom: i < subs.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: 13,
                  alignItems: 'center',
                }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {s.directories?.name || 'Unknown'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {s.directories?.domain || '-'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {s.directories?.da_score ?? '-'}
                  </div>
                  <div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.status === 'verified' && s.live_url ? (
                      <a
                        href={s.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 12 }}
                      >
                        {s.live_url}
                      </a>
                    ) : (
                      <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 12 }}>--</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
