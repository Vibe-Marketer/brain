-- Fix workspace_invitations RLS policy that queried auth.users directly
-- (authenticated role has no SELECT on auth.users, causing 403 on invite creation)
-- Replace with auth.email() which is granted to authenticated role

DROP POLICY IF EXISTS "invited_users_select_own_invitations" ON workspace_invitations;
CREATE POLICY "invited_users_select_own_invitations"
  ON workspace_invitations FOR SELECT
  USING (email = auth.email());

-- Fix workspace_invitations role check constraint: vault_admin → workspace_admin
ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;
ALTER TABLE workspace_invitations ADD CONSTRAINT workspace_invitations_role_check
  CHECK (role = ANY (ARRAY['workspace_admin'::text, 'manager'::text, 'member'::text, 'guest'::text]));

-- Update any existing rows with old role name
UPDATE workspace_invitations SET role = 'workspace_admin' WHERE role = 'vault_admin';
