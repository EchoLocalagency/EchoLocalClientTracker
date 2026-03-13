'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PipelineComm, CommType } from '@/lib/types';

interface CommsLogProps {
  leadId: string;
  comms: PipelineComm[];
  setComms: React.Dispatch<React.SetStateAction<PipelineComm[]>>;
}

export function CommsLog({ leadId, comms, setComms }: CommsLogProps) {
  const [commType, setCommType] = useState<CommType>('call');
  const [commNotes, setCommNotes] = useState('');
  const [commDate, setCommDate] = useState(new Date().toISOString().slice(0, 16));

  async function addComm() {
    const optimisticId = crypto.randomUUID();
    const optimisticEntry: PipelineComm = {
      id: optimisticId,
      lead_id: leadId,
      comm_type: commType,
      direction: 'outbound',
      notes: commNotes || null,
      occurred_at: new Date(commDate).toISOString(),
      created_at: new Date().toISOString(),
    };

    // Optimistic prepend
    setComms(prev => [optimisticEntry, ...prev]);

    // Reset form
    setCommType('call');
    setCommNotes('');
    setCommDate(new Date().toISOString().slice(0, 16));

    const { data, error } = await supabase
      .from('pipeline_comms')
      .insert({
        lead_id: leadId,
        comm_type: optimisticEntry.comm_type,
        direction: 'outbound',
        notes: optimisticEntry.notes,
        occurred_at: optimisticEntry.occurred_at,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add comm entry:', error);
      setComms(prev => prev.filter(c => c.id !== optimisticId));
      return;
    }

    // Replace optimistic entry with real DB row
    if (data) {
      setComms(prev => prev.map(c => c.id === optimisticId ? (data as PipelineComm) : c));
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-depth)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, marginTop: 24 }}>
        Communications
      </div>

      {/* Add entry form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <select
          value={commType}
          onChange={e => setCommType(e.target.value as CommType)}
          style={inputStyle}
        >
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="text">Text</option>
        </select>

        <textarea
          value={commNotes}
          onChange={e => setCommNotes(e.target.value)}
          placeholder="Notes..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <input
          type="datetime-local"
          value={commDate}
          onChange={e => setCommDate(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={addComm}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg-surface)',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Add Entry
        </button>
      </div>

      {/* Timeline */}
      {comms.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No communications yet</div>
      ) : (
        comms.map(comm => (
          <div
            key={comm.id}
            style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}
          >
            <div style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--bg-depth)',
              color: 'var(--text-secondary)',
              height: 'fit-content',
            }}>
              {comm.comm_type}
            </div>
            <div>
              <div style={{ fontSize: 13, color: comm.notes ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {comm.notes || 'No notes'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {new Date(comm.occurred_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
