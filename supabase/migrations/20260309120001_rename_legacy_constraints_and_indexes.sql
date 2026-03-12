-- Migration: Rename all legacy DB constraints and indexes (bank→organization, vault→workspace)
-- Purpose: Tables were renamed (banks→organizations, vaults→workspaces, etc.) but constraints
--          and indexes still reference old names. This causes PostgREST FK resolution issues
--          and developer confusion. All renames are zero-downtime online operations.
-- Issue: #118
-- Date: 2026-03-09
--
-- NOTE: After this migration runs, PostgREST needs a schema cache reload to pick up the
--       renamed FK constraints for embedded select resolution. Run:
--         SELECT pg_notify('pgrst', 'reload schema');
--       or restart the PostgREST service.

-- ============================================================================
-- HELPER: Idempotent constraint and index renames
-- ============================================================================
-- Each rename is wrapped in a conditional block so re-running this migration
-- is safe. IF EXISTS checks prevent errors if already renamed.

DO $$
BEGIN

  -- ==========================================================================
  -- CONSTRAINTS: organizations table (was "banks")
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banks_pkey' AND conrelid = 'public.organizations'::regclass) THEN
    ALTER TABLE public.organizations RENAME CONSTRAINT banks_pkey TO organizations_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banks_type_check' AND conrelid = 'public.organizations'::regclass) THEN
    ALTER TABLE public.organizations RENAME CONSTRAINT banks_type_check TO organizations_type_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banks_cross_bank_default_check' AND conrelid = 'public.organizations'::regclass) THEN
    ALTER TABLE public.organizations RENAME CONSTRAINT banks_cross_bank_default_check TO organizations_cross_org_default_check;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: organization_memberships table (was "bank_memberships")
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_memberships_pkey' AND conrelid = 'public.organization_memberships'::regclass) THEN
    ALTER TABLE public.organization_memberships RENAME CONSTRAINT bank_memberships_pkey TO organization_memberships_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_memberships_bank_id_fkey' AND conrelid = 'public.organization_memberships'::regclass) THEN
    ALTER TABLE public.organization_memberships RENAME CONSTRAINT bank_memberships_bank_id_fkey TO organization_memberships_organization_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_memberships_user_id_fkey' AND conrelid = 'public.organization_memberships'::regclass) THEN
    ALTER TABLE public.organization_memberships RENAME CONSTRAINT bank_memberships_user_id_fkey TO organization_memberships_user_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_memberships_bank_id_user_id_key' AND conrelid = 'public.organization_memberships'::regclass) THEN
    ALTER TABLE public.organization_memberships RENAME CONSTRAINT bank_memberships_bank_id_user_id_key TO organization_memberships_organization_id_user_id_key;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: workspaces table (was "vaults")
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vaults_pkey' AND conrelid = 'public.workspaces'::regclass) THEN
    ALTER TABLE public.workspaces RENAME CONSTRAINT vaults_pkey TO workspaces_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vaults_bank_id_fkey' AND conrelid = 'public.workspaces'::regclass) THEN
    ALTER TABLE public.workspaces RENAME CONSTRAINT vaults_bank_id_fkey TO workspaces_organization_id_fkey;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: workspace_memberships table (was "vault_memberships")
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_memberships_pkey' AND conrelid = 'public.workspace_memberships'::regclass) THEN
    ALTER TABLE public.workspace_memberships RENAME CONSTRAINT vault_memberships_pkey TO workspace_memberships_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_memberships_vault_id_fkey' AND conrelid = 'public.workspace_memberships'::regclass) THEN
    ALTER TABLE public.workspace_memberships RENAME CONSTRAINT vault_memberships_vault_id_fkey TO workspace_memberships_workspace_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_memberships_user_id_fkey' AND conrelid = 'public.workspace_memberships'::regclass) THEN
    ALTER TABLE public.workspace_memberships RENAME CONSTRAINT vault_memberships_user_id_fkey TO workspace_memberships_user_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_memberships_vault_id_user_id_key' AND conrelid = 'public.workspace_memberships'::regclass) THEN
    ALTER TABLE public.workspace_memberships RENAME CONSTRAINT vault_memberships_vault_id_user_id_key TO workspace_memberships_workspace_id_user_id_key;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: workspace_entries table (was "vault_entries")
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_entries_pkey' AND conrelid = 'public.workspace_entries'::regclass) THEN
    ALTER TABLE public.workspace_entries RENAME CONSTRAINT vault_entries_pkey TO workspace_entries_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_entries_vault_id_fkey' AND conrelid = 'public.workspace_entries'::regclass) THEN
    ALTER TABLE public.workspace_entries RENAME CONSTRAINT vault_entries_vault_id_fkey TO workspace_entries_workspace_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_entries_recording_id_fkey' AND conrelid = 'public.workspace_entries'::regclass) THEN
    ALTER TABLE public.workspace_entries RENAME CONSTRAINT vault_entries_recording_id_fkey TO workspace_entries_recording_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_entries_folder_id_fkey' AND conrelid = 'public.workspace_entries'::regclass) THEN
    ALTER TABLE public.workspace_entries RENAME CONSTRAINT vault_entries_folder_id_fkey TO workspace_entries_folder_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vault_entries_vault_id_recording_id_key' AND conrelid = 'public.workspace_entries'::regclass) THEN
    ALTER TABLE public.workspace_entries RENAME CONSTRAINT vault_entries_vault_id_recording_id_key TO workspace_entries_workspace_id_recording_id_key;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: recordings table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recordings_bank_id_fkey' AND conrelid = 'public.recordings'::regclass) THEN
    ALTER TABLE public.recordings RENAME CONSTRAINT recordings_bank_id_fkey TO recordings_organization_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recordings_bank_id_legacy_recording_id_key' AND conrelid = 'public.recordings'::regclass) THEN
    ALTER TABLE public.recordings RENAME CONSTRAINT recordings_bank_id_legacy_recording_id_key TO recordings_organization_id_legacy_recording_id_key;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: folders table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folders_bank_id_fkey' AND conrelid = 'public.folders'::regclass) THEN
    ALTER TABLE public.folders RENAME CONSTRAINT folders_bank_id_fkey TO folders_organization_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folders_vault_id_fkey' AND conrelid = 'public.folders'::regclass) THEN
    ALTER TABLE public.folders RENAME CONSTRAINT folders_vault_id_fkey TO folders_workspace_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folders_user_id_bank_id_name_parent_id_key' AND conrelid = 'public.folders'::regclass) THEN
    ALTER TABLE public.folders RENAME CONSTRAINT folders_user_id_bank_id_name_parent_id_key TO folders_user_id_organization_id_name_parent_id_key;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: call_tags table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_tags_bank_id_fkey' AND conrelid = 'public.call_tags'::regclass) THEN
    ALTER TABLE public.call_tags RENAME CONSTRAINT call_tags_bank_id_fkey TO call_tags_organization_id_fkey;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: chat_sessions table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_bank_id_fkey' AND conrelid = 'public.chat_sessions'::regclass) THEN
    ALTER TABLE public.chat_sessions RENAME CONSTRAINT chat_sessions_bank_id_fkey TO chat_sessions_organization_id_fkey;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: content_items table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_items_bank_id_fkey' AND conrelid = 'public.content_items'::regclass) THEN
    ALTER TABLE public.content_items RENAME CONSTRAINT content_items_bank_id_fkey TO content_items_organization_id_fkey;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: content_library table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_library_bank_id_fkey' AND conrelid = 'public.content_library'::regclass) THEN
    ALTER TABLE public.content_library RENAME CONSTRAINT content_library_bank_id_fkey TO content_library_organization_id_fkey;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: templates table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_bank_id_fkey' AND conrelid = 'public.templates'::regclass) THEN
    ALTER TABLE public.templates RENAME CONSTRAINT templates_bank_id_fkey TO templates_organization_id_fkey;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: import_routing_rules table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_routing_rules_bank_id_fkey' AND conrelid = 'public.import_routing_rules'::regclass) THEN
    ALTER TABLE public.import_routing_rules RENAME CONSTRAINT import_routing_rules_bank_id_fkey TO import_routing_rules_organization_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_routing_rules_target_vault_id_fkey' AND conrelid = 'public.import_routing_rules'::regclass) THEN
    ALTER TABLE public.import_routing_rules RENAME CONSTRAINT import_routing_rules_target_vault_id_fkey TO import_routing_rules_target_workspace_id_fkey;
  END IF;

  -- ==========================================================================
  -- CONSTRAINTS: import_routing_defaults table
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_routing_defaults_bank_id_fkey' AND conrelid = 'public.import_routing_defaults'::regclass) THEN
    ALTER TABLE public.import_routing_defaults RENAME CONSTRAINT import_routing_defaults_bank_id_fkey TO import_routing_defaults_organization_id_fkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_routing_defaults_target_vault_id_fkey' AND conrelid = 'public.import_routing_defaults'::regclass) THEN
    ALTER TABLE public.import_routing_defaults RENAME CONSTRAINT import_routing_defaults_target_vault_id_fkey TO import_routing_defaults_target_workspace_id_fkey;
  END IF;

END;
$$;

-- ============================================================================
-- INDEXES: Rename all legacy bank_/vault_/banks_/vaults_ prefixed indexes
-- ============================================================================
-- Note: PK and UNIQUE constraints create backing indexes with the same name.
-- PostgreSQL does NOT auto-rename the index when renaming the constraint,
-- so we rename both explicitly. IF NOT EXISTS guards ensure idempotency.

DO $$
BEGIN

  -- ==========================================================================
  -- Backing indexes for renamed PK/UNIQUE constraints
  -- ==========================================================================

  -- organizations (was banks)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'banks_pkey') THEN
    ALTER INDEX public.banks_pkey RENAME TO organizations_pkey;
  END IF;

  -- organization_memberships (was bank_memberships)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'bank_memberships_pkey') THEN
    ALTER INDEX public.bank_memberships_pkey RENAME TO organization_memberships_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'bank_memberships_bank_id_user_id_key') THEN
    ALTER INDEX public.bank_memberships_bank_id_user_id_key RENAME TO organization_memberships_organization_id_user_id_key;
  END IF;

  -- workspaces (was vaults)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'vaults_pkey') THEN
    ALTER INDEX public.vaults_pkey RENAME TO workspaces_pkey;
  END IF;

  -- workspace_memberships (was vault_memberships)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'vault_memberships_pkey') THEN
    ALTER INDEX public.vault_memberships_pkey RENAME TO workspace_memberships_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'vault_memberships_vault_id_user_id_key') THEN
    ALTER INDEX public.vault_memberships_vault_id_user_id_key RENAME TO workspace_memberships_workspace_id_user_id_key;
  END IF;

  -- workspace_entries (was vault_entries)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'vault_entries_pkey') THEN
    ALTER INDEX public.vault_entries_pkey RENAME TO workspace_entries_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'vault_entries_vault_id_recording_id_key') THEN
    ALTER INDEX public.vault_entries_vault_id_recording_id_key RENAME TO workspace_entries_workspace_id_recording_id_key;
  END IF;

  -- folders unique constraint backing index
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'folders_user_id_bank_id_name_parent_id_key') THEN
    ALTER INDEX public.folders_user_id_bank_id_name_parent_id_key RENAME TO folders_user_id_organization_id_name_parent_id_key;
  END IF;

  -- recordings unique constraint backing index
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'recordings_bank_id_legacy_recording_id_key') THEN
    ALTER INDEX public.recordings_bank_id_legacy_recording_id_key RENAME TO recordings_organization_id_legacy_recording_id_key;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: organizations (was banks)
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_banks_type') THEN
    ALTER INDEX public.idx_banks_type RENAME TO idx_organizations_type;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: organization_memberships (was bank_memberships)
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_bank_memberships_bank_id') THEN
    ALTER INDEX public.idx_bank_memberships_bank_id RENAME TO idx_organization_memberships_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_bank_memberships_user_id') THEN
    ALTER INDEX public.idx_bank_memberships_user_id RENAME TO idx_organization_memberships_user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_bank_memberships_role') THEN
    ALTER INDEX public.idx_bank_memberships_role RENAME TO idx_organization_memberships_role;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: workspaces (was vaults)
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vaults_bank_id') THEN
    ALTER INDEX public.idx_vaults_bank_id RENAME TO idx_workspaces_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vaults_vault_type') THEN
    ALTER INDEX public.idx_vaults_vault_type RENAME TO idx_workspaces_workspace_type;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vaults_invite_token') THEN
    ALTER INDEX public.idx_vaults_invite_token RENAME TO idx_workspaces_invite_token;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vaults_is_default') THEN
    ALTER INDEX public.idx_vaults_is_default RENAME TO idx_workspaces_is_default;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: workspace_memberships (was vault_memberships)
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_memberships_vault_id') THEN
    ALTER INDEX public.idx_vault_memberships_vault_id RENAME TO idx_workspace_memberships_workspace_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_memberships_user_id') THEN
    ALTER INDEX public.idx_vault_memberships_user_id RENAME TO idx_workspace_memberships_user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_memberships_role') THEN
    ALTER INDEX public.idx_vault_memberships_role RENAME TO idx_workspace_memberships_role;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: workspace_entries (was vault_entries)
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_entries_vault_id') THEN
    ALTER INDEX public.idx_vault_entries_vault_id RENAME TO idx_workspace_entries_workspace_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_entries_recording_id') THEN
    ALTER INDEX public.idx_vault_entries_recording_id RENAME TO idx_workspace_entries_recording_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_entries_folder_id') THEN
    ALTER INDEX public.idx_vault_entries_folder_id RENAME TO idx_workspace_entries_folder_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_entries_local_tags') THEN
    ALTER INDEX public.idx_vault_entries_local_tags RENAME TO idx_workspace_entries_local_tags;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_vault_entries_created_at') THEN
    ALTER INDEX public.idx_vault_entries_created_at RENAME TO idx_workspace_entries_created_at;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: recordings
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_recordings_bank_id') THEN
    ALTER INDEX public.idx_recordings_bank_id RENAME TO idx_recordings_organization_id;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: folders
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_folders_vault_id') THEN
    ALTER INDEX public.idx_folders_vault_id RENAME TO idx_folders_workspace_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_folders_bank_id') THEN
    ALTER INDEX public.idx_folders_bank_id RENAME TO idx_folders_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_folders_user_bank') THEN
    ALTER INDEX public.idx_folders_user_bank RENAME TO idx_folders_user_organization;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: call_tags
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_call_tags_bank_id') THEN
    ALTER INDEX public.idx_call_tags_bank_id RENAME TO idx_call_tags_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_call_tags_user_bank') THEN
    ALTER INDEX public.idx_call_tags_user_bank RENAME TO idx_call_tags_user_organization;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: chat_sessions
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_chat_sessions_bank_id') THEN
    ALTER INDEX public.idx_chat_sessions_bank_id RENAME TO idx_chat_sessions_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_chat_sessions_user_bank') THEN
    ALTER INDEX public.idx_chat_sessions_user_bank RENAME TO idx_chat_sessions_user_organization;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: content_library
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_content_library_bank_id') THEN
    ALTER INDEX public.idx_content_library_bank_id RENAME TO idx_content_library_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_content_library_user_bank') THEN
    ALTER INDEX public.idx_content_library_user_bank RENAME TO idx_content_library_user_organization;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: content_items
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_content_items_bank_id') THEN
    ALTER INDEX public.idx_content_items_bank_id RENAME TO idx_content_items_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_content_items_user_bank') THEN
    ALTER INDEX public.idx_content_items_user_bank RENAME TO idx_content_items_user_organization;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: templates
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_templates_bank_id') THEN
    ALTER INDEX public.idx_templates_bank_id RENAME TO idx_templates_organization_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_templates_user_bank') THEN
    ALTER INDEX public.idx_templates_user_bank RENAME TO idx_templates_user_organization;
  END IF;

  -- ==========================================================================
  -- Standalone indexes: import_routing_rules
  -- ==========================================================================

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_routing_rules_bank_priority') THEN
    ALTER INDEX public.idx_routing_rules_bank_priority RENAME TO idx_routing_rules_organization_priority;
  END IF;

END;
$$;

-- ============================================================================
-- Trigger PostgREST schema cache reload
-- ============================================================================
-- FK constraint renames affect PostgREST's embedded select resolution.
-- Notify PostgREST to reload its schema cache immediately.
SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
