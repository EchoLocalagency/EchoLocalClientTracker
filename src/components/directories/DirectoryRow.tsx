'use client';

import { useState } from 'react';
import { Directory } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface DirectoryRowProps {
  directory: Directory;
  onUpdate: () => void;
}

const CAPTCHA_COLORS: Record<string, { bg: string; color: string }> = {
  no_captcha: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981' },
  simple_captcha: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' },
  advanced_captcha: { bg: 'rgba(255, 61, 87, 0.15)', color: '#FF3D57' },
  unknown: { bg: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)' },
};

const TIER_COLORS: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' },
  2: { bg: 'rgba(6, 182, 212, 0.15)', color: '#06B6D4' },
  3: { bg: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)' },
};

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const inlineInputStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg-depth)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
};

export default function DirectoryRow({ directory, onUpdate }: DirectoryRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tier: directory.tier,
    submission_url: directory.submission_url || '',
    captcha_status: directory.captcha_status,
    da_score: directory.da_score,
    trades: directory.trades || [],
    notes: directory.notes || '',
  });
  const [tradeInput, setTradeInput] = useState('');

  async function handleToggleEnabled() {
    const { error } = await supabase
      .from('directories')
      .update({ enabled: !directory.enabled })
      .eq('id', directory.id);
    if (!error) onUpdate();
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('directories')
      .update({
        tier: form.tier,
        submission_url: form.submission_url || null,
        captcha_status: form.captcha_status,
        da_score: form.da_score,
        trades: form.trades,
        notes: form.notes || null,
      })
      .eq('id', directory.id);

    if (!error) {
      setEditing(false);
      onUpdate();
    }
    setSaving(false);
  }

  function handleCancel() {
    setForm({
      tier: directory.tier,
      submission_url: directory.submission_url || '',
      captcha_status: directory.captcha_status,
      da_score: directory.da_score,
      trades: directory.trades || [],
      notes: directory.notes || '',
    });
    setEditing(false);
  }

  const captchaStyle = CAPTCHA_COLORS[directory.captcha_status] || CAPTCHA_COLORS.unknown;
  const tierStyle = TIER_COLORS[directory.tier] || TIER_COLORS[3];

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={cellStyle}>{directory.name}</td>
        <td style={cellStyle}>
          <a href={`https://${directory.domain}`} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {directory.domain}
          </a>
        </td>
        <td style={cellStyle}>
          <select
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: parseInt(e.target.value) })}
            style={{ ...inlineInputStyle, width: 60 }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </td>
        <td style={cellStyle}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {form.trades.map((t, i) => (
              <span key={i} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 4,
                background: 'var(--bg-depth)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {t}
                <button onClick={() => {
                  const arr = [...form.trades];
                  arr.splice(i, 1);
                  setForm({ ...form, trades: arr });
                }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 10, padding: 0 }}>
                  x
                </button>
              </span>
            ))}
          </div>
          <input
            style={{ ...inlineInputStyle, width: 100 }}
            value={tradeInput}
            onChange={(e) => setTradeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tradeInput.trim()) {
                e.preventDefault();
                if (!form.trades.includes(tradeInput.trim())) {
                  setForm({ ...form, trades: [...form.trades, tradeInput.trim()] });
                }
                setTradeInput('');
              }
            }}
            placeholder="Add trade"
          />
        </td>
        <td style={cellStyle}>
          <input
            style={{ ...inlineInputStyle, width: 50 }}
            type="number"
            value={form.da_score ?? ''}
            onChange={(e) => setForm({ ...form, da_score: e.target.value ? parseInt(e.target.value) : null })}
          />
        </td>
        <td style={cellStyle}>
          <select
            value={form.captcha_status}
            onChange={(e) => setForm({ ...form, captcha_status: e.target.value })}
            style={{ ...inlineInputStyle, width: 130 }}
          >
            <option value="unknown">Unknown</option>
            <option value="no_captcha">No CAPTCHA</option>
            <option value="simple_captcha">Simple</option>
            <option value="advanced_captcha">Advanced</option>
          </select>
        </td>
        <td style={cellStyle}>
          <button
            onClick={handleToggleEnabled}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: directory.enabled ? 'var(--success)' : 'var(--text-secondary)',
            }}
          >
            {directory.enabled ? 'On' : 'Off'}
          </button>
        </td>
        <td style={{ ...cellStyle, display: 'flex', gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 600,
              fontFamily: 'var(--font-mono)', background: 'var(--accent)',
              color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >
            {saving ? '...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 600,
              fontFamily: 'var(--font-mono)', background: 'none',
              color: 'var(--text-secondary)', border: '1px solid var(--border)',
              borderRadius: 4, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <td style={cellStyle}>
        <span style={{ fontWeight: 500 }}>{directory.name}</span>
      </td>
      <td style={cellStyle}>
        <a href={`https://${directory.domain}`} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}>
          {directory.domain}
        </a>
      </td>
      <td style={cellStyle}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: tierStyle.bg, color: tierStyle.color,
        }}>
          T{directory.tier}
        </span>
      </td>
      <td style={{ ...cellStyle, maxWidth: 160 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {(directory.trades || []).slice(0, 3).map((t, i) => (
            <span key={i} style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: 'var(--bg-depth)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}>
              {t}
            </span>
          ))}
          {(directory.trades || []).length > 3 && (
            <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
              +{directory.trades.length - 3}
            </span>
          )}
        </div>
      </td>
      <td style={cellStyle}>
        {directory.da_score ?? '--'}
      </td>
      <td style={cellStyle}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: captchaStyle.bg, color: captchaStyle.color,
          textTransform: 'uppercase' as const, letterSpacing: '0.03em',
        }}>
          {directory.captcha_status.replace(/_/g, ' ')}
        </span>
      </td>
      <td style={cellStyle}>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleEnabled(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            color: directory.enabled ? 'var(--success)' : 'var(--text-secondary)',
          }}
        >
          {directory.enabled ? 'On' : 'Off'}
        </button>
      </td>
      <td style={cellStyle}>
        <button
          onClick={() => setEditing(true)}
          style={{
            padding: '4px 10px', fontSize: 10, fontWeight: 600,
            fontFamily: 'var(--font-mono)', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--text-secondary)', cursor: 'pointer',
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
      </td>
    </tr>
  );
}
