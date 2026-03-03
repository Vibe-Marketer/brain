CREATE TABLE IF NOT EXISTS public.feature_flags (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT false NOT NULL,
  enabled_for_roles text[] DEFAULT '{}'::text[],
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.feature_flags;
CREATE POLICY "Anyone can read feature flags"
  ON public.feature_flags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can insert feature flags" ON public.feature_flags;
CREATE POLICY "Only admins can insert feature flags"
  ON public.feature_flags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'ADMIN'
    )
  );

DROP POLICY IF EXISTS "Only admins can update feature flags" ON public.feature_flags;
CREATE POLICY "Only admins can update feature flags"
  ON public.feature_flags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'ADMIN'
    )
  );

INSERT INTO public.feature_flags (id, name, description, is_enabled, enabled_for_roles) VALUES
  ('beta_imports', 'Import Hub', 'Fathom, Zoom, and Video Imports', false, ARRAY['ADMIN']),
  ('beta_youtube', 'YouTube Import', 'YouTube Video Imports', false, ARRAY['ADMIN']),
  ('beta_analytics', 'Analytics', 'Call Analytics Dashboard', false, ARRAY['ADMIN']),
  ('debug_panel', 'Debug Panel', 'Developer debug panel', false, ARRAY['ADMIN'])
ON CONFLICT (id) DO NOTHING;
