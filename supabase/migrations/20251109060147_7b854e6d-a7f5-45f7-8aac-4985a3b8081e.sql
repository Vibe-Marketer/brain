-- Add RLS policy to allow users to update transcripts for their own calls
CREATE POLICY "Users can update own transcripts"
ON fathom_transcripts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM fathom_calls
    WHERE fathom_calls.recording_id = fathom_transcripts.recording_id
    AND fathom_calls.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM fathom_calls
    WHERE fathom_calls.recording_id = fathom_transcripts.recording_id
    AND fathom_calls.user_id = auth.uid()
  )
);