'use client';

import { useState } from 'react';
import { Client } from '@/lib/types';
import { seo } from '@/lib/seo-theme';
import { supabase } from '@/lib/supabase';

interface ClientFormProps {
  client: Client | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  slug: string;
  website: string;
  phone: string;
  primary_market: string;
  ga4_property: string;
  ga4_measurement_id: string;
  gsc_url: string;
  gbp_location: string;
  drive_folder_id: string;
  website_local_path: string;
  ghl_token: string;
  ghl_location_id: string;
  ghl_form_name: string;
  target_keywords: string;
  service_areas: string;
  seo_engine_enabled: boolean;
}

function toFormData(client: Client | null): FormData {
  return {
    name: client?.name || '',
    slug: client?.slug || '',
    website: client?.website || '',
    phone: client?.phone || '',
    primary_market: client?.primary_market || '',
    ga4_property: client?.ga4_property || '',
    ga4_measurement_id: client?.ga4_measurement_id || '',
    gsc_url: client?.gsc_url || '',
    gbp_location: client?.gbp_location || '',
    drive_folder_id: client?.drive_folder_id || '',
    website_local_path: client?.website_local_path || '',
    ghl_token: client?.ghl_token || '',
    ghl_location_id: client?.ghl_location_id || '',
    ghl_form_name: client?.ghl_form_name || '',
    target_keywords: client?.target_keywords?.join(', ') || '',
    service_areas: client?.service_areas?.join(', ') || '',
    seo_engine_enabled: client?.seo_engine_enabled || false,
  };
}

export default function ClientForm({ client, onSave, onCancel }: ClientFormProps) {
  const [form, setForm] = useState<FormData>(toFormData(client));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!client;

  function update(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug) {
      setError('Name and slug are required.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      slug: form.slug,
      website: form.website || null,
      phone: form.phone || null,
      primary_market: form.primary_market || null,
      ga4_property: form.ga4_property || null,
      ga4_measurement_id: form.ga4_measurement_id || null,
      gsc_url: form.gsc_url || null,
      gbp_location: form.gbp_location || null,
      drive_folder_id: form.drive_folder_id || null,
      website_local_path: form.website_local_path || null,
      ghl_token: form.ghl_token || null,
      ghl_location_id: form.ghl_location_id || null,
      ghl_form_name: form.ghl_form_name || null,
      target_keywords: form.target_keywords ? form.target_keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      service_areas: form.service_areas ? form.service_areas.split(',').map(a => a.trim()).filter(Boolean) : [],
      seo_engine_enabled: form.seo_engine_enabled,
    };

    let result;
    if (isEdit) {
      result = await supabase.from('clients').update(payload).eq('id', client!.id);
    } else {
      result = await supabase.from('clients').insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSave();
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    fontSize: 13,
    fontFamily: seo.fontMono,
    background: seo.deep,
    border: `1px solid ${seo.border}`,
    borderRadius: 6,
    color: seo.text,
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600 as const,
    color: seo.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block' as const,
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: seo.text }}>
          {isEdit ? `Edit ${client!.name}` : 'Add New Client'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 14px', fontSize: 12, fontFamily: seo.fontMono,
            background: 'transparent', border: `1px solid ${seo.border}`,
            borderRadius: 6, color: seo.textMuted, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 16px', marginBottom: 20,
          background: 'rgba(255, 82, 82, 0.1)',
          border: `1px solid rgba(255, 82, 82, 0.3)`,
          borderRadius: 8, color: seo.danger, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Basic Info */}
        <FormSection title="Basic Info">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Name" value={form.name} onChange={(v) => update('name', v)} style={inputStyle} labelStyle={labelStyle} required />
            <Field label="Slug" value={form.slug} onChange={(v) => update('slug', v)} style={inputStyle} labelStyle={labelStyle} required placeholder="e.g. integrity-pro" />
            <Field label="Website" value={form.website} onChange={(v) => update('website', v)} style={inputStyle} labelStyle={labelStyle} placeholder="https://..." />
            <Field label="Phone" value={form.phone} onChange={(v) => update('phone', v)} style={inputStyle} labelStyle={labelStyle} />
            <Field label="Primary Market" value={form.primary_market} onChange={(v) => update('primary_market', v)} style={inputStyle} labelStyle={labelStyle} placeholder="e.g. Oceanside, CA" />
          </div>
        </FormSection>

        {/* Google Analytics */}
        <FormSection title="Google Analytics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="GA4 Property ID" value={form.ga4_property} onChange={(v) => update('ga4_property', v)} style={inputStyle} labelStyle={labelStyle} placeholder="properties/12345" />
            <Field label="GA4 Measurement ID" value={form.ga4_measurement_id} onChange={(v) => update('ga4_measurement_id', v)} style={inputStyle} labelStyle={labelStyle} placeholder="G-XXXXXXXXXX" />
          </div>
        </FormSection>

        {/* Google Search Console */}
        <FormSection title="Google Search Console">
          <Field label="GSC URL" value={form.gsc_url} onChange={(v) => update('gsc_url', v)} style={inputStyle} labelStyle={labelStyle} placeholder="https://example.com" />
        </FormSection>

        {/* Google Business Profile */}
        <FormSection title="Google Business Profile">
          <Field label="GBP Location ID" value={form.gbp_location} onChange={(v) => update('gbp_location', v)} style={inputStyle} labelStyle={labelStyle} placeholder="accounts/123/locations/456" />
        </FormSection>

        {/* Google Drive */}
        <FormSection title="Google Drive">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Drive Folder ID" value={form.drive_folder_id} onChange={(v) => update('drive_folder_id', v)} style={inputStyle} labelStyle={labelStyle} />
            <Field label="Website Local Path" value={form.website_local_path} onChange={(v) => update('website_local_path', v)} style={inputStyle} labelStyle={labelStyle} placeholder="~/Desktop/ClientSite" />
          </div>
        </FormSection>

        {/* GoHighLevel */}
        <FormSection title="GoHighLevel">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Field label="GHL Token" value={form.ghl_token} onChange={(v) => update('ghl_token', v)} style={inputStyle} labelStyle={labelStyle} />
            <Field label="GHL Location ID" value={form.ghl_location_id} onChange={(v) => update('ghl_location_id', v)} style={inputStyle} labelStyle={labelStyle} />
            <Field label="GHL Form Name" value={form.ghl_form_name} onChange={(v) => update('ghl_form_name', v)} style={inputStyle} labelStyle={labelStyle} />
          </div>
        </FormSection>

        {/* SEO Config */}
        <FormSection title="SEO Configuration">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Target Keywords</label>
              <textarea
                value={form.target_keywords}
                onChange={(e) => update('target_keywords', e.target.value)}
                placeholder="pressure washing oceanside, power washing san marcos, driveway cleaning vista"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' as const }}
                onFocus={(e) => { e.currentTarget.style.borderColor = seo.accent; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = seo.border; }}
              />
              <div style={{ fontSize: 10, color: seo.textMuted, marginTop: 4 }}>Comma-separated</div>
            </div>
            <div>
              <label style={labelStyle}>Service Areas</label>
              <textarea
                value={form.service_areas}
                onChange={(e) => update('service_areas', e.target.value)}
                placeholder="Oceanside, Carlsbad, Vista, San Marcos"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' as const }}
                onFocus={(e) => { e.currentTarget.style.borderColor = seo.accent; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = seo.border; }}
              />
              <div style={{ fontSize: 10, color: seo.textMuted, marginTop: 4 }}>Comma-separated</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.seo_engine_enabled}
                onChange={(e) => update('seo_engine_enabled', e.target.checked)}
                style={{ accentColor: seo.accent, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: seo.text }}>Enable SEO Engine for this client</span>
            </label>
          </div>
        </FormSection>
      </div>

      {/* Submit */}
      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '10px 28px',
            fontSize: 13, fontWeight: 600,
            fontFamily: seo.fontMono,
            background: saving ? seo.accentDim : seo.accent,
            color: seo.bg,
            border: 'none', borderRadius: 8,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = seo.accentDim; }}
          onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = seo.accent; }}
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Client'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 28px',
            fontSize: 13, fontWeight: 600,
            fontFamily: seo.fontMono,
            background: 'transparent',
            color: seo.textMuted,
            border: `1px solid ${seo.border}`,
            borderRadius: 8, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: seo.surface,
      border: `1px solid ${seo.border}`,
      borderRadius: seo.radiusCard,
      padding: '20px 24px',
    }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: seo.accent,
        marginBottom: 16, paddingBottom: 8,
        borderBottom: `1px solid ${seo.border}`,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, style, labelStyle, required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  style: React.CSSProperties;
  labelStyle: React.CSSProperties;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: seo.danger, marginLeft: 2 }}>*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={style}
        onFocus={(e) => { e.currentTarget.style.borderColor = seo.accent; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = seo.border; }}
      />
    </div>
  );
}
