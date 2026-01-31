-- Migration: Create contacts database for tracking call attendees
-- Purpose: DIFF-04 enables users to maintain a contacts database populated from call attendees
-- Author: Claude Code
-- Date: 2026-01-31

-- ============================================================================
-- TABLE: contacts
-- ============================================================================
-- Stores contacts derived from call attendees with tracking preferences
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  
  -- Tracking config
  track_health BOOLEAN DEFAULT false,
  contact_type TEXT CHECK (contact_type IN ('client', 'customer', 'lead', 'other')),
  
  -- Health tracking
  last_seen_at TIMESTAMPTZ,
  last_call_recording_id BIGINT,
  health_alert_threshold_days INTEGER,  -- NULL = use global default
  last_alerted_at TIMESTAMPTZ,  -- For cooldown tracking
  
  -- Metadata
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, email)
);

-- ============================================================================
-- TABLE: contact_call_appearances
-- ============================================================================
-- Junction table linking contacts to calls they appeared in
CREATE TABLE contact_call_appearances (
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  recording_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appeared_at TIMESTAMPTZ,
  FOREIGN KEY (recording_id, user_id) REFERENCES fathom_calls(recording_id, user_id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, recording_id, user_id)
);

-- ============================================================================
-- TABLE: user_contact_settings
-- ============================================================================
-- User-level contact tracking preferences
CREATE TABLE user_contact_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  track_all_contacts BOOLEAN DEFAULT true,  -- Per CONTEXT.md: default ON
  default_health_threshold_days INTEGER DEFAULT 14,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(user_id, email);
CREATE INDEX idx_contacts_track_health ON contacts(user_id, track_health) WHERE track_health = true;
CREATE INDEX idx_contacts_last_seen ON contacts(user_id, last_seen_at DESC);
CREATE INDEX idx_contact_appearances_recording ON contact_call_appearances(recording_id, user_id);
CREATE INDEX idx_contact_appearances_contact ON contact_call_appearances(contact_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Automatically update the updated_at timestamp for contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Automatically update the updated_at timestamp for user_contact_settings
CREATE TRIGGER set_user_contact_settings_updated_at
  BEFORE UPDATE ON user_contact_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_call_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contact_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: contacts
-- ============================================================================
CREATE POLICY "Users can view their own contacts"
  ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own contacts"
  ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contacts"
  ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contacts"
  ON contacts FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: contact_call_appearances
-- ============================================================================
CREATE POLICY "Users can view their contact appearances"
  ON contact_call_appearances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their contact appearances"
  ON contact_call_appearances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their contact appearances"
  ON contact_call_appearances FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES: user_contact_settings
-- ============================================================================
CREATE POLICY "Users can manage their contact settings"
  ON user_contact_settings FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE contacts IS 'User contacts derived from call attendees';
COMMENT ON COLUMN contacts.track_health IS 'Whether to monitor this contact for health alerts';
COMMENT ON COLUMN contacts.contact_type IS 'Classification: client, customer, lead, or other';
COMMENT ON COLUMN contacts.last_alerted_at IS 'Last time health alert was sent for this contact';
COMMENT ON COLUMN contacts.health_alert_threshold_days IS 'Custom threshold for this contact, NULL uses global default';

COMMENT ON TABLE contact_call_appearances IS 'Junction table linking contacts to calls they appeared in';

COMMENT ON TABLE user_contact_settings IS 'User-level contact tracking preferences';
COMMENT ON COLUMN user_contact_settings.track_all_contacts IS 'When true, auto-import attendees from all calls. When false, manual import only.';
COMMENT ON COLUMN user_contact_settings.default_health_threshold_days IS 'Default days before health alert for contacts';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
