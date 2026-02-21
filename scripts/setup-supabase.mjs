import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhxovsxpwnrdsgcuzyam.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' },
});

// We'll use Supabase's rpc to execute raw SQL by first creating a helper function
const sql = async (query) => {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw error;
  return data;
};

async function setupExecSql() {
  // Create the exec_sql function using the REST API directly
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'SELECT 1' }),
  });

  if (res.status === 404) {
    // Function doesn't exist yet, create it via a different approach
    // Use the Supabase SQL endpoint (available in newer versions)
    console.log('exec_sql function not found. Creating via query endpoint...');

    const createFnRes = await fetch(`${SUPABASE_URL}/sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          CREATE OR REPLACE FUNCTION exec_sql(query text)
          RETURNS json
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            EXECUTE query;
            RETURN '{"ok": true}'::json;
          END;
          $$;
        `,
      }),
    });

    if (!createFnRes.ok) {
      // Try the /pg endpoint
      console.log('Trying /pg endpoint...');
      // Fall back to using the Supabase Management API
      throw new Error('Cannot create exec_sql function. Please run the SQL manually in the Supabase dashboard SQL editor.');
    }
  }
}

async function createTables() {
  const queries = [
    // clients table
    `CREATE TABLE IF NOT EXISTS clients (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      ga4_property TEXT,
      gsc_url TEXT,
      website TEXT,
      github TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    // reports table
    `CREATE TABLE IF NOT EXISTS reports (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      run_date DATE NOT NULL,
      period_start DATE,
      period_end DATE,
      ga4_sessions INTEGER,
      ga4_sessions_prev INTEGER,
      ga4_organic INTEGER,
      ga4_organic_prev INTEGER,
      ga4_phone_clicks INTEGER DEFAULT 0,
      ga4_phone_clicks_prev INTEGER DEFAULT 0,
      ga4_form_submits INTEGER DEFAULT 0,
      ga4_form_submits_prev INTEGER DEFAULT 0,
      gsc_impressions INTEGER,
      gsc_impressions_prev INTEGER,
      gsc_clicks INTEGER,
      gsc_clicks_prev INTEGER,
      gsc_avg_position REAL,
      gsc_avg_position_prev REAL,
      psi_mobile_score INTEGER,
      psi_desktop_score INTEGER,
      psi_lcp_mobile TEXT,
      psi_lcp_desktop TEXT,
      psi_cls_mobile TEXT,
      psi_cls_desktop TEXT,
      psi_tbt_mobile TEXT,
      psi_tbt_desktop TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(client_id, run_date)
    )`,
    // gsc_queries table
    `CREATE TABLE IF NOT EXISTS gsc_queries (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      run_date DATE NOT NULL,
      query TEXT NOT NULL,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      position REAL DEFAULT 0.0
    )`,
  ];

  for (const q of queries) {
    try {
      await sql(q);
      console.log('OK:', q.slice(0, 60) + '...');
    } catch (err) {
      console.error('FAIL:', q.slice(0, 60), err.message);
    }
  }
}

async function seedClients() {
  const clients = [
    {
      name: 'Integrity Pro Washers',
      slug: 'integrity-pro-washers',
      ga4_property: 'properties/523647807',
      gsc_url: 'https://integrityprowashers.com/',
      website: 'https://integrityprowashers.com/',
      github: 'https://github.com/EchoLocalagency/IntegrityProWashing',
      phone: '+16198874442',
    },
    {
      name: 'Mr Green Turf Clean',
      slug: 'mr-green-turf-clean',
      ga4_property: 'properties/524866087',
      gsc_url: 'https://mrgreenturfclean.com/',
      website: 'https://mrgreenturfclean.com/',
      github: 'https://github.com/EchoLocalagency/MrGreenTurfClean',
      phone: '+18587035676',
    },
  ];

  const { data, error } = await supabase
    .from('clients')
    .upsert(clients, { onConflict: 'slug' })
    .select();

  if (error) {
    console.error('Seed clients error:', error.message);
  } else {
    console.log('Seeded clients:', data.map((c) => c.name));
  }
}

async function main() {
  try {
    await setupExecSql();
    await createTables();
    await seedClients();
    console.log('\nDone! Schema created and clients seeded.');
  } catch (err) {
    console.error('\nSetup failed:', err.message);
    console.log('\n--- MANUAL SQL ---');
    console.log('Paste this into the Supabase SQL Editor (https://supabase.com/dashboard):');
    console.log(`
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  ga4_property TEXT,
  gsc_url TEXT,
  website TEXT,
  github TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  ga4_sessions INTEGER,
  ga4_sessions_prev INTEGER,
  ga4_organic INTEGER,
  ga4_organic_prev INTEGER,
  ga4_phone_clicks INTEGER DEFAULT 0,
  ga4_phone_clicks_prev INTEGER DEFAULT 0,
  ga4_form_submits INTEGER DEFAULT 0,
  ga4_form_submits_prev INTEGER DEFAULT 0,
  gsc_impressions INTEGER,
  gsc_impressions_prev INTEGER,
  gsc_clicks INTEGER,
  gsc_clicks_prev INTEGER,
  gsc_avg_position REAL,
  gsc_avg_position_prev REAL,
  psi_mobile_score INTEGER,
  psi_desktop_score INTEGER,
  psi_lcp_mobile TEXT,
  psi_lcp_desktop TEXT,
  psi_cls_mobile TEXT,
  psi_cls_desktop TEXT,
  psi_tbt_mobile TEXT,
  psi_tbt_desktop TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, run_date)
);

CREATE TABLE IF NOT EXISTS gsc_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  query TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  position REAL DEFAULT 0.0
);

INSERT INTO clients (name, slug, ga4_property, gsc_url, website, github, phone) VALUES
  ('Integrity Pro Washers', 'integrity-pro-washers', 'properties/523647807', 'https://integrityprowashers.com/', 'https://integrityprowashers.com/', 'https://github.com/EchoLocalagency/IntegrityProWashing', '+16198874442'),
  ('Mr Green Turf Clean', 'mr-green-turf-clean', 'properties/524866087', 'https://mrgreenturfclean.com/', 'https://mrgreenturfclean.com/', 'https://github.com/EchoLocalagency/MrGreenTurfClean', '+18587035676')
ON CONFLICT (slug) DO NOTHING;
    `);
  }
}

main();
