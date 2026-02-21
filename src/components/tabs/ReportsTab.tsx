'use client';

export default function ReportsTab() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '60px 40px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>&#9998;</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Report Generator</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
        Auto-generated plain-language performance summaries will be available here.
        Copy/paste ready for client emails.
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--accent-teal)' }}>
        Coming soon
      </div>
    </div>
  );
}
