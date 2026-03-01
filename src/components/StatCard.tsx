'use client';

import { calcDelta, formatDelta, formatNumber, Velocity } from '@/lib/utils';
import VelocityBadge from './VelocityBadge';

interface StatCardProps {
  label: string;
  value: number | null;
  previous?: number | null;
  format?: 'number' | 'position' | 'score';
  invertDelta?: boolean;
  alert?: string | null;
  baseline?: number | null;
  baselineDate?: string | null;
  sparklineData?: number[];
  velocityLabel?: Velocity | null;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const color = last >= prev ? 'var(--success)' : 'var(--danger)';

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function StatCard({
  label, value, previous, format = 'number', invertDelta = false, alert,
  baseline, baselineDate, sparklineData, velocityLabel,
}: StatCardProps) {
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

  const baselineDelta = baseline != null && value != null && baseline > 0
    ? calcDelta(value, baseline)
    : null;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 24px',
        position: 'relative',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-border)';
        e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </div>
        {velocityLabel && <VelocityBadge velocity={velocityLabel} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{displayValue}</div>
        {delta != null && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: 12,
              background: isPositive ? 'rgba(0, 230, 118, 0.15)' : isNegative ? 'rgba(255, 61, 87, 0.15)' : 'rgba(138, 143, 152, 0.15)',
              color: isPositive ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--text-secondary)',
            }}
          >
            {formatDelta(delta)}
          </span>
        )}
      </div>

      {sparklineData && sparklineData.length >= 2 && (
        <div style={{ marginTop: 10 }}>
          <Sparkline data={sparklineData} />
        </div>
      )}

      {baselineDelta != null && baselineDate && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {formatDelta(baselineDelta)} since {baselineDate}
        </div>
      )}

      {alert && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14 }}>!</span> {alert}
        </div>
      )}
    </div>
  );
}
