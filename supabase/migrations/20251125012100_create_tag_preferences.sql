-- Create table for user tag preferences and auto-tagging rules
CREATE TABLE IF NOT EXISTS public.tag_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,

  -- Title pattern matching rules
  title_keywords TEXT[], -- Keywords in call title that indicate this tag
  title_patterns TEXT[], -- Regex patterns for title matching

  -- Attendee-based rules
  attendee_emails TEXT[], -- Specific email addresses that indicate this tag
  attendee_domains TEXT[], -- Email domains (e.g., 'client-company.com')
  attendee_names TEXT[], -- Specific names
  min_attendees INT, -- Minimum number of attendees for this tag (useful for (2+) tags)
  max_attendees INT, -- Maximum number of attendees

  -- Content-based rules (for transcript/summary analysis)
  content_keywords TEXT[], -- Keywords in transcript that indicate this tag

  -- Priority and metadata
  priority INT DEFAULT 0, -- Higher priority = checked first (for overlapping rules)
  enabled BOOLEAN DEFAULT true,
  notes TEXT, -- User notes about when to use this tag

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, tag)
);

-- Create index for faster lookups
CREATE INDEX idx_tag_preferences_user_id ON public.tag_preferences(user_id);
CREATE INDEX idx_tag_preferences_enabled ON public.tag_preferences(user_id, enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE public.tag_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tag preferences"
  ON public.tag_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tag preferences"
  ON public.tag_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tag preferences"
  ON public.tag_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tag preferences"
  ON public.tag_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add index to fathom_calls for better historical tag analysis
CREATE INDEX IF NOT EXISTS idx_fathom_calls_user_auto_tags
  ON public.fathom_calls(user_id, auto_tags)
  WHERE auto_tags IS NOT NULL AND array_length(auto_tags, 1) > 0;

-- Update function for updated_at
CREATE OR REPLACE FUNCTION update_tag_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tag_preferences_updated_at
  BEFORE UPDATE ON public.tag_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_preferences_updated_at();

-- Insert default preferences for existing users
-- (This gives users a starting point they can customize)
INSERT INTO public.tag_preferences (user_id, tag, title_keywords, attendee_emails, min_attendees, priority, notes)
SELECT
  u.id,
  'TEAM',
  ARRAY['team', 'internal', 'standup', 'sync', 'planning'],
  NULL,
  NULL,
  100,
  'Internal team meetings and founder discussions'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, min_attendees, priority, notes)
SELECT
  u.id,
  'COACH (2+)',
  ARRAY['group coaching', 'group session', 'cohort'],
  2,
  90,
  'Group coaching sessions with multiple participants'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, max_attendees, priority, notes)
SELECT
  u.id,
  'COACH (1:1)',
  ARRAY['coaching', '1:1', 'one-on-one'],
  2,
  85,
  'Individual coaching sessions'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, min_attendees, priority, notes)
SELECT
  u.id,
  'WEBINAR (2+)',
  ARRAY['webinar', 'workshop', 'presentation', 'training'],
  3,
  80,
  'Large group events and webinars'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, max_attendees, priority, notes)
SELECT
  u.id,
  'SALES (1:1)',
  ARRAY['sales', 'demo', 'pitch'],
  2,
  75,
  'One-on-one sales calls'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, priority, notes)
SELECT
  u.id,
  'DISCOVERY',
  ARRAY['discovery', 'qualification', 'intro call', 'initial consultation'],
  70,
  'Pre-sales qualification and discovery calls'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, priority, notes)
SELECT
  u.id,
  'ONBOARDING',
  ARRAY['onboarding', 'welcome', 'kickoff', 'getting started'],
  65,
  'Platform onboarding and setup calls'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, priority, notes)
SELECT
  u.id,
  'SUPPORT',
  ARRAY['support', 'help', 'issue', 'troubleshoot', 'bug', 'technical'],
  60,
  'Customer support and technical assistance'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, priority, notes)
SELECT
  u.id,
  'PRODUCT',
  ARRAY['product demo', 'feature demo', 'walkthrough'],
  55,
  'Product demonstrations'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;

INSERT INTO public.tag_preferences (user_id, tag, title_keywords, priority, notes)
SELECT
  u.id,
  'REVIEW',
  ARRAY['testimonial', 'review', 'feedback', 'interview'],
  50,
  'Testimonials, reviews, and feedback sessions'
FROM auth.users u
ON CONFLICT (user_id, tag) DO NOTHING;
