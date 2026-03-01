'use client';

import { Report } from '@/lib/types';
import { parseMetricValue, calcHealthScore, calcVelocity } from '@/lib/utils';
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
}

export default function OverviewTab({ reports, latestReport, allReports }: OverviewTabProps) {
  if (!latestReport) {
    return <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center' }}>No data yet. Run your first report to see metrics here.</div>;
  }

  const r = latestReport;
  const firstReport = allReports && allReports.length > 0 ? allReports[0] : null;
  const baselineDate = firstReport
    ? new Date(firstReport.run_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const { score, factors } = calcHealthScore(r);

  const mobileScore = r.psi_mobile_score;
  const lcpMobile = parseMetricValue(r.psi_lcp_mobile);

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

  // Chart data
  const chartData = reports.map((rep) => ({
    date: new Date(rep.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: rep.gsc_impressions ?? 0,
    periodStart: rep.period_start,
    periodEnd: rep.period_end,
  }));

  // GBP chart data
  const gbpChartData = reports.map((rep) => ({
    date: new Date(rep.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: rep.gbp_total_impressions ?? 0,
    calls: rep.gbp_call_clicks ?? 0,
    website: rep.gbp_website_clicks ?? 0,
  }));

  // Sparkline + velocity data from all reports
  const source = allReports && allReports.length > 0 ? allReports : reports;
  const organicSeries = source.map((rep) => rep.ga4_organic ?? 0);
  const impressionsSeries = source.map((rep) => rep.gsc_impressions ?? 0);
  const phoneSeries = source.map((rep) => rep.ga4_phone_clicks ?? 0);
  const gbpImpressionsSeries = source.map((rep) => rep.gbp_total_impressions ?? 0);
  const gbpCallsSeries = source.map((rep) => rep.gbp_call_clicks ?? 0);
  const gbpWebsiteSeries = source.map((rep) => rep.gbp_website_clicks ?? 0);
  const hasGbp = (r.gbp_total_impressions ?? 0) > 0;

  const organicVelocity = calcVelocity(organicSeries);
  const impressionsVelocity = calcVelocity(impressionsSeries);

  const brushStart = Math.max(0, chartData.length - 8);

  // PSI metrics for absorbed Health row
  const psiMobile = r.psi_mobile_score;
  const psiDesktop = r.psi_desktop_score;
  const lcpVal = r.psi_lcp_mobile;
  const clsVal = r.psi_cls_mobile;

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
                dot={{ r: 3, fill: 'var(--success)' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="website"
                name="Website Clicks"
                stroke="var(--text-primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--text-primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Organic Sessions"
          value={r.ga4_organic}
          previous={r.ga4_organic_prev}
          baseline={firstReport?.ga4_organic}
          baselineDate={baselineDate}
          sparklineData={organicSeries}
          velocityLabel={organicVelocity}
        />
        <StatCard
          label="Search Impressions"
          value={r.gsc_impressions}
          previous={r.gsc_impressions_prev}
          baseline={firstReport?.gsc_impressions}
          baselineDate={baselineDate}
          sparklineData={impressionsSeries}
          velocityLabel={impressionsVelocity}
        />
        <StatCard
          label="Phone Clicks"
          value={r.ga4_phone_clicks}
          previous={r.ga4_phone_clicks_prev}
          baseline={firstReport?.ga4_phone_clicks}
          baselineDate={baselineDate}
          sparklineData={phoneSeries}
        />
        <StatCard
          label="Mobile Speed Score"
          value={r.psi_mobile_score}
          format="score"
          alert={mobileScore != null && mobileScore < 50 ? 'Below threshold' : null}
        />
        {hasGbp && (
          <StatCard
            label="GBP Impressions"
            value={r.gbp_total_impressions}
            previous={r.gbp_total_impressions_prev}
            baseline={firstReport?.gbp_total_impressions}
            baselineDate={baselineDate}
            sparklineData={gbpImpressionsSeries}
          />
        )}
        {hasGbp && (
          <StatCard
            label="GBP Call Clicks"
            value={r.gbp_call_clicks}
            previous={r.gbp_call_clicks_prev}
            baseline={firstReport?.gbp_call_clicks}
            baselineDate={baselineDate}
            sparklineData={gbpCallsSeries}
          />
        )}
        {hasGbp && (
          <StatCard
            label="GBP Website Clicks"
            value={r.gbp_website_clicks}
            previous={r.gbp_website_clicks_prev}
            baseline={firstReport?.gbp_website_clicks}
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
