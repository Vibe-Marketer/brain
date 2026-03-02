-- Phase 16: Refactor Vaults to Workspaces Migration
BEGIN;

-- 1. RENAME TABLES
ALTER TABLE banks RENAME TO organizations;
ALTER TABLE bank_memberships RENAME TO organization_memberships;
ALTER TABLE vaults RENAME TO workspaces;
ALTER TABLE vault_memberships RENAME TO workspace_memberships;
ALTER TABLE vault_entries RENAME TO workspace_entries;

-- 2. RENAME COLUMNS
ALTER TABLE call_tags RENAME COLUMN bank_id TO organization_id;
ALTER TABLE chat_sessions RENAME COLUMN bank_id TO organization_id;
ALTER TABLE content_items RENAME COLUMN bank_id TO organization_id;
ALTER TABLE content_library RENAME COLUMN bank_id TO organization_id;
ALTER TABLE folders RENAME COLUMN bank_id TO organization_id;
ALTER TABLE folders RENAME COLUMN vault_id TO workspace_id;
ALTER TABLE templates RENAME COLUMN bank_id TO organization_id;
ALTER TABLE recordings RENAME COLUMN bank_id TO organization_id;

ALTER TABLE workspaces RENAME COLUMN bank_id TO organization_id;
ALTER TABLE workspaces RENAME COLUMN vault_type TO workspace_type;
ALTER TABLE workspace_memberships RENAME COLUMN vault_id TO workspace_id;
ALTER TABLE workspace_entries RENAME COLUMN vault_id TO workspace_id;
ALTER TABLE organization_memberships RENAME COLUMN bank_id TO organization_id;

ALTER TABLE import_routing_rules RENAME COLUMN bank_id TO organization_id;
ALTER TABLE import_routing_rules RENAME COLUMN target_vault_id TO target_workspace_id;
ALTER TABLE import_routing_defaults RENAME COLUMN bank_id TO organization_id;
ALTER TABLE import_routing_defaults RENAME COLUMN target_vault_id TO target_workspace_id;

-- Drop checks
ALTER TABLE organization_memberships DROP CONSTRAINT IF EXISTS bank_memberships_role_check;
ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS vault_memberships_role_check;
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS vaults_vault_type_check;

-- Ensure enums/text records are updated
UPDATE organization_memberships SET role = 'organization_owner' WHERE role = 'bank_owner';
UPDATE organization_memberships SET role = 'organization_admin' WHERE role = 'bank_admin';
UPDATE workspace_memberships SET role = 'workspace_owner' WHERE role = 'vault_owner';
UPDATE workspace_memberships SET role = 'workspace_admin' WHERE role = 'vault_admin';

-- Re-add constraints
ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_role_check CHECK (role IN ('organization_owner', 'organization_admin', 'manager', 'member', 'guest'));
ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('workspace_owner', 'workspace_admin', 'manager', 'member', 'guest'));
ALTER TABLE workspaces ADD CONSTRAINT workspaces_workspace_type_check CHECK (workspace_type IN ('personal', 'team', 'youtube'));

-- 3. DROP OLD FUNCTIONS 
DROP FUNCTION IF EXISTS update_banks_updated_at() CASCADE;
DROP FUNCTION IF EXISTS is_bank_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_bank_admin_or_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS create_business_bank(text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_workspace_invite_details(text) CASCADE;
DROP FUNCTION IF EXISTS update_vaults_updated_at() CASCADE;
DROP FUNCTION IF EXISTS is_vault_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_vault_admin_or_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_vault_bank_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS generate_vault_invite(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS accept_workspace_invite(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS update_routing_rule_priorities(uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS update_vault_entries_updated_at() CASCADE;
DROP FUNCTION IF EXISTS get_recording_bank_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS migrate_fathom_call_to_recording(bigint, uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS ensure_personal_bank(uuid) CASCADE;
DROP FUNCTION IF EXISTS hybrid_search_transcripts_scoped(text, vector, integer, double precision, double precision, integer, uuid, uuid, uuid, timestamp with time zone, timestamp with time zone, text[], text[], bigint[], text[], text, text[], text[]) CASCADE;
DROP FUNCTION IF EXISTS hybrid_search_transcripts(text, vector, integer, double precision, double precision, integer, uuid, timestamp with time zone, timestamp with time zone, text[], text[], bigint[], text[], text, text[], text[], text[], uuid) CASCADE;

-- 4. RECREATE FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_organization_member(p_organization_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id AND user_id = p_user_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_organization_admin_or_owner(p_organization_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id 
      AND user_id = p_user_id
      AND role IN ('organization_owner', 'organization_admin')
  )
$function$;

CREATE OR REPLACE FUNCTION public.create_business_organization(p_name text, p_cross_bank_default text DEFAULT 'copy_only'::text, p_logo_url text DEFAULT NULL::text, p_default_workspace_name text DEFAULT NULL::text)
 RETURNS TABLE(organization_id uuid, workspace_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_organization_id UUID;
  v_workspace_id UUID;
  v_name TEXT;
  v_cross_bank_default TEXT;
  v_workspace_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := trim(p_name);
  IF v_name IS NULL OR length(v_name) < 3 OR length(v_name) > 50 THEN
    RAISE EXCEPTION 'Organization name must be between 3 and 50 characters';
  END IF;

  v_cross_bank_default := COALESCE(p_cross_bank_default, 'copy_only');
  IF v_cross_bank_default NOT IN ('copy_only', 'copy_and_remove') THEN
    v_cross_bank_default := 'copy_only';
  END IF;

  v_workspace_name := COALESCE(NULLIF(trim(p_default_workspace_name), ''), v_name || '''s Vault');

  INSERT INTO organizations (name, type, cross_bank_default, logo_url)
  VALUES (v_name, 'business', v_cross_bank_default, p_logo_url)
  RETURNING id INTO v_organization_id;

  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, v_user_id, 'organization_owner');

  INSERT INTO workspaces (organization_id, name, workspace_type)
  VALUES (v_organization_id, v_workspace_name, 'team')
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'workspace_owner');

  organization_id := v_organization_id;
  workspace_id := v_workspace_id;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_invite_details(p_token text)
 RETURNS TABLE(invitation_id uuid, workspace_name text, organization_name text, inviter_display_name text, role text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    wi.id,
    v.name::TEXT,
    b.name::TEXT,
    (u.raw_user_meta_data->>'full_name')::TEXT,
    wi.role,
    wi.expires_at
  FROM workspace_invitations wi
  JOIN workspaces v ON v.id = wi.workspace_id
  JOIN organizations b ON b.id = v.organization_id
  JOIN auth.users u ON u.id = wi.invited_by
  WHERE wi.token = p_token
    AND wi.status = 'pending'
    AND wi.expires_at > NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_google_poll_sync()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_workspaces_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM workspace_memberships
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(p_workspace_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM workspace_memberships
    WHERE workspace_id = p_workspace_id 
      AND user_id = p_user_id
      AND role IN ('workspace_owner', 'workspace_admin')
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_vault_organization_id(p_workspace_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM workspaces WHERE id = p_workspace_id
$function$;

CREATE OR REPLACE FUNCTION public.generate_workspace_invite(p_workspace_id uuid, p_force boolean DEFAULT false)
 RETURNS TABLE(invite_token text, invite_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_existing_token TEXT;
  v_existing_expires TIMESTAMPTZ;
  v_token TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT role INTO v_role
  FROM public.workspace_memberships
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('workspace_owner', 'workspace_admin') THEN
    RAISE EXCEPTION 'Only hub owners and admins can generate invite links';
  END IF;

  SELECT v.invite_token, v.invite_expires_at
    INTO v_existing_token, v_existing_expires
  FROM public.workspaces v
  WHERE v.id = p_workspace_id;

  IF NOT p_force
     AND v_existing_token IS NOT NULL
     AND v_existing_expires IS NOT NULL
     AND v_existing_expires > NOW() THEN
    RETURN QUERY SELECT v_existing_token, v_existing_expires;
    RETURN;
  END IF;

  v_token := replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_expires := NOW() + INTERVAL '7 days';

  UPDATE public.workspaces
  SET invite_token = v_token,
      invite_expires_at = v_expires,
      updated_at = NOW()
  WHERE id = p_workspace_id;

  RETURN QUERY SELECT v_token, v_expires;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation workspace_invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  -- Verify the calling user matches the p_user_id parameter
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'User ID mismatch');
  END IF;

  -- Look up the invitation
  SELECT * INTO v_invitation
  FROM workspace_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation not found, already used, or expired');
  END IF;

  -- Verify the invited email matches the authenticated user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_user_email IS DISTINCT FROM v_invitation.email THEN
    RETURN jsonb_build_object('error', 'This invitation was sent to a different email address');
  END IF;

  -- Create vault membership (on conflict: update role to invited role)
  INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
  VALUES (v_invitation.workspace_id, p_user_id, v_invitation.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation as accepted
  UPDATE workspace_invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_invitation.workspace_id,
    'role', v_invitation.role
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_routing_rule_priorities(p_organization_id uuid, p_rule_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rule_id UUID;
  v_priority INTEGER := 1;
BEGIN
  -- Verify caller is a member of this bank
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized: caller is not a member of bank %', p_organization_id;
  END IF;

  -- Update each rule's priority to its 1-based array position
  FOREACH v_rule_id IN ARRAY p_rule_ids LOOP
    UPDATE import_routing_rules
    SET priority = v_priority,
        updated_at = now()
    WHERE id = v_rule_id
      AND organization_id = p_organization_id;

    v_priority := v_priority + 1;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_workspace_entries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_recording_organization_id(p_recording_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM recordings WHERE id = p_recording_id
$function$;

CREATE OR REPLACE FUNCTION public.migrate_fathom_call_to_recording(p_recording_id bigint, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id UUID;
  v_workspace_id UUID;
  v_new_recording_id UUID;
  v_call RECORD;
BEGIN
  -- Get user's personal bank
  SELECT b.id INTO v_organization_id
  FROM organizations b
  JOIN organization_memberships bm ON bm.organization_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    -- User doesn't have a personal bank yet - create one
    -- This handles legacy users who signed up before the Bank/Vault architecture
    INSERT INTO organizations (name, type)
    VALUES ('Personal', 'personal')
    RETURNING id INTO v_organization_id;

    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (v_organization_id, p_user_id, 'organization_owner');
  END IF;

  -- Get user's personal vault
  SELECT v.id INTO v_workspace_id
  FROM workspaces v
  JOIN workspace_memberships vm ON vm.workspace_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.organization_id = v_organization_id
    AND v.workspace_type = 'personal'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    -- User doesn't have a personal vault yet - create one
    INSERT INTO workspaces (organization_id, name, workspace_type)
    VALUES (v_organization_id, 'My Calls', 'personal')
    RETURNING id INTO v_workspace_id;

    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'workspace_owner');
  END IF;

  -- Check if already migrated (idempotency)
  SELECT id INTO v_new_recording_id
  FROM recordings
  WHERE legacy_recording_id = p_recording_id AND organization_id = v_organization_id;

  IF v_new_recording_id IS NOT NULL THEN
    -- Already migrated, return existing ID
    RETURN v_new_recording_id;
  END IF;

  -- Get the fathom_call data
  SELECT * INTO v_call
  FROM fathom_calls
  WHERE recording_id = p_recording_id AND user_id = p_user_id;

  IF v_call IS NULL THEN
    RAISE EXCEPTION 'Call not found: recording_id=%, user_id=%', p_recording_id, p_user_id;
  END IF;

  -- Create recording
  -- FIX 1: COALESCE title so NULL/empty titles become 'Untitled Call' (NOT NULL constraint)
  -- FIX 2: COALESCE duration from time difference, fallback to 0
  -- FIX 3: 'external_id' added to source_metadata for Phase 17 dedup pipeline
  INSERT INTO recordings (
    legacy_recording_id,
    organization_id,
    owner_user_id,
    title,
    audio_url,
    video_url,
    full_transcript,
    summary,
    global_tags,
    source_app,
    source_metadata,
    duration,
    recording_start_time,
    recording_end_time,
    created_at,
    synced_at
  ) VALUES (
    v_call.recording_id,
    v_organization_id,
    p_user_id,
    -- FIX 1: Prevent NOT NULL violation — empty/NULL title becomes 'Untitled Call'
    COALESCE(NULLIF(TRIM(v_call.title), ''), 'Untitled Call'),
    v_call.url,       -- Use url as audio_url fallback
    v_call.share_url, -- Use share_url as video_url fallback
    v_call.full_transcript,
    v_call.summary,
    COALESCE(v_call.auto_tags, '{}'),
    COALESCE(v_call.source_platform, 'fathom'),
    -- FIX 3: Add external_id as first key — used by Phase 17 connector pipeline for dedup
    jsonb_build_object(
      'external_id', v_call.recording_id::TEXT,
      'recorded_by_name', v_call.recorded_by_name,
      'recorded_by_email', v_call.recorded_by_email,
      'calendar_invitees', v_call.calendar_invitees,
      'meeting_fingerprint', v_call.meeting_fingerprint,
      'google_calendar_event_id', v_call.google_calendar_event_id,
      'google_drive_file_id', v_call.google_drive_file_id,
      'sentiment_cache', v_call.sentiment_cache,
      'original_metadata', v_call.metadata
    ),
    -- FIX 2: Compute duration from timestamps; default to 0 if either is NULL
    COALESCE(
      EXTRACT(EPOCH FROM (v_call.recording_end_time - v_call.recording_start_time))::INTEGER,
      0
    ),
    v_call.recording_start_time,
    v_call.recording_end_time,
    v_call.created_at,
    v_call.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  -- Create vault entry in personal vault
  INSERT INTO workspace_entries (
    workspace_id,
    recording_id,
    local_tags,
    created_at
  ) VALUES (
    v_workspace_id,
    v_new_recording_id,
    '{}', -- Start with empty local tags
    v_call.created_at
  );

  RETURN v_new_recording_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id UUID;
  v_workspace_id UUID;
BEGIN
  -- Insert profile for new user
  INSERT INTO public.user_profiles (user_id, email, display_name, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    false
  );

  -- Assign default FREE role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create personal bank for new user
  INSERT INTO organizations (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_organization_id;

  -- Create bank membership as owner
  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, NEW.id, 'organization_owner');

  -- Create default personal vault with is_default = TRUE
  INSERT INTO workspaces (organization_id, name, workspace_type, is_default)
  VALUES (v_organization_id, 'My Calls', 'personal', TRUE)
  RETURNING id INTO v_workspace_id;

  -- Create vault membership as owner
  INSERT INTO workspace_memberships (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'workspace_owner');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_personal_organization(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id UUID;
  v_workspace_id UUID;
BEGIN
  -- Check if user already has a personal bank
  SELECT b.id INTO v_organization_id
  FROM organizations b
  JOIN organization_memberships bm ON bm.organization_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;

  -- If personal bank exists, return it (idempotent)
  IF v_organization_id IS NOT NULL THEN
    RETURN v_organization_id;
  END IF;

  -- Create personal bank
  INSERT INTO organizations (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_organization_id;

  -- Create bank membership as owner
  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (v_organization_id, p_user_id, 'organization_owner');

  -- Check if user already has a personal vault in this bank (shouldn't happen, but defensive)
  SELECT v.id INTO v_workspace_id
  FROM workspaces v
  JOIN workspace_memberships vm ON vm.workspace_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.organization_id = v_organization_id
    AND v.workspace_type = 'personal'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    -- Create personal vault
    INSERT INTO workspaces (organization_id, name, workspace_type)
    VALUES (v_organization_id, 'My Calls', 'personal')
    RETURNING id INTO v_workspace_id;

    -- Create vault membership as owner
    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'workspace_owner');
  END IF;

  RETURN v_organization_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hybrid_search_transcripts_scoped(query_text text, query_embedding vector, match_count integer, full_text_weight double precision DEFAULT 1.0, semantic_weight double precision DEFAULT 1.0, rrf_k integer DEFAULT 60, filter_user_id uuid DEFAULT NULL::uuid, filter_organization_id uuid DEFAULT NULL::uuid, filter_workspace_id uuid DEFAULT NULL::uuid, filter_date_start timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_date_end timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_speakers text[] DEFAULT NULL::text[], filter_categories text[] DEFAULT NULL::text[], filter_recording_ids bigint[] DEFAULT NULL::bigint[], filter_topics text[] DEFAULT NULL::text[], filter_sentiment text DEFAULT NULL::text, filter_intent_signals text[] DEFAULT NULL::text[], filter_user_tags text[] DEFAULT NULL::text[])
 RETURNS TABLE(chunk_id uuid, recording_id bigint, chunk_text text, chunk_index integer, speaker_name text, speaker_email text, call_date timestamp with time zone, call_title text, call_category text, topics text[], sentiment text, intent_signals text[], user_tags text[], entities jsonb, source_platform text, similarity_score double precision, fts_rank double precision, rrf_score double precision, workspace_id uuid, workspace_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  accessible_workspace_ids UUID[];
  scoped_recording_ids BIGINT[];
BEGIN
  -- Determine which workspaces the user can access
  IF filter_workspace_id IS NOT NULL THEN
    -- Specific vault requested - verify user has membership
    IF NOT EXISTS (
      SELECT 1 FROM workspace_memberships 
      WHERE user_id = filter_user_id 
      AND workspace_memberships.workspace_id = filter_workspace_id
    ) THEN
      -- User doesn't have access to this vault - return empty
      RETURN;
    END IF;
    accessible_workspace_ids := ARRAY[filter_workspace_id];
  ELSIF filter_organization_id IS NOT NULL THEN
    -- Bank-level search - get all workspaces user has membership in within this bank
    SELECT ARRAY_AGG(vm.workspace_id) INTO accessible_workspace_ids
    FROM workspace_memberships vm
    JOIN workspaces v ON v.id = vm.workspace_id
    WHERE vm.user_id = filter_user_id
    AND v.organization_id = filter_organization_id;
    
    -- If user has no vault memberships in this bank, return empty
    IF accessible_workspace_ids IS NULL OR array_length(accessible_workspace_ids, 1) IS NULL THEN
      RETURN;
    END IF;
  ELSE
    -- No bank/vault specified - fall back to unscoped search (pre-migration compatibility)
    -- Call hybrid_search_transcripts directly and return with NULL vault info
    RETURN QUERY
    SELECT 
      hs.chunk_id,
      hs.recording_id,
      hs.chunk_text,
      hs.chunk_index,
      hs.speaker_name,
      hs.speaker_email,
      hs.call_date,
      hs.call_title,
      hs.call_category,
      hs.topics,
      hs.sentiment,
      hs.intent_signals,
      hs.user_tags,
      hs.entities,
      hs.source_platform,
      hs.similarity_score,
      hs.fts_rank,
      hs.rrf_score,
      NULL::UUID AS workspace_id,
      NULL::TEXT AS workspace_name
    FROM hybrid_search_transcripts(
      query_text,
      query_embedding,
      match_count,
      full_text_weight::DOUBLE PRECISION,
      semantic_weight::DOUBLE PRECISION,
      rrf_k,
      filter_user_id,
      filter_date_start,
      filter_date_end,
      filter_speakers,
      filter_categories,
      filter_recording_ids,
      filter_topics,
      filter_sentiment,
      filter_intent_signals,
      filter_user_tags
    ) hs;
    RETURN;
  END IF;

  -- Get recording_ids that are in accessible workspaces via workspace_entries
  -- Bridge through legacy_recording_id since transcripts haven't been migrated yet
  SELECT ARRAY_AGG(DISTINCT r.legacy_recording_id)
  INTO scoped_recording_ids
  FROM workspace_entries ve
  JOIN recordings r ON r.id = ve.recording_id
  WHERE ve.workspace_id = ANY(accessible_workspace_ids)
  AND r.legacy_recording_id IS NOT NULL;

  -- If no recordings in accessible workspaces, return empty
  IF scoped_recording_ids IS NULL OR array_length(scoped_recording_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Intersect with user-provided recording_ids filter if present
  IF filter_recording_ids IS NOT NULL AND array_length(filter_recording_ids, 1) IS NOT NULL THEN
    SELECT ARRAY_AGG(rid)
    INTO scoped_recording_ids
    FROM unnest(scoped_recording_ids) AS rid
    WHERE rid = ANY(filter_recording_ids);
    
    IF scoped_recording_ids IS NULL OR array_length(scoped_recording_ids, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  -- Call the existing hybrid_search_transcripts with scoped recording_ids
  RETURN QUERY
  SELECT 
    hs.chunk_id,
    hs.recording_id,
    hs.chunk_text,
    hs.chunk_index,
    hs.speaker_name,
    hs.speaker_email,
    hs.call_date,
    hs.call_title,
    hs.call_category,
    hs.topics,
    hs.sentiment,
    hs.intent_signals,
    hs.user_tags,
    hs.entities,
    hs.source_platform,
    hs.similarity_score,
    hs.fts_rank,
    hs.rrf_score,
    -- Lookup vault info for result attribution
    -- Use first matching vault entry (recording may be in multiple accessible workspaces)
    (SELECT ve2.workspace_id 
     FROM workspace_entries ve2 
     JOIN recordings r2 ON r2.id = ve2.recording_id
     WHERE r2.legacy_recording_id = hs.recording_id
     AND ve2.workspace_id = ANY(accessible_workspace_ids)
     LIMIT 1
    ) AS workspace_id,
    (SELECT v2.name 
     FROM workspace_entries ve2 
     JOIN recordings r2 ON r2.id = ve2.recording_id
     JOIN workspaces v2 ON v2.id = ve2.workspace_id
     WHERE r2.legacy_recording_id = hs.recording_id
     AND ve2.workspace_id = ANY(accessible_workspace_ids)
     LIMIT 1
    ) AS workspace_name
  FROM hybrid_search_transcripts(
    query_text,
    query_embedding,
    match_count,
    full_text_weight::DOUBLE PRECISION,
    semantic_weight::DOUBLE PRECISION,
    rrf_k,
    filter_user_id,
    filter_date_start,
    filter_date_end,
    filter_speakers,
    filter_categories,
    scoped_recording_ids,  -- Use vault-scoped recording IDs
    filter_topics,
    filter_sentiment,
    filter_intent_signals,
    filter_user_tags
  ) hs;
  
END;
$function$;

CREATE OR REPLACE FUNCTION public.hybrid_search_transcripts(query_text text, query_embedding vector, match_count integer DEFAULT 10, full_text_weight double precision DEFAULT 1.0, semantic_weight double precision DEFAULT 1.0, rrf_k integer DEFAULT 60, filter_user_id uuid DEFAULT NULL::uuid, filter_date_start timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_date_end timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_speakers text[] DEFAULT NULL::text[], filter_categories text[] DEFAULT NULL::text[], filter_recording_ids bigint[] DEFAULT NULL::bigint[], filter_topics text[] DEFAULT NULL::text[], filter_sentiment text DEFAULT NULL::text, filter_intent_signals text[] DEFAULT NULL::text[], filter_user_tags text[] DEFAULT NULL::text[], filter_source_platforms text[] DEFAULT NULL::text[], filter_organization_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(chunk_id uuid, recording_id bigint, chunk_text text, chunk_index integer, speaker_name text, speaker_email text, call_date timestamp with time zone, call_title text, call_category text, topics text[], sentiment text, intent_signals text[], user_tags text[], entities jsonb, source_platform text, similarity_score double precision, fts_rank double precision, rrf_score double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT 
            tc.id,
            tc.recording_id,
            (1 - (tc.embedding <=> query_embedding))::double precision AS similarity
        FROM transcript_chunks tc
        LEFT JOIN recordings r ON r.legacy_recording_id = tc.recording_id
        WHERE 
            (filter_user_id IS NULL OR tc.user_id = filter_user_id)
            AND (filter_date_start IS NULL OR tc.call_date >= filter_date_start)
            AND (filter_date_end IS NULL OR tc.call_date <= filter_date_end)
            AND (filter_speakers IS NULL OR tc.speaker_name = ANY(filter_speakers))
            AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
            AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
            AND (filter_topics IS NULL OR tc.topics && filter_topics)
            AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
            AND (filter_intent_signals IS NULL OR tc.intent_signals && filter_intent_signals)
            AND (filter_user_tags IS NULL OR tc.user_tags && filter_user_tags)
            AND (filter_source_platforms IS NULL OR tc.source_platform = ANY(filter_source_platforms))
            AND (filter_organization_id IS NULL OR r.organization_id = filter_organization_id)
        ORDER BY tc.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    full_text_search AS (
        SELECT 
            tc.id,
            tc.recording_id,
            ts_rank_cd(tc.fts, plainto_tsquery('english', query_text))::double precision AS rank
        FROM transcript_chunks tc
        LEFT JOIN recordings r ON r.legacy_recording_id = tc.recording_id
        WHERE 
            tc.fts @@ plainto_tsquery('english', query_text)
            AND (filter_user_id IS NULL OR tc.user_id = filter_user_id)
            AND (filter_date_start IS NULL OR tc.call_date >= filter_date_start)
            AND (filter_date_end IS NULL OR tc.call_date <= filter_date_end)
            AND (filter_speakers IS NULL OR tc.speaker_name = ANY(filter_speakers))
            AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
            AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
            AND (filter_topics IS NULL OR tc.topics && filter_topics)
            AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
            AND (filter_intent_signals IS NULL OR tc.intent_signals && filter_intent_signals)
            AND (filter_user_tags IS NULL OR tc.user_tags && filter_user_tags)
            AND (filter_source_platforms IS NULL OR tc.source_platform = ANY(filter_source_platforms))
            AND (filter_organization_id IS NULL OR r.organization_id = filter_organization_id)
        ORDER BY rank DESC
        LIMIT match_count * 2
    ),
    combined AS (
        SELECT
            COALESCE(ss.id, fts.id) AS id,
            COALESCE(ss.recording_id, fts.recording_id) AS recording_id,
            COALESCE(ss.similarity, 0::double precision) AS similarity,
            COALESCE(fts.rank, 0::double precision) AS fts_rank,
            (
                COALESCE(1.0 / (rrf_k + ROW_NUMBER() OVER (ORDER BY ss.similarity DESC NULLS LAST)), 0) * semantic_weight +
                COALESCE(1.0 / (rrf_k + ROW_NUMBER() OVER (ORDER BY fts.rank DESC NULLS LAST)), 0) * full_text_weight
            )::double precision AS rrf_score
        FROM semantic_search ss
        FULL OUTER JOIN full_text_search fts ON ss.id = fts.id
    )
    SELECT 
        tc.id AS chunk_id,
        tc.recording_id,
        tc.chunk_text,
        tc.chunk_index,
        tc.speaker_name,
        tc.speaker_email,
        tc.call_date,
        tc.call_title,
        tc.call_category,
        tc.topics,
        tc.sentiment,
        tc.intent_signals,
        tc.user_tags,
        tc.entities,
        tc.source_platform,
        c.similarity AS similarity_score,
        c.fts_rank,
        c.rrf_score
    FROM combined c
    JOIN transcript_chunks tc ON c.id = tc.id
    ORDER BY c.rrf_score DESC
    LIMIT match_count;
END;
$function$;



-- 5. RE-ATTACH TRIGGERS THAT DROPPED DUE TO CASCADE
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_workspaces_updated_at();
CREATE TRIGGER workspace_entries_updated_at BEFORE UPDATE ON workspace_entries FOR EACH ROW EXECUTE FUNCTION update_workspace_entries_updated_at();

COMMIT;
