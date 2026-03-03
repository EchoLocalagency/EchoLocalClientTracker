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

// ── Script sections from cold-call-script.md ──

const SCRIPT_SECTIONS = [
  {
    id: 1,
    title: 'The Opener',
    content: `"Hey [NAME], this is Brian. I know you're probably busy so I'll keep this quick. I'm a local student out here at Cal State San Marcos -- I built a system that helps turf [or whatever trade] companies get more jobs through Google without paying for ads. I'm looking for a few businesses to try it out with completely free. Got 60 seconds for me to explain how it works?"

If they say yes, go to The Pitch.
If they say "I'm busy": "Totally get it. When's a better time for a 2 minute call? I'll be quick, I promise."
If they say "not interested": "No worries at all. Just out of curiosity, are you getting most of your jobs from Google right now or is it mostly word of mouth?"`,
  },
  {
    id: 2,
    title: 'The Pitch',
    content: `"So here's the deal. You know your Google Business Profile, the thing that shows up when someone searches for [TRADE] near them? Most businesses set it up once and never touch it again. Google sees that and pushes you down. The businesses getting the most calls are the ones that are active on there every single day.

That's what my system does. It automatically posts your job photos to your GBP, responds to every single review so Google sees you're engaged, seeds Q&A with the questions your customers are actually asking. All without you doing anything.

But here's where it gets good. The system also watches what's working and what's not, 24/7. If a keyword is close to ranking, it adjusts your site to push it over. If a certain type of post is getting more views, it makes more of those. It's a constant feedback loop between your GBP and your website, always improving, always learning what gets you showing up higher.

And then on top of that, it builds out pages for every city you serve. So instead of only showing up in [THEIR CITY], you're showing up in [NEARBY CITY 1], [NEARBY CITY 2], [NEARBY CITY 3]. Every page is another net in the water catching jobs.

The whole thing runs automatically, every single day. More visibility, more calls, more jobs. And right now I'm testing it with a handful of businesses completely free. No cost, no contract, no catch. I just need real businesses to build case studies with."`,
  },
  {
    id: 3,
    title: "What's the catch?",
    content: `"Honestly, there isn't one. I'm a college kid who built something that works and I need businesses to prove it. You're doing me the favor by letting me test it on your business. Worst case, you get a free month of work and we part ways."`,
  },
  {
    id: 4,
    title: 'Already have an SEO guy',
    content: `"That's great, are you happy with the results? [Let them answer.] The thing that makes this different is it runs every single day automatically. Most agencies set it and forget it. This system is checking what's ranking, what's not, and adjusting daily. And since it's free to try, it's not like you're replacing anything. Think of it as a second opinion."`,
  },
  {
    id: 5,
    title: "I don't need more work",
    content: `"That's a great problem to have. But let me ask you this -- are you busy because you're booked solid, or busy because you're running around doing everything yourself? Most guys I talk to are busy but they're not turning down jobs. And the ones that are, they want to be able to pick and choose the higher paying ones. That's what more visibility gets you."`,
  },
  {
    id: 6,
    title: 'How do I know this works?',
    content: `"I've got a turf cleaning client who went from basically invisible on Google to the number one result for their main keyword in under 60 days. Same system, same approach. I can show you the data if you want."`,
  },
  {
    id: 7,
    title: 'I need to think about it',
    content: `"Totally fair. But just so you know, there's nothing to think about cost-wise because it's free. The only question is whether you want more people finding you on Google. Can I send you a quick email breaking down exactly what we'd do for your business? That way you can look at it on your own time."`,
  },
  {
    id: 8,
    title: 'Send me some info',
    content: `"For sure. What's your email? I'll send over a breakdown of where your business stands online right now and exactly what the system would do for you. Fair warning, I'm going to follow up in a couple days to see what you think."`,
  },
  {
    id: 9,
    title: 'How much after free month?',
    content: `"Depends on the scope but we're talking a few hundred a month. Way less than ads, and unlike ads it keeps working even between payments. But let's not even worry about that right now. Let me just show you what the system does first and you can decide if the results are worth it."`,
  },
  {
    id: 10,
    title: 'Closing - Warm',
    content: `"Cool, so what I'll do is put together a quick breakdown of your online presence right now -- where you're showing up, where you're not, and what the system would do in the first 30 days. Can we hop on a quick call [TOMORROW/THURSDAY/FRIDAY] so I can walk you through it? Takes about 10 minutes."`,
  },
  {
    id: 11,
    title: 'Closing - Email only',
    content: `"No problem. I'll send that over today. What's the best email? And is [THEIR NAME] the best person to talk to about this?"`,
  },
  {
    id: 12,
    title: 'Closing - No',
    content: `"No worries at all, I appreciate your time. If anything changes, I'm easy to find. Have a good one, [NAME]."`,
  },
  {
    id: 13,
    title: 'Key Rules',
    content: `1. Don't say "SEO." Say "getting found on Google" or "showing up when people search." SEO sounds like a sales pitch. The other sounds like a result.
2. Don't say "services." Say "system." It's one system that does everything automatically. That's the differentiator.
3. Lead with the student angle. It's disarming. People want to help students. It also explains why it's free without sounding sketchy.
4. Ask questions, don't lecture. The more they talk, the more you learn, and the more bought in they get.
5. Always get the next step. Never hang up without either a meeting booked, an email to send, or a follow-up time set.
6. Match their energy. If they're chill, be chill. If they're direct, be direct. Don't be the overly enthusiastic salesman.
7. It's free. Remind them. When they hesitate, the answer is always "there's zero risk because it's free."`,
  },
];

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

// ── Helper: parse [N] references in coaching text ──

function renderWithRefs(
  text: string,
  onRefClick: (id: number) => void,
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const refId = parseInt(match[1], 10);
      const section = SCRIPT_SECTIONS.find(s => s.id === refId);
      return (
        <span
          key={i}
          onClick={(e) => { e.stopPropagation(); onRefClick(refId); }}
          title={section ? `${section.id}. ${section.title}` : `Section ${refId}`}
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

// ── Components ──

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

function ScriptPanel({ highlightedSection, onHighlightClear }: { highlightedSection: number | null; onHighlightClear: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightedSection != null) {
      // Expand the section
      setExpandedSections(prev => new Set(prev).add(highlightedSection));
      // Scroll to it
      const el = sectionRefs.current[highlightedSection];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Clear highlight after animation
      const timer = setTimeout(onHighlightClear, 1500);
      return () => clearTimeout(timer);
    }
  }, [highlightedSection, onHighlightClear]);

  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{
      maxHeight: 500,
      overflowY: 'auto',
      fontSize: 12,
      borderLeft: '1px solid var(--border)',
      paddingLeft: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
        Call Script
      </div>
      {SCRIPT_SECTIONS.map(section => {
        const isOpen = expandedSections.has(section.id);
        const isHighlighted = highlightedSection === section.id;
        return (
          <div
            key={section.id}
            ref={el => { sectionRefs.current[section.id] = el; }}
            style={{
              marginBottom: 4,
              borderRadius: 6,
              background: isHighlighted ? 'rgba(232, 255, 0, 0.08)' : 'transparent',
              transition: 'background 0.3s ease',
            }}
          >
            <button
              onClick={() => toggleSection(section.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: isHighlighted ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                color: isHighlighted ? '#0A0F1E' : 'var(--text-secondary)',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
                transition: 'all 0.3s ease',
              }}>
                {section.id}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-primary)',
                flex: 1,
              }}>
                {section.title}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                &#9654;
              </span>
            </button>
            {isOpen && (
              <div style={{
                padding: '4px 8px 10px 36px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                fontSize: 11,
              }}>
                {section.content}
              </div>
            )}
          </div>
        );
      })}
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
  const [highlightedSection, setHighlightedSection] = useState<number | null>(null);

  const handleHighlightClear = useCallback(() => setHighlightedSection(null), []);

  const handleRefClick = useCallback((id: number) => {
    setHighlightedSection(id);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: callsData } = await supabase
        .from('sales_calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: analysesData } = await supabase
        .from('call_analyses')
        .select('*')
        .order('analyzed_at', { ascending: false })
        .limit(50);

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

  // ── Delete logic ──

  async function deleteCalls(ids: string[]) {
    if (ids.length === 0) return;
    setDeleting(true);

    // 1. Delete from call_analyses
    await supabase.from('call_analyses').delete().in('call_id', ids);

    // 2. Delete from sales_calls
    await supabase.from('sales_calls').delete().in('id', ids);

    // 3. Update daily_call_reports to remove deleted IDs from call_ids arrays
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

    // 4. Update local state
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
                                    {renderWithRefs(a.coaching_notes, handleRefClick)}
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
                                        {renderWithRefs(s, handleRefClick)}
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
                                        {renderWithRefs(s, handleRefClick)}
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

                            {/* Right column: Script panel */}
                            <ScriptPanel
                              highlightedSection={highlightedSection}
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
      </div>
    </div>
  );
}
