-- Add INP (Interaction to Next Paint) columns to reports table
-- INP is a Core Web Vital since March 2024, replacing FID.
-- Values are in milliseconds. Good < 200ms, Needs Improvement < 500ms, Poor >= 500ms.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS psi_inp_mobile REAL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS psi_inp_desktop REAL;
