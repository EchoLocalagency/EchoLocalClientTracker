'use client';

import { WeeklyTrendPoint } from '@/lib/types';
import ChartTooltip from '@/components/ChartTooltip';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface CitationTrendChartProps {
  data: WeeklyTrendPoint[];
}

export default function CitationTrendChart({ data }: CitationTrendChartProps) {
  const current = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: 24,
    }}>
      <div>
        <div style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          AI Overview Citation Trend
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 4,
        }}>
          Weekly citation rate across tracked keywords
        </div>
      </div>

      {data.length === 0 && (
        <div style={{
          color: 'var(--text-secondary)',
          padding: 32,
          textAlign: 'center',
        }}>
          No citation trend data yet. Trends appear after multiple research runs.
        </div>
      )}

      {data.length === 1 && current && (
        <div style={{
          marginTop: 20,
          padding: 20,
          background: 'rgba(6,182,212,0.05)',
          borderRadius: 8,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 8,
          }}>
            Week of {current.week}
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: current.citationRate >= 50 ? 'var(--success)' : 'var(--accent)',
          }}>
            {current.citedCount}/{current.aioCount} keywords cited ({current.citationRate}%)
          </div>
        </div>
      )}

      {data.length >= 2 && (
        <>
          <div style={{ marginTop: 20 }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
                />
                <Area
                  type="monotone"
                  dataKey="citedCount"
                  name="Cited Keywords"
                  stroke="var(--success)"
                  fill="rgba(16,185,129,0.1)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="aioCount"
                  name="AI Overview Keywords"
                  stroke="var(--accent)"
                  fill="rgba(6,182,212,0.08)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {current && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: current.citationRate >= 50 ? 'var(--success)' : 'var(--accent)',
              }}>
                Current citation rate: {current.citationRate}%
              </div>
              <div style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 4,
              }}>
                {current.citedCount} of {current.aioCount} keywords cited
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
