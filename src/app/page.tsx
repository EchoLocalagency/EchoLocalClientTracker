'use client';

import { useState, useMemo } from 'react';
import { Client, Report, GscQuery, TabId } from '@/lib/types';
import { mockClients, mockReports, getMockQueries } from '@/lib/mock-data';
import Sidebar from '@/components/Sidebar';
import TabNav from '@/components/TabNav';
import OverviewTab from '@/components/tabs/OverviewTab';
import SeoTab from '@/components/tabs/SeoTab';
import HealthTab from '@/components/tabs/HealthTab';
import ConversionsTab from '@/components/tabs/ConversionsTab';
import GbpTab from '@/components/tabs/GbpTab';
import ReportsTab from '@/components/tabs/ReportsTab';

// TODO: Replace with Supabase queries once schema is set up
const USE_MOCK = true;

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeClient, setActiveClient] = useState<Client>(mockClients[0]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const clients = USE_MOCK ? mockClients : [];

  const clientReports = useMemo(() => {
    if (USE_MOCK) {
      return mockReports
        .filter((r) => r.client_id === activeClient.id)
        .sort((a, b) => a.run_date.localeCompare(b.run_date));
    }
    return [];
  }, [activeClient.id]);

  const latestReport = clientReports.length > 0 ? clientReports[clientReports.length - 1] : null;

  const queries = useMemo(() => {
    if (USE_MOCK && latestReport) {
      return getMockQueries(activeClient.id, latestReport.id, latestReport.run_date);
    }
    return [];
  }, [activeClient.id, latestReport]);

  const hasFormTracking = activeClient.slug === 'integrity-pro-washers';

  const sidebarWidth = sidebarCollapsed ? 60 : 240;

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

          {activeTab === 'overview' && (
            <OverviewTab reports={clientReports} latestReport={latestReport} />
          )}
          {activeTab === 'seo' && (
            <SeoTab reports={clientReports} queries={queries} latestReport={latestReport} />
          )}
          {activeTab === 'health' && (
            <HealthTab reports={clientReports} latestReport={latestReport} />
          )}
          {activeTab === 'conversions' && (
            <ConversionsTab reports={clientReports} latestReport={latestReport} hasFormTracking={hasFormTracking} />
          )}
          {activeTab === 'gbp' && <GbpTab />}
          {activeTab === 'reports' && <ReportsTab />}
        </div>
      </main>
    </div>
  );
}
