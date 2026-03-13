'use client';

import type { PipelineStageHistory } from '@/lib/types';

interface StageTimelineProps {
  history: PipelineStageHistory[];
}

export function StageTimeline({ history }: StageTimelineProps) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, marginTop: 24 }}>
        Stage History
      </div>

      {history.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          No stage transitions yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {history.map((entry, idx) => {
            const isLast = idx === history.length - 1;
            return (
              <div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Dot + connecting line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    marginTop: 5,
                  }} />
                  {!isLast && (
                    <div style={{
                      width: 1,
                      flex: 1,
                      minHeight: 24,
                      background: 'var(--border)',
                    }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ paddingBottom: isLast ? 0 : 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {entry.previous_stage
                      ? `${entry.previous_stage} -> ${entry.new_stage}`
                      : `Entered as ${entry.new_stage}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {new Date(entry.transitioned_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
