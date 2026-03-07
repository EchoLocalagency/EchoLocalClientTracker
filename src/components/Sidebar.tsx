'use client';

import { Client } from '@/lib/types';

interface SidebarProps {
  clients: Client[];
  activeClient: Client | null;
  onSelectClient: (client: Client) => void;
  collapsed: boolean;
  onToggle: () => void;
  onSignOut?: () => void;
}

export default function Sidebar({ clients, activeClient, onSelectClient, collapsed, onToggle, onSignOut }: SidebarProps) {
  return (
    <aside
      style={{
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
      }}
    >
      {/* Logo / Brand */}
      <div style={{
        padding: collapsed ? '20px 12px' : '24px 24px',
        borderBottom: '1px solid var(--border)',
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
                color: 'var(--accent)',
                letterSpacing: '-0.01em',
              }}>
                Echo Local
              </div>
              <div style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
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
            color: 'var(--text-secondary)',
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
                  ? 'rgba(6, 182, 212, 0.08)'
                  : 'transparent',
                border: isActive ? '1px solid rgba(6, 182, 212, 0.15)' : '1px solid transparent',
                borderRadius: 8,
                cursor: 'pointer',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                marginBottom: 4,
                transition: 'all 0.2s ease',
                textAlign: 'left',
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
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: isActive
                    ? 'var(--accent)'
                    : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                  border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
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

      {/* Engine links */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <a
          href="/agents"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '12px 0' : '12px 24px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: '#FF6B35',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 107, 53, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {collapsed ? 'AG' : 'Agents \u203A'}
        </a>
        <a
          href="/seo-engine"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '12px 0' : '12px 24px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--success)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 230, 118, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {collapsed ? 'SE' : 'SEO Engine \u203A'}
        </a>
        <a
          href="/sales-engine"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '12px 0' : '12px 24px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {collapsed ? 'SA' : 'Sales Engine \u203A'}
        </a>
      </div>

      {/* Sign out */}
      {onSignOut && (
        <button
          onClick={onSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '12px 0' : '12px 24px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
            border: 'none',
            borderTop: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 61, 87, 0.08)';
            e.currentTarget.style.color = '#FF3D57';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {collapsed ? 'X' : 'Sign Out'}
        </button>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        style={{
          padding: '14px',
          border: 'none',
          borderTop: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(6, 182, 212, 0.06)';
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
