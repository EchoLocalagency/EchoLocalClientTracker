'use client';

import { SeoEngineTabId } from '@/lib/types';

interface SeoTab {
  id: SeoEngineTabId;
  label: string;
}

const tabs: SeoTab[] = [
  { id: 'clients', label: 'Clients' },
  { id: 'actions', label: 'Action Feed' },
  { id: 'brain', label: 'Brain Decisions' },
  { id: 'keywords', label: 'Keywords' },
];

interface SeoTabNavProps {
  activeTab: SeoEngineTabId;
  onTabChange: (tab: SeoEngineTabId) => void;
}

export default function SeoTabNav({ activeTab, onTabChange }: SeoTabNavProps) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--border)',
      marginBottom: 24,
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === tab.id
              ? '2px solid var(--accent)'
              : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: activeTab === tab.id ? 600 : 400,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
