import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentName = searchParams.get('agent');

  if (agentName) {
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

    return Response.json({ runs: runs || [], tasks: tasks || [] });
  }

  // Get all recent runs across all agents
  const { data: runs } = await supabase
    .from('agent_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100);

  return Response.json({ runs: runs || [] });
}
