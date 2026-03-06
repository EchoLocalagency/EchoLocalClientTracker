import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('linkedin_drafts')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('LinkedIn drafts error:', error);
    return Response.json({ total: 0, drafts: [], research: [] });
  }

  const drafts = (data || []).filter((d) => d.type === 'draft');
  const research = (data || []).filter((d) => d.type === 'research');

  return Response.json({
    total: (data || []).length,
    drafts,
    research,
  });
}
