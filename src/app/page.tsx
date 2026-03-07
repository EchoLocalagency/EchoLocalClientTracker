'use client';

import { useState, useEffect } from 'react';
import { Client, Report, GscQuery, GbpKeyword, SeoAction, SeoBrainDecision, TabId, TimeRange } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useFilteredReports } from '@/hooks/useFilteredReports';
import Sidebar from '@/components/Sidebar';
import TabNav from '@/components/TabNav';
import TimeRangeFilter from '@/components/TimeRangeFilter';
import OverviewTab from '@/components/tabs/OverviewTab';
import SeoTab from '@/components/tabs/SeoTab';
import ConversionsTab from '@/components/tabs/ConversionsTab';
import GbpTab from '@/components/tabs/GbpTab';
import SeoEngineTab from '@/components/tabs/SeoEngineTab';

export default function Dashboard() {
  const { profile, loading: authLoading, isAdmin } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [reports, setReports] = useState<Report[]>([]);
  const [queries, setQueries] = useState<GscQuery[]>([]);
  const [prevQueries, setPrevQueries] = useState<GscQuery[]>([]);
  const [gbpKeywords, setGbpKeywords] = useState<GbpKeyword[]>([]);
  const [seoActions, setSeoActions] = useState<SeoAction[]>([]);
  const [brainDecisions, setBrainDecisions] = useState<SeoBrainDecision[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('3m');
  const [loading, setLoading] = useState(true);

  const filteredReports = useFilteredReports(reports, timeRange);
  const latestReport = reports.length > 0 ? reports[reports.length - 1] : null;

  // Load clients from Supabase
  useEffect(() => {
    if (authLoading || !profile) return;

    async function loadClients() {
      if (profile!.role === 'client' && profile!.client_id) {
        // Client user: only load their assigned client
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', profile!.client_id);

        if (error) {
          console.error('Clients fetch error:', error);
          return;
        }
        if (data && data.length > 0) {
          setClients(data);
          setActiveClient(data[0]);
        }
      } else {
        // Admin: load all clients
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
    }
    loadClients();
  }, [authLoading, profile]);

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

  // Load queries + GBP keywords for latest report + previous report
  useEffect(() => {
    if (!activeClient || !latestReport) {
      setQueries([]);
      setPrevQueries([]);
      setGbpKeywords([]);
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
      const recentReportIds = reports
        .filter((rep) => rep.id !== latestReport!.id)
        .slice(-14)
        .map((rep) => rep.id);
      if (recentReportIds.length === 0) {
        setPrevQueries([]);
        return;
      }
      const { data, error } = await supabase
        .from('gsc_queries')
        .select('*')
        .in('report_id', recentReportIds)
        .order('run_date', { ascending: false });

      if (error) {
        console.error('Prev queries fetch error:', error);
        setPrevQueries([]);
      } else {
        const seen = new Map<string, GscQuery>();
        for (const q of (data || [])) {
          if (!seen.has(q.query)) {
            seen.set(q.query, q);
          }
        }
        setPrevQueries(Array.from(seen.values()));
      }
    }

    async function loadGbpKeywords() {
      const { data, error } = await supabase
        .from('gbp_keywords')
        .select('*')
        .eq('report_id', latestReport!.id)
        .order('impressions', { ascending: false });

      if (error) {
        console.error('GBP keywords fetch error:', error);
        setGbpKeywords([]);
      } else {
        setGbpKeywords(data || []);
      }
    }

    loadQueries();
    loadPrevQueries();
    loadGbpKeywords();
  }, [activeClient, latestReport, reports.length]);

  // Load SEO Engine data (admin only)
  useEffect(() => {
    if (!activeClient || !isAdmin) {
      setSeoActions([]);
      setBrainDecisions([]);
      return;
    }

    async function loadSeoActions() {
      const { data, error } = await supabase
        .from('seo_actions')
        .select('*')
        .eq('client_id', activeClient!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('SEO actions fetch error:', error);
        setSeoActions([]);
      } else {
        setSeoActions(data || []);
      }
    }

    async function loadBrainDecisions() {
      const { data, error } = await supabase
        .from('seo_brain_decisions')
        .select('*')
        .eq('client_id', activeClient!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Brain decisions fetch error:', error);
        setBrainDecisions([]);
      } else {
        setBrainDecisions(data || []);
      }
    }

    loadSeoActions();
    loadBrainDecisions();
  }, [activeClient, isAdmin]);

  const hasFormTracking = reports.some(r => r.ga4_form_submits != null && r.ga4_form_submits > 0);
  const sidebarWidth = isAdmin ? (sidebarCollapsed ? 68 : 260) : 0;

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)', flexDirection: 'column', gap: 16 }}>
        <div>No profile found for this account.</div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
          style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (!activeClient) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isAdmin && (
        <Sidebar
          clients={clients}
          activeClient={activeClient}
          onSelectClient={(c) => { setActiveClient(c); setActiveTab('overview'); }}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onSignOut={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
        />
      )}

      <main style={{ flex: 1, marginLeft: sidebarWidth, transition: 'margin-left 0.2s ease' }}>
        {/* Header */}
        <header style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {!isAdmin && (
              <img
                src="/echo-local-logo.png"
                alt="Echo Local"
                style={{ width: 36, height: 36, objectFit: 'contain' }}
              />
            )}
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{activeClient.name}</h1>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {activeClient.website}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last updated</div>
              <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                {latestReport ? latestReport.run_date : 'No data'}
              </div>
            </div>
            {!isAdmin && (
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: '24px 32px' }}>
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} />

          {loading ? (
            <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>Loading...</div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab reports={filteredReports} latestReport={latestReport} allReports={reports} queries={queries} />
              )}
              {activeTab === 'seo' && (
                <SeoTab reports={filteredReports} queries={queries} latestReport={latestReport} prevQueries={prevQueries} clientId={activeClient?.id} clientName={activeClient?.name} />
              )}
              {activeTab === 'conversions' && (
                <ConversionsTab reports={filteredReports} latestReport={latestReport} hasFormTracking={hasFormTracking} />
              )}
              {activeTab === 'gbp' && (
                <GbpTab reports={filteredReports} latestReport={latestReport} gbpKeywords={gbpKeywords} />
              )}
              {activeTab === 'seo-engine' && isAdmin && (
                <SeoEngineTab actions={seoActions} decisions={brainDecisions} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
