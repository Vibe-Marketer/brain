-- Migration: Add get_available_metadata RPC function
-- Purpose: Enables chat tool #12 to discover available speakers, categories, topics, and tags

CREATE OR REPLACE FUNCTION public.get_available_metadata(
  p_user_id UUID,
  p_metadata_type TEXT
)
RETURNS TABLE (value TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_metadata_type
    WHEN 'speakers' THEN
      -- Get distinct speaker names from the speakers table for this user
      RETURN QUERY
      SELECT 
        s.name AS value,
        COUNT(DISTINCT cs.call_recording_id)::BIGINT AS count
      FROM speakers s
      JOIN call_speakers cs ON cs.speaker_id = s.id
      WHERE s.user_id = p_user_id
        AND s.name IS NOT NULL
        AND s.name != ''
      GROUP BY s.name
      ORDER BY count DESC, value ASC
      LIMIT 100;

    WHEN 'categories' THEN
      -- Get distinct category names from call_categories for this user
      RETURN QUERY
      SELECT 
        cc.name AS value,
        COUNT(DISTINCT cca.call_recording_id)::BIGINT AS count
      FROM call_categories cc
      LEFT JOIN call_category_assignments cca ON cca.category_id = cc.id
      WHERE cc.user_id = p_user_id
        AND cc.name IS NOT NULL
        AND cc.name != ''
      GROUP BY cc.name
      ORDER BY count DESC, value ASC
      LIMIT 100;

    WHEN 'tags' THEN
      -- Get distinct auto_tags from fathom_calls for this user
      RETURN QUERY
      SELECT 
        unnest(fc.auto_tags) AS value,
        1::BIGINT AS count
      FROM fathom_calls fc
      WHERE fc.user_id = p_user_id
        AND fc.auto_tags IS NOT NULL
        AND array_length(fc.auto_tags, 1) > 0
      GROUP BY value
      ORDER BY value ASC
      LIMIT 100;

    WHEN 'topics' THEN
      -- Extract topics from transcript_tags for this user
      RETURN QUERY
      SELECT 
        tt.tag_text AS value,
        COUNT(*)::BIGINT AS count
      FROM transcript_tags tt
      WHERE tt.user_id = p_user_id
        AND tt.tag_text IS NOT NULL
        AND tt.tag_text != ''
      GROUP BY tt.tag_text
      ORDER BY count DESC, value ASC
      LIMIT 100;

    ELSE
      -- Unknown metadata type, return empty
      RETURN;
  END CASE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_available_metadata(UUID, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_available_metadata IS 'Returns available metadata values (speakers, categories, topics, tags) for a user. Used by chat tool #12 getAvailableMetadata.';
