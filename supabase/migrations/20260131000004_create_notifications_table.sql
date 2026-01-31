-- Migration: Create notifications table and infrastructure for health alerts
-- Purpose: DIFF-03 enables in-app notifications for client health alerts
-- Author: Claude Code
-- Date: 2026-01-31

-- ============================================================================
-- TABLE: user_notifications
-- ============================================================================
-- In-app notifications for users including health alerts
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'health_alert', 'system', 'info'
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB,  -- { contact_id, days_since_seen, contact_name, contact_email, etc. }
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_notifications_unread ON user_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON user_notifications(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
CREATE POLICY "Users can view their notifications"
  ON user_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications"
  ON user_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert notifications"
  ON user_notifications FOR INSERT WITH CHECK (true);  -- Service role only
CREATE POLICY "Users can delete their notifications"
  ON user_notifications FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE user_notifications IS 'In-app notifications including health alerts';
COMMENT ON COLUMN user_notifications.type IS 'Notification type: health_alert, system, info';
COMMENT ON COLUMN user_notifications.metadata IS 'JSON metadata specific to notification type';
COMMENT ON COLUMN user_notifications.read_at IS 'Timestamp when notification was read, NULL if unread';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
