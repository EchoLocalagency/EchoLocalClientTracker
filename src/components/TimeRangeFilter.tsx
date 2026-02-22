'use client';

import { TimeRange } from '@/lib/types';

const options: { value: TimeRange; label: string }[] = [
  { value: '4w', label: '4W' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'all', label: 'ALL' },
];

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export default function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-depth)', borderRadius: 8, padding: 3 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.02em',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: value === opt.value ? 'var(--accent-teal)' : 'transparent',
            color: value === opt.value ? 'var(--bg-primary)' : 'var(--text-muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
