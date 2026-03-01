'use client';

import { useState } from 'react';
import { Client } from '@/lib/types';
import { seo } from '@/lib/seo-theme';
import { supabase } from '@/lib/supabase';
import ClientForm from './ClientForm';

interface ClientManagerProps {
  clients: Client[];
  activeClient: Client | null;
  onSelectClient: (client: Client) => void;
  onClientSaved: () => void;
}

export default function ClientManager({ clients, activeClient, onSelectClient, onClientSaved }: ClientManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  function handleAdd() {
    setEditingClient(null);
    setShowForm(true);
  }

  function handleEdit(client: Client) {
    setEditingClient(client);
    setShowForm(true);
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      console.error('Delete error:', error);
      return;
    }
    onClientSaved();
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingClient(null);
  }

  function handleFormSaved() {
    setShowForm(false);
    setEditingClient(null);
    onClientSaved();
  }

  if (showForm) {
    return (
      <ClientForm
        client={editingClient}
        onSave={handleFormSaved}
        onCancel={handleFormClose}
      />
    );
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: seo.textMuted }}>
          {clients.length} client{clients.length !== 1 ? 's' : ''} configured
        </div>
        <button
          onClick={handleAdd}
          style={{
            padding: '8px 20px',
            fontSize: 12, fontWeight: 600,
            fontFamily: seo.fontMono,
            background: seo.accent,
            color: seo.bg,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = seo.accentDim; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = seo.accent; }}
        >
          + Add Client
        </button>
      </div>

      {/* Client cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 16,
      }}>
        {clients.map(client => {
          const isActive = activeClient?.id === client.id;
          return (
            <div
              key={client.id}
              style={{
                background: seo.surface,
                border: `1px solid ${isActive ? seo.accentBorder : seo.border}`,
                borderRadius: seo.radiusCard,
                padding: '20px 24px',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                boxShadow: isActive ? seo.shadowGlow : 'none',
              }}
              onClick={() => onSelectClient(client)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = seo.accentBorder;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = seo.border;
                }
              }}
            >
              {/* Client header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: seo.text, marginBottom: 4 }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: 11, color: seo.textMuted, fontFamily: seo.fontMono }}>
                    {client.slug}
                  </div>
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 700, fontFamily: seo.fontMono,
                  padding: '3px 10px', borderRadius: 12,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: client.seo_engine_enabled ? seo.accentGlow : 'rgba(255,255,255,0.05)',
                  color: client.seo_engine_enabled ? seo.accent : seo.textMuted,
                }}>
                  {client.seo_engine_enabled ? 'Active' : 'Inactive'}
                </div>
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <InfoItem label="Website" value={client.website} />
                <InfoItem label="Market" value={client.primary_market} />
                <InfoItem label="GA4" value={client.ga4_property} />
                <InfoItem label="GSC" value={client.gsc_url ? 'Connected' : null} />
              </div>

              {/* Keywords */}
              {client.target_keywords && client.target_keywords.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                  {client.target_keywords.slice(0, 4).map((kw, i) => (
                    <span key={i} style={{
                      fontSize: 9, fontFamily: seo.fontMono,
                      padding: '2px 8px', borderRadius: 6,
                      background: seo.deep, color: seo.textMuted,
                      border: `1px solid ${seo.border}`,
                    }}>
                      {kw}
                    </span>
                  ))}
                  {client.target_keywords.length > 4 && (
                    <span style={{ fontSize: 9, color: seo.textMuted, fontFamily: seo.fontMono, padding: '2px 4px' }}>
                      +{client.target_keywords.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(client); }}
                  style={{
                    padding: '6px 14px', fontSize: 11, fontWeight: 600,
                    fontFamily: seo.fontMono,
                    background: 'transparent',
                    border: `1px solid ${seo.border}`,
                    borderRadius: 6, color: seo.textMuted, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = seo.accentBorder;
                    e.currentTarget.style.color = seo.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = seo.border;
                    e.currentTarget.style.color = seo.textMuted;
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(client); }}
                  style={{
                    padding: '6px 14px', fontSize: 11, fontWeight: 600,
                    fontFamily: seo.fontMono,
                    background: 'transparent',
                    border: `1px solid ${seo.border}`,
                    borderRadius: 6, color: seo.textMuted, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 82, 82, 0.4)';
                    e.currentTarget.style.color = seo.danger;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = seo.border;
                    e.currentTarget.style.color = seo.textMuted;
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: seo.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, fontFamily: seo.fontMono,
        color: value ? seo.text : 'rgba(129, 199, 132, 0.3)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value || '--'}
      </div>
    </div>
  );
}
