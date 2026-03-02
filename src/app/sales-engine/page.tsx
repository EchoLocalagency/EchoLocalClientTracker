'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface SalesCall {
  id: string;
  call_transcript: string | null;
  call_summary: string | null;
  call_duration: string | null;
  call_from: string | null;
  call_to: string | null;
  call_start_time: string | null;
  call_end_time: string | null;
  call_status: string | null;
  recording_url: string | null;
  contact_name: string | null;
  company_name: string | null;
  analyzed: boolean;
  created_at: string;
}

interface CallAnalysis {
  id: string;
  call_id: string;
  outcome: string | null;
  objections: Array<{ type: string; exact_quote?: string; response_quality?: string; better_response?: string }>;
  score: number | null;
  talk_ratio: number | null;
  energy_score: number | null;
  opener_used: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
  coaching_notes: string | null;
  key_moments: Array<{ timestamp?: string; moment: string; impact: string }>;
  analyzed_at: string;
}

interface DailyReport {
  id: string;
  report_date: string;
  total_dials: number;
  conversations: number;
  meetings_booked: number;
  avg_score: number | null;
  avg_talk_ratio: number | null;
  avg_energy: number | null;
  top_objections: Array<{ type: string; count: number; best_handle?: string }>;
  objection_counts: Record<string, number>;
  win_patterns: string | null;
  loss_patterns: string | null;
  daily_coaching: string | null;
  call_ids: string[] | null;
  created_at: string;
}

interface CallWithAnalysis extends SalesCall {
  analysis?: CallAnalysis;
}

const OUTCOME_COLORS: Record<string, string> = {
  meeting_booked: '#00E676',
  closed: '#00E676',
  follow_up: '#E8FF00',
  conversation: '#E8FF00',
  gatekeeper: '#8A8F98',
  not_interested: '#FF3D57',
  voicemail: '#8A8F98',
  no_answer: '#555',
};

const OUTCOME_LABELS: Record<string, string> = {
  meeting_booked: 'Meeting Booked',
  closed: 'Closed',
  follow_up: 'Follow Up',
  conversation: 'Conversation',
  gatekeeper: 'Gatekeeper',
  not_interested: 'Not Interested',
  voicemail: 'Voicemail',
  no_answer: 'No Answer',
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const color = OUTCOME_COLORS[outcome] || '#8A8F98';
  const label = OUTCOME_LABELS[outcome] || outcome;
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      padding: '3px 10px',
      borderRadius: 12,
      background: `${color}22`,
      color,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? '#00E676' : score >= 4 ? '#E8FF00' : '#FF3D57';
  return (
    <span style={{
      fontSize: 18,
      fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      color,
    }}>
      {score}
    </span>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: 'var(--bg-depth)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export default function SalesEnginePage() {
  const [calls, setCalls] = useState<CallWithAnalysis[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [latestReport, setLatestReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // Load recent calls
      const { data: callsData } = await supabase
        .from('sales_calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Load analyses
      const { data: analysesData } = await supabase
        .from('call_analyses')
        .select('*')
        .order('analyzed_at', { ascending: false })
        .limit(50);

      // Load daily reports
      const { data: reportsData } = await supabase
        .from('daily_call_reports')
        .select('*')
        .order('report_date', { ascending: true })
        .limit(90);

      // Merge calls with their analyses
      const analysisMap = new Map<string, CallAnalysis>();
      (analysesData || []).forEach((a: CallAnalysis) => {
        analysisMap.set(a.call_id, a);
      });

      const merged: CallWithAnalysis[] = (callsData || []).map((c: SalesCall) => ({
        ...c,
        analysis: analysisMap.get(c.id),
      }));

      setCalls(merged);
      setDailyReports(reportsData || []);
      setLatestReport(reportsData && reportsData.length > 0 ? reportsData[reportsData.length - 1] : null);
      setLoading(false);
    }

    loadData();
  }, []);

  // Compute stats from all analyzed calls
  const analyzedCalls = calls.filter(c => c.analysis);
  const totalDials = calls.length;
  const totalConversations = analyzedCalls.filter(c =>
    ['conversation', 'follow_up', 'meeting_booked', 'closed'].includes(c.analysis?.outcome || '')
  ).length;
  const totalMeetings = analyzedCalls.filter(c =>
    ['meeting_booked', 'closed'].includes(c.analysis?.outcome || '')
  ).length;
  const scores = analyzedCalls.map(c => c.analysis!.score).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '--';
  const ratios = analyzedCalls.map(c => c.analysis!.talk_ratio).filter((r): r is number => r != null);
  const avgRatio = ratios.length > 0 ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length * 100) : null;

  // Objection breakdown from all analyses
  const objectionCounts: Record<string, number> = {};
  analyzedCalls.forEach(c => {
    (c.analysis!.objections || []).forEach((o) => {
      const t = typeof o === 'string' ? o : o.type;
      objectionCounts[t] = (objectionCounts[t] || 0) + 1;
    });
  });
  const sortedObjections = Object.entries(objectionCounts).sort(([, a], [, b]) => b - a);

  // Chart data from daily reports
  const chartData = dailyReports.map(r => ({
    date: new Date(r.report_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    dials: r.total_dials,
    conversations: r.conversations,
    meetings: r.meetings_booked,
    score: r.avg_score,
  }));

  const cardStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)' as const,
    padding: '20px 24px',
    marginBottom: 20,
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{
        padding: '24px 40px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a
            href="/"
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          >
            &#8249; Dashboard
          </a>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: 'var(--font-sans)' }}>
              Sales Engine
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              Call analysis + daily coaching
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last report</div>
          <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
            {latestReport ? latestReport.report_date : 'No reports yet'}
          </div>
        </div>
      </header>

      <div style={{ padding: '28px 40px', maxWidth: 1200 }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatBox label="Total Dials" value={totalDials} />
          <StatBox label="Conversations" value={totalConversations} sub={totalDials > 0 ? `${Math.round(totalConversations / totalDials * 100)}% pick-up` : undefined} />
          <StatBox label="Meetings Booked" value={totalMeetings} sub={totalConversations > 0 ? `${Math.round(totalMeetings / totalConversations * 100)}% close rate` : undefined} />
          <StatBox label="Avg Score" value={avgScore} sub="/10" />
          <StatBox label="Talk Ratio" value={avgRatio != null ? `${avgRatio}%` : '--'} sub={avgRatio != null ? (avgRatio < 30 ? 'Great -- listening' : avgRatio < 50 ? 'Good balance' : 'Talking too much') : undefined} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          {/* Daily volume chart */}
          {chartData.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Daily Call Volume</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="dials" fill="#8A8F98" name="Dials" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="conversations" fill="#E8FF00" name="Conversations" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="meetings" fill="#00E676" name="Meetings" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Score trend chart */}
          {chartData.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Call Score Trend</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="score" stroke="#E8FF00" strokeWidth={2} dot={{ fill: '#E8FF00', r: 4 }} name="Avg Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 28 }}>
          {/* Call feed */}
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
              Recent Calls
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                {calls.length} total
              </span>
            </div>

            {calls.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', padding: 20, textAlign: 'center', fontSize: 13 }}>
                No calls yet. Make some calls and they will appear here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {calls.map((call) => {
                  const a = call.analysis;
                  const isExpanded = expandedCall === call.id;
                  return (
                    <div key={call.id}>
                      <button
                        onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          width: '100%',
                          padding: '12px 16px',
                          background: isExpanded ? 'rgba(232, 255, 0, 0.04)' : 'transparent',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Score */}
                        <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
                          {a?.score ? <ScoreBadge score={a.score} /> : <span style={{ fontSize: 12, color: '#555' }}>--</span>}
                        </div>

                        {/* Contact info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {call.contact_name || call.call_to || 'Unknown'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {call.company_name || ''}
                            {call.company_name && call.call_duration ? ' \u00B7 ' : ''}
                            {call.call_duration || ''}
                          </div>
                        </div>

                        {/* Outcome */}
                        <div style={{ flexShrink: 0 }}>
                          {a?.outcome ? <OutcomeBadge outcome={a.outcome} /> : (
                            <span style={{ fontSize: 11, color: '#555', fontFamily: 'var(--font-mono)' }}>
                              {call.analyzed ? 'analyzed' : 'pending'}
                            </span>
                          )}
                        </div>

                        {/* Time */}
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 80, textAlign: 'right' }}>
                          {call.call_start_time
                            ? new Date(call.call_start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                            : new Date(call.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          }
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && a && (
                        <div style={{
                          padding: '16px 16px 16px 68px',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13,
                        }}>
                          {/* Coaching notes */}
                          {a.coaching_notes && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>Coaching</div>
                              <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{a.coaching_notes}</div>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* Strengths */}
                            {a.strengths && a.strengths.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 6 }}>Strengths</div>
                                {a.strengths.map((s, i) => (
                                  <div key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid var(--success)' }}>
                                    {s}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Improvements */}
                            {a.improvements && a.improvements.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 6 }}>Improve</div>
                                {a.improvements.map((s, i) => (
                                  <div key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid var(--danger)' }}>
                                    {s}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Objections */}
                          {a.objections && a.objections.length > 0 && (
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Objections</div>
                              {a.objections.map((obj, i) => (
                                <div key={i} style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>{obj.type}</span>
                                    {obj.response_quality && (
                                      <span style={{
                                        fontSize: 10,
                                        padding: '1px 6px',
                                        borderRadius: 8,
                                        background: obj.response_quality === 'good' ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.15)',
                                        color: obj.response_quality === 'good' ? 'var(--success)' : 'var(--danger)',
                                      }}>
                                        {obj.response_quality}
                                      </span>
                                    )}
                                  </div>
                                  {obj.exact_quote && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 4 }}>
                                      &ldquo;{obj.exact_quote}&rdquo;
                                    </div>
                                  )}
                                  {obj.better_response && (
                                    <div style={{ fontSize: 12, color: 'var(--success)' }}>
                                      Better: {obj.better_response}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Talk ratio + energy */}
                          <div style={{ display: 'flex', gap: 24, marginTop: 14, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {a.talk_ratio != null && (
                              <span>Talk ratio: <span style={{ color: a.talk_ratio < 0.3 ? 'var(--success)' : a.talk_ratio > 0.5 ? 'var(--danger)' : 'var(--accent)' }}>{Math.round(a.talk_ratio * 100)}%</span></span>
                            )}
                            {a.energy_score != null && (
                              <span>Energy: <span style={{ color: a.energy_score >= 7 ? 'var(--success)' : a.energy_score >= 4 ? 'var(--accent)' : 'var(--danger)' }}>{a.energy_score}/10</span></span>
                            )}
                            {a.opener_used && (
                              <span>Opener: {a.opener_used}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column: Objections + Daily Coaching */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Objection breakdown */}
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Objection Breakdown</div>
              {sortedObjections.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No objection data yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sortedObjections.map(([type, count]) => {
                    const max = sortedObjections[0][1];
                    const pct = (count / max) * 100;
                    return (
                      <div key={type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{type}</span>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Latest coaching report */}
            {latestReport && latestReport.daily_coaching && (
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Daily Coaching</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {latestReport.report_date}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {latestReport.daily_coaching}
                </div>
                {latestReport.win_patterns && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 6 }}>Win Patterns</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{latestReport.win_patterns}</div>
                  </div>
                )}
                {latestReport.loss_patterns && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 6 }}>Loss Patterns</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{latestReport.loss_patterns}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
