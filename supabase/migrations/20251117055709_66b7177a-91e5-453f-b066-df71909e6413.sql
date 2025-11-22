-- Fix security: Set search_path for update_ai_processing_jobs_updated_at function
CREATE OR REPLACE FUNCTION update_ai_processing_jobs_updated_at()
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