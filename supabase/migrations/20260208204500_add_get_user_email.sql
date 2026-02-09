-- ============================================================================
-- GET USER EMAIL FUNCTION
-- ============================================================================
-- Purpose: Retrieve email address for a given user_id from auth.users
-- Used by frontend components to enrich user data with email addresses
--
-- Security:
--   - SECURITY DEFINER required to access auth.users table
--   - Available to authenticated users and service_role
--   - Returns NULL if user not found
-- ============================================================================

-- Function: get_user_email
-- Parameters:
--   user_id: UUID of the user to look up
-- Returns:
--   TEXT: email address of the user, or NULL if not found

CREATE OR REPLACE FUNCTION public.get_user_email(
  user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Query auth.users for the email
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = user_id;
  
  RETURN v_email;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.get_user_email(UUID) IS 'Retrieve email address for a given user_id from auth.users. Returns NULL if user not found.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
