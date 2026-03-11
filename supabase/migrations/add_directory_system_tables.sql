-- Directory Submission System Tables
-- Creates client_profiles, directories, and submissions tables
-- Follows pattern from supabase_migration_v3_backlinks.sql

-- Client canonical profiles for directory submissions
CREATE TABLE IF NOT EXISTS client_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    business_name text NOT NULL,
    phone text,
    address_street text,
    address_city text,
    address_state text,
    address_zip text,
    email text,
    website text,
    description text,
    short_description text,
    services text[] DEFAULT '{}',
    certifications text[] DEFAULT '{}',
    payment_methods text[] DEFAULT '{}',
    hours jsonb DEFAULT '{}',
    social_links jsonb DEFAULT '{}',
    year_established integer,
    logo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id)
);

-- Master directory list
CREATE TABLE IF NOT EXISTS directories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    domain text NOT NULL,
    submission_url text,
    tier integer NOT NULL DEFAULT 3,
    trades text[] DEFAULT '{}',
    submission_method text DEFAULT 'web_form',
    captcha_status text DEFAULT 'unknown',
    captcha_checked_at timestamptz,
    da_score integer,
    enabled boolean DEFAULT true,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(domain)
);

-- Submission tracking (links clients to directories)
CREATE TABLE IF NOT EXISTS submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    directory_id uuid REFERENCES directories(id) ON DELETE CASCADE NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    live_url text,
    submitted_at timestamptz,
    verified_at timestamptz,
    notes text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id, directory_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_profiles_client ON client_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_directories_tier ON directories(tier);
CREATE INDEX IF NOT EXISTS idx_directories_trades ON directories USING gin(trades);
CREATE INDEX IF NOT EXISTS idx_submissions_client ON submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_submissions_directory ON submissions(directory_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
