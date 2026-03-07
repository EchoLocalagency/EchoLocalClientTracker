/** Normalize a count metric to a daily rate based on the report's period length. */
export function dailyRate(value: number | null, periodStart: string | null, periodEnd: string | null): number {
  if (value == null || value === 0) return 0;
  if (!periodStart || !periodEnd) return value;
  const start = new Date(periodStart + 'T00:00:00');
  const end = new Date(periodEnd + 'T00:00:00');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return Math.round((value / days) * 10) / 10;
}

/** Compute 14-day rolling sum for a metric across sorted reports. */
export function rollingSum14(values: (number | null)[], index: number): number {
  let sum = 0;
  const start = Math.max(0, index - 13);
  for (let i = start; i <= index; i++) {
    sum += values[i] ?? 0;
  }
  return sum;
}

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
}): { score: number; factors: HealthFactor[] } {
  const factors: HealthFactor[] = [];

  // Mobile speed (weight 25) -- treat 0 as missing (PSI API failure)
  const mobile = report.psi_mobile_score;
  const mobileScore = mobile ? Math.min(mobile, 100) : 50;
  factors.push({ label: 'Mobile Speed', score: mobileScore, weight: 25 });

  // Desktop speed (weight 15)
  const desktop = report.psi_desktop_score;
  const desktopScore = desktop ? Math.min(desktop, 100) : 50;
  factors.push({ label: 'Desktop Speed', score: desktopScore, weight: 15 });

  // LCP (weight 20) -- under 2.5s = 100, under 4s = 60, over = 30
  const lcp = parseMetricValue(report.psi_lcp_mobile);
  const lcpScore = lcp == null ? 50 : lcp <= 2.5 ? 100 : lcp <= 4 ? 60 : 30;
  factors.push({ label: 'LCP (Mobile)', score: lcpScore, weight: 20 });

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
