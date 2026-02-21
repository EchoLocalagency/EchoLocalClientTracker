'use client';

export default function GbpTab() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '60px 40px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>&#9729;</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Google Business Profile</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
        GBP metrics will appear here once the Business Profile Performance API is approved.
        This will include Maps views, Search views, phone calls, direction requests, and website clicks from your listing.
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--accent-teal)' }}>
        Pending API approval
      </div>
    </div>
  );
}
