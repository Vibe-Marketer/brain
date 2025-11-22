-- Fix search_path security warning for ensure_skip_category function
CREATE OR REPLACE FUNCTION ensure_skip_category()
RETURNS TRIGGER AS $$
DECLARE
  skip_category_id UUID;
  user_id_val UUID;
BEGIN
  -- Get the user_id from the new row
  user_id_val := NEW.user_id;
  
  -- Check if SKIP category exists for this user
  SELECT id INTO skip_category_id
  FROM call_categories
  WHERE user_id = user_id_val AND name = 'SKIP';
  
  -- If not, create it
  IF skip_category_id IS NULL THEN
    INSERT INTO call_categories (name, description, user_id, icon)
    VALUES ('SKIP', 'Calls with no transcript or short transcripts (less than 500 characters)', user_id_val, 'x-circle')
    RETURNING id INTO skip_category_id;
  END IF;
  
  -- Auto-assign to SKIP if transcript is null or too short
  IF NEW.full_transcript IS NULL OR LENGTH(NEW.full_transcript) < 500 THEN
    -- Check if already assigned to SKIP
    IF NOT EXISTS (
      SELECT 1 FROM call_category_assignments
      WHERE call_recording_id = NEW.recording_id AND category_id = skip_category_id
    ) THEN
      INSERT INTO call_category_assignments (call_recording_id, category_id, auto_assigned)
      VALUES (NEW.recording_id, skip_category_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- Remove from SKIP if transcript is now adequate
    DELETE FROM call_category_assignments
    WHERE call_recording_id = NEW.recording_id 
    AND category_id = skip_category_id
    AND auto_assigned = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
