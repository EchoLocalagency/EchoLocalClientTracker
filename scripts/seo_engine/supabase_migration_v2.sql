-- SEO Engine v2 Migration
-- Run this in the Supabase SQL editor

-- Content clusters: tracks pillar pages, supporting posts, gap topics
CREATE TABLE IF NOT EXISTS seo_content_clusters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id),
    cluster_name TEXT NOT NULL,
    pillar_page TEXT,
    supporting_posts TEXT[] DEFAULT '{}',
    target_keywords TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active',
    gap_topics TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_clusters_client ON seo_content_clusters(client_id);
CREATE INDEX idx_content_clusters_status ON seo_content_clusters(status);

-- Page schema tracking: which pages have which schema types
CREATE TABLE IF NOT EXISTS seo_page_schemas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id),
    page_path TEXT NOT NULL,
    schema_types TEXT[] DEFAULT '{}',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_schemas_client ON seo_page_schemas(client_id);
CREATE UNIQUE INDEX idx_page_schemas_client_page ON seo_page_schemas(client_id, page_path);

-- Internal links injected by the auto-linker
CREATE TABLE IF NOT EXISTS seo_internal_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id),
    source_page TEXT NOT NULL,
    target_page TEXT NOT NULL,
    anchor_text TEXT NOT NULL,
    injected_date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX idx_internal_links_client ON seo_internal_links(client_id);
CREATE INDEX idx_internal_links_source ON seo_internal_links(source_page);

-- Add newsjack flag and GBP media tracking to existing actions table
ALTER TABLE seo_actions ADD COLUMN IF NOT EXISTS is_newsjack BOOLEAN DEFAULT FALSE;
ALTER TABLE seo_actions ADD COLUMN IF NOT EXISTS gbp_media_name TEXT;
