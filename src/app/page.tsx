'use client';

import { useState, useEffect } from 'react';
import { Client, Report, GscQuery, TabId, TimeRange } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useFilteredReports } from '@/hooks/useFilteredReports';
import Sidebar from '@/components/Sidebar';
import TabNav from '@/components/TabNav';
import TimeRangeFilter from '@/components/TimeRangeFilter';
import OverviewTab from '@/components/tabs/OverviewTab';
import SeoTab from '@/components/tabs/SeoTab';
import HealthTab from '@/components/tabs/HealthTab';
import ConversionsTab from '@/components/tabs/ConversionsTab';
import GbpTab from '@/components/tabs/GbpTab';
import SummaryTab from '@/components/tabs/SummaryTab';

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [queries, setQueries] = useState<GscQuery[]>([]);
  const [prevQueries, setPrevQueries] = useState<GscQuery[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('3m');
  const [loading, setLoading] = useState(true);

  const filteredReports = useFilteredReports(reports, timeRange);
  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;
  const firstReport = reports.length > 0 ? reports[0] : null;

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

  // Load queries for latest report + previous report
  useEffect(() => {
    if (!activeClient || !latestReport) {
      setQueries([]);
      setPrevQueries([]);
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

    async function loadPrevQueries() {
      if (reports.length < 2) {
        setPrevQueries([]);
        return;
      }
      const prevReport = reports[reports.length - 2];
      const { data, error } = await supabase
        .from('gsc_queries')
        .select('*')
        .eq('report_id', prevReport.id)
        .order('impressions', { ascending: false });

      if (error) {
        console.error('Prev queries fetch error:', error);
        setPrevQueries([]);
      } else {
        setPrevQueries(data || []);
      }
    }

    loadQueries();
    loadPrevQueries();
  }, [activeClient, latestReport, reports.length]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last updated</div>
              <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                {latestReport ? latestReport.run_date : 'No data'}
              </div>
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
                <OverviewTab reports={filteredReports} latestReport={latestReport} allReports={reports} />
              )}
              {activeTab === 'seo' && (
                <SeoTab reports={filteredReports} queries={queries} latestReport={latestReport} prevQueries={prevQueries} />
              )}
              {activeTab === 'health' && (
                <HealthTab reports={filteredReports} latestReport={latestReport} />
              )}
              {activeTab === 'conversions' && (
                <ConversionsTab reports={filteredReports} latestReport={latestReport} hasFormTracking={hasFormTracking} />
              )}
              {activeTab === 'gbp' && <GbpTab />}
              {activeTab === 'summary' && (
                <SummaryTab latestReport={latestReport} firstReport={firstReport} clientName={activeClient.name} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
