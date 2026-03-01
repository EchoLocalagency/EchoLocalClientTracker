import { useMemo } from 'react';
import { Report, TimeRange } from '@/lib/types';

function getCutoffDate(range: TimeRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  switch (range) {
    case '4w':
      now.setDate(now.getDate() - 28);
      return now;
    case '3m':
      now.setMonth(now.getMonth() - 3);
      return now;
    case '6m':
      now.setMonth(now.getMonth() - 6);
      return now;
  }
}

export function useFilteredReports(reports: Report[], timeRange: TimeRange): Report[] {
  return useMemo(() => {
    const cutoff = getCutoffDate(timeRange);
    const filtered = cutoff
      ? reports.filter((r) => new Date(r.run_date + 'T00:00:00') >= cutoff)
      : [...reports];
    return filtered.sort((a, b) => a.run_date.localeCompare(b.run_date));
  }, [reports, timeRange]);
}
