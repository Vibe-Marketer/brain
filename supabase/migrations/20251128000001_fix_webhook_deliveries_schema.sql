-- Fix webhook_deliveries table schema to match Edge Function insert statements
-- This adds the missing columns that were being inserted by the webhook function,
-- causing silent failures and empty diagnostic history.

-- Add recording_id column for linking to the call recording
ALTER TABLE public.webhook_deliveries
ADD COLUMN IF NOT EXISTS recording_id BIGINT;

-- Add request_headers column to store incoming webhook headers for debugging
ALTER TABLE public.webhook_deliveries
ADD COLUMN IF NOT EXISTS request_headers JSONB;

-- Add request_body column to store the webhook payload for inspection
ALTER TABLE public.webhook_deliveries
ADD COLUMN IF NOT EXISTS request_body JSONB;

-- Add signature_valid column to track signature verification status
ALTER TABLE public.webhook_deliveries
ADD COLUMN IF NOT EXISTS signature_valid BOOLEAN;

-- Add index on recording_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_recording_id
ON public.webhook_deliveries(recording_id);

-- Add comment explaining the schema
COMMENT ON COLUMN public.webhook_deliveries.recording_id IS 'Links to the Fathom recording ID from the webhook payload';
COMMENT ON COLUMN public.webhook_deliveries.request_headers IS 'Incoming HTTP headers for debugging webhook issues';
COMMENT ON COLUMN public.webhook_deliveries.request_body IS 'Full webhook payload for inspection and troubleshooting';
COMMENT ON COLUMN public.webhook_deliveries.signature_valid IS 'Whether the Svix signature was successfully verified';
