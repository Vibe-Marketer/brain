-- Rename get_vault_organization_id -> get_workspace_organization_id
-- No RLS policies, triggers, or app code reference this function directly.

-- Create the new function with identical body
CREATE OR REPLACE FUNCTION public.get_workspace_organization_id(p_workspace_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM workspaces WHERE id = p_workspace_id
$function$;

-- Drop the old function
DROP FUNCTION IF EXISTS public.get_vault_organization_id(uuid);
