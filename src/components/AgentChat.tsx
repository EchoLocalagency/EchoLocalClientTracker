'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface AgentConfig {
  id: string;
  name: string;
  shortName: string;
  color: string;
}

interface Chat {
  id: string;
  title: string;
  updated_at: string;
  agent_name: string;
}

interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
  created_at: string;
}

interface ToolCall {
  name: string;
  input: unknown;
  result?: unknown;
}

interface StreamingToolCall {
  name: string;
  input: unknown;
  result?: unknown;
  collapsed: boolean;
}

export default function AgentChat({ agent }: { agent: AgentConfig }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamToolCalls, setStreamToolCalls] = useState<StreamingToolCall[]>([]);
  const [collapsedTools, setCollapsedTools] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chats for this agent
  const loadChats = useCallback(async () => {
    const res = await fetch(`/api/agents/chat/history?agent=${agent.id}`);
    const data = await res.json();
    setChats(data.chats || []);
  }, [agent.id]);

  // Load messages for active chat
  const loadMessages = useCallback(async (chatId: string) => {
    const res = await fetch(`/api/agents/chat/history?id=${chatId}`);
    const data = await res.json();
    setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat);
    } else {
      setMessages([]);
    }
  }, [activeChat, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText, streamToolCalls]);

  // Focus input when chat changes
  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [activeChat, streaming]);

  const createNewChat = async () => {
    setActiveChat(null);
    setMessages([]);
    setStreamText('');
    setStreamToolCalls([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const deleteChat = async (chatId: string) => {
    await fetch(`/api/agents/chat/history?id=${chatId}`, { method: 'DELETE' });
    if (activeChat === chatId) {
      setActiveChat(null);
      setMessages([]);
    }
    loadChats();
  };

  const stopStream = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setStreaming(true);
    setStreamText('');
    setStreamToolCalls([]);
    setCollapsedTools(new Set());

    // Optimistically add user message to display
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      chat_id: activeChat || '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/agents/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agent.id,
          message: text,
          chat_id: activeChat,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr.trim()) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'chat_id' && !activeChat) {
              setActiveChat(event.chat_id);
              // Update the temp user message chat_id
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === userMsg.id ? { ...m, chat_id: event.chat_id } : m
                )
              );
            } else if (event.type === 'text' || event.type === 'text_delta') {
              setStreamText((prev) => prev + event.text);
            } else if (event.type === 'tool_use') {
              setStreamToolCalls((prev) => [
                ...prev,
                { name: event.name, input: event.input, collapsed: true },
              ]);
            } else if (event.type === 'tool_result') {
              setStreamToolCalls((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last) {
                  updated[updated.length - 1] = { ...last, result: event.result };
                }
                return updated;
              });
            } else if (event.type === 'done') {
              // Reload messages from DB to get final state
              const chatIdToLoad = activeChat || event.chat_id;
              if (chatIdToLoad) {
                await loadMessages(chatIdToLoad);
              }
              loadChats();
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Stream error:', err);
      }
    } finally {
      setStreaming(false);
      setStreamText('');
      setStreamToolCalls([]);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleToolCollapse = (index: number) => {
    setCollapsedTools((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Render tool calls within a message
  const renderToolCalls = (tools: ToolCall[], msgCollapsed: boolean) => {
    if (!tools?.length) return null;
    return (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {tools.map((tool, i) => (
          <div key={i} style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            <button
              onClick={() => {
                // Toggle using message-level collapsed state
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: agent.color,
                opacity: 0.8,
              }}>
                {tool.name}
              </span>
            </button>
            {!msgCollapsed && (
              <div style={{
                padding: '6px 10px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                maxHeight: 120,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {typeof tool.input === 'string'
                  ? tool.input
                  : JSON.stringify(tool.input, null, 2)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render streaming tool calls
  const renderStreamingTools = () => {
    if (!streamToolCalls.length) return null;
    return (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {streamToolCalls.map((tool, i) => {
          const isCollapsed = collapsedTools.has(i);
          return (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => toggleToolCollapse(i)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 8,
                  color: 'var(--text-secondary)',
                  transition: 'transform 0.15s',
                  transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                  display: 'inline-block',
                }}>&#9654;</span>
                <span style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: agent.color,
                  opacity: 0.8,
                }}>
                  {tool.name}
                </span>
                {!tool.result && (
                  <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    color: '#E8FF00',
                    animation: 'pulse 1.5s infinite',
                  }}>running...</span>
                )}
              </button>
              {!isCollapsed && (
                <div style={{
                  padding: '6px 10px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    maxHeight: 100,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginBottom: tool.result ? 6 : 0,
                  }}>
                    {typeof tool.input === 'string'
                      ? tool.input
                      : JSON.stringify(tool.input, null, 2)}
                  </div>
                  {tool.result != null && (
                    <div style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: '#00E676',
                      opacity: 0.7,
                      maxHeight: 80,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {typeof tool.result === 'string'
                        ? tool.result.slice(0, 500)
                        : JSON.stringify(tool.result, null, 2).slice(0, 500)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Format markdown-lite (code blocks, bold, inline code)
  const formatContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const inner = part.slice(3, -3).replace(/^\w+\n/, '');
        return (
          <pre key={i} style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            padding: '10px 12px',
            margin: '8px 0',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>{inner}</pre>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} style={{
            background: 'rgba(255,255,255,0.08)',
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: '0.9em',
            fontFamily: 'var(--font-mono)',
          }}>{part.slice(1, -1)}</code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 120px)',
      overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <div style={{
        width: 220,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <button
          onClick={createNewChat}
          style={{
            margin: '12px 12px 8px',
            padding: '8px 12px',
            background: agent.color + '15',
            border: `1px solid ${agent.color}30`,
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: agent.color,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = agent.color + '25';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = agent.color + '15';
          }}
        >
          + New Chat
        </button>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
          {chats.map((chat) => (
            <div
              key={chat.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 2,
              }}
            >
              <button
                onClick={() => {
                  setActiveChat(chat.id);
                  setStreamText('');
                  setStreamToolCalls([]);
                }}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  background: activeChat === chat.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (activeChat !== chat.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  if (activeChat !== chat.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{
                  fontSize: 12,
                  color: activeChat === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {chat.title}
                </div>
                <div style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  opacity: 0.6,
                  marginTop: 2,
                }}>
                  {new Date(chat.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  padding: '4px 6px',
                  borderRadius: 4,
                  opacity: 0.4,
                  transition: 'opacity 0.15s, color 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = '#FF3D57';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.4';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                &times;
              </button>
            </div>
          ))}

          {chats.length === 0 && (
            <div style={{
              padding: '24px 12px',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--text-secondary)',
              opacity: 0.5,
              fontFamily: 'var(--font-mono)',
            }}>
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>
        {/* Messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {messages.length === 0 && !streaming && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              opacity: 0.4,
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: agent.color + '15',
                border: `1px solid ${agent.color}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: agent.color,
              }}>
                {agent.shortName}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}>
                Chat with {agent.name}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                opacity: 0.6,
              }}>
                Full tool access -- reads, writes, bash, web
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '100%',
              }}
            >
              <div style={{
                maxWidth: msg.role === 'user' ? '70%' : '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user'
                  ? agent.color + '18'
                  : 'rgba(255,255,255,0.04)',
                border: msg.role === 'user'
                  ? `1px solid ${agent.color}30`
                  : '1px solid rgba(255,255,255,0.06)',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                wordBreak: 'break-word',
              }}>
                {formatContent(msg.content)}
                {msg.tool_calls && renderToolCalls(msg.tool_calls, true)}
              </div>
            </div>
          ))}

          {/* Streaming assistant message */}
          {streaming && (streamText || streamToolCalls.length > 0) && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start',
              maxWidth: '100%',
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '12px 12px 12px 4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                wordBreak: 'break-word',
              }}>
                {streamText && formatContent(streamText)}
                {renderStreamingTools()}
                <span style={{
                  display: 'inline-block',
                  width: 6,
                  height: 14,
                  background: agent.color,
                  marginLeft: 2,
                  animation: 'blink 1s infinite',
                  verticalAlign: 'text-bottom',
                }} />
              </div>
            </div>
          )}

          {/* Streaming indicator when no content yet */}
          {streaming && !streamText && streamToolCalls.length === 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start',
            }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px 12px 12px 4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <div style={{
                  display: 'flex',
                  gap: 4,
                }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: agent.color,
                      opacity: 0.5,
                      animation: `bounce 1.4s ${i * 0.2}s infinite ease-in-out`,
                    }} />
                  ))}
                </div>
                <span style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  opacity: 0.6,
                }}>
                  {agent.name} is thinking...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '12px 24px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            disabled={streaming}
            rows={1}
            style={{
              flex: 1,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              resize: 'none',
              outline: 'none',
              minHeight: 40,
              maxHeight: 120,
              lineHeight: 1.5,
              transition: 'border-color 0.15s',
              opacity: streaming ? 0.5 : 1,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = agent.color + '60';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          {streaming ? (
            <button
              onClick={stopStream}
              style={{
                padding: '10px 16px',
                background: '#FF3D57',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                flexShrink: 0,
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                padding: '10px 16px',
                background: input.trim() ? agent.color : 'rgba(255,255,255,0.04)',
                border: 'none',
                borderRadius: 10,
                cursor: input.trim() ? 'pointer' : 'default',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: input.trim() ? '#000' : 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
