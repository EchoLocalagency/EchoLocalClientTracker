'use client';

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '@/lib/supabase';
import { LeadProfile } from './LeadProfile';
import { StageTimeline } from './StageTimeline';
import { LeadChecklist } from './LeadChecklist';
import { CommsLog } from './CommsLog';
import type { PipelineLead, PipelineStageHistory, PipelineChecklistItem, PipelineComm } from '@/lib/types';

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: (lead: PipelineLead) => void;
}

export function LeadDrawer({ leadId, onClose, onLeadUpdated }: LeadDrawerProps) {
  const [lead, setLead] = useState<PipelineLead | null>(null);
  const [history, setHistory] = useState<PipelineStageHistory[]>([]);
  const [checklistItems, setChecklistItems] = useState<PipelineChecklistItem[]>([]);
  const [comms, setComms] = useState<PipelineComm[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all drawer data when leadId changes
  useEffect(() => {
    if (!leadId) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from('pipeline_leads').select('*').eq('id', leadId).single(),
      supabase.from('pipeline_stage_history').select('*').eq('lead_id', leadId).order('transitioned_at', { ascending: true }),
      supabase.from('pipeline_checklist_items').select('*').eq('lead_id', leadId),
      supabase.from('pipeline_comms').select('*').eq('lead_id', leadId).order('occurred_at', { ascending: false }),
    ]).then(([leadRes, historyRes, checklistRes, commsRes]) => {
      if (cancelled) return;
      setLead((leadRes.data as PipelineLead) || null);
      setHistory((historyRes.data as PipelineStageHistory[]) || []);
      setChecklistItems((checklistRes.data as PipelineChecklistItem[]) || []);
      setComms((commsRes.data as PipelineComm[]) || []);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [leadId]);

  // Escape key handler
  useEffect(() => {
    if (!leadId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [leadId, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!leadId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [leadId]);

  if (!leadId) return null;

  function handleFieldSaved(updated: PipelineLead) {
    setLead(updated);
    onLeadUpdated(updated);
  }

  const content = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(560px, 100vw)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 101,
          overflowY: 'auto',
          padding: '24px 28px',
        }}
      >
        {loading || !lead ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            Loading...
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {lead.contact_name}
                </div>
                {lead.company_name && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {lead.company_name}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
                aria-label="Close drawer"
              >
                X
              </button>
            </div>

            {/* Profile */}
            <LeadProfile lead={lead} onFieldSaved={handleFieldSaved} />

            {/* Stage Timeline */}
            <StageTimeline history={history} />

            {/* Checklist */}
            <LeadChecklist lead={lead} items={checklistItems} setItems={setChecklistItems} />

            {/* Communications */}
            <CommsLog leadId={lead.id} comms={comms} setComms={setComms} />
          </>
        )}
      </div>
    </>
  );

  return ReactDOM.createPortal(content, document.body);
}
