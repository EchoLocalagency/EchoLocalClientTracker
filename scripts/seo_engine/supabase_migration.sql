-- SEO Engine Tables
-- Run this in the Supabase SQL editor for project yhxovsxpwnrdsgcuzyam

-- Every action the system takes
CREATE TABLE IF NOT EXISTS seo_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    target_keywords TEXT[],
    content_summary TEXT,
    metadata JSONB DEFAULT '{}',
    baseline_position REAL,
    baseline_impressions INTEGER,
    baseline_clicks INTEGER,
    baseline_gbp_impressions INTEGER,
    followup_7d JSONB,
    followup_14d JSONB,
    followup_28d JSONB,
    impact_score REAL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Scheduled follow-up measurements
CREATE TABLE IF NOT EXISTS seo_action_followups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_id UUID REFERENCES seo_actions(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    followup_type TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    measured_data JSONB,
    measured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log of every brain decision
CREATE TABLE IF NOT EXISTS seo_brain_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    input_summary JSONB NOT NULL,
    raw_response TEXT,
    parsed_actions JSONB,
    execution_log JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_actions_client ON seo_actions(client_id);
CREATE INDEX IF NOT EXISTS idx_seo_actions_date ON seo_actions(action_date);
CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON seo_action_followups(scheduled_date, completed);
