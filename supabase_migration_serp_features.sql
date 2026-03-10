-- SERP Features Migration
-- Stores per-keyword SERP feature data (AI Overview, PAA, Featured Snippets)
-- for time-series tracking across research runs.

CREATE TABLE IF NOT EXISTS serp_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    has_ai_overview BOOLEAN DEFAULT FALSE,
    client_cited_in_ai_overview BOOLEAN DEFAULT FALSE,
    ai_overview_references JSONB DEFAULT '[]'::jsonb,
    paa_questions JSONB DEFAULT '[]'::jsonb,
    paa_data JSONB DEFAULT '[]'::jsonb,
    has_featured_snippet BOOLEAN DEFAULT FALSE,
    featured_snippet_holder TEXT DEFAULT '',
    client_has_snippet BOOLEAN DEFAULT FALSE,
    collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for per-keyword time-series queries
CREATE INDEX idx_serp_features_keyword ON serp_features(client_id, keyword, collected_at);

-- Index for AI Overview detection filtering
CREATE INDEX idx_serp_features_ai_overview ON serp_features(has_ai_overview, collected_at);
