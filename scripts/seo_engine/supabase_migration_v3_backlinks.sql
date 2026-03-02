-- Backlink System Tables
-- Run via Supabase SQL editor

-- Discovered backlink opportunities (from research modules)
CREATE TABLE IF NOT EXISTS backlink_targets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) NOT NULL,
    target_url text NOT NULL,
    target_domain text NOT NULL,
    opportunity_type text NOT NULL, -- broken_link, brand_mention, competitor_gap, journalist
    contact_email text,
    contact_name text,
    relevance_score integer DEFAULT 0, -- 1-10
    context text, -- why this is an opportunity
    discovered_at timestamptz DEFAULT now(),
    status text DEFAULT 'new', -- new, contacted, replied, won, lost, skipped
    metadata jsonb DEFAULT '{}',
    UNIQUE(client_id, target_url)
);

-- Outreach emails sent + tracked
CREATE TABLE IF NOT EXISTS backlink_outreach (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) NOT NULL,
    target_id uuid REFERENCES backlink_targets(id),
    template_type text NOT NULL, -- broken_link, brand_mention, haro_pitch, followup
    subject text NOT NULL,
    body text NOT NULL,
    sent_at timestamptz DEFAULT now(),
    followup_number integer DEFAULT 0, -- 0=initial, 1=first followup, 2=second
    reply_received boolean DEFAULT false,
    reply_date timestamptz,
    outcome text -- won, lost, no_reply
);

-- Rate-limit view: emails sent today + this week
CREATE OR REPLACE VIEW backlink_outreach_rate AS
SELECT
    client_id,
    COUNT(*) FILTER (WHERE sent_at::date = CURRENT_DATE) AS sent_today,
    COUNT(*) FILTER (WHERE sent_at >= date_trunc('week', CURRENT_DATE)) AS sent_this_week
FROM backlink_outreach
GROUP BY client_id;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backlink_targets_client ON backlink_targets(client_id);
CREATE INDEX IF NOT EXISTS idx_backlink_targets_status ON backlink_targets(status);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_client ON backlink_outreach(client_id);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_sent ON backlink_outreach(sent_at);
