'use client';

import { useState, useEffect } from 'react';
import { Client, SeoAction, SeoBrainDecision, SeoEngineTabId } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import SeoEngineLayout from '@/components/seo-engine/SeoEngineLayout';
import SeoClientSelector from '@/components/seo-engine/SeoClientSelector';
import SeoTabNav from '@/components/seo-engine/SeoTabNav';
import ClientManager from '@/components/seo-engine/ClientManager';
import ActionFeedGreen from '@/components/seo-engine/ActionFeedGreen';
import BrainDecisionsGreen from '@/components/seo-engine/BrainDecisionsGreen';
import KeywordDashboard from '@/components/seo-engine/KeywordDashboard';
import ClientProfileForm from '@/components/directories/ClientProfileForm';
import DirectoryManager from '@/components/directories/DirectoryManager';

export default function SeoEnginePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<SeoEngineTabId>('clients');
  const [seoActions, setSeoActions] = useState<SeoAction[]>([]);
  const [brainDecisions, setBrainDecisions] = useState<SeoBrainDecision[]>([]);
  const [loading, setLoading] = useState(true);

  // Load clients
  useEffect(() => {
    async function loadClients() {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) {
        console.error('Clients fetch error:', error);
        return;
      }
      if (data && data.length > 0) {
        setClients(data);
        setActiveClient(data[0]);
      }
      setLoading(false);
    }
    loadClients();
  }, []);

  // Load SEO data when client changes
  useEffect(() => {
    if (!activeClient) {
      setSeoActions([]);
      setBrainDecisions([]);
      return;
    }

    async function loadSeoData() {
      const [actionsRes, decisionsRes] = await Promise.all([
        supabase
          .from('seo_actions')
          .select('*')
          .eq('client_id', activeClient!.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('seo_brain_decisions')
          .select('*')
          .eq('client_id', activeClient!.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (actionsRes.error) {
        console.error('SEO actions fetch error:', actionsRes.error);
        setSeoActions([]);
      } else {
        setSeoActions(actionsRes.data || []);
      }

      if (decisionsRes.error) {
        console.error('Brain decisions fetch error:', decisionsRes.error);
        setBrainDecisions([]);
      } else {
        setBrainDecisions(decisionsRes.data || []);
      }
    }

    loadSeoData();
  }, [activeClient]);

  const sidebarWidth = sidebarCollapsed ? 68 : 260;

  function handleClientSaved() {
    // Reload clients after add/edit
    supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data);
      });
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--text-secondary)', background: 'var(--bg-primary)',
        fontFamily: 'var(--font-sans)',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <SeoEngineLayout
      sidebarWidth={sidebarWidth}
      sidebar={
        <SeoClientSelector
          clients={clients}
          activeClient={activeClient}
          onSelectClient={(c) => { setActiveClient(c); }}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      }
    >
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            SEO Engine
          </h1>
          {activeClient && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {activeClient.name} {activeClient.website ? `-- ${activeClient.website}` : ''}
            </div>
          )}
        </div>
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: activeClient?.seo_engine_enabled ? 'var(--success)' : 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '6px 14px',
          border: '1px solid var(--border)',
          borderRadius: 20,
        }}>
          {activeClient?.seo_engine_enabled ? 'Engine Active' : 'Engine Inactive'}
        </div>
      </header>

      {/* Content */}
      <div style={{ padding: '24px 32px' }}>
        <SeoTabNav activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'clients' && (
          <ClientManager
            clients={clients}
            activeClient={activeClient}
            onSelectClient={setActiveClient}
            onClientSaved={handleClientSaved}
          />
        )}
        {activeTab === 'actions' && (
          <ActionFeedGreen actions={seoActions} />
        )}
        {activeTab === 'brain' && (
          <BrainDecisionsGreen decisions={brainDecisions} />
        )}
        {activeTab === 'keywords' && (
          <KeywordDashboard actions={seoActions} />
        )}
        {activeTab === 'directories' && activeClient && (
          <div>
            <ClientProfileForm clientId={activeClient.id} />
            <DirectoryManager />
          </div>
        )}
      </div>
    </SeoEngineLayout>
  );
}
