'use client';

import { TabId } from '@/lib/types';

interface Tab {
  id: TabId;
  label: string;
  disabled?: boolean;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'seo', label: 'SEO Performance' },
  { id: 'conversions', label: 'Conversions' },
  { id: 'gbp', label: 'GBP' },
  { id: 'geo', label: 'GEO' },
  { id: 'seo-engine', label: 'SEO Engine' },
  { id: 'agents', label: 'Agents' },
];

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isAdmin?: boolean;
}

export default function TabNav({ activeTab, onTabChange, isAdmin = false }: TabNavProps) {
  const visibleTabs = isAdmin ? tabs : tabs.filter(t => t.id !== 'seo-engine' && t.id !== 'agents');

  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab.disabled
              ? 'rgba(138, 143, 152, 0.4)'
              : activeTab === tab.id
              ? 'var(--accent)'
              : 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: activeTab === tab.id ? 600 : 400,
            cursor: tab.disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!tab.disabled && activeTab !== tab.id) {
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!tab.disabled && activeTab !== tab.id) {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          {tab.label}
          {tab.disabled && (
            <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.5 }}>soon</span>
          )}
        </button>
      ))}
    </div>
  );
}
