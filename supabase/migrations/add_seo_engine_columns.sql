-- Add SEO Engine columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_keywords text[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_areas text[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS drive_folder_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website_local_path text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gbp_location text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_token text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_location_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_form_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_market text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS conversion_events jsonb DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ga4_measurement_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS seo_engine_enabled boolean DEFAULT false;
