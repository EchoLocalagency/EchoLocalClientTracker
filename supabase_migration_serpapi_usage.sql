-- SerpAPI Usage Tracking Migration
-- Run this in the Supabase SQL editor
-- Tracks every SerpAPI call per client for budget enforcement

CREATE TABLE IF NOT EXISTS serpapi_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL DEFAULT 'organic',
    location TEXT,
    searched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for per-client monthly budget checks
CREATE INDEX idx_serpapi_usage_client_month ON serpapi_usage(client_id, searched_at);

-- Index for global monthly budget checks
CREATE INDEX idx_serpapi_usage_month ON serpapi_usage(searched_at);
