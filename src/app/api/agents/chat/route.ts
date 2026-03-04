import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CLAUDE_PATH = '/Users/brianegan/.nvm/versions/node/v24.13.0/bin/claude';

export async function POST(request: Request) {
  const { agentName, message } = await request.json();

  if (!agentName || !message) {
    return Response.json({ error: 'agentName and message required' }, { status: 400 });
  }

  // Save user message
  await supabase.from('agent_messages').insert({
    agent_name: agentName,
    role: 'user',
    content: message,
  });

  // Create run record
  const { data: run } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: agentName,
      status: 'running',
      prompt: message,
    })
    .select()
    .single();

  const runId = run?.id;
  const startTime = Date.now();

  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        CLAUDE_PATH,
        ['-p', message, '--agent', agentName, '--dangerously-skip-permissions', '--max-turns', '10'],
        {
          timeout: 300000,
          maxBuffer: 10 * 1024 * 1024,
          env: {
            ...process.env,
            HOME: '/Users/brianegan',
            CLAUDECODE: undefined,
            PATH: `/Users/brianegan/.nvm/versions/node/v24.13.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH}`,
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve(stdout);
          }
        }
      );

      // Safety: kill if process hangs
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Agent timed out after 5 minutes'));
      }, 300000);
    });

    const durationMs = Date.now() - startTime;

    // Update run record
    if (runId) {
      await supabase.from('agent_runs').update({
        status: 'completed',
        output,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      }).eq('id', runId);
    }

    // Save assistant message
    await supabase.from('agent_messages').insert({
      agent_name: agentName,
      role: 'assistant',
      content: output,
      run_id: runId,
    });

    return Response.json({ output, status: 'completed', runId, durationMs });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const durationMs = Date.now() - startTime;

    if (runId) {
      await supabase.from('agent_runs').update({
        status: 'error',
        error: errorMsg,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
      }).eq('id', runId);
    }

    // Save error as assistant message
    await supabase.from('agent_messages').insert({
      agent_name: agentName,
      role: 'assistant',
      content: `Error: ${errorMsg}`,
      run_id: runId,
    });

    return Response.json({ error: errorMsg, status: 'error', runId, durationMs }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentName = searchParams.get('agent');

  if (agentName) {
    // Get messages for specific agent
    const { data: messages } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('agent_name', agentName)
      .order('created_at', { ascending: true })
      .limit(100);

    const { data: runs } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('agent_name', agentName)
      .order('started_at', { ascending: false })
      .limit(50);

    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('agent_name', agentName)
      .order('created_at', { ascending: false });

    return Response.json({ messages: messages || [], runs: runs || [], tasks: tasks || [] });
  }

  // Get all recent runs across all agents
  const { data: runs } = await supabase
    .from('agent_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100);

  return Response.json({ runs: runs || [] });
}
