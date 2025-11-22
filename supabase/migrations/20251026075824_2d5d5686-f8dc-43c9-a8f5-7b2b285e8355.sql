-- Allow public read access to fathom_calls table
CREATE POLICY "Allow public read access to fathom_calls"
ON public.fathom_calls
FOR SELECT
TO public
USING (true);

-- Allow public read access to fathom_transcripts table
CREATE POLICY "Allow public read access to fathom_transcripts"
ON public.fathom_transcripts
FOR SELECT
TO public
USING (true);