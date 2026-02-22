export function calcDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatDelta(delta: number | null): string {
  if (delta == null) return '--';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

export function formatNumber(n: number | null): string {
  if (n == null) return '--';
  return n.toLocaleString();
}

export function formatPosition(n: number | null): string {
  if (n == null) return '--';
  return n.toFixed(1);
}

export function parseMetricValue(val: string | null): number | null {
  if (!val) return null;
  return parseFloat(val.replace(/[^0-9.]/g, ''));
}

export interface HealthFactor {
  label: string;
  score: number;
  weight: number;
}

export function calcHealthScore(report: {
  psi_mobile_score: number | null;
  psi_desktop_score: number | null;
  psi_lcp_mobile: string | null;
  gsc_avg_position: number | null;
  ga4_organic: number | null;
  ga4_organic_prev: number | null;
}): { score: number; factors: HealthFactor[] } {
  const factors: HealthFactor[] = [];

  // Mobile speed (weight 25)
  const mobile = report.psi_mobile_score;
  const mobileScore = mobile != null ? Math.min(mobile, 100) : 50;
  factors.push({ label: 'Mobile Speed', score: mobileScore, weight: 25 });

  // Desktop speed (weight 15)
  const desktop = report.psi_desktop_score;
  const desktopScore = desktop != null ? Math.min(desktop, 100) : 50;
  factors.push({ label: 'Desktop Speed', score: desktopScore, weight: 15 });

  // LCP (weight 20) — under 2.5s = 100, under 4s = 60, over = 30
  const lcp = parseMetricValue(report.psi_lcp_mobile);
  const lcpScore = lcp == null ? 50 : lcp <= 2.5 ? 100 : lcp <= 4 ? 60 : 30;
  factors.push({ label: 'LCP (Mobile)', score: lcpScore, weight: 20 });

  // Search position (weight 20) — pos 1=100, 10=60, 20=30, 50+=10
  const pos = report.gsc_avg_position;
  const posScore = pos == null ? 50 : pos <= 3 ? 100 : pos <= 10 ? 80 : pos <= 20 ? 50 : pos <= 50 ? 25 : 10;
  factors.push({ label: 'Avg Position', score: posScore, weight: 20 });

  // Organic growth (weight 20)
  const organic = report.ga4_organic;
  const organicPrev = report.ga4_organic_prev;
  let growthScore = 50;
  if (organic != null && organicPrev != null && organicPrev > 0) {
    const delta = ((organic - organicPrev) / organicPrev) * 100;
    growthScore = delta >= 20 ? 100 : delta >= 5 ? 80 : delta >= -5 ? 60 : delta >= -20 ? 35 : 15;
  }
  factors.push({ label: 'Organic Growth', score: growthScore, weight: 20 });

  const total = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const maxWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round(total / maxWeight);

  return { score, factors };
}

export type Velocity = 'accelerating' | 'steady' | 'decelerating' | 'declining';

export function calcVelocity(values: number[]): Velocity {
  if (values.length < 3) return 'steady';

  const recent = values.slice(-3);
  const deltas: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    deltas.push(recent[i] - recent[i - 1]);
  }

  const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  const lastVal = recent[recent.length - 1];
  const threshold = lastVal === 0 ? 1 : Math.abs(lastVal) * 0.05;

  if (avgDelta > threshold && deltas[deltas.length - 1] > deltas[0]) return 'accelerating';
  if (avgDelta > threshold) return 'steady';
  if (avgDelta < -threshold && deltas[deltas.length - 1] < deltas[0]) return 'declining';
  if (avgDelta < -threshold) return 'decelerating';
  return 'steady';
}
