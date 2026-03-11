'use client';

import { useState, useEffect } from 'react';
import { Directory } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import DirectoryRow from './DirectoryRow';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg-depth)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 4,
  display: 'block',
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 10,
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  textAlign: 'left' as const,
  borderBottom: '1px solid var(--border)',
};

const filterBtnBase: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

export default function DirectoryManager() {
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [captchaFilter, setCaptchaFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [newDir, setNewDir] = useState({
    name: '', domain: '', submission_url: '', tier: 2,
    trades: [] as string[], da_score: '' as string | number,
    submission_method: 'form', notes: '',
  });
  const [tradeInput, setTradeInput] = useState('');

  async function loadDirectories() {
    const { data, error } = await supabase
      .from('directories')
      .select('*')
      .order('tier', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Directories fetch error:', error);
    } else {
      setDirectories((data as Directory[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => { loadDirectories(); }, []);

  async function handleAdd() {
    if (!newDir.name.trim() || !newDir.domain.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('directories').insert({
      name: newDir.name.trim(),
      domain: newDir.domain.trim(),
      submission_url: newDir.submission_url.trim() || null,
      tier: newDir.tier,
      trades: newDir.trades,
      da_score: newDir.da_score ? Number(newDir.da_score) : null,
      submission_method: newDir.submission_method,
      notes: newDir.notes.trim() || null,
      captcha_status: 'unknown',
      enabled: true,
    });

    if (!error) {
      setShowAddForm(false);
      setNewDir({ name: '', domain: '', submission_url: '', tier: 2, trades: [], da_score: '', submission_method: 'form', notes: '' });
      loadDirectories();
    } else {
      console.error('Add directory error:', error);
    }
    setSaving(false);
  }

  const filtered = directories.filter((d) => {
    if (tierFilter !== null && d.tier !== tierFilter) return false;
    if (captchaFilter !== null && d.captcha_status !== captchaFilter) return false;
    return true;
  });

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Loading directories...</div>;
  }

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Directories
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
            {filtered.length} of {directories.length}
          </span>
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 600,
            fontFamily: 'var(--font-mono)', background: 'var(--accent)',
            color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          {showAddForm ? 'Cancel' : '+ Add Directory'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'All', value: null },
          { label: 'Tier 1', value: 1 },
          { label: 'Tier 2', value: 2 },
          { label: 'Tier 3', value: 3 },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => setTierFilter(f.value)}
            style={{
              ...filterBtnBase,
              background: tierFilter === f.value ? 'var(--accent)' : 'transparent',
              color: tierFilter === f.value ? '#000' : 'var(--text-secondary)',
              borderColor: tierFilter === f.value ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {f.label}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        {[
          { label: 'Any CAPTCHA', value: null },
          { label: 'No CAPTCHA', value: 'no_captcha' },
          { label: 'Simple', value: 'simple_captcha' },
          { label: 'Advanced', value: 'advanced_captcha' },
          { label: 'Unknown', value: 'unknown' },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => setCaptchaFilter(f.value)}
            style={{
              ...filterBtnBase,
              background: captchaFilter === f.value ? 'var(--accent)' : 'transparent',
              color: captchaFilter === f.value ? '#000' : 'var(--text-secondary)',
              borderColor: captchaFilter === f.value ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{
          marginBottom: 20, padding: 20,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
            Add New Directory
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={newDir.name}
                onChange={(e) => setNewDir({ ...newDir, name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Domain *</label>
              <input style={inputStyle} value={newDir.domain} placeholder="example.com"
                onChange={(e) => setNewDir({ ...newDir, domain: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Submission URL</label>
              <input style={inputStyle} value={newDir.submission_url}
                onChange={(e) => setNewDir({ ...newDir, submission_url: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Tier</label>
              <select style={inputStyle} value={newDir.tier}
                onChange={(e) => setNewDir({ ...newDir, tier: parseInt(e.target.value) })}>
                <option value={1}>Tier 1 (DA 50+)</option>
                <option value={2}>Tier 2 (DA 30-50)</option>
                <option value={3}>Tier 3 (DA 10-30)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>DA Score</label>
              <input style={inputStyle} type="number" value={newDir.da_score}
                onChange={(e) => setNewDir({ ...newDir, da_score: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Submission Method</label>
              <select style={inputStyle} value={newDir.submission_method}
                onChange={(e) => setNewDir({ ...newDir, submission_method: e.target.value })}>
                <option value="form">Form</option>
                <option value="email">Email</option>
                <option value="api">API</option>
                <option value="manual">Manual</option>
                <option value="claim">Claim</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Trades</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
              {newDir.trades.map((t, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: 'var(--bg-depth)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {t}
                  <button onClick={() => {
                    const arr = [...newDir.trades];
                    arr.splice(i, 1);
                    setNewDir({ ...newDir, trades: arr });
                  }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 10, padding: 0 }}>
                    x
                  </button>
                </span>
              ))}
            </div>
            <input style={inputStyle} value={tradeInput}
              onChange={(e) => setTradeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tradeInput.trim()) {
                  e.preventDefault();
                  if (!newDir.trades.includes(tradeInput.trim())) {
                    setNewDir({ ...newDir, trades: [...newDir.trades, tradeInput.trim()] });
                  }
                  setTradeInput('');
                }
              }}
              placeholder="Type trade and press Enter"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Notes</label>
            <input style={inputStyle} value={newDir.notes}
              onChange={(e) => setNewDir({ ...newDir, notes: e.target.value })} />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !newDir.name.trim() || !newDir.domain.trim()}
            style={{
              padding: '8px 20px', fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-mono)', background: 'var(--accent)',
              color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer',
              opacity: saving || !newDir.name.trim() || !newDir.domain.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Adding...' : 'Add Directory'}
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', overflow: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Domain</th>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Trades</th>
              <th style={thStyle}>DA</th>
              <th style={thStyle}>CAPTCHA</th>
              <th style={thStyle}>Enabled</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dir) => (
              <DirectoryRow key={dir.id} directory={dir} onUpdate={loadDirectories} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            No directories match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
