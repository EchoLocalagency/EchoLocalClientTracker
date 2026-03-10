-- GEO citation-readiness score per page per day
CREATE TABLE IF NOT EXISTS geo_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    page_path TEXT NOT NULL,          -- relative path, e.g. "services.html"
    page_url TEXT,                     -- full URL, e.g. "https://mrgreenturfclean.com/services.html"
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 5),
    factors JSONB NOT NULL,            -- {"answer_block": 0, "stats_density": 1, ...}
    scored_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One score per page per day (upsert target)
CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_scores_page_day ON geo_scores(client_id, page_path, scored_at);

-- Index for trend queries
CREATE INDEX IF NOT EXISTS idx_geo_scores_trend ON geo_scores(client_id, scored_at);
