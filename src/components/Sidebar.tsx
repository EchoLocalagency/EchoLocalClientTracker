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
        width: collapsed ? 60 : 240,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 50,
      }}
    >
      {/* Logo / Brand */}
      <div style={{ padding: collapsed ? '16px 12px' : '20px 20px', borderBottom: '1px solid var(--border)' }}>
        {collapsed ? (
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-teal)', textAlign: 'center' }}>E</div>
        ) : (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-teal)', letterSpacing: '-0.02em' }}>
              Echo Local
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Client Tracker</div>
          </div>
        )}
      </div>

      {/* Client list */}
      <div style={{ padding: collapsed ? '12px 8px' : '16px 12px', flex: 1, overflow: 'auto' }}>
        {!collapsed && (
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 8 }}>
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
                gap: 10,
                width: '100%',
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'rgba(0, 206, 209, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                color: isActive ? 'var(--accent-teal)' : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                marginBottom: 4,
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: isActive ? 'var(--accent-teal)' : 'var(--border)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</span>}
            </button>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        style={{
          padding: '12px',
          border: 'none',
          borderTop: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 16,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {collapsed ? '\u203A' : '\u2039'}
      </button>
    </aside>
  );
}
