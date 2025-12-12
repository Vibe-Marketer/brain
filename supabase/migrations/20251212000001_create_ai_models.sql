-- Create ai_models table
CREATE TABLE public.ai_models (
  id TEXT PRIMARY KEY, -- OpenRouter ID (e.g., 'openai/gpt-4o')
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  context_length INTEGER,
  pricing JSONB,
  
  -- Configuration
  is_enabled BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE public.ai_models IS 'Curated list of AI models managed by Admins';
COMMENT ON COLUMN public.ai_models.is_enabled IS 'Whether this model is valid for users to select';

-- RLS
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

-- Policies

-- Everyone can read ENABLED models (for the chat selector)
CREATE POLICY "Everyone can read enabled models"
  ON public.ai_models FOR SELECT
  USING (is_enabled = true);

-- Admins can read ALL models (to manage them)
CREATE POLICY "Admins can read all models"
  ON public.ai_models FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Admins can insert/update/delete
CREATE POLICY "Admins can manage models"
  ON public.ai_models FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Service Role (Edge Functions) can do everything
CREATE POLICY "Service role full access"
  ON public.ai_models FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_speakers_updated_at();
