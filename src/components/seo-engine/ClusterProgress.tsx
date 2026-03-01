'use client';

interface Cluster {
  name: string;
  filled: number;
  total: number;
}

interface ClusterProgressProps {
  clusters: Cluster[];
}

export default function ClusterProgress({ clusters }: ClusterProgressProps) {
  if (clusters.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 24px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Cluster Progress
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No cluster data yet</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
        Cluster Progress
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {clusters.map(cluster => {
          const pct = cluster.total > 0 ? Math.round((cluster.filled / cluster.total) * 100) : 0;
          return (
            <div key={cluster.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)', textTransform: 'uppercase',
                }}>
                  {cluster.name}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {cluster.filled}/{cluster.total} ({pct}%)
                </span>
              </div>
              <div style={{
                width: '100%', height: 8,
                background: 'var(--bg-depth)',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: pct >= 75 ? 'var(--success)' : pct >= 40 ? 'var(--accent)' : 'var(--danger)',
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
