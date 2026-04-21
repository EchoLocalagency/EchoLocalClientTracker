'use client';

import { useState, useEffect } from 'react';
import { Client, Report, GscQuery, GbpKeyword, SeoAction, SeoBrainDecision, GeoScore, SerpFeature, Mention, WeeklyTrendPoint, TabId, TimeRange, TrackedKeyword, KeywordSnapshot, SubmissionWithDirectory } from '@/lib/types';
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
import GeoTab from '@/components/tabs/GeoTab';
import DirectoriesTab from '@/components/tabs/DirectoriesTab';

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
  const [geoScores, setGeoScores] = useState<GeoScore[]>([]);
  const [serpFeatures, setSerpFeatures] = useState<SerpFeature[]>([]);
  const [serpApiUsageCount, setSerpApiUsageCount] = useState<number>(0);
  const [geoScoreTrends, setGeoScoreTrends] = useState<Record<string, Array<{ score: number; scored_at: string }>>>({});
  const [citationTrends, setCitationTrends] = useState<WeeklyTrendPoint[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [keywordSnapshots, setKeywordSnapshots] = useState<KeywordSnapshot[]>([]);
  const [directorySubmissions, setDirectorySubmissions] = useState<SubmissionWithDirectory[]>([]);
  const [gscHistory, setGscHistory] = useState<GscQuery[]>([]);
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
      // Try latest report first, then fall back to most recent report with queries
      const { data, error } = await supabase
        .from('gsc_queries')
        .select('*')
        .eq('report_id', latestReport!.id)
        .order('impressions', { ascending: false });

      if (error) {
        console.error('Queries fetch error:', error);
        setQueries([]);
      } else if (data && data.length > 0) {
        setQueries(data);
      } else {
        // Latest report has no queries -- find the most recent report that does
        const fallbackIds = reports
          .filter((r) => r.id !== latestReport!.id)
          .slice(-5)
          .map((r) => r.id);
        if (fallbackIds.length > 0) {
          const { data: fallback } = await supabase
            .from('gsc_queries')
            .select('*')
            .in('report_id', fallbackIds)
            .order('run_date', { ascending: false });
          if (fallback && fallback.length > 0) {
            // Keep only the latest run_date's queries
            const latestDate = fallback[0].run_date;
            setQueries(fallback.filter((q) => q.run_date === latestDate));
          } else {
            setQueries([]);
          }
        } else {
          setQueries([]);
        }
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

    async function loadTrackedKeywords() {
      const { data, error } = await supabase
        .from('tracked_keywords')
        .select('*')
        .eq('client_id', activeClient!.id)
        .eq('is_active', true);

      if (error) {
        console.error('Tracked keywords fetch error:', error);
        setTrackedKeywords([]);
      } else {
        setTrackedKeywords(data || []);
      }
    }

    async function loadKeywordSnapshots() {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from('keyword_snapshots')
        .select('*')
        .eq('client_id', activeClient!.id)
        .gte('checked_at', ninetyDaysAgo.toISOString().slice(0, 10))
        .order('checked_at', { ascending: true });

      if (error) {
        console.error('Keyword snapshots fetch error:', error);
        setKeywordSnapshots([]);
      } else {
        setKeywordSnapshots(data || []);
      }
    }

    async function loadGscHistory() {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);

      // Supabase caps each request at 1000 rows; paginate with .range() for clients
      // that have more than 1000 GSC rows in the last 90 days (Arcadian, Mr Green).
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 20;
      const all: GscQuery[] = [];

      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('gsc_queries')
          .select('id, report_id, client_id, run_date, query, impressions, clicks, position')
          .eq('client_id', activeClient!.id)
          .gte('run_date', cutoff)
          .order('run_date', { ascending: true })
          .range(from, to);

        if (error) {
          console.error('GSC history fetch error:', error);
          setGscHistory([]);
          return;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
      }
      setGscHistory(all);
    }

    loadQueries();
    loadPrevQueries();
    loadGbpKeywords();
    loadTrackedKeywords();
    loadKeywordSnapshots();
    loadGscHistory();
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

  // Load GEO data (visible to all users)
  useEffect(() => {
    if (!activeClient) {
      setGeoScores([]);
      setSerpFeatures([]);
      setSerpApiUsageCount(0);
      setGeoScoreTrends({});
      setCitationTrends([]);
      setMentions([]);
      return;
    }

    if (!activeClient.seo_engine_enabled) {
      setGeoScores([]);
      setSerpFeatures([]);
      setSerpApiUsageCount(0);
      setGeoScoreTrends({});
      setCitationTrends([]);
      setMentions([]);
      return;
    }

    async function loadGeoScores() {
      const { data, error } = await supabase
        .from('geo_scores')
        .select('page_path, page_url, score, factors, scored_at')
        .eq('client_id', activeClient!.id)
        .order('scored_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('GEO scores fetch error:', error);
        setGeoScores([]);
      } else {
        const seen = new Set<string>();
        const latest = (data || []).filter(row => {
          if (seen.has(row.page_path)) return false;
          seen.add(row.page_path);
          return true;
        });
        setGeoScores(latest);
      }
    }

    async function loadSerpFeatures() {
      const { data, error } = await supabase
        .from('serp_features')
        .select('keyword, has_ai_overview, client_cited_in_ai_overview, has_featured_snippet, featured_snippet_holder, client_has_snippet, collected_at')
        .eq('client_id', activeClient!.id)
        .order('collected_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('SERP features fetch error:', error);
        setSerpFeatures([]);
      } else {
        const seen = new Set<string>();
        const latest = (data || []).filter(row => {
          if (seen.has(row.keyword)) return false;
          seen.add(row.keyword);
          return true;
        });
        setSerpFeatures(latest);
      }
    }

    async function loadSerpApiUsage() {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('serpapi_usage')
        .select('id', { count: 'exact', head: true })
        .gte('searched_at', monthStart.toISOString());

      if (error) {
        console.error('SerpAPI usage fetch error:', error);
        setSerpApiUsageCount(0);
      } else {
        setSerpApiUsageCount(count || 0);
      }
    }

    async function loadGeoScoreTrends() {
      const { data: allScores, error } = await supabase
        .from('geo_scores')
        .select('page_path, score, scored_at')
        .eq('client_id', activeClient!.id)
        .order('scored_at', { ascending: true });

      if (error) {
        console.error('GEO trends fetch error:', error);
        setGeoScoreTrends({});
      } else {
        const trends: Record<string, Array<{ score: number; scored_at: string }>> = {};
        for (const row of (allScores || [])) {
          if (!trends[row.page_path]) trends[row.page_path] = [];
          trends[row.page_path].push({ score: row.score, scored_at: row.scored_at });
        }
        setGeoScoreTrends(trends);
      }
    }

    async function loadCitationTrends() {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: trendRows, error } = await supabase
        .from('serp_features')
        .select('keyword, has_ai_overview, client_cited_in_ai_overview, collected_at')
        .eq('client_id', activeClient!.id)
        .gte('collected_at', ninetyDaysAgo.toISOString())
        .order('collected_at', { ascending: true });

      if (error) {
        console.error('Citation trends fetch error:', error);
        setCitationTrends([]);
        return;
      }

      const weekMap = new Map<string, { cited: Set<string>; aio: Set<string> }>();
      for (const row of (trendRows || [])) {
        const date = new Date(row.collected_at);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        if (!weekMap.has(key)) weekMap.set(key, { cited: new Set(), aio: new Set() });
        const bucket = weekMap.get(key)!;
        if (row.has_ai_overview) {
          bucket.aio.add(row.keyword);
          if (row.client_cited_in_ai_overview) bucket.cited.add(row.keyword);
        }
      }

      const trends: WeeklyTrendPoint[] = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, data]) => ({
          week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          citedCount: data.cited.size,
          aioCount: data.aio.size,
          citationRate: data.aio.size > 0 ? Math.round((data.cited.size / data.aio.size) * 100) : 0,
        }));
      setCitationTrends(trends);
    }

    async function loadMentions() {
      const { data: mentionsData, error } = await supabase
        .from('mentions')
        .select('platform, source_domain, mention_type, title, source_url')
        .eq('client_id', activeClient!.id);

      if (error) {
        console.error('Mentions fetch error:', error);
        setMentions([]);
      } else {
        setMentions(mentionsData || []);
      }
    }

    loadGeoScores();
    loadSerpFeatures();
    loadSerpApiUsage();
    loadGeoScoreTrends();
    loadCitationTrends();
    loadMentions();
  }, [activeClient]);

  // Load directory submissions
  useEffect(() => {
    if (!activeClient) {
      setDirectorySubmissions([]);
      return;
    }

    async function loadDirectorySubmissions() {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id, status, live_url, submitted_at, verified_at,
          directories (id, name, domain, tier, da_score, trades, submission_url, enabled)
        `)
        .eq('client_id', activeClient!.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Directory submissions fetch error:', error);
        setDirectorySubmissions([]);
      } else {
        setDirectorySubmissions((data as unknown as SubmissionWithDirectory[]) || []);
      }
    }

    loadDirectorySubmissions();
  }, [activeClient]);

  // GA4 form_submit is false positives from GHL iframe -- real form tracking uses GHL webhook
  const hasFormTracking = false;
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
          isAdmin={isAdmin}
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
                <SeoTab reports={filteredReports} queries={queries} latestReport={latestReport} prevQueries={prevQueries} clientId={activeClient?.id} clientName={activeClient?.name} gscHistory={gscHistory} />
              )}
              {activeTab === 'conversions' && (
                <ConversionsTab reports={filteredReports} latestReport={latestReport} hasFormTracking={hasFormTracking} />
              )}
              {activeTab === 'gbp' && (
                <GbpTab reports={filteredReports} latestReport={latestReport} gbpKeywords={gbpKeywords} />
              )}
              {activeTab === 'seo-engine' && isAdmin && (
                <SeoEngineTab actions={seoActions} decisions={brainDecisions} trackedKeywords={trackedKeywords} keywordSnapshots={keywordSnapshots} gscHistory={gscHistory} clientName={activeClient?.name} />
              )}
              {activeTab === 'geo' && isAdmin && (
                <GeoTab
                  geoScores={geoScores}
                  serpFeatures={serpFeatures}
                  serpApiUsageCount={serpApiUsageCount}
                  isAdmin={isAdmin}
                  seoEngineEnabled={activeClient?.seo_engine_enabled ?? false}
                  geoScoreTrends={geoScoreTrends}
                  citationTrends={citationTrends}
                  mentions={mentions}
                />
              )}
              {activeTab === 'directories' && (
                <DirectoriesTab
                  submissions={directorySubmissions}
                  seoEngineEnabled={activeClient?.seo_engine_enabled ?? false}
                  isAdmin={isAdmin}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
