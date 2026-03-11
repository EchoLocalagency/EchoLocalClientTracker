'use client';

import { useState, useEffect } from 'react';
import { ClientProfile } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface ClientProfileFormProps {
  clientId: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: 'vertical' as const,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 4,
  display: 'block',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: 20,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 16,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border)',
};

export default function ClientProfileForm({ clientId }: ClientProfileFormProps) {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tagInput, setTagInput] = useState({ services: '', certifications: '', payment_methods: '' });
  const [socialKey, setSocialKey] = useState('');
  const [socialVal, setSocialVal] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (error || !data) {
        setProfile(null);
      } else {
        setProfile(data as ClientProfile);
      }
      setLoading(false);
    }
    load();
  }, [clientId]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const { id, client_id, created_at, updated_at, ...updates } = profile;
    const { error } = await supabase
      .from('client_profiles')
      .update(updates)
      .eq('client_id', clientId);

    if (error) {
      console.error('Save error:', error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  function update(field: keyof ClientProfile, value: unknown) {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  }

  function addTag(field: 'services' | 'certifications' | 'payment_methods') {
    const val = tagInput[field].trim();
    if (!val || !profile) return;
    const arr = [...(profile[field] || [])];
    if (!arr.includes(val)) arr.push(val);
    update(field, arr);
    setTagInput({ ...tagInput, [field]: '' });
  }

  function removeTag(field: 'services' | 'certifications' | 'payment_methods', idx: number) {
    if (!profile) return;
    const arr = [...(profile[field] || [])];
    arr.splice(idx, 1);
    update(field, arr);
  }

  function addSocialLink() {
    if (!socialKey.trim() || !socialVal.trim() || !profile) return;
    const links = { ...(profile.social_links || {}), [socialKey.trim()]: socialVal.trim() };
    update('social_links', links);
    setSocialKey('');
    setSocialVal('');
  }

  function removeSocialLink(key: string) {
    if (!profile) return;
    const links = { ...(profile.social_links || {}) };
    delete links[key];
    update('social_links', links);
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>
        No profile found -- run seed script first.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Client Profile
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {saved && (
            <span style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
              Saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = 'var(--accent-dim)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* NAP Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Business Info (NAP)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Business Name *</label>
            <input
              style={inputStyle}
              value={profile.business_name}
              onChange={(e) => update('business_name', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              value={profile.phone || ''}
              onChange={(e) => update('phone', e.target.value || null)}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              value={profile.email || ''}
              onChange={(e) => update('email', e.target.value || null)}
            />
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input
              style={inputStyle}
              value={profile.website || ''}
              onChange={(e) => update('website', e.target.value || null)}
            />
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Address</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Street</label>
            <input
              style={inputStyle}
              value={profile.address_street || ''}
              onChange={(e) => update('address_street', e.target.value || null)}
            />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input
              style={inputStyle}
              value={profile.address_city || ''}
              onChange={(e) => update('address_city', e.target.value || null)}
            />
          </div>
          <div>
            <label style={labelStyle}>State</label>
            <input
              style={inputStyle}
              value={profile.address_state || ''}
              onChange={(e) => update('address_state', e.target.value || null)}
            />
          </div>
          <div>
            <label style={labelStyle}>ZIP</label>
            <input
              style={inputStyle}
              value={profile.address_zip || ''}
              onChange={(e) => update('address_zip', e.target.value || null)}
            />
          </div>
        </div>
      </div>

      {/* Descriptions Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Descriptions</div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Full Description</label>
          <textarea
            style={textareaStyle}
            value={profile.description || ''}
            onChange={(e) => update('description', e.target.value || null)}
          />
        </div>
        <div>
          <label style={labelStyle}>Short Description</label>
          <textarea
            style={{ ...textareaStyle, minHeight: 50 }}
            value={profile.short_description || ''}
            onChange={(e) => update('short_description', e.target.value || null)}
          />
        </div>
      </div>

      {/* Services Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Services</div>
        <TagInput
          tags={profile.services || []}
          value={tagInput.services}
          onChange={(v) => setTagInput({ ...tagInput, services: v })}
          onAdd={() => addTag('services')}
          onRemove={(i) => removeTag('services', i)}
          placeholder="Add a service and press Enter"
        />
      </div>

      {/* Certifications Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Certifications</div>
        <TagInput
          tags={profile.certifications || []}
          value={tagInput.certifications}
          onChange={(v) => setTagInput({ ...tagInput, certifications: v })}
          onAdd={() => addTag('certifications')}
          onRemove={(i) => removeTag('certifications', i)}
          placeholder="Add a certification and press Enter"
        />
      </div>

      {/* Payment Methods Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Payment Methods</div>
        <TagInput
          tags={profile.payment_methods || []}
          value={tagInput.payment_methods}
          onChange={(v) => setTagInput({ ...tagInput, payment_methods: v })}
          onAdd={() => addTag('payment_methods')}
          onRemove={(i) => removeTag('payment_methods', i)}
          placeholder="Add a payment method and press Enter"
        />
      </div>

      {/* Hours Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Business Hours</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          {DAYS.map((day) => (
            <div key={day} style={{ display: 'contents' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', marginBottom: 0 }}>
                {day}
              </label>
              <input
                style={inputStyle}
                value={(profile.hours || {})[day] || ''}
                placeholder="e.g. 8:00 AM - 5:00 PM"
                onChange={(e) => {
                  const hours = { ...(profile.hours || {}), [day]: e.target.value };
                  update('hours', hours);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Social Links Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Social Links</div>
        {Object.entries(profile.social_links || {}).map(([key, url]) => (
          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 100 }}>
              {key}
            </span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {url}
            </span>
            <button
              onClick={() => removeSocialLink(key)}
              style={{
                background: 'none', border: 'none', color: 'var(--danger)',
                cursor: 'pointer', fontSize: 14, padding: '2px 6px',
              }}
            >
              x
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            style={{ ...inputStyle, width: 120 }}
            placeholder="Platform"
            value={socialKey}
            onChange={(e) => setSocialKey(e.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="URL"
            value={socialVal}
            onChange={(e) => setSocialVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSocialLink(); }}
          />
          <button
            onClick={addSocialLink}
            style={{
              padding: '8px 14px', fontSize: 11, fontWeight: 600,
              fontFamily: 'var(--font-mono)', background: 'var(--bg-depth)',
              border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Other Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Other</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Year Established</label>
            <input
              style={inputStyle}
              type="number"
              value={profile.year_established || ''}
              onChange={(e) => update('year_established', e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
          <div>
            <label style={labelStyle}>Logo URL</label>
            <input
              style={inputStyle}
              value={profile.logo_url || ''}
              onChange={(e) => update('logo_url', e.target.value || null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TagInput({
  tags,
  value,
  onChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {tags.map((tag, i) => (
          <span
            key={i}
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              padding: '4px 10px',
              borderRadius: 6,
              background: 'var(--bg-depth)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tag}
            <button
              onClick={() => onRemove(i)}
              style={{
                background: 'none', border: 'none', color: 'var(--danger)',
                cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1,
              }}
            >
              x
            </button>
          </span>
        ))}
      </div>
      <input
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
      />
    </div>
  );
}
