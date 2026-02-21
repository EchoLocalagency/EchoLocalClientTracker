import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map GHL location IDs to client slugs
const LOCATION_MAP: Record<string, string> = {
  'KwsH04X22oBXm8Ugdqb8': 'integrity-pro-washers',
  '3m3jhkEz2xInUprxbRzX': 'mr-green-turf-clean',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // GHL sends location_id in the webhook payload
    const locationId = body.location_id || body.locationId || body.location?.id;
    const slug = locationId ? LOCATION_MAP[locationId] : null;

    if (!slug) {
      // Try to match by contact email domain or other field if location_id missing
      console.error('Unknown location_id:', locationId, 'Body keys:', Object.keys(body));
      return NextResponse.json({ error: 'Unknown location' }, { status: 400 });
    }

    // Get the client record
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!clientData) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get today's report for this client (most recent)
    const today = new Date().toISOString().split('T')[0];
    const { data: reportData } = await supabase
      .from('reports')
      .select('id, ga4_form_submits')
      .eq('client_id', clientData.id)
      .order('run_date', { ascending: false })
      .limit(1)
      .single();

    if (reportData) {
      // Increment form_submits on the latest report
      await supabase
        .from('reports')
        .update({ ga4_form_submits: (reportData.ga4_form_submits || 0) + 1 })
        .eq('id', reportData.id);
    }

    // Also log to a dedicated form_submissions table for granular tracking
    await supabase.from('form_submissions').insert({
      client_id: clientData.id,
      submitted_at: new Date().toISOString(),
      form_name: body.form_name || body.formName || body.name || 'contact',
      contact_name: body.contact?.full_name || body.full_name || body.firstName || null,
      contact_email: body.contact?.email || body.email || null,
      contact_phone: body.contact?.phone || body.phone || null,
      raw_payload: body,
    });

    console.log(`Form submit recorded: ${slug}`);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GHL sometimes sends a GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ ok: true, service: 'echo-local-ghl-webhook' });
}
