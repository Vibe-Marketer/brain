-- Recordings and VaultEntries Tables for Bank/Vault Architecture
-- Phase 09-04: Core data model - recordings contain call data, vault_entries provide multi-vault context
-- 
-- Recordings are the base call objects that live in exactly ONE bank.
-- VaultEntries enable the same recording to appear in multiple vaults with different local metadata.

-- =============================================================================
-- RECORDINGS TABLE
-- =============================================================================

-- Recordings: Base call objects containing audio/transcript
-- Lives in exactly ONE bank - cross-bank movement is always COPY
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_recording_id BIGINT, -- For migration from fathom_calls
  bank_id UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Call metadata (migrated from fathom_calls)
  title TEXT NOT NULL,
  audio_url TEXT,
  video_url TEXT,
  full_transcript TEXT,
  summary TEXT,
  
  -- Tags at recording level (source-level, global)
  global_tags TEXT[] DEFAULT '{}',
  
  -- Source tracking
  source_app TEXT, -- 'fathom', 'google_meet', 'zoom', 'youtube'
  source_metadata JSONB DEFAULT '{}',
  
  -- Timing
  duration INTEGER, -- seconds
  recording_start_time TIMESTAMPTZ,
  recording_end_time TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate migrations within same bank
  UNIQUE(bank_id, legacy_recording_id)
);

-- =============================================================================
-- INDEXES FOR RECORDINGS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_recordings_bank_id ON recordings(bank_id);
CREATE INDEX IF NOT EXISTS idx_recordings_owner_user_id ON recordings(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_legacy_recording_id ON recordings(legacy_recording_id);
CREATE INDEX IF NOT EXISTS idx_recordings_source_app ON recordings(source_app);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_global_tags ON recordings USING GIN(global_tags);

-- Full-text search on transcript (matches existing pattern from fathom_calls)
CREATE INDEX IF NOT EXISTS idx_recordings_transcript_fts 
  ON recordings USING GIN(to_tsvector('english', COALESCE(full_transcript, '')));

-- =============================================================================
-- UPDATED_AT TRIGGER FOR RECORDINGS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recordings_updated_at ON recordings;
CREATE TRIGGER recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_recordings_updated_at();

-- Enable RLS on recordings
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- VAULT_ENTRIES TABLE
-- =============================================================================

-- VaultEntry: Recording in Vault with local context
-- Same recording can appear in multiple vaults (within same bank) with different metadata
CREATE TABLE IF NOT EXISTS vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL, -- Uses existing folders table
  
  -- Local context (vault-specific)
  local_tags TEXT[] DEFAULT '{}',
  scores JSONB, -- AI scoring results
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Same recording can only appear once per vault
  UNIQUE(vault_id, recording_id)
);

-- =============================================================================
-- INDEXES FOR VAULT_ENTRIES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_vault_entries_vault_id ON vault_entries(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_entries_recording_id ON vault_entries(recording_id);
CREATE INDEX IF NOT EXISTS idx_vault_entries_folder_id ON vault_entries(folder_id);
CREATE INDEX IF NOT EXISTS idx_vault_entries_local_tags ON vault_entries USING GIN(local_tags);
CREATE INDEX IF NOT EXISTS idx_vault_entries_created_at ON vault_entries(created_at DESC);

-- =============================================================================
-- UPDATED_AT TRIGGER FOR VAULT_ENTRIES
-- =============================================================================

CREATE OR REPLACE FUNCTION update_vault_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vault_entries_updated_at ON vault_entries;
CREATE TRIGGER vault_entries_updated_at
  BEFORE UPDATE ON vault_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_vault_entries_updated_at();

-- Enable RLS on vault_entries
ALTER TABLE vault_entries ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- =============================================================================

-- SECURITY DEFINER helper to get recording's bank_id
CREATE OR REPLACE FUNCTION get_recording_bank_id(p_recording_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bank_id FROM recordings WHERE id = p_recording_id
$$;

-- =============================================================================
-- RLS POLICIES FOR RECORDINGS
-- =============================================================================

-- Users can view recordings in banks they belong to
CREATE POLICY "Users can view recordings in their banks"
  ON recordings FOR SELECT
  USING (is_bank_member(bank_id, auth.uid()));

-- Recording owner can update their recordings
CREATE POLICY "Recording owners can update their recordings"
  ON recordings FOR UPDATE
  USING (owner_user_id = auth.uid());

-- Bank members can create recordings (must be owner of the recording)
CREATE POLICY "Bank members can create recordings"
  ON recordings FOR INSERT
  WITH CHECK (is_bank_member(bank_id, auth.uid()) AND owner_user_id = auth.uid());

-- Recording owner can delete if no vault_entries exist
-- (Per spec: recordings with VaultEntries cannot be hard deleted)
CREATE POLICY "Recording owners can delete their recordings"
  ON recordings FOR DELETE
  USING (
    owner_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM vault_entries WHERE vault_entries.recording_id = recordings.id
    )
  );

-- =============================================================================
-- RLS POLICIES FOR VAULT_ENTRIES
-- =============================================================================

-- Users can view entries in vaults they belong to
CREATE POLICY "Users can view vault entries in their vaults"
  ON vault_entries FOR SELECT
  USING (is_vault_member(vault_id, auth.uid()));

-- Bank admins can see all entries in bank's vaults
CREATE POLICY "Bank admins can view all vault entries"
  ON vault_entries FOR SELECT
  USING (
    is_bank_admin_or_owner(get_vault_bank_id(vault_id), auth.uid())
  );

-- Vault members with any role can create entries (members can share their own recordings)
CREATE POLICY "Vault members can create entries"
  ON vault_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vault_memberships
      WHERE vault_memberships.vault_id = vault_entries.vault_id
        AND vault_memberships.user_id = auth.uid()
        AND vault_memberships.role IN ('vault_owner', 'vault_admin', 'manager', 'member')
    )
  );

-- Vault admins/owners can update any entries
CREATE POLICY "Vault admins can update entries"
  ON vault_entries FOR UPDATE
  USING (is_vault_admin_or_owner(vault_id, auth.uid()));

-- Members can update their own entries (entries for recordings they own)
CREATE POLICY "Members can update own entries"
  ON vault_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vault_memberships
      WHERE vault_memberships.vault_id = vault_entries.vault_id
        AND vault_memberships.user_id = auth.uid()
        AND vault_memberships.role IN ('member', 'manager')
    )
    AND EXISTS (
      SELECT 1 FROM recordings 
      WHERE recordings.id = vault_entries.recording_id
        AND recordings.owner_user_id = auth.uid()
    )
  );

-- Vault admins can delete entries
CREATE POLICY "Vault admins can delete entries"
  ON vault_entries FOR DELETE
  USING (is_vault_admin_or_owner(vault_id, auth.uid()));

-- Members can delete their own entries (entries for recordings they own)
CREATE POLICY "Members can delete own entries"
  ON vault_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM vault_memberships
      WHERE vault_memberships.vault_id = vault_entries.vault_id
        AND vault_memberships.user_id = auth.uid()
        AND vault_memberships.role IN ('member', 'manager')
    )
    AND EXISTS (
      SELECT 1 FROM recordings 
      WHERE recordings.id = vault_entries.recording_id
        AND recordings.owner_user_id = auth.uid()
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE recordings IS 'Base call objects containing audio/transcript. Lives in exactly ONE bank - cross-bank movement is always COPY.';
COMMENT ON COLUMN recordings.legacy_recording_id IS 'Original recording_id from fathom_calls for migration tracking';
COMMENT ON COLUMN recordings.global_tags IS 'Source-level tags that apply across all vault appearances';
COMMENT ON COLUMN recordings.source_app IS 'Source platform: fathom, google_meet, zoom, youtube';
COMMENT ON COLUMN recordings.source_metadata IS 'Platform-specific metadata preserved from source';

COMMENT ON TABLE vault_entries IS 'Recording appearance in a specific vault with local context (tags, scores, notes). Same recording can appear in multiple vaults.';
COMMENT ON COLUMN vault_entries.local_tags IS 'Vault-specific tags that only apply in this vault context';
COMMENT ON COLUMN vault_entries.scores IS 'AI scoring results for this vault entry (JSON)';
COMMENT ON COLUMN vault_entries.folder_id IS 'Optional folder assignment within the vault';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
