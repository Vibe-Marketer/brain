-- =============================================
-- CONVERSION BRAIN - CONSOLIDATED SCHEMA MIGRATION
-- =============================================
-- Created: 2025-11-23
-- Purpose: Single migration file for fresh Supabase setup
-- Contains: All core tables, functions, triggers, RLS policies
--
-- IMPORTANT: This is a consolidated version of 39 incremental migrations.
-- Use this for NEW projects. Existing databases should continue using incremental migrations.
-- =============================================

-- =============================================
-- PART 1: ENUM TYPES
-- =============================================

-- User roles enum
CREATE TYPE public.app_role AS ENUM ('FREE', 'PRO', 'TEAM', 'ADMIN');

-- =============================================
-- PART 2: CORE TABLES
-- =============================================

-- User profiles table
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  setup_wizard_completed BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.user_profiles IS 'User account profiles with onboarding and setup tracking';

-- User settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Fathom API credentials
  fathom_api_key TEXT,
  fathom_api_secret TEXT,
  
  -- OAuth tokens
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_token_expires BIGINT,
  oauth_state TEXT,
  
  -- OAuth test status
  oauth_last_tested_at TIMESTAMPTZ,
  oauth_test_status TEXT,
  
  -- Webhook configuration
  webhook_secret TEXT,
  webhook_last_tested_at TIMESTAMPTZ,
  webhook_test_status TEXT,
  
  -- Other settings
  host_email TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  bulk_import_enabled BOOLEAN DEFAULT false,
  setup_completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.user_settings IS 'Per-user Fathom integration settings and credentials';

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

COMMENT ON TABLE public.user_roles IS 'Stores user roles separately from profiles for security (prevents privilege escalation attacks)';
COMMENT ON COLUMN public.user_roles.role IS 'User role: FREE (default), PRO (premium features), TEAM (multi-user access), ADMIN (full access)';

-- Fathom calls table (meeting recordings)
CREATE TABLE public.fathom_calls (
  recording_id BIGINT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic metadata
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  recording_start_time TIMESTAMPTZ,
  recording_end_time TIMESTAMPTZ,
  url TEXT,
  share_url TEXT,
  
  -- Recorder info
  recorded_by_name TEXT,
  recorded_by_email TEXT,
  
  -- Calendar invitees
  calendar_invitees JSONB,
  
  -- Transcript and summary
  full_transcript TEXT,
  summary TEXT,
  
  -- Edit tracking
  title_edited_by_user BOOLEAN DEFAULT false,
  summary_edited_by_user BOOLEAN DEFAULT false,
  
  -- AI-generated content
  ai_generated_title TEXT,
  ai_title_generated_at TIMESTAMPTZ,
  auto_tags TEXT[] DEFAULT '{}',
  auto_tags_generated_at TIMESTAMPTZ,
  
  -- Sync tracking
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.fathom_calls IS 'Stores Fathom meeting recordings metadata';

-- Fathom transcripts table (transcript segments)
CREATE TABLE public.fathom_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id BIGINT NOT NULL REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE,
  
  -- Original data
  speaker_name TEXT,
  speaker_email TEXT,
  text TEXT NOT NULL,
  timestamp TEXT,
  
  -- User edits (non-destructive)
  edited_text TEXT,
  edited_speaker_name TEXT,
  edited_speaker_email TEXT,
  is_deleted BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  edited_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.fathom_transcripts IS 'Stores transcript segments for each Fathom meeting with non-destructive editing';

-- Processed webhooks table (idempotency)
CREATE TABLE public.processed_webhooks (
  webhook_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.processed_webhooks IS 'Tracks processed webhook IDs to prevent duplicate processing';

-- Webhook deliveries table (tracking)
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_id TEXT,
  status TEXT NOT NULL,
  payload JSONB,
  response_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.webhook_deliveries IS 'Tracks all webhook delivery attempts and their status';

-- Sync jobs table (background operations)
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.sync_jobs IS 'Tracks background sync operations and their status';

-- Call categories table
CREATE TABLE public.call_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, name)
);

COMMENT ON TABLE public.call_categories IS 'User-defined categories for organizing calls';

-- Call category assignments table (many-to-many)
CREATE TABLE public.call_category_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id BIGINT REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.call_categories(id) ON DELETE CASCADE NOT NULL,
  auto_assigned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (call_recording_id, category_id)
);

COMMENT ON TABLE public.call_category_assignments IS 'Many-to-many mapping between calls and categories';

-- Speakers table
CREATE TABLE public.speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, email)
);

COMMENT ON TABLE public.speakers IS 'Speaker identity management across meetings';

-- Call speakers table (many-to-many)
CREATE TABLE public.call_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id BIGINT REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE NOT NULL,
  speaker_id UUID REFERENCES public.speakers(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (call_recording_id, speaker_id)
);

COMMENT ON TABLE public.call_speakers IS 'Many-to-many mapping between calls and speakers';

-- Transcript tags table
CREATE TABLE public.transcript_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transcript_id UUID REFERENCES public.fathom_transcripts(id) ON DELETE CASCADE NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.transcript_tags IS 'Tagging system for transcript segments';

-- =============================================
-- PART 3: INDEXES
-- =============================================

-- fathom_calls indexes
CREATE INDEX idx_calls_created_at ON public.fathom_calls(created_at DESC);
CREATE INDEX idx_calls_user_id ON public.fathom_calls(user_id);
CREATE INDEX idx_calls_calendar_invitees ON public.fathom_calls USING GIN(calendar_invitees);
CREATE INDEX idx_calls_auto_tags ON public.fathom_calls USING GIN(auto_tags);

-- fathom_transcripts indexes
CREATE INDEX idx_transcripts_recording_id ON public.fathom_transcripts(recording_id);
CREATE INDEX idx_transcripts_is_deleted ON public.fathom_transcripts(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_transcripts_edited ON public.fathom_transcripts(edited_at) WHERE edited_at IS NOT NULL;

-- user_roles indexes
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- user_profiles indexes
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role) WHERE role IN ('TEAM', 'ADMIN');

-- webhook_deliveries indexes
CREATE INDEX idx_webhook_deliveries_user_id ON public.webhook_deliveries(user_id);
CREATE INDEX idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at DESC);

-- sync_jobs indexes
CREATE INDEX idx_sync_jobs_user_id ON public.sync_jobs(user_id);
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status);

-- call_categories indexes
CREATE INDEX idx_call_categories_user_id ON public.call_categories(user_id);

-- call_speakers indexes
CREATE INDEX idx_call_speakers_recording_id ON public.call_speakers(call_recording_id);
CREATE INDEX idx_call_speakers_speaker_id ON public.call_speakers(speaker_id);

-- speakers indexes
CREATE INDEX idx_speakers_user_id ON public.speakers(user_id);
CREATE INDEX idx_speakers_email ON public.speakers(email);

-- transcript_tags indexes
CREATE INDEX idx_transcript_tags_transcript_id ON public.transcript_tags(transcript_id);
CREATE INDEX idx_transcript_tags_user_id ON public.transcript_tags(user_id);

-- =============================================
-- PART 4: FUNCTIONS
-- =============================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_speakers_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_speakers_updated_at() IS 'Generic trigger function to update updated_at timestamp (reused across tables)';

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

COMMENT ON FUNCTION public.has_role(UUID, app_role) IS 'Check if user has specific role (SECURITY DEFINER to prevent RLS recursion)';

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'ADMIN' THEN 1
      WHEN 'TEAM' THEN 2
      WHEN 'PRO' THEN 3
      WHEN 'FREE' THEN 4
    END
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_user_role(UUID) IS 'Get user''s highest role in precedence order';

-- Function to auto-create user profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically create user profile and FREE role on signup';

-- Function to auto-categorize calls to SKIP category
CREATE OR REPLACE FUNCTION public.ensure_skip_category()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  skip_category_id UUID;
BEGIN
  -- Get or create SKIP category for this user
  SELECT id INTO skip_category_id
  FROM call_categories
  WHERE user_id = NEW.user_id AND name = 'SKIP';
  
  IF skip_category_id IS NULL THEN
    INSERT INTO call_categories (name, description, user_id, icon)
    VALUES ('SKIP', 'Calls with no transcript or short transcripts (less than 500 characters)', NEW.user_id, 'x-circle')
    RETURNING id INTO skip_category_id;
  END IF;
  
  -- Auto-assign to SKIP if transcript is null or too short
  IF NEW.full_transcript IS NULL OR LENGTH(NEW.full_transcript) < 500 THEN
    INSERT INTO call_category_assignments (call_recording_id, category_id, auto_assigned)
    VALUES (NEW.recording_id, skip_category_id, true)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Remove from SKIP if transcript is now adequate
    DELETE FROM call_category_assignments
    WHERE call_recording_id = NEW.recording_id 
    AND category_id = skip_category_id
    AND auto_assigned = true;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ensure_skip_category() IS 'Auto-categorize calls with no/short transcripts to SKIP category';

-- =============================================
-- PART 5: TRIGGERS
-- =============================================

-- Trigger on auth.users to auto-create profile + role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_speakers_updated_at();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_speakers_updated_at();

CREATE TRIGGER update_speakers_updated_at_trigger
BEFORE UPDATE ON public.speakers
FOR EACH ROW
EXECUTE FUNCTION public.update_speakers_updated_at();

CREATE TRIGGER update_call_categories_updated_at
BEFORE UPDATE ON public.call_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_speakers_updated_at();

CREATE TRIGGER update_sync_jobs_updated_at
BEFORE UPDATE ON public.sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_speakers_updated_at();

-- SKIP category auto-assignment triggers
DROP TRIGGER IF EXISTS auto_categorize_skip_on_insert ON public.fathom_calls;
CREATE TRIGGER auto_categorize_skip_on_insert
AFTER INSERT ON public.fathom_calls
FOR EACH ROW
EXECUTE FUNCTION public.ensure_skip_category();

DROP TRIGGER IF EXISTS auto_categorize_skip_on_update ON public.fathom_calls;
CREATE TRIGGER auto_categorize_skip_on_update
AFTER UPDATE ON public.fathom_calls
FOR EACH ROW
WHEN (OLD.full_transcript IS DISTINCT FROM NEW.full_transcript)
EXECUTE FUNCTION public.ensure_skip_category();

-- =============================================
-- PART 6: ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fathom_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fathom_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_tags ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
CREATE POLICY "Users can read own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = auth.uid() AND up.role = 'ADMIN'
  )
);

-- user_settings policies
CREATE POLICY "Users can read own settings"
ON public.user_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
ON public.user_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
ON public.user_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage user_settings"
ON public.user_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- user_roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'ADMIN'));

-- fathom_calls policies
CREATE POLICY "Users can read own calls"
ON public.fathom_calls FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calls"
ON public.fathom_calls FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calls"
ON public.fathom_calls FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calls"
ON public.fathom_calls FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage fathom_calls"
ON public.fathom_calls FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- fathom_transcripts policies
CREATE POLICY "Users can read transcripts for own calls"
ON public.fathom_transcripts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = fathom_transcripts.recording_id
    AND fc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update transcripts for own calls"
ON public.fathom_transcripts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = fathom_transcripts.recording_id
    AND fc.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = fathom_transcripts.recording_id
    AND fc.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage fathom_transcripts"
ON public.fathom_transcripts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- processed_webhooks policies
CREATE POLICY "Service role can manage processed_webhooks"
ON public.processed_webhooks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- webhook_deliveries policies
CREATE POLICY "Users can read own webhook deliveries"
ON public.webhook_deliveries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage webhook_deliveries"
ON public.webhook_deliveries FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- sync_jobs policies
CREATE POLICY "Users can read own sync jobs"
ON public.sync_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sync_jobs"
ON public.sync_jobs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- call_categories policies
CREATE POLICY "Users can read own categories"
ON public.call_categories FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
ON public.call_categories FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
ON public.call_categories FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
ON public.call_categories FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- call_category_assignments policies
CREATE POLICY "Users can read own call category assignments"
ON public.call_category_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = call_category_assignments.call_recording_id
    AND fc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage own call category assignments"
ON public.call_category_assignments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = call_category_assignments.call_recording_id
    AND fc.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = call_category_assignments.call_recording_id
    AND fc.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage call_category_assignments"
ON public.call_category_assignments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- speakers policies
CREATE POLICY "Users can read own speakers"
ON public.speakers FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own speakers"
ON public.speakers FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- call_speakers policies
CREATE POLICY "Users can read own call speakers"
ON public.call_speakers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = call_speakers.call_recording_id
    AND fc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage own call speakers"
ON public.call_speakers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = call_speakers.call_recording_id
    AND fc.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fathom_calls fc
    WHERE fc.recording_id = call_speakers.call_recording_id
    AND fc.user_id = auth.uid()
  )
);

-- transcript_tags policies
CREATE POLICY "Users can read own transcript tags"
ON public.transcript_tags FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own transcript tags"
ON public.transcript_tags FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PART 7: REALTIME CONFIGURATION
-- =============================================

-- Enable realtime for webhook_deliveries
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_deliveries;

-- =============================================
-- END OF MIGRATION
-- =============================================
