-- Add min_tier and is_default columns to ai_models
ALTER TABLE public.ai_models 
ADD COLUMN IF NOT EXISTS min_tier app_role NOT NULL DEFAULT 'FREE',
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Create function to ensure only one default model exists
CREATE OR REPLACE FUNCTION public.ensure_single_default_model()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.ai_models
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_single_default_model_trigger ON public.ai_models;
CREATE TRIGGER ensure_single_default_model_trigger
BEFORE INSERT OR UPDATE ON public.ai_models
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_model();

-- Set initial default (safe fallback)
UPDATE public.ai_models 
SET is_default = true 
WHERE id = 'openai/gpt-4o-mini' OR id LIKE '%gpt-4o-mini%';
