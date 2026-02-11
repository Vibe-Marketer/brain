-- Migration: Shared-with-me RPC cache fix
-- Purpose: Ensure a callable RPC exists and force PostgREST schema cache reload

CREATE OR REPLACE FUNCTION public.get_calls_shared_with_me_v2(
  p_include_expired BOOLEAN DEFAULT FALSE
)
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
    AND (
      p_include_expired
      OR l.expires_at IS NULL
      OR l.expires_at > NOW()
    )
  ORDER BY c.recording_start_time DESC;
$$;

-- Keep legacy RPC name available as alias
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
  SELECT * FROM public.get_calls_shared_with_me_v2(FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.get_calls_shared_with_me_v2(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calls_shared_with_me() TO authenticated;

-- Force PostgREST schema cache reload (needed for immediate RPC visibility)
NOTIFY pgrst, 'reload schema';
