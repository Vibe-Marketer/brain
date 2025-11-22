-- Add DELETE policy for users to delete their own calls
CREATE POLICY "Users can delete own calls"
ON public.fathom_calls
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add UPDATE policy for users to update their own calls (for future features)
CREATE POLICY "Users can update own calls"
ON public.fathom_calls
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);