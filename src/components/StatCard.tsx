'use client';

import { calcDelta, formatDelta, formatNumber } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | null;
  previous?: number | null;
  format?: 'number' | 'position' | 'score';
  invertDelta?: boolean; // for metrics where lower is better (position)
  alert?: string | null;
}

export default function StatCard({ label, value, previous, format = 'number', invertDelta = false, alert }: StatCardProps) {
  const delta = calcDelta(value, previous ?? null);
  const isPositive = invertDelta ? (delta != null && delta < 0) : (delta != null && delta > 0);
  const isNegative = invertDelta ? (delta != null && delta > 0) : (delta != null && delta < 0);

  let displayValue: string;
  if (value == null) {
    displayValue = '--';
  } else if (format === 'position') {
    displayValue = value.toFixed(1);
  } else if (format === 'score') {
    displayValue = value.toString();
  } else {
    displayValue = formatNumber(value);
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '20px 24px',
        position: 'relative',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0, 206, 209, 0.3)';
        e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 206, 209, 0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{displayValue}</div>
        {delta != null && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 12,
              background: isPositive ? 'rgba(40, 167, 69, 0.15)' : isNegative ? 'rgba(220, 53, 69, 0.15)' : 'rgba(136, 146, 164, 0.15)',
              color: isPositive ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--text-muted)',
            }}
          >
            {formatDelta(delta)}
          </span>
        )}
      </div>
      {alert && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14 }}>!</span> {alert}
        </div>
      )}
    </div>
  );
}
