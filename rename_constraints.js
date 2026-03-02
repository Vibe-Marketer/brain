const fs = require('fs');
let content = fs.readFileSync('supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql', 'utf8');

const constraintUpdates = `
-- Drop constraints
ALTER TABLE organization_memberships DROP CONSTRAINT IF EXISTS bank_memberships_role_check;
ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS vault_memberships_role_check;
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS vaults_vault_type_check;

-- Ensure enums/text records are updated
UPDATE organization_memberships SET role = 'organization_owner' WHERE role = 'bank_owner';
UPDATE organization_memberships SET role = 'organization_admin' WHERE role = 'bank_admin';
UPDATE workspace_memberships SET role = 'workspace_owner' WHERE role = 'vault_owner';
UPDATE workspace_memberships SET role = 'workspace_admin' WHERE role = 'vault_admin';

-- Re-add constraints
ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_role_check CHECK (role IN ('organization_owner', 'organization_admin', 'manager', 'member', 'guest'));
ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('workspace_owner', 'workspace_admin', 'manager', 'member', 'guest'));
ALTER TABLE workspaces ADD CONSTRAINT workspaces_workspace_type_check CHECK (workspace_type IN ('personal', 'team', 'youtube'));
`;

content = content.replace(
/-- Ensure enums\/text records are updated[\s\S]*?UPDATE workspace_memberships SET role = 'workspace_admin' WHERE role = 'vault_admin';/, 
constraintUpdates
);

fs.writeFileSync('supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql', content);
