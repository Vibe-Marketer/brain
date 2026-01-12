-- Create pg_cron job for Google Meet polling sync
-- This job runs every 15 minutes to poll all users with Google OAuth connected
-- for new Meet recordings and triggers sync jobs

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create a function to trigger the google-poll-sync edge function
-- This function is called by pg_cron and makes an HTTP request to the edge function
CREATE OR REPLACE FUNCTION trigger_google_poll_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  response extensions.http_response;
BEGIN
  -- Get environment variables from vault or settings
  -- These should be set in Supabase dashboard under Settings > API
  supabase_url := current_setting('app.supabase_url', true);
  service_key := current_setting('app.service_role_key', true);

  -- If settings not available, try alternative approach
  IF supabase_url IS NULL OR supabase_url = '' THEN
    -- Fallback: Get from environment (works in most Supabase deployments)
    supabase_url := 'https://vltmrnjsubfzrgrtdqey.supabase.co';
  END IF;

  -- Log the attempt
  RAISE LOG 'Triggering google-poll-sync at %', now();

  -- Make HTTP POST request to the edge function
  -- The edge function handles authentication via service key
  BEGIN
    SELECT * INTO response FROM extensions.http_post(
      url := supabase_url || '/functions/v1/google-poll-sync',
      body := '{}',
      content_type := 'application/json'
    );

    IF response.status >= 400 THEN
      RAISE LOG 'google-poll-sync returned error status: %, body: %', response.status, response.content;
    ELSE
      RAISE LOG 'google-poll-sync completed successfully with status: %', response.status;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'google-poll-sync HTTP request failed: %', SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION trigger_google_poll_sync() IS 'Triggers the google-poll-sync edge function via HTTP. Called by pg_cron every 15 minutes.';

-- Schedule the cron job to run every 15 minutes
-- The job name must be unique within the database
DO $$
BEGIN
  -- Remove existing job if present (to allow re-running migration)
  PERFORM cron.unschedule('google-poll-sync');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, that's fine
  NULL;
END $$;

SELECT cron.schedule(
  'google-poll-sync',              -- Job name
  '*/15 * * * *',                   -- Every 15 minutes
  'SELECT trigger_google_poll_sync()'
);

-- Also create a function to manually trigger a poll (for testing/admin use)
CREATE OR REPLACE FUNCTION manual_google_poll_sync()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM trigger_google_poll_sync();
  RETURN 'Poll sync triggered at ' || now()::TEXT;
END;
$$;

COMMENT ON FUNCTION manual_google_poll_sync() IS 'Manually trigger Google poll sync for testing. Can be called via: SELECT manual_google_poll_sync();';

-- Grant execute permission to authenticated users (for admin testing)
GRANT EXECUTE ON FUNCTION manual_google_poll_sync() TO authenticated;
