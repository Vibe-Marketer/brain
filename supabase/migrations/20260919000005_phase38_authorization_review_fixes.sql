-- Phase 38 interim-review corrections.
-- Additive follow-up to the already-applied 20260919000001..000004 migrations.

-- Keep provider classification total: oversized numeric JSON must resolve to
-- unknown instead of overflowing an INTEGER cast.
CREATE OR REPLACE FUNCTION public.phase38_recording_event_kind(
  p_source_app TEXT,
  p_source_metadata JSONB
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_source_app, '')) <> 'zoom' THEN 'unknown'
    WHEN jsonb_typeof(COALESCE(p_source_metadata, '{}'::JSONB) -> 'zoom_type') <> 'number' THEN 'unknown'
    WHEN (p_source_metadata ->> 'zoom_type') IN ('5', '6', '9') THEN 'webinar'
    WHEN (p_source_metadata ->> 'zoom_type') IN ('1', '2', '3', '4', '7', '8', '99') THEN 'non_webinar'
    ELSE 'unknown'
  END
$$;

-- One complete recording-read predicate for RLS, discovery, request rejection,
-- and privileged copy preflight. The caller identity is explicit so definer
-- functions cannot accidentally substitute organization membership for access.
CREATE OR REPLACE FUNCTION public.phase38_user_can_access_recording_as(
  p_recording_id UUID,
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT
      r.owner_user_id = p_user_id
      OR public.is_organization_admin_or_owner(r.organization_id, p_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.workspace_entries AS we
        JOIN public.workspace_memberships AS wm
          ON wm.workspace_id = we.workspace_id
         AND wm.user_id = p_user_id
        WHERE we.recording_id = r.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.recording_access_grants AS rag
        WHERE rag.recording_id = r.id
          AND rag.grantee_user_id = p_user_id
          AND rag.revoked_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.call_share_links AS csl
        WHERE (
            csl.recording_id = r.id
            OR (
              csl.recording_id IS NULL
              AND csl.call_recording_id = r.fathom_provider_id
            )
          )
          AND csl.user_id = r.owner_user_id
          AND csl.status = 'active'
          AND csl.recipient_email IS NOT NULL
          AND lower(csl.recipient_email) = lower(COALESCE(p_user_email, ''))
          AND (csl.expires_at IS NULL OR csl.expires_at > NOW())
      )
      OR (
        r.access_level = 'attendees'
        AND public.phase38_user_has_recording_participation(r.id, p_user_id, FALSE)
      )
      OR (
        r.access_level = 'invitees'
        AND public.phase38_user_has_recording_participation(r.id, p_user_id, TRUE)
      )
      OR (
        r.access_level = 'organization'
        AND public.is_organization_member(r.organization_id, p_user_id)
      )
    FROM public.recordings AS r
    WHERE r.id = p_recording_id
  ), FALSE)
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_user_can_access_recording_as(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase38_user_can_access_recording_as(UUID, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.phase38_user_can_access_recording(p_recording_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.phase38_user_can_access_recording_as(
    p_recording_id,
    auth.uid(),
    auth.jwt() ->> 'email'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.phase38_user_can_access_recording(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase38_user_can_access_recording(UUID) TO authenticated, service_role;

-- Number only inaccessible copies, and report approved only while the grant
-- created from that request is still active.
CREATE OR REPLACE FUNCTION public.list_discoverable_recording_copies(p_event_id UUID)
RETURNS TABLE (
  copy_ordinal INTEGER,
  recording_id UUID,
  request_status TEXT,
  cooldown_until TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH inaccessible_copies AS (
    SELECT r.id, r.created_at
    FROM public.recordings AS r
    WHERE r.event_id = p_event_id
      AND NOT public.phase38_user_can_access_recording(r.id)
  ), numbered_copies AS (
    SELECT
      ic.id,
      row_number() OVER (ORDER BY ic.created_at, ic.id)::INTEGER AS ordinal
    FROM inaccessible_copies AS ic
  )
  SELECT
    nc.ordinal,
    nc.id,
    CASE
      WHEN latest.status = 'approved' AND NOT EXISTS (
        SELECT 1
        FROM public.recording_access_grants AS rag
        WHERE rag.source_request_id = latest.id
          AND rag.grantee_user_id = auth.uid()
          AND rag.revoked_at IS NULL
      ) THEN NULL
      ELSE latest.status
    END,
    latest.cooldown_until
  FROM numbered_copies AS nc
  LEFT JOIN LATERAL (
    SELECT rar.id, rar.status, rar.cooldown_until
    FROM public.recording_access_requests AS rar
    WHERE rar.recording_id = nc.id
      AND rar.requester_user_id = auth.uid()
    ORDER BY rar.created_at DESC, rar.id DESC
    LIMIT 1
  ) AS latest ON TRUE
  WHERE auth.uid() IS NOT NULL
    AND public.phase38_user_is_verified_confirmed_participant(p_event_id, auth.uid())
    AND public.phase38_event_allows_discovery(p_event_id)
  ORDER BY nc.ordinal
$$;

REVOKE EXECUTE ON FUNCTION public.list_discoverable_recording_copies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_discoverable_recording_copies(UUID) TO authenticated;

-- Preserve the proven copy implementations behind authorization wrappers.
ALTER FUNCTION public.copy_recording_to_org(UUID, UUID, UUID, BOOLEAN)
  RENAME TO phase38_copy_recording_to_org_impl;
REVOKE ALL ON FUNCTION public.phase38_copy_recording_to_org_impl(UUID, UUID, UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.copy_recording_to_org(
  p_recording_id UUID,
  p_target_org_id UUID,
  p_target_workspace_id UUID,
  p_delete_original BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.phase38_user_can_access_recording_as(
       p_recording_id,
       auth.uid(),
       auth.jwt() ->> 'email'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied: recording is not readable';
  END IF;

  RETURN public.phase38_copy_recording_to_org_impl(
    p_recording_id,
    p_target_org_id,
    p_target_workspace_id,
    p_delete_original
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.copy_recording_to_org(UUID, UUID, UUID, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_recording_to_org(UUID, UUID, UUID, BOOLEAN)
  TO authenticated, service_role;

ALTER FUNCTION public.copy_recording_to_organization(UUID, UUID)
  RENAME TO phase38_copy_recording_to_organization_impl;
REVOKE ALL ON FUNCTION public.phase38_copy_recording_to_organization_impl(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.copy_recording_to_organization(
  p_recording_id UUID,
  p_target_org_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.phase38_user_can_access_recording_as(
       p_recording_id,
       auth.uid(),
       auth.jwt() ->> 'email'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied: recording is not readable';
  END IF;

  RETURN public.phase38_copy_recording_to_organization_impl(
    p_recording_id,
    p_target_org_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.copy_recording_to_organization(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_recording_to_organization(UUID, UUID)
  TO authenticated, service_role;

-- The service-role routing RPC still uses its explicit p_user_id, but the
-- selected workspace must be in the target organization and readable by that
-- user before the implementation can insert or relocate entries.
ALTER FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID)
  RENAME TO phase38_route_recording_cross_org_impl;
REVOKE ALL ON FUNCTION public.phase38_route_recording_cross_org_impl(UUID, UUID, UUID, BOOLEAN, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.route_recording_cross_org(
  p_recording_id UUID,
  p_target_org_id UUID,
  p_user_id UUID,
  p_delete_source BOOLEAN DEFAULT FALSE,
  p_target_workspace_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_org_id UUID;
BEGIN
  IF p_target_workspace_id IS NOT NULL THEN
    SELECT w.organization_id
      INTO v_workspace_org_id
    FROM public.workspaces AS w
    WHERE w.id = p_target_workspace_id;

    IF v_workspace_org_id IS NULL OR v_workspace_org_id <> p_target_org_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Target workspace does not belong to target organization';
    END IF;

    IF NOT public.is_workspace_member(p_target_workspace_id, p_user_id) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied: not a member of target workspace';
    END IF;
  END IF;

  RETURN public.phase38_route_recording_cross_org_impl(
    p_recording_id,
    p_target_org_id,
    p_user_id,
    p_delete_source,
    p_target_workspace_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_recording_cross_org(UUID, UUID, UUID, BOOLEAN, UUID)
  TO service_role;
