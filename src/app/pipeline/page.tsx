'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { PIPELINE_STAGES, STAGE_CHECKLIST_DEFAULTS } from '@/lib/pipeline-constants';
import type { PipelineLead, PipelineStage } from '@/lib/types';

type SortField = 'contact_name' | 'stage' | 'trade' | 'source' | 'days_in_stage' | 'checklist' | 'last_contact' | 'created_at';

function daysInStage(lead: PipelineLead): number {
  return Math.floor((Date.now() - new Date(lead.stage_entered_at).getTime()) / 86400000);
}

export default function PipelinePage() {
  const { profile, loading: authLoading, isAdmin } = useAuth();

  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [lastContact, setLastContact] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    async function fetchData() {
      setLoading(true);
      const [leadsRes, checklistRes, commsRes] = await Promise.all([
        supabase.from('pipeline_leads').select('*').order('created_at', { ascending: false }),
        supabase.from('pipeline_checklist_items').select('lead_id, completed'),
        supabase.from('pipeline_comms').select('lead_id, occurred_at').order('occurred_at', { ascending: false }),
      ]);

      const fetchedLeads = (leadsRes.data || []) as PipelineLead[];
      setLeads(fetchedLeads);

      // Process checklist progress
      const progress: Record<string, { done: number; total: number }> = {};
      for (const item of (checklistRes.data || [])) {
        if (!progress[item.lead_id]) {
          progress[item.lead_id] = { done: 0, total: 0 };
        }
        progress[item.lead_id].total += 1;
        if (item.completed) progress[item.lead_id].done += 1;
      }
      // For leads with no checklist items, set denominator from defaults
      for (const lead of fetchedLeads) {
        if (!progress[lead.id]) {
          progress[lead.id] = { done: 0, total: STAGE_CHECKLIST_DEFAULTS[lead.stage].length };
        }
      }
      setChecklistProgress(progress);

      // Process last contact -- first per lead_id is latest due to order
      const contact: Record<string, string> = {};
      for (const comm of (commsRes.data || [])) {
        if (!contact[comm.lead_id]) {
          contact[comm.lead_id] = comm.occurred_at;
        }
      }
      setLastContact(contact);

      setLoading(false);
    }

    fetchData();
  }, [isAdmin]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) counts[stage] = 0;
    for (const lead of leads) counts[lead.stage] = (counts[lead.stage] || 0) + 1;
    return counts;
  }, [leads]);

  const sortedLeads = useMemo(() => {
    let filtered = stageFilter === 'all' ? leads : leads.filter(l => l.stage === stageFilter);

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'contact_name':
          cmp = (a.contact_name ?? '').localeCompare(b.contact_name ?? '');
          break;
        case 'stage': {
          const ai = PIPELINE_STAGES.indexOf(a.stage);
          const bi = PIPELINE_STAGES.indexOf(b.stage);
          cmp = ai - bi;
          break;
        }
        case 'trade':
          cmp = (a.trade ?? '').localeCompare(b.trade ?? '');
          break;
        case 'source':
          cmp = (a.source ?? '').localeCompare(b.source ?? '');
          break;
        case 'days_in_stage':
          cmp = new Date(a.stage_entered_at).getTime() - new Date(b.stage_entered_at).getTime();
          break;
        case 'checklist': {
          const aP = checklistProgress[a.id];
          const bP = checklistProgress[b.id];
          const aRatio = aP && aP.total > 0 ? aP.done / aP.total : 0;
          const bRatio = bP && bP.total > 0 ? bP.done / bP.total : 0;
          cmp = aRatio - bRatio;
          break;
        }
        case 'last_contact': {
          const aT = lastContact[a.id] ? new Date(lastContact[a.id]).getTime() : 0;
          const bT = lastContact[b.id] ? new Date(lastContact[b.id]).getTime() : 0;
          cmp = aT - bT;
          break;
        }
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [leads, stageFilter, sortField, sortDir, checklistProgress, lastContact]);

  async function changeStage(leadId: string, currentStage: PipelineStage, newStage: PipelineStage) {
    if (currentStage === newStage) return;

    const now = new Date().toISOString();
    const prevLeads = [...leads];

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, stage: newStage, stage_entered_at: now, updated_at: now } : l
    ));

    // Update checklist denominator for new stage
    setChecklistProgress(prev => ({
      ...prev,
      [leadId]: { done: 0, total: STAGE_CHECKLIST_DEFAULTS[newStage].length },
    }));

    const { error: updateError } = await supabase
      .from('pipeline_leads')
      .update({ stage: newStage, stage_entered_at: now, updated_at: now })
      .eq('id', leadId);

    if (updateError) {
      console.error('Failed to update lead stage:', updateError);
      setLeads(prevLeads);
      return;
    }

    const { error: historyError } = await supabase
      .from('pipeline_stage_history')
      .insert({ lead_id: leadId, previous_stage: currentStage, new_stage: newStage });

    if (historyError) {
      console.error('Failed to create stage history:', historyError);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Access denied
      </div>
    );
  }

  const sortArrow = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  const thStyle = (field: SortField): React.CSSProperties => ({
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    userSelect: 'none' as const,
    borderBottom: '1px solid var(--border)',
    color: sortField === field ? 'var(--accent)' : 'var(--text-secondary)',
  });

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--text-primary)' }}>
        Pipeline
      </h1>

      {/* Stage summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {PIPELINE_STAGES.map(stage => (
          <div
            key={stage}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: '16px 20px',
              flex: 1,
              minWidth: 120,
            }}
          >
            <div style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {stage}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>
              {stageCounts[stage] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Stage filter dropdown */}
      <div style={{ marginTop: 20, marginBottom: 12 }}>
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value as PipelineStage | 'all')}
          style={{
            background: 'var(--bg-depth)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <option value="all">All Stages</option>
          {PIPELINE_STAGES.map(stage => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>
      </div>

      {/* Pipeline table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          Loading pipeline...
        </div>
      ) : sortedLeads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          No pipeline leads yet
        </div>
      ) : (
        <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle('contact_name')} onClick={() => handleSort('contact_name')}>
                  Name{sortArrow('contact_name')}
                </th>
                <th style={thStyle('stage')} onClick={() => handleSort('stage')}>
                  Stage{sortArrow('stage')}
                </th>
                <th style={thStyle('trade')} onClick={() => handleSort('trade')}>
                  Trade{sortArrow('trade')}
                </th>
                <th style={thStyle('source')} onClick={() => handleSort('source')}>
                  Source{sortArrow('source')}
                </th>
                <th style={thStyle('days_in_stage')} onClick={() => handleSort('days_in_stage')}>
                  Days{sortArrow('days_in_stage')}
                </th>
                <th style={thStyle('checklist')} onClick={() => handleSort('checklist')}>
                  Checklist{sortArrow('checklist')}
                </th>
                <th style={thStyle('last_contact')} onClick={() => handleSort('last_contact')}>
                  Last Contact{sortArrow('last_contact')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLeads.map(lead => (
                <tr
                  key={lead.id}
                  onMouseEnter={() => setHoveredRow(lead.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: hoveredRow === lead.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}
                >
                  <td style={tdStyle}>
                    <div style={{ color: 'var(--text-primary)' }}>{lead.contact_name}</div>
                    {lead.company_name && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {lead.company_name}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={lead.stage}
                      onChange={e => changeStage(lead.id, lead.stage, e.target.value as PipelineStage)}
                      style={{
                        background: 'var(--bg-depth)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {PIPELINE_STAGES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{lead.trade || '--'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{lead.source || '--'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-primary)' }}>{daysInStage(lead)}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                    {checklistProgress[lead.id]
                      ? `${checklistProgress[lead.id].done}/${checklistProgress[lead.id].total}`
                      : `0/${STAGE_CHECKLIST_DEFAULTS[lead.stage].length}`}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                    {lastContact[lead.id]
                      ? new Date(lastContact[lead.id]).toLocaleDateString()
                      : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
