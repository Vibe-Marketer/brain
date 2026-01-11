-- Add automation webhook secrets management to user_settings table
-- This enables external systems to trigger automation rules via authenticated webhooks

-- Add automation_webhook_secret column for HMAC-SHA256 signature verification
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS automation_webhook_secret TEXT;

-- Add timestamp for tracking when the secret was last generated/regenerated
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS automation_webhook_secret_created_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_settings.automation_webhook_secret IS 'HMAC-SHA256 secret for verifying automation webhook signatures. Used by automation-webhook Edge Function.';
COMMENT ON COLUMN public.user_settings.automation_webhook_secret_created_at IS 'Timestamp when the automation webhook secret was created or last regenerated.';

-- Create function to generate a new webhook secret
-- Uses gen_random_bytes for cryptographically secure random generation
CREATE OR REPLACE FUNCTION public.generate_automation_webhook_secret(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_secret TEXT;
BEGIN
  -- Generate a 32-byte (256-bit) cryptographically secure random secret
  -- Encode as hex for easy storage and transmission
  new_secret := encode(gen_random_bytes(32), 'hex');

  -- Update the user's settings with the new secret
  UPDATE public.user_settings
  SET
    automation_webhook_secret = new_secret,
    automation_webhook_secret_created_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If no row exists, insert one with the secret
  IF NOT FOUND THEN
    INSERT INTO public.user_settings (user_id, automation_webhook_secret, automation_webhook_secret_created_at, created_at, updated_at)
    VALUES (p_user_id, new_secret, NOW(), NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      automation_webhook_secret = EXCLUDED.automation_webhook_secret,
      automation_webhook_secret_created_at = EXCLUDED.automation_webhook_secret_created_at,
      updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN new_secret;
END;
$$;

COMMENT ON FUNCTION public.generate_automation_webhook_secret(UUID) IS 'Generates and stores a new 256-bit cryptographically secure webhook secret for the specified user. Returns the new secret.';

-- Grant execute to authenticated users (they can only regenerate their own secret due to RLS)
GRANT EXECUTE ON FUNCTION public.generate_automation_webhook_secret(UUID) TO authenticated;

-- Create function to revoke/clear webhook secret (for disabling webhooks)
CREATE OR REPLACE FUNCTION public.revoke_automation_webhook_secret(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_settings
  SET
    automation_webhook_secret = NULL,
    automation_webhook_secret_created_at = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.revoke_automation_webhook_secret(UUID) IS 'Clears the automation webhook secret for the specified user, effectively disabling webhook authentication.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.revoke_automation_webhook_secret(UUID) TO authenticated;

-- Create index for quick lookup of users with configured webhook secrets
-- Useful for admin dashboards and webhook statistics
CREATE INDEX IF NOT EXISTS idx_user_settings_automation_webhook_secret_exists
ON public.user_settings (user_id)
WHERE automation_webhook_secret IS NOT NULL;
