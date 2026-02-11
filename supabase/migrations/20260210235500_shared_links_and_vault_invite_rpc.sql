-- Migration: Restore shared-with-me data path + robust vault invite RPC
-- Purpose:
--   1) Ensure call_share_links table exists for recipient-based sharing
--   2) Add SECURITY DEFINER RPC to fetch shared calls without cross-user RLS failures
--   3) Ensure vault invite columns exist and add SECURITY DEFINER RPC to generate invites

-- ============================================================================
-- CALL SHARE LINKS TABLE (idempotent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.call_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  call_recording_id BIGINT NOT NULL,
  share_token VARCHAR(64) UNIQUE,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_call_share_links_recipient_email
  ON public.call_share_links(recipient_email);

CREATE INDEX IF NOT EXISTS idx_call_share_links_recording_user
  ON public.call_share_links(call_recording_id, user_id);

CREATE INDEX IF NOT EXISTS idx_call_share_links_status
  ON public.call_share_links(status);

ALTER TABLE public.call_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Call share links owner read" ON public.call_share_links;
CREATE POLICY "Call share links owner read"
  ON public.call_share_links
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Call share links owner insert" ON public.call_share_links;
CREATE POLICY "Call share links owner insert"
  ON public.call_share_links
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Call share links owner update" ON public.call_share_links;
CREATE POLICY "Call share links owner update"
  ON public.call_share_links
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Call share links owner delete" ON public.call_share_links;
CREATE POLICY "Call share links owner delete"
  ON public.call_share_links
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Call share links recipient read" ON public.call_share_links;
CREATE POLICY "Call share links recipient read"
  ON public.call_share_links
  FOR SELECT
  USING (
    recipient_email IS NOT NULL
    AND lower(recipient_email) = lower((auth.jwt() ->> 'email'))
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- ============================================================================
-- RPC: GET CALLS SHARED WITH CURRENT USER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_calls_shared_with_me()
RETURNS TABLE (
  recording_id BIGINT,
  call_name TEXT,
  recording_start_time TIMESTAMPTZ,
  duration TEXT,
  owner_user_id UUID,
  source_type TEXT,
  source_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    c.recording_id,
    c.title AS call_name,
    c.recording_start_time,
    NULL::TEXT AS duration,
    l.user_id AS owner_user_id,
    'share_link'::TEXT AS source_type,
    'Direct Link'::TEXT AS source_label
  FROM public.call_share_links l
  INNER JOIN public.fathom_calls c
    ON c.recording_id = l.call_recording_id
   AND c.user_id = l.user_id
  WHERE l.status = 'active'
    AND l.recipient_email IS NOT NULL
    AND lower(l.recipient_email) = lower((auth.jwt() ->> 'email'))
    AND (l.expires_at IS NULL OR l.expires_at > NOW())
  ORDER BY c.recording_start_time DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_calls_shared_with_me() TO authenticated;

-- ============================================================================
-- VAULT INVITE COLUMNS + RPC
-- ============================================================================

ALTER TABLE public.vaults
ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vaults_invite_token
  ON public.vaults(invite_token)
  WHERE invite_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_vault_invite(
  p_vault_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_existing_token TEXT;
  v_existing_expires TIMESTAMPTZ;
  v_token TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT role INTO v_role
  FROM public.vault_memberships
  WHERE vault_id = p_vault_id
    AND user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('vault_owner', 'vault_admin') THEN
    RAISE EXCEPTION 'Only hub owners and admins can generate invite links';
  END IF;

  SELECT v.invite_token, v.invite_expires_at
    INTO v_existing_token, v_existing_expires
  FROM public.vaults v
  WHERE v.id = p_vault_id;

  IF NOT p_force
     AND v_existing_token IS NOT NULL
     AND v_existing_expires IS NOT NULL
     AND v_existing_expires > NOW() THEN
    RETURN QUERY SELECT v_existing_token, v_existing_expires;
    RETURN;
  END IF;

  v_token := replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_expires := NOW() + INTERVAL '7 days';

  UPDATE public.vaults
  SET invite_token = v_token,
      invite_expires_at = v_expires,
      updated_at = NOW()
  WHERE id = p_vault_id;

  RETURN QUERY SELECT v_token, v_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_vault_invite(UUID, BOOLEAN) TO authenticated;
