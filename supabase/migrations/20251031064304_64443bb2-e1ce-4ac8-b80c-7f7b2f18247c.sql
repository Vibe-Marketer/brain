-- Security Fix: Make user_id columns NOT NULL and add auto-assignment triggers

-- Step 1: Delete orphaned records with NULL user_id
-- Since there are no users yet, these are test records that should be removed
DELETE FROM call_categories WHERE user_id IS NULL;
DELETE FROM speakers WHERE user_id IS NULL;

-- Step 2: Make user_id columns NOT NULL
ALTER TABLE call_categories 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE speakers
ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Create function to auto-set user_id for new records
CREATE OR REPLACE FUNCTION public.set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Add triggers to auto-set user_id on insert
CREATE TRIGGER set_user_id_categories
BEFORE INSERT ON call_categories
FOR EACH ROW
EXECUTE FUNCTION set_user_id();

CREATE TRIGGER set_user_id_speakers
BEFORE INSERT ON speakers
FOR EACH ROW
EXECUTE FUNCTION set_user_id();

-- Step 5: Add user_id to fathom_calls for per-user isolation
ALTER TABLE fathom_calls ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Step 6: Update RLS policies for fathom_calls and fathom_transcripts
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read calls" ON fathom_calls;
DROP POLICY IF EXISTS "Authenticated users can read transcripts" ON fathom_transcripts;

-- Create user-scoped policies for fathom_calls
CREATE POLICY "Users can read own calls"
ON fathom_calls FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all calls"
ON fathom_calls FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create user-scoped policies for fathom_transcripts
CREATE POLICY "Users can read own transcripts"
ON fathom_transcripts FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM fathom_calls
  WHERE fathom_calls.recording_id = fathom_transcripts.recording_id
  AND fathom_calls.user_id = auth.uid()
));

CREATE POLICY "Service role can manage all transcripts"
ON fathom_transcripts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_fathom_calls_user_id ON fathom_calls(user_id);

-- Add comment explaining the security model
COMMENT ON COLUMN fathom_calls.user_id IS 'Each user syncs their own Fathom account. Meetings are scoped per user for data isolation.';