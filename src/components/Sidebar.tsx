'use client';

import { Client } from '@/lib/types';

interface SidebarProps {
  clients: Client[];
  activeClient: Client | null;
  onSelectClient: (client: Client) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ clients, activeClient, onSelectClient, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      style={{
        width: collapsed ? 68 : 260,
        background: 'linear-gradient(180deg, #001A33 0%, #001228 50%, #000D1F 100%)',
        borderRight: '1px solid rgba(0, 206, 209, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 50,
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Logo / Brand */}
      <div style={{
        padding: collapsed ? '20px 12px' : '24px 24px',
        borderBottom: '1px solid rgba(0, 206, 209, 0.1)',
        background: 'rgba(0, 206, 209, 0.02)',
      }}>
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src="/echo-local-logo.png"
              alt="Echo Local"
              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6 }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/echo-local-logo.png"
              alt="Echo Local"
              style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 8 }}
            />
            <div>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                color: 'var(--accent-teal)',
                letterSpacing: '-0.01em',
                textShadow: '0 0 20px rgba(0, 206, 209, 0.3)',
              }}>
                Echo Local
              </div>
              <div style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                marginTop: 1,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Client Tracker
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Client list */}
      <div style={{ padding: collapsed ? '16px 10px' : '20px 16px', flex: 1, overflow: 'auto' }}>
        {!collapsed && (
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12,
            paddingLeft: 10,
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
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(0, 206, 209, 0.15) 0%, rgba(0, 206, 209, 0.06) 100%)'
                  : 'transparent',
                border: isActive ? '1px solid rgba(0, 206, 209, 0.2)' : '1px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                marginBottom: 4,
                transition: 'all 0.2s ease',
                textAlign: 'left',
                boxShadow: isActive ? '0 2px 12px rgba(0, 206, 209, 0.08)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: isActive
                    ? 'linear-gradient(135deg, var(--accent-teal) 0%, #009B9E 100%)'
                    : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                  border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: isActive ? '0 2px 8px rgba(0, 206, 209, 0.25)' : 'none',
                }}
              >
                {initials}
              </div>
              {!collapsed && (
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                  letterSpacing: '-0.01em',
                }}>
                  {client.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        style={{
          padding: '14px',
          border: 'none',
          borderTop: '1px solid rgba(0, 206, 209, 0.08)',
          background: 'rgba(0, 206, 209, 0.02)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 206, 209, 0.06)';
          e.currentTarget.style.color = 'var(--accent-teal)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 206, 209, 0.02)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        {collapsed ? '\u203A' : '\u2039'}
      </button>
    </aside>
  );
}
