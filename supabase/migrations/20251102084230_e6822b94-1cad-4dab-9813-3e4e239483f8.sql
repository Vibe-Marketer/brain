-- Create transcript_tags table
CREATE TABLE IF NOT EXISTS public.transcript_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.transcript_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for transcript_tags
CREATE POLICY "Users can read own tags"
  ON public.transcript_tags
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags"
  ON public.transcript_tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON public.transcript_tags
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON public.transcript_tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create transcript_tag_assignments junction table
CREATE TABLE IF NOT EXISTS public.transcript_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES public.transcript_tags(id) ON DELETE CASCADE,
  call_recording_id BIGINT NOT NULL REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, call_recording_id)
);

-- Enable RLS
ALTER TABLE public.transcript_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for transcript_tag_assignments
CREATE POLICY "Users can read own tag assignments"
  ON public.transcript_tag_assignments
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transcript_tags
    WHERE transcript_tags.id = transcript_tag_assignments.tag_id
    AND transcript_tags.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own tag assignments"
  ON public.transcript_tag_assignments
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transcript_tags
    WHERE transcript_tags.id = transcript_tag_assignments.tag_id
    AND transcript_tags.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own tag assignments"
  ON public.transcript_tag_assignments
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.transcript_tags
    WHERE transcript_tags.id = transcript_tag_assignments.tag_id
    AND transcript_tags.user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX idx_transcript_tags_user_id ON public.transcript_tags(user_id);
CREATE INDEX idx_transcript_tag_assignments_tag_id ON public.transcript_tag_assignments(tag_id);
CREATE INDEX idx_transcript_tag_assignments_call_id ON public.transcript_tag_assignments(call_recording_id);

-- Create shared_links table
CREATE TABLE IF NOT EXISTS public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_recording_ids BIGINT[] NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for shared_links
CREATE POLICY "Users can read own shared links"
  ON public.shared_links
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shared links"
  ON public.shared_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared links"
  ON public.shared_links
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared links"
  ON public.shared_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public access policy for shared links (anyone with token)
CREATE POLICY "Public can access shared links with valid token"
  ON public.shared_links
  FOR SELECT
  USING (
    share_token IS NOT NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Create indexes
CREATE INDEX idx_shared_links_user_id ON public.shared_links(user_id);
CREATE INDEX idx_shared_links_token ON public.shared_links(share_token);
CREATE INDEX idx_shared_links_expires_at ON public.shared_links(expires_at);

-- Create trigger to update updated_at on transcript_tags
CREATE OR REPLACE FUNCTION update_transcript_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcript_tags_updated_at
  BEFORE UPDATE ON public.transcript_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_transcript_tags_updated_at();