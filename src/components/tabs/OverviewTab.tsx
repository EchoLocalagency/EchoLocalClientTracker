'use client';

import { Report, GscQuery } from '@/lib/types';
import { parseMetricValue, calcHealthScore, calcVelocity, rollingSum14 } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import HealthScoreCard from '@/components/HealthScoreCard';
import AlertBanner, { AlertItem } from '@/components/AlertBanner';
import ChartTooltip from '@/components/ChartTooltip';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  Legend,
} from 'recharts';

interface OverviewTabProps {
  reports: Report[];
  latestReport: Report | null;
  allReports?: Report[];
  queries?: GscQuery[];
}

export default function OverviewTab({ reports, latestReport, allReports, queries = [] }: OverviewTabProps) {
  if (!latestReport) {
    return <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>No data yet. Run your first report to see metrics here.</div>;
  }

  const r = latestReport;
  const firstReport = allReports && allReports.length > 0 ? allReports[0] : null;
  const baselineDate = firstReport
    ? new Date(firstReport.run_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  // Fall back to most recent report with real PSI data (non-zero) when latest failed
  const psiReport = (r.psi_mobile_score ?? 0) > 0
    ? r
    : [...(allReports ?? reports)].sort((a, b) => b.run_date.localeCompare(a.run_date))
        .find((rep) => (rep.psi_mobile_score ?? 0) > 0) ?? r;

  const recentForHealth = (allReports ?? reports).slice(-14);

  // Top 5 keyword avg: sort by position (best first), take top 5, average
  const rankedQueries = queries
    .filter(q => q.position != null && q.position > 0)
    .sort((a, b) => a.position - b.position)
    .slice(0, 5);
  const top5AvgPosition = rankedQueries.length > 0
    ? rankedQueries.reduce((sum, q) => sum + q.position, 0) / rankedQueries.length
    : null;

  const { score, factors } = calcHealthScore(psiReport, recentForHealth, top5AvgPosition);

  const mobileScore = psiReport.psi_mobile_score;
  const lcpMobile = parseMetricValue(psiReport.psi_lcp_mobile);

  const alerts: AlertItem[] = [];
  if (mobileScore != null && mobileScore < 50) {
    alerts.push({ severity: 'critical', message: `Mobile speed score is ${mobileScore} (below 50)`, hint: 'Consider image optimization and reducing JS bundle size' });
  }
  if (lcpMobile != null && lcpMobile > 4) {
    alerts.push({ severity: 'critical', message: `Mobile LCP is ${r.psi_lcp_mobile} (above 4s)`, hint: 'Largest Contentful Paint affects Core Web Vitals ranking' });
  }
  const organicDelta = r.ga4_organic != null && r.ga4_organic_prev != null && r.ga4_organic_prev > 0
    ? ((r.ga4_organic - r.ga4_organic_prev) / r.ga4_organic_prev) * 100
    : null;
  if (organicDelta != null && organicDelta < -20) {
    alerts.push({ severity: 'warning', message: `Organic sessions dropped ${Math.abs(organicDelta).toFixed(0)}%`, hint: 'Check for algorithm updates or indexing issues in GSC' });
  }

  // Chart data: 14-day rolling totals (sum of trailing 14 daily data points)
  const impressionsRaw = reports.map((rep) => rep.gsc_impressions);
  const chartData = reports.map((rep, i) => ({
    date: new Date(rep.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: rollingSum14(impressionsRaw, i),
    periodStart: rep.period_start,
    periodEnd: rep.period_end,
  }));

  // GBP chart data: 14-day rolling totals
  const gbpImpRaw = reports.map((rep) => rep.gbp_total_impressions);
  const gbpCallsRaw = reports.map((rep) => rep.gbp_call_clicks);
  const gbpWebRaw = reports.map((rep) => rep.gbp_website_clicks);
  const gbpChartData = reports.map((rep, i) => ({
    date: new Date(rep.run_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: rollingSum14(gbpImpRaw, i),
    calls: rollingSum14(gbpCallsRaw, i),
    website: rollingSum14(gbpWebRaw, i),
  }));

  // Sparkline + velocity data: 14-day rolling totals from filtered reports
  const organicRaw = reports.map((rep) => rep.ga4_organic);
  const impressionsAllRaw = reports.map((rep) => rep.gsc_impressions);
  const phoneRaw = reports.map((rep) => rep.ga4_phone_clicks);
  const gbpImpAllRaw = reports.map((rep) => rep.gbp_total_impressions);
  const organicSeries = organicRaw.map((_, i) => rollingSum14(organicRaw, i));
  const impressionsSeries = impressionsAllRaw.map((_, i) => rollingSum14(impressionsAllRaw, i));
  const phoneSeries = phoneRaw.map((_, i) => rollingSum14(phoneRaw, i));
  const gbpImpressionsSeries = gbpImpAllRaw.map((_, i) => rollingSum14(gbpImpAllRaw, i));
  const gbpCallsRawAll = reports.map((rep) => rep.gbp_call_clicks);
  const gbpWebRawAll = reports.map((rep) => rep.gbp_website_clicks);
  const gbpCallsSeries = gbpCallsRawAll.map((_, i) => rollingSum14(gbpCallsRawAll, i));
  const gbpWebsiteSeries = gbpWebRawAll.map((_, i) => rollingSum14(gbpWebRawAll, i));
  const hasGbp = reports.some((rep) => (rep.gbp_total_impressions ?? 0) > 0);

  // Use the most recent report that has actual GBP data (skip NULLs from failed pulls)
  const gbpReport = [...reports]
    .sort((a, b) => b.run_date.localeCompare(a.run_date))
    .find((rep) => (rep.gbp_total_impressions ?? 0) > 0) ?? r;

  const organicVelocity = calcVelocity(organicSeries);
  const impressionsVelocity = calcVelocity(impressionsSeries);

  const brushStart = Math.max(0, chartData.length - 8);

  // PSI metrics for absorbed Health row (use fallback report)
  const psiMobile = psiReport.psi_mobile_score;
  const psiDesktop = psiReport.psi_desktop_score;
  const lcpVal = psiReport.psi_lcp_mobile;
  const clsVal = psiReport.psi_cls_mobile;

  function psiColor(score: number | null): string {
    if (score == null) return 'var(--text-secondary)';
    if (score >= 80) return 'var(--success)';
    if (score >= 50) return 'var(--accent-dim)';
    return 'var(--danger)';
  }

  function metricColor(val: string | null, good: number, mid: number): string {
    const num = parseMetricValue(val);
    if (num == null) return 'var(--text-secondary)';
    if (num <= good) return 'var(--success)';
    if (num <= mid) return 'var(--accent-dim)';
    return 'var(--danger)';
  }

  return (
    <div>
      {/* Health Score */}
      <div style={{ marginBottom: 24 }}>
        <HealthScoreCard score={score} factors={factors} />
      </div>

      {/* Absorbed Health metrics - compact row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Mobile PSI</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: psiColor(psiMobile) }}>{psiMobile ?? '--'}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Desktop PSI</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: psiColor(psiDesktop) }}>{psiDesktop ?? '--'}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>LCP (Mobile)</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: metricColor(lcpVal, 2.5, 4) }}>{lcpVal ?? '--'}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>CLS (Mobile)</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: metricColor(clsVal, 0.1, 0.25) }}>{clsVal ?? '--'}</div>
        </div>
      </div>

      {/* Hero chart: GSC impressions trend */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
          Google Search Impressions Over Time
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          How much more are you showing up on Google
        </div>
        <div style={{ height: chartData.length > 6 ? 280 : 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E8FF00" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E8FF00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  const data = payload?.[0]?.payload;
                  return (
                    <ChartTooltip
                      active={active}
                      payload={payload as any}
                      label={String(label ?? '')}
                      periodStart={data?.periodStart}
                      periodEnd={data?.periodEnd}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="impressions"
                stroke="#E8FF00"
                strokeWidth={2}
                fill="url(#impressionsGrad)"
                name="Impressions"
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: '#E8FF00', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
              {chartData.length > 6 && (
                <Brush
                  dataKey="date"
                  height={24}
                  stroke="var(--border)"
                  fill="var(--bg-depth)"
                  startIndex={brushStart}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GBP Overview chart */}
      {hasGbp && gbpChartData.length > 1 && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>
            Google Business Profile Performance
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Impressions, calls, and website clicks from your GBP listing
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={gbpChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="impressions"
                name="Impressions"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="calls"
                name="Call Clicks"
                stroke="var(--success)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--success)', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="website"
                name="Website Clicks"
                stroke="var(--text-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--text-primary)', strokeWidth: 2, fill: 'var(--bg-surface)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stat cards grid -- values are 14-day rolling totals, % change vs prior 14-day window */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Organic Sessions"
          value={organicSeries[organicSeries.length - 1] ?? null}
          previous={organicSeries[Math.max(0, organicSeries.length - 15)] ?? null}
          baseline={organicSeries[0] ?? null}
          baselineDate={baselineDate}
          sparklineData={organicSeries}
          velocityLabel={organicVelocity}
        />
        <StatCard
          label="Search Impressions"
          value={impressionsSeries[impressionsSeries.length - 1] ?? null}
          previous={impressionsSeries[Math.max(0, impressionsSeries.length - 15)] ?? null}
          baseline={impressionsSeries[0] ?? null}
          baselineDate={baselineDate}
          sparklineData={impressionsSeries}
          velocityLabel={impressionsVelocity}
        />
        <StatCard
          label="Phone Clicks"
          value={phoneSeries[phoneSeries.length - 1] ?? null}
          previous={phoneSeries[Math.max(0, phoneSeries.length - 15)] ?? null}
          baseline={phoneSeries[0] ?? null}
          baselineDate={baselineDate}
          sparklineData={phoneSeries}
        />
        <StatCard
          label="Mobile Speed Score"
          value={psiReport.psi_mobile_score}
          format="score"
          alert={mobileScore != null && mobileScore < 50 ? 'Below threshold' : null}
        />
        {hasGbp && (
          <StatCard
            label="GBP Impressions"
            value={gbpImpressionsSeries[gbpImpressionsSeries.length - 1] ?? null}
            previous={gbpImpressionsSeries[Math.max(0, gbpImpressionsSeries.length - 15)] ?? null}
            baseline={gbpImpressionsSeries[0] ?? null}
            baselineDate={baselineDate}
            sparklineData={gbpImpressionsSeries}
          />
        )}
        {hasGbp && (
          <StatCard
            label="GBP Call Clicks"
            value={gbpCallsSeries[gbpCallsSeries.length - 1] ?? null}
            previous={gbpCallsSeries[Math.max(0, gbpCallsSeries.length - 15)] ?? null}
            baseline={gbpCallsSeries[0] ?? null}
            baselineDate={baselineDate}
            sparklineData={gbpCallsSeries}
          />
        )}
        {hasGbp && (
          <StatCard
            label="GBP Website Clicks"
            value={gbpWebsiteSeries[gbpWebsiteSeries.length - 1] ?? null}
            previous={gbpWebsiteSeries[Math.max(0, gbpWebsiteSeries.length - 15)] ?? null}
            baseline={gbpWebsiteSeries[0] ?? null}
            baselineDate={baselineDate}
            sparklineData={gbpWebsiteSeries}
          />
        )}
      </div>

      {/* Alerts */}
      <AlertBanner alerts={alerts} />
    </div>
  );
}
