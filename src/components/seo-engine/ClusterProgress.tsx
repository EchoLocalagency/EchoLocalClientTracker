'use client';

import { seo } from '@/lib/seo-theme';

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
        background: seo.surface,
        border: `1px solid ${seo.border}`,
        borderRadius: seo.radiusCard,
        padding: '20px 24px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: seo.text, marginBottom: 12 }}>
          Cluster Progress
        </div>
        <div style={{ color: seo.textMuted, fontSize: 12 }}>No cluster data yet</div>
      </div>
    );
  }

  return (
    <div style={{
      background: seo.surface,
      border: `1px solid ${seo.border}`,
      borderRadius: seo.radiusCard,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: seo.text, marginBottom: 16 }}>
        Cluster Progress
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {clusters.map(cluster => {
          const pct = cluster.total > 0 ? Math.round((cluster.filled / cluster.total) * 100) : 0;
          return (
            <div key={cluster.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontFamily: seo.fontMono,
                  color: seo.text, textTransform: 'uppercase',
                }}>
                  {cluster.name}
                </span>
                <span style={{ fontSize: 11, fontFamily: seo.fontMono, color: seo.textMuted }}>
                  {cluster.filled}/{cluster.total} ({pct}%)
                </span>
              </div>
              <div style={{
                width: '100%', height: 8,
                background: seo.deep,
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: pct >= 75 ? seo.accent : pct >= 40 ? seo.warning : seo.danger,
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
