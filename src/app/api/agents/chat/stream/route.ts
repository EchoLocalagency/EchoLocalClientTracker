import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AGENT_DIRS: Record<string, string> = {
  'seo-engine': '/Users/brianegan/EchoLocalClientTracker',
  'client-tracker': '/Users/brianegan/EchoLocalClientTracker',
  'cold-email-drafter': '/Users/brianegan/EchoLocalColdEmail',
  'instantly-manager': '/Users/brianegan/EchoLocalColdEmail',
  'lead-enricher': '/Users/brianegan/EchoLocalLeadScraper',
  'linkedin-poster': '/Users/brianegan',
  'social-content': '/Users/brianegan',
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { agent_name, message, chat_id: existingChatId } = await request.json();

  if (!agent_name || !message) {
    return new Response(JSON.stringify({ error: 'agent_name and message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Create or reuse chat
  let chatId = existingChatId;
  if (!chatId) {
    const { data: chat, error } = await supabase
      .from('agent_chats')
      .insert({ agent_name, title: message.slice(0, 50) })
      .select()
      .single();
    if (error || !chat) {
      return new Response(JSON.stringify({ error: 'Failed to create chat' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    chatId = chat.id;
  }

  // 2. Save user message
  await supabase.from('agent_chat_messages').insert({
    chat_id: chatId,
    role: 'user',
    content: message,
  });

  // 3. Load conversation history (last 20 messages)
  const { data: history } = await supabase
    .from('agent_chat_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(20);

  // 4. Build prompt from history
  const historyText = (history || [])
    .map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const prompt = historyText || `Human: ${message}`;

  // 5. Spawn claude subprocess
  const cwd = AGENT_DIRS[agent_name] || '/Users/brianegan';
  const agentFile = `/Users/brianegan/.claude/agents/${agent_name}.md`;

  // Strip CLAUDE* env vars to avoid nested-session detection
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('CLAUDE')) {
      delete env[key];
    }
  }

  const child = spawn('claude', [
    '-p', prompt,
    '--agent', agentFile,
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--max-turns', '25',
    '--setting-sources', '',
  ], { cwd, env });

  // 6. Stream SSE response
  const encoder = new TextEncoder();
  let fullResponse = '';
  const toolCalls: Array<{ name: string; input: unknown; result?: unknown }> = [];

  const stream = new ReadableStream({
    start(controller) {
      // Send chat_id immediately so client knows which chat this belongs to
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chat_id', chat_id: chatId })}\n\n`));

      let buffer = '';

      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'assistant' && event.message?.content) {
              // Content blocks from assistant message
              for (const block of event.message.content) {
                if (block.type === 'text') {
                  fullResponse += block.text;
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: 'text', text: block.text })}\n\n`
                  ));
                } else if (block.type === 'tool_use') {
                  toolCalls.push({ name: block.name, input: block.input });
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ type: 'tool_use', name: block.name, input: block.input })}\n\n`
                  ));
                }
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                fullResponse += event.delta.text;
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`
                ));
              }
            } else if (event.type === 'result') {
              // Final result - extract text from content blocks
              if (event.result?.content) {
                for (const block of event.result.content) {
                  if (block.type === 'text' && !fullResponse.includes(block.text)) {
                    fullResponse += block.text;
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'text', text: block.text })}\n\n`
                    ));
                  }
                }
              }
              // Also check for top-level result text
              if (event.result && typeof event.result === 'string') {
                fullResponse += event.result;
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'text', text: event.result })}\n\n`
                ));
              }
            } else if (event.type === 'tool_result' || event.type === 'tool_output') {
              const lastTool = toolCalls[toolCalls.length - 1];
              if (lastTool) {
                lastTool.result = event.content || event.output || event.result;
              }
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({
                  type: 'tool_result',
                  name: lastTool?.name,
                  result: event.content || event.output || event.result,
                })}\n\n`
              ));
            }
          } catch {
            // Non-JSON line, skip
          }
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        // Forward meaningful stderr (skip progress indicators)
        if (text.trim() && !text.includes('Progress:')) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', text })}\n\n`
          ));
        }
      });

      child.on('close', async (code: number | null) => {
        // Save assistant message to DB
        if (fullResponse.trim()) {
          await supabase.from('agent_chat_messages').insert({
            chat_id: chatId,
            role: 'assistant',
            content: fullResponse.trim(),
            tool_calls: toolCalls.length > 0 ? toolCalls : null,
          });

          // Update chat timestamp
          await supabase
            .from('agent_chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chatId);
        }

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'done', code })}\n\n`
        ));
        controller.close();
      });

      child.on('error', (err: Error) => {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`
        ));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
