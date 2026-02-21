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
