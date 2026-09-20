-- Migration: Restore the single-call share access audit log after historical drift
-- Purpose: Repair a missing table without rewriting share rows or existing logs
-- Date: 2026-09-19

CREATE TABLE IF NOT EXISTS public.call_share_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL
    REFERENCES public.call_share_links(id) ON DELETE CASCADE,
  accessed_by_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT
);

-- Reconcile both supported historical shapes. These additions preserve every
-- existing row and make anonymous share access explicit through a nullable
-- accessor rather than a fabricated auth user.
ALTER TABLE public.call_share_access_log
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS share_link_id UUID,
  ADD COLUMN IF NOT EXISTS accessed_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

ALTER TABLE public.call_share_access_log
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN share_link_id SET NOT NULL,
  ALTER COLUMN accessed_by_user_id DROP NOT NULL,
  ALTER COLUMN accessed_at SET DEFAULT NOW();

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.call_share_access_log'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.call_share_access_log
      ADD CONSTRAINT call_share_access_log_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.call_share_access_log'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute
         WHERE attrelid = 'public.call_share_access_log'::regclass
           AND attname = 'share_link_id')
      ]::SMALLINT[]
  ) THEN
    ALTER TABLE public.call_share_access_log
      ADD CONSTRAINT call_share_access_log_share_link_id_fkey
      FOREIGN KEY (share_link_id)
      REFERENCES public.call_share_links(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.call_share_access_log'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_catalog.pg_attribute
         WHERE attrelid = 'public.call_share_access_log'::regclass
           AND attname = 'accessed_by_user_id')
      ]::SMALLINT[]
  ) THEN
    ALTER TABLE public.call_share_access_log
      ADD CONSTRAINT call_share_access_log_accessed_by_user_id_fkey
      FOREIGN KEY (accessed_by_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS idx_call_share_access_log_share_link_id
  ON public.call_share_access_log(share_link_id);

CREATE INDEX IF NOT EXISTS idx_call_share_access_log_accessed_by_user_id
  ON public.call_share_access_log(accessed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_call_share_access_log_accessed_at
  ON public.call_share_access_log(accessed_at);

ALTER TABLE public.call_share_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view access logs for their share links"
  ON public.call_share_access_log;
CREATE POLICY "Owners can view access logs for their share links"
  ON public.call_share_access_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.call_share_links AS link
      WHERE link.id = call_share_access_log.share_link_id
        AND link.user_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.call_share_access_log
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.call_share_access_log TO authenticated;
GRANT ALL ON TABLE public.call_share_access_log TO service_role;

COMMENT ON TABLE public.call_share_access_log IS
  'Audit log of shared-call access. Browser clients may read owner-scoped rows but only the service role may write.';
COMMENT ON COLUMN public.call_share_access_log.id IS
  'Stable identifier for one share-link access event.';
COMMENT ON COLUMN public.call_share_access_log.share_link_id IS
  'Share link that was accessed; deleting the link removes its audit rows.';
COMMENT ON COLUMN public.call_share_access_log.accessed_by_user_id IS
  'Authenticated accessor when known; NULL represents anonymous access.';
COMMENT ON COLUMN public.call_share_access_log.accessed_at IS
  'Timestamp at which the share link was accessed.';
COMMENT ON COLUMN public.call_share_access_log.ip_address IS
  'Optional accessor IP retained for security auditing.';

NOTIFY pgrst, 'reload schema';
