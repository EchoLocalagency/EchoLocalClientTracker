import { Report } from '@/lib/types';
import { calcDelta, formatDelta, formatNumber, parseMetricValue, calcHealthScore } from '@/lib/utils';

export function generateSummary(
  report: Report,
  firstReport: Report | null,
  clientName: string,
): string {
  const lines: string[] = [];
  const date = new Date(report.run_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  lines.push(`Performance Summary for ${clientName}`);
  lines.push(`Report date: ${date}`);
  lines.push(`Period: ${report.period_start} to ${report.period_end}`);
  lines.push('');

  // Health score
  const { score } = calcHealthScore(report);
  const grade = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Improvement' : 'Critical';
  lines.push(`Overall Health Score: ${score}/100 (${grade})`);
  lines.push('');

  // Traffic
  lines.push('--- Traffic ---');
  const organicDelta = calcDelta(report.ga4_organic, report.ga4_organic_prev);
  lines.push(`Organic Sessions: ${formatNumber(report.ga4_organic)} (${formatDelta(organicDelta)} vs previous period)`);

  const sessionsDelta = calcDelta(report.ga4_sessions, report.ga4_sessions_prev);
  lines.push(`Total Sessions: ${formatNumber(report.ga4_sessions)} (${formatDelta(sessionsDelta)})`);

  if (firstReport && firstReport.ga4_organic != null && report.ga4_organic != null) {
    const baselineDelta = calcDelta(report.ga4_organic, firstReport.ga4_organic);
    const baseDate = new Date(firstReport.run_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    lines.push(`Since ${baseDate}: ${formatDelta(baselineDelta)} organic growth`);
  }
  lines.push('');

  // Search visibility
  lines.push('--- Search Visibility ---');
  const impressionsDelta = calcDelta(report.gsc_impressions, report.gsc_impressions_prev);
  lines.push(`Impressions: ${formatNumber(report.gsc_impressions)} (${formatDelta(impressionsDelta)})`);

  const clicksDelta = calcDelta(report.gsc_clicks, report.gsc_clicks_prev);
  lines.push(`Clicks: ${formatNumber(report.gsc_clicks)} (${formatDelta(clicksDelta)})`);

  if (report.gsc_avg_position != null) {
    lines.push(`Avg Position: ${report.gsc_avg_position.toFixed(1)}`);
  }
  lines.push('');

  // Conversions
  lines.push('--- Conversions ---');
  const phoneDelta = calcDelta(report.ga4_phone_clicks, report.ga4_phone_clicks_prev);
  lines.push(`Phone Clicks: ${formatNumber(report.ga4_phone_clicks)} (${formatDelta(phoneDelta)})`);

  if (report.ga4_form_submits != null) {
    const formDelta = calcDelta(report.ga4_form_submits, report.ga4_form_submits_prev);
    lines.push(`Form Submissions: ${formatNumber(report.ga4_form_submits)} (${formatDelta(formDelta)})`);
  }
  lines.push('');

  // Site speed
  lines.push('--- Website Speed ---');
  if (report.psi_mobile_score != null) lines.push(`Mobile Score: ${report.psi_mobile_score}/100`);
  if (report.psi_desktop_score != null) lines.push(`Desktop Score: ${report.psi_desktop_score}/100`);
  const lcp = parseMetricValue(report.psi_lcp_mobile);
  if (lcp != null) lines.push(`Mobile LCP: ${report.psi_lcp_mobile}`);
  lines.push('');

  // Alerts
  const issues: string[] = [];
  if (report.psi_mobile_score != null && report.psi_mobile_score < 50) issues.push('Mobile speed score below 50');
  if (lcp != null && lcp > 4) issues.push('LCP above 4 seconds');
  if (organicDelta != null && organicDelta < -20) issues.push(`Organic traffic dropped ${Math.abs(organicDelta).toFixed(0)}%`);

  if (issues.length > 0) {
    lines.push('--- Action Items ---');
    issues.forEach((issue) => lines.push(`- ${issue}`));
  }

  return lines.join('\n');
}
