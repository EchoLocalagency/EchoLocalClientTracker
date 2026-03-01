'use client';

import { Client } from '@/lib/types';

interface SeoClientSelectorProps {
  clients: Client[];
  activeClient: Client | null;
  onSelectClient: (client: Client) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function SeoClientSelector({
  clients, activeClient, onSelectClient, collapsed, onToggle,
}: SeoClientSelectorProps) {
  return (
    <aside style={{
      width: collapsed ? 68 : 260,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease',
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      zIndex: 50,
      boxShadow: '4px 0 24px rgba(0, 0, 0, 0.5)',
    }}>
      {/* Brand */}
      <div style={{
        padding: collapsed ? '20px 12px' : '24px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#000',
              fontFamily: 'var(--font-mono)',
            }}>
              SE
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#000',
              fontFamily: 'var(--font-mono)',
            }}>
              SE
            </div>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                color: 'var(--accent)',
                letterSpacing: '-0.01em',
              }}>
                SEO Engine
              </div>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                marginTop: 1, letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Echo Local
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Back to Dashboard link */}
      <a
        href="/"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: collapsed ? '12px 0' : '12px 24px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          fontSize: 12, color: 'var(--text-secondary)',
          textDecoration: 'none',
          borderBottom: '1px solid var(--border)',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        {collapsed ? '\u2039' : '\u2039 Dashboard'}
      </a>

      {/* Client list */}
      <div style={{ padding: collapsed ? '16px 10px' : '20px 16px', flex: 1, overflow: 'auto' }}>
        {!collapsed && (
          <div style={{
            fontSize: 10, fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12, paddingLeft: 10,
          }}>
            Clients
          </div>
        )}
        {clients.map((client) => {
          const isActive = activeClient?.id === client.id;
          const initials = client.name.split(' ').map(w => w[0]).join('').slice(0, 2);
          return (
            <button
              key={client.id}
              onClick={() => onSelectClient(client)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%',
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                marginBottom: 4,
                transition: 'all 0.2s ease',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: isActive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)',
                color: isActive ? '#000' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
                border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                {initials}
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', fontSize: 13,
                    letterSpacing: '-0.01em', display: 'block',
                  }}>
                    {client.name}
                  </span>
                  {client.seo_engine_enabled && (
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)',
                      color: 'var(--success)', textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      active
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        style={{
          padding: '14px', border: 'none',
          borderTop: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 14,
          display: 'flex', justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent-glow)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        {collapsed ? '\u203A' : '\u2039'}
      </button>
    </aside>
  );
}
