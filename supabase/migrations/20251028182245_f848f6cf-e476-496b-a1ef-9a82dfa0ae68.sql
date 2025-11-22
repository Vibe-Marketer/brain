-- Fix search_path for security - drop trigger first
DROP TRIGGER IF EXISTS update_speakers_updated_at_trigger ON public.speakers;
DROP FUNCTION IF EXISTS public.update_speakers_updated_at();

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

CREATE TRIGGER update_speakers_updated_at_trigger
BEFORE UPDATE ON public.speakers
FOR EACH ROW
EXECUTE FUNCTION public.update_speakers_updated_at();