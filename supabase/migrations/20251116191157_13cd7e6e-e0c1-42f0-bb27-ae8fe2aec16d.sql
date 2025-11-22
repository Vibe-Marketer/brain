
-- Create SKIP category for existing users if not exists
INSERT INTO call_categories (name, description, user_id, icon)
SELECT DISTINCT ON (fc.user_id)
  'SKIP',
  'Calls with no transcript or short transcripts (less than 500 characters)',
  fc.user_id,
  'x-circle'
FROM fathom_calls fc
WHERE NOT EXISTS (
  SELECT 1 FROM call_categories cc
  WHERE cc.name = 'SKIP' AND cc.user_id = fc.user_id
)
ON CONFLICT DO NOTHING;

-- Function to auto-categorize calls to SKIP
CREATE OR REPLACE FUNCTION ensure_skip_category()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
DROP TRIGGER IF EXISTS auto_categorize_skip_on_insert ON fathom_calls;
CREATE TRIGGER auto_categorize_skip_on_insert
AFTER INSERT ON fathom_calls
FOR EACH ROW
EXECUTE FUNCTION ensure_skip_category();

DROP TRIGGER IF EXISTS auto_categorize_skip_on_update ON fathom_calls;
CREATE TRIGGER auto_categorize_skip_on_update
AFTER UPDATE ON fathom_calls
FOR EACH ROW
WHEN (OLD.full_transcript IS DISTINCT FROM NEW.full_transcript)
EXECUTE FUNCTION ensure_skip_category();

-- Manually categorize existing calls with no/short transcripts
INSERT INTO call_category_assignments (call_recording_id, category_id, auto_assigned)
SELECT 
  fc.recording_id,
  cc.id,
  true
FROM fathom_calls fc
JOIN call_categories cc ON cc.user_id = fc.user_id AND cc.name = 'SKIP'
WHERE (fc.full_transcript IS NULL OR LENGTH(fc.full_transcript) < 500)
AND NOT EXISTS (
  SELECT 1 FROM call_category_assignments cca
  WHERE cca.call_recording_id = fc.recording_id AND cca.category_id = cc.id
)
ON CONFLICT DO NOTHING;
