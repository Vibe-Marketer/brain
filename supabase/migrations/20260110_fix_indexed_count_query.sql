-- Fix for AITab stats showing wrong indexed count
-- The frontend query was limited to 1000 rows by default, causing incorrect unique counts

-- Create RPC function to get accurate count of indexed recordings for a user
CREATE OR REPLACE FUNCTION get_indexed_recording_count(p_user_id UUID)
RETURNS TABLE(indexed_count BIGINT, total_chunks BIGINT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT recording_id)::BIGINT as indexed_count,
    COUNT(*)::BIGINT as total_chunks
  FROM transcript_chunks
  WHERE user_id = p_user_id;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_indexed_recording_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_indexed_recording_count(UUID) TO anon;
