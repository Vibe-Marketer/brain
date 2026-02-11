-- Add logo_url to banks for business branding
-- Phase 10.2-05: Business bank creation

ALTER TABLE banks
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
