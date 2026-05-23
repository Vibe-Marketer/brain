-- Migration: Add connection_metadata to import_sources
-- Purpose: Persist provider-specific connection details needed for durable syncs
--          without overloading generic display columns.
-- Date: 2026-05-23

ALTER TABLE public.import_sources
ADD COLUMN IF NOT EXISTS connection_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.import_sources.connection_metadata IS
  'Provider-specific durable connection state (e.g. Plaud api_base, workspace_id, auth_type).';
