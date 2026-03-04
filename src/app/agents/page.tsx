'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Agent Configs ──────────────────────────────────────────────────────────

interface AgentConfig {
  id: string;
  name: string;
  shortName: string;
  description: string;
  model: string;
  color: string;
  schedule: string;
  category: string;
  capabilities: string[];
}

const AGENTS: AgentConfig[] = [
  {
    id: 'seo-engine',
    name: 'SEO Engine',
    shortName: 'SE',
    description: 'Manages the autonomous SEO system. Verifies daily runs, debugs failures, reviews brain decisions, scans for algorithm updates.',
    model: 'opus',
    color: '#00E676',
    schedule: 'Daily 12:45 PM',
    category: 'Core',
    capabilities: ['Health check', 'Debug & repair', 'Trend scan', 'Brain review', 'Impact tracking'],
  },
  {
    id: 'client-tracker',
    name: 'Client Tracker',
    shortName: 'CT',
    description: 'Dashboard management, client reports, performance monitoring, anomaly detection.',
    model: 'sonnet',
    color: '#E8FF00',
    schedule: 'On demand',
    category: 'Core',
    capabilities: ['Report generation', 'Performance alerts', 'Client management', 'Data pipeline'],
  },
  {
    id: 'cold-email-drafter',
    name: 'Cold Email Drafter',
    shortName: 'CE',
    description: 'Researches prospects, picks the angle, writes personalized emails using 3 template structures with anti-slop validation.',
    model: 'sonnet',
    color: '#FF6B35',
    schedule: 'On demand',
    category: 'Outreach',
    capabilities: ['Prospect research', 'Email drafting', '3 templates', 'Anti-slop check'],
  },
  {
    id: 'instantly-manager',
    name: 'Instantly Manager',
    shortName: 'IM',
    description: 'Campaign health, warmup scores, reply monitoring, bounce tracking, deliverability management.',
    model: 'sonnet',
    color: '#00B4D8',
    schedule: 'Daily 8:00 AM',
    category: 'Outreach',
    capabilities: ['Account health', 'Reply alerts', 'Campaign analytics', 'Lead pipeline'],
  },
  {
    id: 'lead-enricher',
    name: 'Lead Enricher',
    shortName: 'LE',
    description: 'Google Maps scraping, website/GBP analysis, lead scoring 0-100, GHL push with tags and custom fields.',
    model: 'sonnet',
    color: '#9B5DE5',
    schedule: 'Monday 9:00 AM',
    category: 'Prospecting',
    capabilities: ['Maps scraping', 'SEO analysis', 'Lead scoring', 'GHL push'],
  },
  {
    id: 'linkedin-poster',
    name: 'LinkedIn Poster',
    shortName: 'LP',
    description: 'Competitive research, trend analysis, and content drafting for LinkedIn with algorithm-aware writing.',
    model: 'sonnet',
    color: '#0A66C2',
    schedule: 'Mon/Wed/Fri 7 AM',
    category: 'Social',
    capabilities: ['Trend research', 'Competitor analysis', 'Content drafting', 'API posting'],
  },
  {
    id: 'social-content',
    name: 'Social Content',
    shortName: 'SC',
    description: 'Cross-platform content strategy and calendar for LinkedIn, Instagram, and Facebook.',
    model: 'sonnet',
    color: '#FF006E',
    schedule: 'On demand',
    category: 'Social',
    capabilities: ['Content calendar', 'Platform strategy', 'Post drafting', 'Repurposing'],
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentRun {
  id: string;
  agent_name: string;
  status: string;
  prompt: string | null;
  output: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

interface AgentTask {
  id: string;
  agent_name: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface AgentMessage {
  id: string;
  agent_name: string;
  role: string;
  content: string;
  run_id: string | null;
  created_at: string;
}

type DetailTab = 'chat' | 'history' | 'tasks' | 'config';

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AgentsDashboard() {
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('chat');
  const [runs, setRuns] = useState<Record<string, AgentRun[]>>({});
  const [tasks, setTasks] = useState<Record<string, AgentTask[]>>({});
  const [messages, setMessages] = useState<Record<string, AgentMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load data for selected agent
  const loadAgentData = useCallback(async (agentName: string) => {
    const res = await fetch(`/api/agents/chat?agent=${agentName}`);
    const data = await res.json();
    setMessages((prev) => ({ ...prev, [agentName]: data.messages || [] }));
    setRuns((prev) => ({ ...prev, [agentName]: data.runs || [] }));
    setTasks((prev) => ({ ...prev, [agentName]: data.tasks || [] }));
  }, []);

  // Load all runs for overview stats
  useEffect(() => {
    async function loadAllRuns() {
      const res = await fetch('/api/agents/chat');
      const data = await res.json();
      const grouped: Record<string, AgentRun[]> = {};
      (data.runs || []).forEach((run: AgentRun) => {
        if (!grouped[run.agent_name]) grouped[run.agent_name] = [];
        grouped[run.agent_name].push(run);
      });
      setRuns(grouped);
    }
    loadAllRuns();
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      loadAgentData(selectedAgent.id);
    }
  }, [selectedAgent, loadAgentData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedAgent]);

  useEffect(() => {
    if (selectedAgent && activeTab === 'chat') {
      inputRef.current?.focus();
    }
  }, [selectedAgent, activeTab]);

  // Send chat message
  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedAgent || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    // Optimistic user message
    const tempMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      agent_name: selectedAgent.id,
      role: 'user',
      content: msg,
      run_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => ({
      ...prev,
      [selectedAgent.id]: [...(prev[selectedAgent.id] || []), tempMsg],
    }));

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: selectedAgent.id, message: msg }),
      });
      const data = await res.json();

      // Refresh data
      await loadAgentData(selectedAgent.id);
    } catch {
      const errMsg: AgentMessage = {
        id: `err-${Date.now()}`,
        agent_name: selectedAgent.id,
        role: 'assistant',
        content: 'Failed to reach agent. Check if the dev server has the right environment variables.',
        run_id: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => ({
        ...prev,
        [selectedAgent.id]: [...(prev[selectedAgent.id] || []), errMsg],
      }));
    }
    setChatLoading(false);
  };

  // Add task
  const addTask = async () => {
    if (!newTaskTitle.trim() || !selectedAgent) return;
    await fetch('/api/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        agent_name: selectedAgent.id,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
      }),
    });
    setNewTaskTitle('');
    loadAgentData(selectedAgent.id);
  };

  // Update task status
  const toggleTaskStatus = async (task: AgentTask) => {
    const nextStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'pending';
    await fetch('/api/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: task.id, status: nextStatus }),
    });
    loadAgentData(selectedAgent!.id);
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    await fetch('/api/agents/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: taskId }),
    });
    loadAgentData(selectedAgent!.id);
  };

  // Stats
  const totalRuns = Object.values(runs).flat().length;
  const errorRuns = Object.values(runs).flat().filter((r) => r.status === 'error').length;
  const scheduledAgents = AGENTS.filter((a) => a.schedule !== 'On demand').length;

  const getLastRun = (agentId: string): AgentRun | undefined => {
    return (runs[agentId] || [])[0];
  };

  const getAgentStatus = (agentId: string): 'active' | 'error' | 'idle' | 'running' => {
    const last = getLastRun(agentId);
    if (!last) return 'idle';
    if (last.status === 'running') return 'running';
    if (last.status === 'error') return 'error';
    const hoursSince = (Date.now() - new Date(last.started_at).getTime()) / 3600000;
    return hoursSince < 24 ? 'active' : 'idle';
  };

  const statusColors: Record<string, string> = {
    active: '#00E676',
    error: '#FF3D57',
    idle: '#8A8F98',
    running: '#E8FF00',
  };

  // ─── Grid View ──────────────────────────────────────────────────────────

  if (!selectedAgent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '32px 40px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <a href="/" style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>Dashboard</a>
            <span style={{ color: 'var(--border)' }}>/</span>
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-sans)',
            color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em',
          }}>
            Agent Command Center
          </h1>
          <p style={{
            fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0 0',
            fontFamily: 'var(--font-sans)',
          }}>
            {AGENTS.length} agents deployed. {scheduledAgents} scheduled. {totalRuns} total runs.
            {errorRuns > 0 && <span style={{ color: '#FF3D57' }}> {errorRuns} errors.</span>}
          </p>
        </div>

        {/* Stats Bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32,
        }}>
          {[
            { label: 'TOTAL AGENTS', value: AGENTS.length, color: 'var(--accent)' },
            { label: 'SCHEDULED', value: scheduledAgents, color: '#00B4D8' },
            { label: 'TOTAL RUNS', value: totalRuns, color: '#00E676' },
            { label: 'ERRORS', value: errorRuns, color: errorRuns > 0 ? '#FF3D57' : 'var(--text-secondary)' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)', padding: '16px 20px',
            }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>{stat.label}</div>
              <div style={{
                fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: stat.color,
              }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Agent Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {AGENTS.map((agent) => {
            const status = getAgentStatus(agent.id);
            const lastRun = getLastRun(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setActiveTab('chat'); }}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '24px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = agent.color + '40';
                  e.currentTarget.style.boxShadow = `0 0 32px ${agent.color}15, inset 0 1px 0 ${agent.color}15`;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Status pulse */}
                <div style={{
                  position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: statusColors[status],
                    boxShadow: status === 'running' ? `0 0 8px ${statusColors[status]}` : 'none',
                    animation: status === 'running' ? 'pulse 2s infinite' : 'none',
                  }} />
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: statusColors[status],
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{status}</span>
                </div>

                {/* Agent icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: agent.color + '18',
                    border: `1px solid ${agent.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: agent.color,
                  }}>
                    {agent.shortName}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em',
                    }}>{agent.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)',
                        padding: '2px 6px', borderRadius: 4,
                        background: agent.model === 'opus' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(192, 192, 192, 0.12)',
                        color: agent.model === 'opus' ? '#FFD700' : '#C0C0C0',
                        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
                      }}>{agent.model}</span>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)',
                        padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{agent.category}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px',
                  lineHeight: 1.5, fontFamily: 'var(--font-sans)',
                }}>{agent.description}</p>

                {/* Capabilities */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {agent.capabilities.map((cap) => (
                    <span key={cap} style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      padding: '3px 8px', borderRadius: 4,
                      background: agent.color + '10',
                      color: agent.color,
                      border: `1px solid ${agent.color}20`,
                    }}>{cap}</span>
                  ))}
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: 12, borderTop: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {agent.schedule}
                  </div>
                  {lastRun && (
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      Last: {new Date(lastRun.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {lastRun.duration_ms && ` (${(lastRun.duration_ms / 1000).toFixed(0)}s)`}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Detail View ────────────────────────────────────────────────────────

  const agentMessages = messages[selectedAgent.id] || [];
  const agentRuns = runs[selectedAgent.id] || [];
  const agentTasks = tasks[selectedAgent.id] || [];

  const detailTabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'history', label: 'History', count: agentRuns.length },
    { id: 'tasks', label: 'Tasks', count: agentTasks.filter((t) => t.status !== 'completed').length },
    { id: 'config', label: 'Config' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Detail Header */}
      <div style={{
        padding: '20px 32px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={() => setSelectedAgent(null)}
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 14, transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-border)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          &larr;
        </button>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: selectedAgent.color + '18',
          border: `1px solid ${selectedAgent.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: selectedAgent.color,
        }}>
          {selectedAgent.shortName}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
            {selectedAgent.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {selectedAgent.schedule}
            <span style={{
              marginLeft: 8, padding: '1px 6px', borderRadius: 4, fontSize: 9,
              background: selectedAgent.model === 'opus' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(192, 192, 192, 0.12)',
              color: selectedAgent.model === 'opus' ? '#FFD700' : '#C0C0C0',
              textTransform: 'uppercase', fontWeight: 600,
            }}>{selectedAgent.model}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColors[getAgentStatus(selectedAgent.id)],
          }} />
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: statusColors[getAgentStatus(selectedAgent.id)],
            textTransform: 'uppercase',
          }}>{getAgentStatus(selectedAgent.id)}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        padding: '0 32px',
      }}>
        {detailTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
              color: activeTab === tab.id ? selectedAgent.color : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? `2px solid ${selectedAgent.color}` : '2px solid transparent',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                background: selectedAgent.color + '20',
                color: selectedAgent.color,
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ─── Chat Tab ────────────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Messages */}
            <div style={{
              flex: 1, overflow: 'auto', padding: '24px 32px',
              background: 'rgba(0,0,0,0.3)',
            }}>
              {agentMessages.length === 0 && !chatLoading && (
                <div style={{
                  textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)',
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    background: selectedAgent.color + '12',
                    border: `1px solid ${selectedAgent.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', fontSize: 22, fontWeight: 700,
                    fontFamily: 'var(--font-mono)', color: selectedAgent.color,
                  }}>{selectedAgent.shortName}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                    {selectedAgent.name} is ready
                  </div>
                  <div style={{ fontSize: 12, maxWidth: 400, margin: '0 auto' }}>
                    Send a message to talk to this agent. It runs in its own context with specialized knowledge.
                  </div>
                </div>
              )}

              {agentMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: msg.role === 'user' ? '60%' : '80%',
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: msg.role === 'user'
                      ? selectedAgent.color + '12'
                      : 'var(--bg-surface)',
                    border: msg.role === 'user'
                      ? `1px solid ${selectedAgent.color}25`
                      : '1px solid var(--border)',
                  }}>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)',
                      color: msg.role === 'user' ? selectedAgent.color : 'var(--text-secondary)',
                      marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {msg.role === 'user' ? 'You' : selectedAgent.name}
                      <span style={{ marginLeft: 8, opacity: 0.5 }}>
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6,
                      fontFamily: msg.role === 'assistant' ? 'var(--font-mono)' : 'var(--font-sans)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                  <div style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: selectedAgent.color,
                      marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{selectedAgent.name}</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: selectedAgent.color,
                          animation: `dotPulse 1.4s infinite ${i * 0.2}s`,
                        }} />
                      ))}
                      <span style={{
                        fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8,
                        fontFamily: 'var(--font-mono)',
                      }}>Running agent...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '16px 32px', borderTop: '1px solid var(--border)',
              background: 'var(--bg-surface)', display: 'flex', gap: 12,
            }}>
              <div style={{
                fontSize: 14, color: selectedAgent.color, fontFamily: 'var(--font-mono)',
                padding: '10px 0', fontWeight: 700,
              }}>&gt;</div>
              <input
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={`Message ${selectedAgent.name}...`}
                disabled={chatLoading}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)',
                  padding: '10px 0',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 8,
                  background: chatInput.trim() ? selectedAgent.color : 'rgba(255,255,255,0.04)',
                  color: chatInput.trim() ? '#000' : 'var(--text-secondary)',
                  border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  transition: 'all 0.15s ease',
                  opacity: chatLoading ? 0.5 : 1,
                }}
              >
                {chatLoading ? 'Running...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {/* ─── History Tab ─────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            {agentRuns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', fontSize: 13 }}>
                No runs yet. Send a message or wait for the next scheduled run.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {agentRuns.map((run) => {
                  const expanded = expandedRuns.has(run.id);
                  return (
                    <div key={run.id} style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-card)', overflow: 'hidden',
                    }}>
                      <button
                        onClick={() => setExpandedRuns((prev) => {
                          const next = new Set(prev);
                          expanded ? next.delete(run.id) : next.add(run.id);
                          return next;
                        })}
                        style={{
                          width: '100%', padding: '16px 20px', cursor: 'pointer',
                          background: 'transparent', border: 'none', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}
                      >
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: run.status === 'completed' ? '#00E676' : run.status === 'error' ? '#FF3D57' : '#E8FF00',
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {run.prompt || 'Scheduled run'}
                          </div>
                          <div style={{
                            fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                            marginTop: 4,
                          }}>
                            {new Date(run.started_at).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}
                            {run.duration_ms && ` \u00B7 ${(run.duration_ms / 1000).toFixed(1)}s`}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 4,
                          background: run.status === 'completed' ? 'rgba(0,230,118,0.12)' : run.status === 'error' ? 'rgba(255,61,87,0.12)' : 'rgba(232,255,0,0.12)',
                          color: run.status === 'completed' ? '#00E676' : run.status === 'error' ? '#FF3D57' : '#E8FF00',
                          textTransform: 'uppercase', fontWeight: 600,
                        }}>{run.status}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
                      </button>
                      {expanded && (
                        <div style={{
                          padding: '0 20px 16px', borderTop: '1px solid var(--border)',
                        }}>
                          <pre style={{
                            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
                            maxHeight: 400, overflow: 'auto', margin: '12px 0 0',
                            background: 'var(--bg-depth)', padding: 12, borderRadius: 6,
                          }}>
                            {run.output || run.error || 'No output captured'}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Tasks Tab ───────────────────────────────────────────────── */}
        {activeTab === 'tasks' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            {/* Add task form */}
            <div style={{
              display: 'flex', gap: 10, marginBottom: 24,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)', padding: '12px 16px',
            }}>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)',
                }}
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                style={{
                  background: 'var(--bg-depth)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '4px 8px', color: 'var(--text-secondary)',
                  fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none',
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <button
                onClick={addTask}
                disabled={!newTaskTitle.trim()}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  background: newTaskTitle.trim() ? selectedAgent.color : 'rgba(255,255,255,0.04)',
                  color: newTaskTitle.trim() ? '#000' : 'var(--text-secondary)',
                  border: 'none', cursor: newTaskTitle.trim() ? 'pointer' : 'default',
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                }}
              >Add</button>
            </div>

            {/* Task list */}
            {agentTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', fontSize: 13 }}>
                No tasks yet. Add one above or let the agent create tasks during runs.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {agentTasks.map((task) => {
                  const priorityColors: Record<string, string> = {
                    critical: '#FF3D57', high: '#FF6B35', medium: '#E8FF00', low: '#8A8F98',
                  };
                  const statusIcons: Record<string, string> = {
                    pending: '\u25CB', in_progress: '\u25D4', completed: '\u25CF',
                  };
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '12px 16px',
                      opacity: task.status === 'completed' ? 0.5 : 1,
                    }}>
                      <button
                        onClick={() => toggleTaskStatus(task)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          fontSize: 16, color: task.status === 'completed' ? '#00E676' : 'var(--text-secondary)',
                          padding: 0, lineHeight: 1,
                        }}
                        title={`Status: ${task.status}`}
                      >{statusIcons[task.status]}</button>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: priorityColors[task.priority],
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 13, color: 'var(--text-primary)',
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        }}>{task.title}</div>
                        {task.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                            {task.description}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                      }}>
                        {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--text-secondary)', fontSize: 14, padding: '0 4px',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#FF3D57'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >&times;</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Config Tab ──────────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)', padding: '24px',
            }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
              }}>Agent Configuration</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Agent ID', value: selectedAgent.id },
                  { label: 'Model', value: selectedAgent.model },
                  { label: 'Schedule', value: selectedAgent.schedule },
                  { label: 'Category', value: selectedAgent.category },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
                    }}>{item.label}</div>
                    <div style={{
                      fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
                    }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>Description</div>
              <p style={{
                fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6,
                margin: '0 0 24px',
              }}>{selectedAgent.description}</p>

              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>Capabilities</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {selectedAgent.capabilities.map((cap) => (
                  <span key={cap} style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    padding: '4px 10px', borderRadius: 6,
                    background: selectedAgent.color + '12',
                    color: selectedAgent.color,
                    border: `1px solid ${selectedAgent.color}20`,
                  }}>{cap}</span>
                ))}
              </div>

              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
              }}>Agent File</div>
              <div style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                background: 'var(--bg-depth)', padding: 12, borderRadius: 6,
              }}>
                ~/.claude/agents/{selectedAgent.id}.md
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
