'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { PipelineLead } from '@/lib/types';

type EditableField = 'contact_name' | 'email' | 'phone' | 'company_name' | 'trade' | 'source' | 'notes';

const FIELDS: { key: EditableField; label: string }[] = [
  { key: 'contact_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company_name', label: 'Company' },
  { key: 'trade', label: 'Trade' },
  { key: 'source', label: 'Source' },
  { key: 'notes', label: 'Notes' },
];

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  padding: '4px 0',
};

const emptyStyle: React.CSSProperties = {
  ...valueStyle,
  color: 'var(--text-secondary)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-depth)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 14,
  color: 'var(--text-primary)',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
};

interface LeadProfileProps {
  lead: PipelineLead;
  onFieldSaved: (updated: PipelineLead) => void;
}

export function LeadProfile({ lead, onFieldSaved }: LeadProfileProps) {
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [draft, setDraft] = useState('');
  const prevValueRef = useRef<string>('');

  function startEditing(field: EditableField) {
    const current = lead[field] ?? '';
    setEditing(field);
    setDraft(String(current));
    prevValueRef.current = String(current);
  }

  async function saveField() {
    if (!editing) return;
    const field = editing;
    setEditing(null);

    if (draft === prevValueRef.current) return;

    const updatedValue = draft.trim() || null;
    const updatedLead = { ...lead, [field]: updatedValue, updated_at: new Date().toISOString() };

    // Optimistic update
    onFieldSaved(updatedLead);

    const { error } = await supabase
      .from('pipeline_leads')
      .update({ [field]: updatedValue, updated_at: new Date().toISOString() })
      .eq('id', lead.id);

    if (error) {
      console.error(`Failed to update ${field}:`, error);
      // Revert
      onFieldSaved({ ...lead });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, field: EditableField) {
    if (field === 'notes') return; // notes uses blur only
    if (e.key === 'Enter') {
      saveField();
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <div style={labelStyle}>{label}</div>
          {editing === key ? (
            key === 'notes' ? (
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={saveField}
                onKeyDown={e => { if (e.key === 'Escape') setEditing(null); }}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            ) : (
              <input
                autoFocus
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={saveField}
                onKeyDown={e => handleKeyDown(e, key)}
                style={inputStyle}
              />
            )
          ) : (
            <div
              onClick={() => startEditing(key)}
              style={lead[key] ? valueStyle : emptyStyle}
            >
              {lead[key] ? String(lead[key]) : '--'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
