'use client';

const upcoming = [
  { metric: 'Maps Views', desc: 'How often your listing appears on Google Maps' },
  { metric: 'Search Views', desc: 'Listing appearances in Google Search' },
  { metric: 'Phone Calls', desc: 'Calls initiated from your GBP listing' },
  { metric: 'Direction Requests', desc: 'Navigation requests to your business' },
  { metric: 'Website Clicks', desc: 'Clicks through to your website from GBP' },
  { metric: 'Photo Views', desc: 'Views on your business photos' },
];

export default function GbpTab() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '40px',
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Google Business Profile</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 500, lineHeight: 1.6 }}>
        GBP metrics will appear here once the Business Profile Performance API is approved. Here is what you will see:
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {upcoming.map((item) => (
          <div
            key={item.metric}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 20px',
              background: 'var(--bg-depth)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-teal-border)',
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{item.metric}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, fontSize: 12, color: 'var(--accent-teal)', fontFamily: 'var(--font-mono)' }}>
        Pending API approval
      </div>
    </div>
  );
}
