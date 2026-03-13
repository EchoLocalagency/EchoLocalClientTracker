'use client';

import { supabase } from '@/lib/supabase';
import { STAGE_CHECKLIST_DEFAULTS } from '@/lib/pipeline-constants';
import type { PipelineLead, PipelineChecklistItem } from '@/lib/types';

interface LeadChecklistProps {
  lead: PipelineLead;
  items: PipelineChecklistItem[];
  setItems: React.Dispatch<React.SetStateAction<PipelineChecklistItem[]>>;
}

export function LeadChecklist({ lead, items, setItems }: LeadChecklistProps) {
  const defaults = STAGE_CHECKLIST_DEFAULTS[lead.stage] || [];

  // Merge DB items with defaults for current stage
  const dbMap = new Map<string, PipelineChecklistItem>();
  for (const item of items) {
    if (item.stage === lead.stage) {
      dbMap.set(item.item_key, item);
    }
  }

  const merged = defaults.map(d => {
    const existing = dbMap.get(d.key);
    if (existing) return existing;
    return {
      id: `synthetic-${d.key}`,
      lead_id: lead.id,
      stage: lead.stage,
      item_key: d.key,
      item_label: d.label,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    } as PipelineChecklistItem;
  });

  const done = merged.filter(m => m.completed).length;
  const total = merged.length;

  async function toggleItem(item: PipelineChecklistItem) {
    const newValue = !item.completed;
    const prevItems = [...items];

    // Optimistic update
    setItems(prev => {
      // If it was synthetic, add it to the array
      if (item.id.startsWith('synthetic-')) {
        return [...prev, { ...item, completed: newValue, completed_at: newValue ? new Date().toISOString() : null }];
      }
      return prev.map(i => i.id === item.id ? { ...i, completed: newValue, completed_at: newValue ? new Date().toISOString() : null } : i);
    });

    const { error } = await supabase
      .from('pipeline_checklist_items')
      .upsert(
        {
          lead_id: lead.id,
          stage: lead.stage,
          item_key: item.item_key,
          item_label: item.item_label,
          completed: newValue,
          completed_at: newValue ? new Date().toISOString() : null,
        },
        { onConflict: 'lead_id,stage,item_key' }
      );

    if (error) {
      console.error('Failed to toggle checklist item:', error);
      setItems(prevItems);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, marginTop: 24 }}>
        Checklist
      </div>
      {merged.map(item => (
        <div
          key={item.item_key}
          style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}
        >
          <input
            type="checkbox"
            checked={item.completed}
            onChange={() => toggleItem(item)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
          <label
            onClick={() => toggleItem(item)}
            style={{
              fontSize: 13,
              color: item.completed ? 'var(--text-secondary)' : 'var(--text-primary)',
              textDecoration: item.completed ? 'line-through' : 'none',
              cursor: 'pointer',
            }}
          >
            {item.item_label}
          </label>
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
        {done}/{total} complete
      </div>
    </div>
  );
}
