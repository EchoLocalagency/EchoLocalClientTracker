import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agent = searchParams.get('agent');
  const chatId = searchParams.get('id');

  // Get messages for a specific chat
  if (chatId) {
    const { data: messages } = await supabase
      .from('agent_chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    return Response.json({ messages: messages || [] });
  }

  // List all chats for an agent
  if (agent) {
    const { data: chats } = await supabase
      .from('agent_chats')
      .select('id, title, updated_at, agent_name')
      .eq('agent_name', agent)
      .order('updated_at', { ascending: false });

    return Response.json({ chats: chats || [] });
  }

  return Response.json({ error: 'agent or id param required' }, { status: 400 });
}

export async function POST(request: Request) {
  const { agent_name } = await request.json();

  if (!agent_name) {
    return Response.json({ error: 'agent_name required' }, { status: 400 });
  }

  const { data: chat, error } = await supabase
    .from('agent_chats')
    .insert({ agent_name, title: 'New Chat' })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ chat });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'id param required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('agent_chats')
    .delete()
    .eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
