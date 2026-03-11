-- Keyword Tracking Tables
-- tracked_keywords: persistent list of keywords to track per client
-- keyword_snapshots: historical position data from GSC + SerpAPI

CREATE TABLE IF NOT EXISTS tracked_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'target_list',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(client_id, keyword)
);

CREATE TABLE IF NOT EXISTS keyword_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    checked_at DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT NOT NULL,
    position REAL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    serp_position INTEGER,
    in_map_pack BOOLEAN DEFAULT false,
    map_pack_position INTEGER,
    has_featured_snippet BOOLEAN DEFAULT false,
    has_ai_overview BOOLEAN DEFAULT false,
    client_cited_in_aio BOOLEAN DEFAULT false,
    serp_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(client_id, keyword, checked_at, source)
);

CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_client_date
    ON keyword_snapshots(client_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_client_keyword_date
    ON keyword_snapshots(client_id, keyword, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracked_keywords_client
    ON tracked_keywords(client_id);
