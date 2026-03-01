'use client';

import { useState } from 'react';
import { Client } from '@/lib/types';
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
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {clients.length} client{clients.length !== 1 ? 's' : ''} configured
        </div>
        <button
          onClick={handleAdd}
          style={{
            padding: '8px 20px',
            fontSize: 12, fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
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
                background: 'var(--bg-surface)',
                border: `1px solid ${isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-card)',
                padding: '20px 24px',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
              }}
              onClick={() => onSelectClient(client)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--accent-border)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
            >
              {/* Client header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {client.slug}
                  </div>
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  padding: '3px 10px', borderRadius: 12,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: client.seo_engine_enabled ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255,255,255,0.05)',
                  color: client.seo_engine_enabled ? 'var(--success)' : 'var(--text-secondary)',
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
                      fontSize: 9, fontFamily: 'var(--font-mono)',
                      padding: '2px 8px', borderRadius: 6,
                      background: 'var(--bg-depth)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}>
                      {kw}
                    </span>
                  ))}
                  {client.target_keywords.length > 4 && (
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}>
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
                    fontFamily: 'var(--font-mono)',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-border)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(client); }}
                  style={{
                    padding: '6px 14px', fontSize: 11, fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 61, 87, 0.4)';
                    e.currentTarget.style.color = 'var(--danger)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
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
      <div style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, fontFamily: 'var(--font-mono)',
        color: value ? 'var(--text-primary)' : 'rgba(138, 143, 152, 0.3)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value || '--'}
      </div>
    </div>
  );
}
