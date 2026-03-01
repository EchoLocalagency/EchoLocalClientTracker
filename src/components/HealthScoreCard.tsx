'use client';

import { HealthFactor } from '@/lib/utils';

interface HealthScoreCardProps {
  score: number;
  factors: HealthFactor[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--accent)';
  if (score >= 40) return 'var(--accent-dim)';
  return 'var(--danger)';
}

export default function HealthScoreCard({ score, factors }: HealthScoreCardProps) {
  const color = getScoreColor(score);
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '24px',
      display: 'flex',
      gap: 32,
      alignItems: 'center',
    }}>
      {/* Arc gauge */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
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
            stroke={color}
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
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{score}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Health</div>
        </div>
      </div>

      {/* Factor breakdown */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Score Breakdown</div>
        {factors.map((f) => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', width: 110, flexShrink: 0 }}>{f.label}</div>
            <div style={{
              flex: 1,
              height: 4,
              background: 'var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${f.score}%`,
                height: '100%',
                background: getScoreColor(f.score),
                borderRadius: 2,
              }} />
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', width: 28, textAlign: 'right' }}>{f.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
