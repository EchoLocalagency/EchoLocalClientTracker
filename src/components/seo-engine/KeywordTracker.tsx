'use client';

import { SeoAction, TrackedKeyword, KeywordSnapshot } from '@/lib/types';

interface KeywordTrackerProps {
  actions: SeoAction[];
  trackedKeywords: TrackedKeyword[];
  keywordSnapshots: KeywordSnapshot[];
}

interface KeywordRow {
  keyword: string;
  latestPosition: number | null;
  previousPosition: number | null;
  positionChange: number | null;
  impressions: number;
  clicks: number;
  source: string;
  history: number[];
  actionCount: number;
}

function TrendSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 20;

  // For positions, lower is better, so invert the y-axis
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = ((v - min) / range) * h; // lower position = higher on chart
    return `${x},${y}`;
  }).join(' ');

  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  // Lower position is better (green)
  const color = last <= prev ? 'var(--success)' : 'var(--danger)';

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function KeywordTracker({ actions, trackedKeywords, keywordSnapshots }: KeywordTrackerProps) {
  // Build rows from keyword_snapshots (actual GSC/SerpAPI ranking data)
  const snapshotsByKeyword = new Map<string, KeywordSnapshot[]>();
  for (const snap of keywordSnapshots) {
    const existing = snapshotsByKeyword.get(snap.keyword) || [];
    existing.push(snap);
    snapshotsByKeyword.set(snap.keyword, existing);
  }

  // Count actions per keyword from seo_actions
  const actionCountByKeyword = new Map<string, number>();
  for (const action of actions) {
    if (!action.target_keywords) continue;
    for (const kw of action.target_keywords) {
      actionCountByKeyword.set(kw, (actionCountByKeyword.get(kw) || 0) + 1);
    }
  }

  // Build rows from tracked keywords that have snapshot data
  const rows: KeywordRow[] = [];

  for (const tk of trackedKeywords) {
    if (!tk.is_active) continue;
    const snapshots = snapshotsByKeyword.get(tk.keyword) || [];
    if (snapshots.length === 0) {
      // Still show the keyword even without data
      rows.push({
        keyword: tk.keyword,
        latestPosition: null,
        previousPosition: null,
        positionChange: null,
        impressions: 0,
        clicks: 0,
        source: '-',
        history: [],
        actionCount: actionCountByKeyword.get(tk.keyword) || 0,
      });
      continue;
    }

    // Sort by date ascending
    const sorted = [...snapshots].sort((a, b) => a.checked_at.localeCompare(b.checked_at));
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

    const latestPos = latest.position;
    const prevPos = previous?.position ?? null;
    const change = latestPos != null && prevPos != null ? prevPos - latestPos : null; // positive = improved

    // Sum impressions/clicks from all snapshots
    const totalImpressions = sorted.reduce((sum, s) => sum + (s.impressions || 0), 0);
    const totalClicks = sorted.reduce((sum, s) => sum + (s.clicks || 0), 0);

    // Position history for sparkline (last 14 data points max)
    const history = sorted
      .filter(s => s.position != null)
      .slice(-14)
      .map(s => s.position as number);

    rows.push({
      keyword: tk.keyword,
      latestPosition: latestPos,
      previousPosition: prevPos,
      positionChange: change,
      impressions: totalImpressions,
      clicks: totalClicks,
      source: latest.source,
      history,
      actionCount: actionCountByKeyword.get(tk.keyword) || 0,
    });
  }

  // Also add any keywords from snapshots not in tracked_keywords
  for (const [kw, snapshots] of snapshotsByKeyword) {
    if (rows.some(r => r.keyword === kw)) continue;
    const sorted = [...snapshots].sort((a, b) => a.checked_at.localeCompare(b.checked_at));
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const latestPos = latest.position;
    const prevPos = previous?.position ?? null;
    const change = latestPos != null && prevPos != null ? prevPos - latestPos : null;

    rows.push({
      keyword: kw,
      latestPosition: latestPos,
      previousPosition: prevPos,
      positionChange: change,
      impressions: sorted.reduce((sum, s) => sum + (s.impressions || 0), 0),
      clicks: sorted.reduce((sum, s) => sum + (s.clicks || 0), 0),
      source: latest.source,
      history: sorted.filter(s => s.position != null).slice(-14).map(s => s.position as number),
      actionCount: actionCountByKeyword.get(kw) || 0,
    });
  }

  // Sort: keywords with positions first (best rank), then nulls at bottom
  rows.sort((a, b) => {
    if (a.latestPosition == null && b.latestPosition == null) return 0;
    if (a.latestPosition == null) return 1;
    if (b.latestPosition == null) return -1;
    return a.latestPosition - b.latestPosition;
  });

  if (rows.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>
        No keyword data yet. Run the reports pipeline to populate keyword snapshots.
      </div>
    );
  }

  // Stats
  const withPosition = rows.filter(r => r.latestPosition != null);
  const top3 = withPosition.filter(r => r.latestPosition! <= 3).length;
  const top10 = withPosition.filter(r => r.latestPosition! <= 10).length;
  const avgPosition = withPosition.length > 0
    ? (withPosition.reduce((sum, r) => sum + r.latestPosition!, 0) / withPosition.length).toFixed(1)
    : '-';
  const improved = rows.filter(r => r.positionChange != null && r.positionChange > 0).length;

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatBox label="Tracked Keywords" value={rows.length.toString()} />
        <StatBox label="Top 3" value={top3.toString()} color="var(--success)" />
        <StatBox label="Top 10" value={top10.toString()} color="var(--accent)" />
        <StatBox label="Avg Position" value={avgPosition} />
      </div>

      {/* Rankings table */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Keyword Rankings
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {improved} improved since last check
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle}>Keyword</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Position</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Change</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Trend</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Impressions</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Clicks</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.keyword} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {row.keyword}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {row.latestPosition != null ? (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: row.latestPosition <= 3 ? 'var(--success)' : row.latestPosition <= 10 ? 'var(--accent)' : 'var(--text-secondary)',
                    }}>
                      {row.latestPosition % 1 === 0 ? row.latestPosition : row.latestPosition.toFixed(1)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>--</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {row.positionChange != null ? (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      fontSize: 12,
                      color: row.positionChange > 0 ? 'var(--success)' : row.positionChange < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                    }}>
                      {row.positionChange > 0 ? '+' : ''}{row.positionChange % 1 === 0 ? row.positionChange : row.positionChange.toFixed(1)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>--</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {row.history.length >= 2 && <TrendSparkline values={row.history} />}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {row.impressions}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {row.clicks}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {row.actionCount || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: color || 'var(--accent)' }}>
        {value}
      </div>
    </div>
  );
}
