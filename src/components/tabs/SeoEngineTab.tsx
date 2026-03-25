'use client';

import { useState } from 'react';
import { SeoAction, SeoBrainDecision, SeoEngineSubTab, TrackedKeyword, KeywordSnapshot, GscQuery } from '@/lib/types';
import ActionFeed from '@/components/seo-engine/ActionFeed';
import BrainDecisions from '@/components/seo-engine/BrainDecisions';
import KeywordTracker from '@/components/seo-engine/KeywordTracker';
import OutcomePatterns from '@/components/seo-engine/OutcomePatterns';

interface SeoEngineTabProps {
  actions: SeoAction[];
  decisions: SeoBrainDecision[];
  trackedKeywords: TrackedKeyword[];
  keywordSnapshots: KeywordSnapshot[];
  gscHistory: GscQuery[];
  clientName?: string;
}

const subTabs: { id: SeoEngineSubTab; label: string }[] = [
  { id: 'action-feed', label: 'Action Feed' },
  { id: 'brain-decisions', label: 'Brain Decisions' },
  { id: 'keyword-tracker', label: 'Keyword Tracker' },
  { id: 'outcome-patterns', label: 'Outcome Patterns' },
];

export default function SeoEngineTab({ actions, decisions, trackedKeywords, keywordSnapshots, gscHistory, clientName }: SeoEngineTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SeoEngineSubTab>('action-feed');

  return (
    <div>
      {/* Sub-nav pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid',
              borderColor: activeSubTab === tab.id ? 'var(--accent)' : 'var(--border)',
              borderRadius: 20,
              background: activeSubTab === tab.id ? 'rgba(232, 255, 0, 0.1)' : 'transparent',
              color: activeSubTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (activeSubTab !== tab.id) {
                e.currentTarget.style.borderColor = 'var(--accent-border)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeSubTab !== tab.id) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'action-feed' && <ActionFeed actions={actions} />}
      {activeSubTab === 'brain-decisions' && <BrainDecisions decisions={decisions} />}
      {activeSubTab === 'keyword-tracker' && <KeywordTracker actions={actions} trackedKeywords={trackedKeywords} keywordSnapshots={keywordSnapshots} gscHistory={gscHistory} clientName={clientName} />}
      {activeSubTab === 'outcome-patterns' && <OutcomePatterns actions={actions} />}
    </div>
  );
}
