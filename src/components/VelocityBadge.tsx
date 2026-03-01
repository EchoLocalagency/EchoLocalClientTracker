'use client';

import { Velocity } from '@/lib/utils';

const config: Record<Velocity, { label: string; color: string; bg: string }> = {
  accelerating: { label: 'Accelerating', color: 'var(--success)', bg: 'rgba(0, 230, 118, 0.12)' },
  steady: { label: 'Steady', color: 'var(--text-secondary)', bg: 'rgba(138, 143, 152, 0.12)' },
  decelerating: { label: 'Decelerating', color: 'var(--accent-dim)', bg: 'rgba(232, 255, 0, 0.12)' },
  declining: { label: 'Declining', color: 'var(--danger)', bg: 'rgba(255, 61, 87, 0.12)' },
};

interface VelocityBadgeProps {
  velocity: Velocity;
}

export default function VelocityBadge({ velocity }: VelocityBadgeProps) {
  const c = config[velocity];
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      padding: '3px 8px',
      borderRadius: 10,
      background: c.bg,
      color: c.color,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {c.label}
    </span>
  );
}
