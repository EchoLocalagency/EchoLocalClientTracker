import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const body = await request.json();
  const { action, ...data } = body;

  if (action === 'create') {
    const { data: task, error } = await supabase
      .from('agent_tasks')
      .insert({
        agent_name: data.agent_name,
        title: data.title,
        description: data.description || null,
        priority: data.priority || 'medium',
      })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ task });
  }

  if (action === 'update') {
    const { data: task, error } = await supabase
      .from('agent_tasks')
      .update({
        status: data.status,
        title: data.title,
        description: data.description,
        priority: data.priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ task });
  }

  if (action === 'delete') {
    const { error } = await supabase
      .from('agent_tasks')
      .delete()
      .eq('id', data.id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
