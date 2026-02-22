'use client';

export interface AlertItem {
  severity: 'critical' | 'warning';
  message: string;
  hint?: string;
}

interface AlertBannerProps {
  alerts: AlertItem[];
}

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const borderColor = hasCritical ? 'rgba(220, 53, 69, 0.3)' : 'rgba(255, 215, 0, 0.2)';
  const bgColor = hasCritical ? 'rgba(220, 53, 69, 0.06)' : 'rgba(255, 215, 0, 0.06)';
  const titleColor = hasCritical ? 'var(--danger)' : 'var(--accent-gold)';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-card)',
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: titleColor, marginBottom: 8 }}>
        {hasCritical ? 'Action Required' : 'Attention Needed'}
      </div>
      {alerts.map((alert, i) => (
        <div key={i} style={{ marginBottom: i < alerts.length - 1 ? 6 : 0 }}>
          <div style={{
            fontSize: 13,
            color: 'var(--text-primary)',
            paddingLeft: 12,
            display: 'flex',
            gap: 8,
          }}>
            <span style={{ color: alert.severity === 'critical' ? 'var(--danger)' : 'var(--accent-gold)' }}>
              {alert.severity === 'critical' ? '!!' : '!'}
            </span>
            <span>{alert.message}</span>
          </div>
          {alert.hint && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 28, marginTop: 2 }}>
              {alert.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
