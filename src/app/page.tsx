'use client';

import { useState, useEffect } from 'react';
import { Client, Report, GscQuery, TabId } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TabNav from '@/components/TabNav';
import OverviewTab from '@/components/tabs/OverviewTab';
import SeoTab from '@/components/tabs/SeoTab';
import HealthTab from '@/components/tabs/HealthTab';
import ConversionsTab from '@/components/tabs/ConversionsTab';
import GbpTab from '@/components/tabs/GbpTab';
import ReportsTab from '@/components/tabs/ReportsTab';

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [queries, setQueries] = useState<GscQuery[]>([]);
  const [loading, setLoading] = useState(true);

  // Load clients from Supabase
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
    }
    loadClients();
  }, []);

  // Load reports when client changes
  useEffect(() => {
    if (!activeClient) return;

    async function loadReports() {
      setLoading(true);

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', activeClient!.id)
        .order('run_date', { ascending: true });

      if (error) {
        console.error('Reports fetch error:', error);
        setReports([]);
      } else {
        setReports(data || []);
      }
      setLoading(false);
    }

    loadReports();
  }, [activeClient]);

  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;

  // Load queries for latest report
  useEffect(() => {
    if (!activeClient || !latestReport) {
      setQueries([]);
      return;
    }

    async function loadQueries() {
      const { data, error } = await supabase
        .from('gsc_queries')
        .select('*')
        .eq('report_id', latestReport!.id)
        .order('impressions', { ascending: false });

      if (error) {
        console.error('Queries fetch error:', error);
        setQueries([]);
      } else {
        setQueries(data || []);
      }
    }

    loadQueries();
  }, [activeClient, latestReport]);

  const hasFormTracking = activeClient?.slug === 'integrity-pro-washers';
  const sidebarWidth = sidebarCollapsed ? 60 : 240;

  if (!activeClient) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        clients={clients}
        activeClient={activeClient}
        onSelectClient={(c) => { setActiveClient(c); setActiveTab('overview'); }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main style={{ flex: 1, marginLeft: sidebarWidth, transition: 'margin-left 0.2s ease' }}>
        {/* Header */}
        <header style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{activeClient.name}</h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {activeClient.website}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last updated</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {latestReport ? latestReport.run_date : 'No data'}
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: '24px 32px' }}>
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading...</div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab reports={reports} latestReport={latestReport} />
              )}
              {activeTab === 'seo' && (
                <SeoTab reports={reports} queries={queries} latestReport={latestReport} />
              )}
              {activeTab === 'health' && (
                <HealthTab reports={reports} latestReport={latestReport} />
              )}
              {activeTab === 'conversions' && (
                <ConversionsTab reports={reports} latestReport={latestReport} hasFormTracking={hasFormTracking} />
              )}
              {activeTab === 'gbp' && <GbpTab />}
              {activeTab === 'reports' && <ReportsTab />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
