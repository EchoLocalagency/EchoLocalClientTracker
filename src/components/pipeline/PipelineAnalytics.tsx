'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ChartTooltip from '@/components/ChartTooltip';
import { PIPELINE_STAGES } from '@/lib/pipeline-constants';
import type { PipelineLead, PipelineStageHistory } from '@/lib/types';

interface PipelineAnalyticsProps {
  leads: PipelineLead[];
  stageHistory: PipelineStageHistory[];
}

export default function PipelineAnalytics({ leads, stageHistory }: PipelineAnalyticsProps) {
  // ANAL-01: Conversion funnel from stage history
  const funnelData = useMemo(() => {
    const stageLeads: Record<string, Set<string>> = {};
    for (const stage of PIPELINE_STAGES) stageLeads[stage] = new Set();

    // Every lead starts at Lead stage
    for (const lead of leads) {
      stageLeads['Lead'].add(lead.id);
    }

    // Scan history for stages leads have entered
    for (const entry of stageHistory) {
      if (stageLeads[entry.new_stage]) {
        stageLeads[entry.new_stage].add(entry.lead_id);
      }
    }

    return PIPELINE_STAGES.map((stage, i) => {
      const count = stageLeads[stage].size;
      const prevCount = i === 0 ? count : stageLeads[PIPELINE_STAGES[i - 1]].size;
      const dropoff = prevCount > 0 ? Math.round((1 - count / prevCount) * 100) : 0;
      return { stage, count, dropoff };
    });
  }, [leads, stageHistory]);

  // ANAL-02: Average days per stage
  const avgDaysData = useMemo(() => {
    // Group history entries by lead_id (already sorted by transitioned_at asc)
    const byLead: Record<string, PipelineStageHistory[]> = {};
    for (const entry of stageHistory) {
      if (!byLead[entry.lead_id]) byLead[entry.lead_id] = [];
      byLead[entry.lead_id].push(entry);
    }

    const stageDurations: Record<string, number[]> = {};
    for (const stage of PIPELINE_STAGES) stageDurations[stage] = [];

    // Process history entries
    for (const entries of Object.values(byLead)) {
      for (let i = 0; i < entries.length; i++) {
        const stage = entries[i].new_stage;
        const enteredAt = new Date(entries[i].transitioned_at).getTime();
        const exitedAt = i < entries.length - 1
          ? new Date(entries[i + 1].transitioned_at).getTime()
          : Date.now();
        const days = (exitedAt - enteredAt) / 86400000;
        stageDurations[stage].push(days);
      }
    }

    // For leads with NO history entries, compute Lead stage duration
    const leadsWithHistory = new Set(Object.keys(byLead));
    for (const lead of leads) {
      if (!leadsWithHistory.has(lead.id)) {
        const days = (Date.now() - new Date(lead.stage_entered_at).getTime()) / 86400000;
        stageDurations['Lead'].push(days);
      }
    }

    return PIPELINE_STAGES.map(stage => {
      const durations = stageDurations[stage];
      const avgDays = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : null;
      return { stage, avgDays, sampleSize: durations.length };
    });
  }, [leads, stageHistory]);

  // ANAL-03: Source breakdown
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const src = lead.source || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  if (leads.length === 0) return null;

  return (
    <div style={{ marginTop: 20, marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        Analytics
      </h2>

      {/* Avg days per stage metric cards */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {avgDaysData.map(item => (
          <div
            key={item.stage}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: '12px 16px',
              flex: 1,
              minWidth: 100,
            }}
          >
            <div style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {item.stage}
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              marginTop: 2,
            }}>
              {item.avgDays !== null ? `${item.avgDays.toFixed(1)}d` : '--'}
            </div>
            <div style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              marginTop: 2,
            }}>
              {item.sampleSize} lead{item.sampleSize !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column chart layout */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Conversion Funnel */}
        <div style={{
          flex: 1,
          minWidth: 300,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            Conversion Funnel
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Unique leads that reached each stage
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                  width={80}
                />
                <Tooltip
                  content={<ChartTooltip formatter={(value, name) => {
                    const item = funnelData.find(d => d.stage === name || d.count === value);
                    const dropoff = item ? ` (${item.dropoff}% drop)` : '';
                    return `${value} leads${dropoff}`;
                  }} />}
                />
                <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                  {funnelData.map((_, index) => (
                    <Cell key={index} fill={`rgba(6, 182, 212, ${1 - index * 0.12})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Sources */}
        <div style={{
          flex: 1,
          minWidth: 300,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            Lead Sources
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Where leads originate
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} layout="vertical" margin={{ left: 20, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                  width={80}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Leads" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
