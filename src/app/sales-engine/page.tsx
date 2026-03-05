'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  callback_priority: string | null;
  callback_status: string | null;
  callback_notes: string | null;
  caller_details: CallerDetails | null;
  callback_completed_at: string | null;
}

interface CallerDetails {
  contact_person?: string;
  role?: string;
  interest_level?: string;
  situation?: string;
  key_info?: string[];
  next_step?: string;
  best_time_to_call?: string;
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
  key_moments: Array<{ id?: number; quote?: string; timestamp?: string; moment: string; impact: string }>;
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

// ── Constants ──

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

const PRIORITY_CONFIG: Record<string, { color: string; label: string; order: number }> = {
  hot_lead: { color: '#FF3D57', label: 'Hot Lead', order: 0 },
  follow_up: { color: '#E8FF00', label: 'Follow Up', order: 1 },
  callback: { color: '#8A8F98', label: 'Callback', order: 2 },
  no_answer: { color: '#555', label: 'No Answer', order: 3 },
  no_action: { color: '#555', label: 'No Action', order: 4 },
};

const INTEREST_COLORS: Record<string, string> = {
  hot: '#FF3D57',
  warm: '#E8FF00',
  cold: '#8A8F98',
  unknown: '#555',
};

type TabType = 'callbacks' | 'coaching';

// ── Helper: parse [N] references in coaching text ──

function renderWithRefs(
  text: string,
  onRefClick: (id: number) => void,
  keyMoments?: Array<{ id?: number; quote?: string; moment: string; impact: string }>,
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const refId = parseInt(match[1], 10);
      const moment = keyMoments?.find(m => m.id === refId);
      const tooltip = moment ? `[${refId}] ${moment.moment}` : `Moment ${refId}`;
      return (
        <span
          key={i}
          onClick={(e) => { e.stopPropagation(); onRefClick(refId); }}
          title={tooltip}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#0A0F1E',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            marginLeft: 2,
            marginRight: 2,
            verticalAlign: 'middle',
            lineHeight: 1,
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {refId}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Shared Components ──

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

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] || { color: '#555', label: priority };
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      padding: '3px 10px',
      borderRadius: 12,
      background: `${config.color}22`,
      color: config.color,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {config.label}
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

function TranscriptPanel({
  transcript,
  keyMoments,
  highlightedMoment,
  onHighlightClear,
}: {
  transcript: string | null;
  keyMoments?: Array<{ id?: number; quote?: string; moment: string; impact: string }>;
  highlightedMoment: number | null;
  onHighlightClear: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRefs = useRef<Record<number, HTMLSpanElement | null>>({});

  useEffect(() => {
    if (highlightedMoment != null) {
      const el = highlightRefs.current[highlightedMoment];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.background = 'rgba(232, 255, 0, 0.25)';
        const timer = setTimeout(() => {
          el.style.background = 'rgba(232, 255, 0, 0.10)';
          onHighlightClear();
        }, 1500);
        return () => clearTimeout(timer);
      }
      const timer = setTimeout(onHighlightClear, 1500);
      return () => clearTimeout(timer);
    }
  }, [highlightedMoment, onHighlightClear]);

  if (!transcript) {
    return (
      <div style={{
        maxHeight: 500,
        borderLeft: '1px solid var(--border)',
        paddingLeft: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 12,
      }}>
        No transcript available
      </div>
    );
  }

  const momentsWithQuotes = (keyMoments || []).filter(m => m.id != null && m.quote);

  function buildTranscriptNodes(): React.ReactNode[] {
    if (momentsWithQuotes.length === 0) {
      return [<span key="plain">{transcript}</span>];
    }

    type Mark = { start: number; end: number; id: number; moment: string; impact: string };
    const marks: Mark[] = [];
    for (const m of momentsWithQuotes) {
      const idx = transcript!.toLowerCase().indexOf(m.quote!.toLowerCase());
      if (idx !== -1) {
        marks.push({ start: idx, end: idx + m.quote!.length, id: m.id!, moment: m.moment, impact: m.impact });
      }
    }
    marks.sort((a, b) => a.start - b.start);

    const cleaned: Mark[] = [];
    let lastEnd = 0;
    for (const mark of marks) {
      if (mark.start >= lastEnd) {
        cleaned.push(mark);
        lastEnd = mark.end;
      }
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const mark of cleaned) {
      if (mark.start > cursor) {
        nodes.push(<span key={`t-${cursor}`}>{transcript!.slice(cursor, mark.start)}</span>);
      }
      const impactColor = mark.impact === 'positive' ? 'var(--success)' : mark.impact === 'negative' ? 'var(--danger)' : 'var(--accent)';
      nodes.push(
        <span
          key={`m-${mark.id}`}
          ref={el => { highlightRefs.current[mark.id] = el; }}
          title={`[${mark.id}] ${mark.moment}`}
          style={{
            background: 'rgba(232, 255, 0, 0.10)',
            borderRadius: 3,
            padding: '1px 2px',
            transition: 'background 0.3s ease',
            position: 'relative',
          }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: impactColor,
            color: '#0A0F1E',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            marginRight: 3,
            verticalAlign: 'middle',
            lineHeight: 1,
          }}>
            {mark.id}
          </span>
          {transcript!.slice(mark.start, mark.end)}
        </span>
      );
      cursor = mark.end;
    }
    if (cursor < transcript!.length) {
      nodes.push(<span key={`t-${cursor}`}>{transcript!.slice(cursor)}</span>);
    }
    return nodes;
  }

  return (
    <div
      ref={scrollRef}
      style={{
        maxHeight: 500,
        overflowY: 'auto',
        fontSize: 12,
        borderLeft: '1px solid var(--border)',
        paddingLeft: 16,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
        Transcript
      </div>
      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {buildTranscriptNodes()}
      </div>
    </div>
  );
}

// ── Callback Queue Tab ──

function CallbackQueue({
  calls,
  onStatusChange,
  onNotesChange,
}: {
  calls: CallWithAnalysis[];
  onStatusChange: (id: string, status: string) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('actionable');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  // Filter and sort
  const filtered = calls.filter(c => {
    if (!c.analyzed) return false;
    const priority = c.callback_priority || 'no_action';
    if (filter === 'actionable') return priority !== 'no_action' && priority !== 'no_answer' && c.callback_status !== 'completed';
    if (filter === 'completed') return c.callback_status === 'completed';
    if (filter === 'all') return true;
    return priority === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    // Pending before completed
    if (a.callback_status === 'completed' && b.callback_status !== 'completed') return 1;
    if (a.callback_status !== 'completed' && b.callback_status === 'completed') return -1;
    // Priority order
    const aPri = PRIORITY_CONFIG[a.callback_priority || 'no_action']?.order ?? 99;
    const bPri = PRIORITY_CONFIG[b.callback_priority || 'no_action']?.order ?? 99;
    if (aPri !== bPri) return aPri - bPri;
    // Newest first within same priority
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const counts = {
    actionable: calls.filter(c => c.analyzed && c.callback_priority && c.callback_priority !== 'no_action' && c.callback_priority !== 'no_answer' && c.callback_status !== 'completed').length,
    hot_lead: calls.filter(c => c.callback_priority === 'hot_lead' && c.callback_status !== 'completed').length,
    follow_up: calls.filter(c => c.callback_priority === 'follow_up' && c.callback_status !== 'completed').length,
    callback: calls.filter(c => c.callback_priority === 'callback' && c.callback_status !== 'completed').length,
    no_answer: calls.filter(c => c.callback_priority === 'no_answer').length,
    completed: calls.filter(c => c.callback_status === 'completed').length,
  };

  const cardStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-card)' as const,
    padding: '20px 24px',
    marginBottom: 20,
  };

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatBox label="Needs Callback" value={counts.actionable} sub={`${counts.hot_lead} hot`} />
        <StatBox label="Hot Leads" value={counts.hot_lead} sub="call ASAP" />
        <StatBox label="Follow Ups" value={counts.follow_up} sub="worth another try" />
        <StatBox label="Completed" value={counts.completed} />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'actionable', label: `Action Needed (${counts.actionable})` },
          { key: 'hot_lead', label: `Hot (${counts.hot_lead})` },
          { key: 'follow_up', label: `Follow Up (${counts.follow_up})` },
          { key: 'callback', label: `Callback (${counts.callback})` },
          { key: 'no_answer', label: `No Answer (${counts.no_answer})` },
          { key: 'completed', label: `Done (${counts.completed})` },
          { key: 'all', label: 'All' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              padding: '6px 14px',
              borderRadius: 8,
              border: filter === f.key ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: filter === f.key ? 'rgba(232, 255, 0, 0.08)' : 'transparent',
              color: filter === f.key ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: filter === f.key ? 600 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Callback list */}
      {sorted.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: 40 }}>
          {filter === 'actionable' ? 'No callbacks needed right now.' : 'No calls match this filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(call => {
            const a = call.analysis;
            const details = call.caller_details;
            const priority = call.callback_priority || 'no_action';
            const isCompleted = call.callback_status === 'completed';
            const isExpanded = expandedId === call.id;
            const priConfig = PRIORITY_CONFIG[priority] || { color: '#555', label: priority };

            return (
              <div
                key={call.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${isExpanded ? priConfig.color + '44' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                  opacity: isCompleted ? 0.5 : 1,
                  transition: 'opacity 0.2s ease, border-color 0.2s ease',
                }}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : call.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    width: '100%',
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {/* Priority indicator */}
                  <div style={{
                    width: 4,
                    height: 40,
                    borderRadius: 2,
                    background: priConfig.color,
                    flexShrink: 0,
                  }} />

                  {/* Contact info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {call.contact_name || call.call_to || 'Unknown'}
                      </span>
                      {call.company_name && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {call.company_name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                      {details?.contact_person && details.contact_person !== call.contact_name && (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Spoke with: {details.contact_person}
                        </span>
                      )}
                      {details?.role && (
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {details.role}
                        </span>
                      )}
                      {details?.next_step && (
                        <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                          {details.next_step}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Interest level */}
                  {details?.interest_level && details.interest_level !== 'unknown' && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: `${INTEREST_COLORS[details.interest_level] || '#555'}22`,
                      color: INTEREST_COLORS[details.interest_level] || '#555',
                      textTransform: 'uppercase',
                    }}>
                      {details.interest_level}
                    </span>
                  )}

                  {/* Priority + outcome */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <PriorityBadge priority={priority} />
                    {a?.outcome && <OutcomeBadge outcome={a.outcome} />}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 70, textAlign: 'right' }}>
                    {new Date(call.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px 40px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, paddingTop: 16 }}>
                      {/* Left: caller details + notes */}
                      <div>
                        {/* Situation */}
                        {details?.situation && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>
                              Situation
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                              {details.situation}
                            </div>
                          </div>
                        )}

                        {/* Key info */}
                        {details?.key_info && details.key_info.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>
                              Key Intel
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {details.key_info.map((info, i) => (
                                <div key={i} style={{
                                  fontSize: 12,
                                  color: 'var(--text-secondary)',
                                  paddingLeft: 10,
                                  borderLeft: '2px solid var(--border)',
                                }}>
                                  {info}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Call meta */}
                        <div style={{ display: 'flex', gap: 20, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 16 }}>
                          {call.call_duration && <span>Duration: {call.call_duration}s</span>}
                          {a?.score && <span>Score: <span style={{ color: a.score >= 7 ? 'var(--success)' : a.score >= 4 ? 'var(--accent)' : 'var(--danger)' }}>{a.score}/10</span></span>}
                          {details?.best_time_to_call && <span>Best time: {details.best_time_to_call}</span>}
                        </div>

                        {/* Coaching one-liner */}
                        {a?.coaching_notes && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                              Coaching
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {a.coaching_notes}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
                            Your Notes
                          </div>
                          {editingNotes === call.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <textarea
                                value={notesText}
                                onChange={e => setNotesText(e.target.value)}
                                placeholder="Add notes for callback..."
                                style={{
                                  width: '100%',
                                  minHeight: 60,
                                  padding: 10,
                                  fontSize: 12,
                                  fontFamily: 'var(--font-sans)',
                                  background: 'var(--bg-depth)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  color: 'var(--text-primary)',
                                  resize: 'vertical',
                                }}
                              />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={() => {
                                    onNotesChange(call.id, notesText);
                                    setEditingNotes(null);
                                  }}
                                  style={{
                                    fontSize: 11,
                                    fontFamily: 'var(--font-mono)',
                                    padding: '4px 12px',
                                    borderRadius: 6,
                                    border: '1px solid var(--accent)',
                                    background: 'rgba(232, 255, 0, 0.1)',
                                    color: 'var(--accent)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingNotes(null)}
                                  style={{
                                    fontSize: 11,
                                    fontFamily: 'var(--font-mono)',
                                    padding: '4px 12px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingNotes(call.id);
                                setNotesText(call.callback_notes || '');
                              }}
                              style={{
                                fontSize: 12,
                                color: call.callback_notes ? 'var(--text-primary)' : 'var(--text-secondary)',
                                padding: 10,
                                background: 'var(--bg-depth)',
                                borderRadius: 6,
                                cursor: 'pointer',
                                minHeight: 36,
                                lineHeight: 1.5,
                              }}
                            >
                              {call.callback_notes || 'Click to add notes...'}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!isCompleted ? (
                            <>
                              <button
                                onClick={() => onStatusChange(call.id, 'completed')}
                                style={{
                                  fontSize: 12,
                                  fontFamily: 'var(--font-mono)',
                                  padding: '8px 16px',
                                  borderRadius: 8,
                                  border: '1px solid var(--success)',
                                  background: 'rgba(0, 230, 118, 0.1)',
                                  color: 'var(--success)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                              >
                                Mark Complete
                              </button>
                              <button
                                onClick={() => onStatusChange(call.id, 'skipped')}
                                style={{
                                  fontSize: 12,
                                  fontFamily: 'var(--font-mono)',
                                  padding: '8px 16px',
                                  borderRadius: 8,
                                  border: '1px solid var(--border)',
                                  background: 'transparent',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                }}
                              >
                                Skip
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => onStatusChange(call.id, 'pending')}
                              style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right: transcript excerpt */}
                      <div style={{
                        maxHeight: 400,
                        overflowY: 'auto',
                        fontSize: 12,
                        borderLeft: '1px solid var(--border)',
                        paddingLeft: 16,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
                          Transcript
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {call.call_transcript || 'No transcript available'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function SalesEnginePage() {
  const [calls, setCalls] = useState<CallWithAnalysis[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [latestReport, setLatestReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [highlightedMoment, setHighlightedMoment] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('callbacks');

  const handleHighlightClear = useCallback(() => setHighlightedMoment(null), []);

  const handleRefClick = useCallback((id: number) => {
    setHighlightedMoment(id);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: callsData } = await supabase
        .from('sales_calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: analysesData } = await supabase
        .from('call_analyses')
        .select('*')
        .order('analyzed_at', { ascending: false })
        .limit(100);

      const { data: reportsData } = await supabase
        .from('daily_call_reports')
        .select('*')
        .order('report_date', { ascending: true })
        .limit(90);

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

  // ── Callback handlers ──

  async function handleCallbackStatus(id: string, status: string) {
    const update: Record<string, unknown> = {
      callback_status: status,
      callback_completed_at: status === 'completed' ? new Date().toISOString() : null,
    };
    await supabase.from('sales_calls').update(update).eq('id', id);
    setCalls(prev => prev.map(c => c.id === id ? { ...c, callback_status: status, callback_completed_at: update.callback_completed_at as string | null } : c));
  }

  async function handleCallbackNotes(id: string, notes: string) {
    await supabase.from('sales_calls').update({ callback_notes: notes }).eq('id', id);
    setCalls(prev => prev.map(c => c.id === id ? { ...c, callback_notes: notes } : c));
  }

  // ── Delete logic ──

  async function deleteCalls(ids: string[]) {
    if (ids.length === 0) return;
    setDeleting(true);

    await supabase.from('call_analyses').delete().in('call_id', ids);
    await supabase.from('sales_calls').delete().in('id', ids);

    const { data: reports } = await supabase
      .from('daily_call_reports')
      .select('id, call_ids')
      .not('call_ids', 'is', null);

    if (reports) {
      const idsSet = new Set(ids);
      for (const report of reports) {
        const original: string[] = report.call_ids || [];
        const filtered = original.filter((cid: string) => !idsSet.has(cid));
        if (filtered.length !== original.length) {
          await supabase
            .from('daily_call_reports')
            .update({ call_ids: filtered })
            .eq('id', report.id);
        }
      }
    }

    setCalls(prev => prev.filter(c => !ids.includes(c.id)));
    setSelectedCalls(new Set());
    setSelectMode(false);
    setExpandedCall(null);
    setDeleting(false);
  }

  function toggleSelectCall(id: string) {
    setSelectedCalls(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedCalls.size === calls.length) {
      setSelectedCalls(new Set());
    } else {
      setSelectedCalls(new Set(calls.map(c => c.id)));
    }
  }

  // ── Computed stats ──

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

  const objectionCounts: Record<string, number> = {};
  analyzedCalls.forEach(c => {
    (c.analysis!.objections || []).forEach((o) => {
      const t = typeof o === 'string' ? o : o.type;
      objectionCounts[t] = (objectionCounts[t] || 0) + 1;
    });
  });
  const sortedObjections = Object.entries(objectionCounts).sort(([, a], [, b]) => b - a);

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

  const callbackCount = calls.filter(c => c.analyzed && c.callback_priority && c.callback_priority !== 'no_action' && c.callback_status !== 'completed').length;

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
          <a
            href="/sales-engine/script"
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              textDecoration: 'none',
              padding: '6px 12px',
              border: '1px solid var(--accent)',
              borderRadius: 6,
            }}
          >
            Script
          </a>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: 'var(--font-sans)' }}>
              Sales Engine
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              Call tracking + analysis + coaching
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-depth)', borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setActiveTab('callbacks')}
            style={{
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'callbacks' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'callbacks' ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'callbacks' ? 600 : 400,
              position: 'relative',
            }}
          >
            Callbacks
            {callbackCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#FF3D57',
              }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('coaching')}
            style={{
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'coaching' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'coaching' ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'coaching' ? 600 : 400,
            }}
          >
            Coaching
          </button>
        </div>
      </header>

      <div style={{ padding: '28px 40px', maxWidth: 1200 }}>

        {/* ════════════════ CALLBACKS TAB ════════════════ */}
        {activeTab === 'callbacks' && (
          <CallbackQueue
            calls={calls}
            onStatusChange={handleCallbackStatus}
            onNotesChange={handleCallbackNotes}
          />
        )}

        {/* ════════════════ COACHING TAB ════════════════ */}
        {activeTab === 'coaching' && (
          <>
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
                {/* Toolbar row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Recent Calls
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 8 }}>
                        {calls.length} total
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectMode(!selectMode);
                        if (selectMode) setSelectedCalls(new Set());
                      }}
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: selectMode ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: selectMode ? 'rgba(232, 255, 0, 0.1)' : 'transparent',
                        color: selectMode ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {selectMode ? 'Cancel' : 'Select'}
                    </button>
                  </div>
                  {selectMode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedCalls.size === calls.length && calls.length > 0}
                          onChange={toggleSelectAll}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        All
                      </label>
                      {selectedCalls.size > 0 && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${selectedCalls.size} call${selectedCalls.size > 1 ? 's' : ''}?`)) {
                              deleteCalls(Array.from(selectedCalls));
                            }
                          }}
                          disabled={deleting}
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            padding: '4px 12px',
                            borderRadius: 6,
                            border: '1px solid #FF3D57',
                            background: 'rgba(255, 61, 87, 0.12)',
                            color: '#FF3D57',
                            cursor: deleting ? 'wait' : 'pointer',
                            fontWeight: 600,
                            opacity: deleting ? 0.5 : 1,
                          }}
                        >
                          {deleting ? 'Deleting...' : `Delete ${selectedCalls.size}`}
                        </button>
                      )}
                    </div>
                  )}
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
                      const isSelected = selectedCalls.has(call.id);
                      return (
                        <div key={call.id}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {/* Checkbox (select mode only) */}
                            {selectMode && (
                              <div style={{ flexShrink: 0, paddingLeft: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectCall(call.id)}
                                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                                />
                              </div>
                            )}
                            <button
                              onClick={() => {
                                if (selectMode) {
                                  toggleSelectCall(call.id);
                                } else {
                                  setExpandedCall(isExpanded ? null : call.id);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                width: '100%',
                                padding: '12px 16px',
                                background: isExpanded ? 'rgba(232, 255, 0, 0.04)' : isSelected ? 'rgba(232, 255, 0, 0.02)' : 'transparent',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                              onMouseLeave={(e) => { if (!isExpanded && !isSelected) e.currentTarget.style.background = 'transparent'; else if (isSelected && !isExpanded) e.currentTarget.style.background = 'rgba(232, 255, 0, 0.02)'; }}
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
                          </div>

                          {/* Expanded details - two column layout */}
                          {isExpanded && a && (
                            <div style={{
                              padding: '16px 16px 16px 28px',
                              borderBottom: '1px solid var(--border)',
                              fontSize: 13,
                            }}>
                              {/* Delete single call button */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                                <button
                                  onClick={() => {
                                    if (confirm('Delete this call?')) {
                                      deleteCalls([call.id]);
                                    }
                                  }}
                                  disabled={deleting}
                                  style={{
                                    fontSize: 11,
                                    fontFamily: 'var(--font-mono)',
                                    padding: '3px 10px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(255, 61, 87, 0.3)',
                                    background: 'transparent',
                                    color: '#FF3D57',
                                    cursor: deleting ? 'wait' : 'pointer',
                                    opacity: deleting ? 0.5 : 0.6,
                                    transition: 'opacity 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                                >
                                  Delete call
                                </button>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
                                {/* Left column: Coaching content */}
                                <div>
                                  {/* Coaching notes */}
                                  {a.coaching_notes && (
                                    <div style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>Coaching</div>
                                      <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                        {renderWithRefs(a.coaching_notes, handleRefClick, a.key_moments)}
                                      </div>
                                    </div>
                                  )}

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    {/* Strengths */}
                                    {a.strengths && a.strengths.length > 0 && (
                                      <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 6 }}>Strengths</div>
                                        {a.strengths.map((s, i) => (
                                          <div key={i} style={{ color: 'var(--text-secondary)', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid var(--success)' }}>
                                            {renderWithRefs(s, handleRefClick, a.key_moments)}
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
                                            {renderWithRefs(s, handleRefClick, a.key_moments)}
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

                                {/* Right column: Transcript panel */}
                                <TranscriptPanel
                                  transcript={call.call_transcript}
                                  keyMoments={a.key_moments}
                                  highlightedMoment={highlightedMoment}
                                  onHighlightClear={handleHighlightClear}
                                />
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
          </>
        )}
      </div>
    </div>
  );
}
