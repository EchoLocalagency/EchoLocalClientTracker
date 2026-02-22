'use client';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  periodStart?: string;
  periodEnd?: string;
  formatter?: (value: number, name: string) => string;
}

export default function ChartTooltip({ active, payload, label, periodStart, periodEnd, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {periodStart && periodEnd && (
        <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: 10 }}>
          {periodStart} — {periodEnd}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span style={{ color: 'var(--text-muted)' }}>{entry.name}:</span>
          <span style={{ fontWeight: 600 }}>
            {formatter
              ? formatter(entry.value, entry.name)
              : typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
