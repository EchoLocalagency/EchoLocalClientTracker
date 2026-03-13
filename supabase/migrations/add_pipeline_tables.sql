-- Pipeline Tracker tables for v1.4 Client Pipeline Tracker

-- Table 1: pipeline_leads
-- Central lead record tracking each prospect through the sales pipeline
CREATE TABLE IF NOT EXISTS pipeline_leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_name text NOT NULL,
    email text,
    phone text,
    company_name text,
    trade text,
    source text NOT NULL DEFAULT 'manual',
    channel text,
    notes text,
    stage text NOT NULL DEFAULT 'Lead',
    stage_entered_at timestamptz NOT NULL DEFAULT now(), -- IMPORTANT: Update this column whenever stage is changed
    call_analysis_id uuid REFERENCES call_analyses(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_stage ON pipeline_leads(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_phone ON pipeline_leads(phone);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_company ON pipeline_leads(lower(company_name));

-- Table 2: pipeline_stage_history
-- Append-only log of all stage transitions for a lead
CREATE TABLE IF NOT EXISTS pipeline_stage_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES pipeline_leads(id) ON DELETE CASCADE,
    previous_stage text, -- NULL for initial entry
    new_stage text NOT NULL,
    transitioned_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stage_history_lead ON pipeline_stage_history(lead_id);

-- Table 3: pipeline_checklist_items
-- Per-lead, per-stage checklist items stored as queryable rows
CREATE TABLE IF NOT EXISTS pipeline_checklist_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES pipeline_leads(id) ON DELETE CASCADE,
    stage text NOT NULL,
    item_key text NOT NULL,
    item_label text NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(lead_id, stage, item_key)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_checklist_lead ON pipeline_checklist_items(lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_checklist_lead_stage ON pipeline_checklist_items(lead_id, stage);

-- Table 4: pipeline_comms
-- Communication log for each lead (calls, emails, texts)
CREATE TABLE IF NOT EXISTS pipeline_comms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES pipeline_leads(id) ON DELETE CASCADE,
    comm_type text NOT NULL, -- 'call', 'email', 'text'
    direction text NOT NULL DEFAULT 'outbound', -- 'outbound', 'inbound'
    notes text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_comms_lead ON pipeline_comms(lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_comms_occurred_at ON pipeline_comms(occurred_at);

-- RLS: pipeline_leads
ALTER TABLE pipeline_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_leads_admin_only"
    ON pipeline_leads
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- RLS: pipeline_stage_history
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_stage_history_admin_only"
    ON pipeline_stage_history
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- RLS: pipeline_checklist_items
ALTER TABLE pipeline_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_checklist_items_admin_only"
    ON pipeline_checklist_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );

-- RLS: pipeline_comms
ALTER TABLE pipeline_comms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_comms_admin_only"
    ON pipeline_comms
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.role = 'admin'
        )
    );
