import fs from 'fs';

const dump = fs.readFileSync('functions_dump.sql', 'utf8');

let newFunctions = dump;
// Global Replacements
const replacements = [
  [/banks/g, 'organizations'],
  [/bank_memberships/g, 'organization_memberships'],
  [/vaults/g, 'workspaces'],
  [/vault_memberships/g, 'workspace_memberships'],
  [/vault_entries/g, 'workspace_entries'],
  [/bank_id/g, 'organization_id'],
  [/vault_id/g, 'workspace_id'],
  [/bank_owner/g, 'organization_owner'],
  [/bank_admin/g, 'organization_admin'],
  [/vault_owner/g, 'workspace_owner'],
  [/vault_admin/g, 'workspace_admin'],
  [/vault_type/g, 'workspace_type'],
  [/vault_name/g, 'workspace_name'],
  [/bank_name/g, 'organization_name'],
  // Function names
  [/is_bank_member/g, 'is_organization_member'],
  [/is_bank_admin_or_owner/g, 'is_organization_admin_or_owner'],
  [/create_business_bank/g, 'create_business_organization'],
  [/update_banks_updated_at/g, 'update_organizations_updated_at'],
  [/update_vaults_updated_at/g, 'update_workspaces_updated_at'],
  [/is_vault_member/g, 'is_workspace_member'],
  [/is_vault_admin_or_owner/g, 'is_workspace_admin_or_owner'],
  [/get_vault_bank_id/g, 'get_workspace_organization_id'],
  [/generate_vault_invite/g, 'generate_workspace_invite'],
  [/update_vault_entries_updated_at/g, 'update_workspace_entries_updated_at'],
  [/get_recording_bank_id/g, 'get_recording_organization_id'],
  [/ensure_personal_bank/g, 'ensure_personal_organization'],
];

for (const [regex, replacement] of replacements) {
  newFunctions = newFunctions.replace(regex, replacement);
}

let migrationSQL = `-- Phase 16: Refactor Vaults to Workspaces Migration
BEGIN;

-- 1. RENAME TABLES
ALTER TABLE banks RENAME TO organizations;
ALTER TABLE bank_memberships RENAME TO organization_memberships;
ALTER TABLE vaults RENAME TO workspaces;
ALTER TABLE vault_memberships RENAME TO workspace_memberships;
ALTER TABLE vault_entries RENAME TO workspace_entries;

-- 2. RENAME COLUMNS
ALTER TABLE call_tags RENAME COLUMN bank_id TO organization_id;
ALTER TABLE chat_sessions RENAME COLUMN bank_id TO organization_id;
ALTER TABLE content_items RENAME COLUMN bank_id TO organization_id;
ALTER TABLE content_library RENAME COLUMN bank_id TO organization_id;
ALTER TABLE folders RENAME COLUMN bank_id TO organization_id;
ALTER TABLE folders RENAME COLUMN vault_id TO workspace_id;
ALTER TABLE templates RENAME COLUMN bank_id TO organization_id;
ALTER TABLE recordings RENAME COLUMN bank_id TO organization_id;

ALTER TABLE workspaces RENAME COLUMN bank_id TO organization_id;
ALTER TABLE workspaces RENAME COLUMN vault_type TO workspace_type;
ALTER TABLE workspace_memberships RENAME COLUMN vault_id TO workspace_id;
ALTER TABLE workspace_entries RENAME COLUMN vault_id TO workspace_id;
ALTER TABLE organization_memberships RENAME COLUMN bank_id TO organization_id;

ALTER TABLE import_routing_rules RENAME COLUMN bank_id TO organization_id;
ALTER TABLE import_routing_rules RENAME COLUMN target_vault_id TO target_workspace_id;
ALTER TABLE import_routing_defaults RENAME COLUMN bank_id TO organization_id;
ALTER TABLE import_routing_defaults RENAME COLUMN target_vault_id TO target_workspace_id;

-- Ensure enums/text records are updated
UPDATE organization_memberships SET role = 'organization_owner' WHERE role = 'bank_owner';
UPDATE organization_memberships SET role = 'organization_admin' WHERE role = 'bank_admin';
UPDATE workspace_memberships SET role = 'workspace_owner' WHERE role = 'vault_owner';
UPDATE workspace_memberships SET role = 'workspace_admin' WHERE role = 'vault_admin';

-- 3. DROP OLD FUNCTIONS 
DROP FUNCTION IF EXISTS update_banks_updated_at() CASCADE;
DROP FUNCTION IF EXISTS is_bank_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_bank_admin_or_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS create_business_bank(text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS get_workspace_invite_details(text) CASCADE;
DROP FUNCTION IF EXISTS update_vaults_updated_at() CASCADE;
DROP FUNCTION IF EXISTS is_vault_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_vault_admin_or_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS get_vault_bank_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS generate_vault_invite(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS accept_workspace_invite(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS update_routing_rule_priorities(uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS update_vault_entries_updated_at() CASCADE;
DROP FUNCTION IF EXISTS get_recording_bank_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS migrate_fathom_call_to_recording(bigint, uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS ensure_personal_bank(uuid) CASCADE;
DROP FUNCTION IF EXISTS hybrid_search_transcripts_scoped(text, vector, integer, double precision, double precision, integer, uuid, uuid, uuid, timestamp with time zone, timestamp with time zone, text[], text[], bigint[], text[], text, text[], text[]) CASCADE;
DROP FUNCTION IF EXISTS hybrid_search_transcripts(text, vector, integer, double precision, double precision, integer, uuid, timestamp with time zone, timestamp with time zone, text[], text[], bigint[], text[], text, text[], text[], text[], uuid) CASCADE;

-- 4. RECREATE FUNCTIONS
${newFunctions}

-- 5. RE-ATTACH TRIGGERS THAT DROPPED DUE TO CASCADE
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_workspaces_updated_at();
CREATE TRIGGER workspace_entries_updated_at BEFORE UPDATE ON workspace_entries FOR EACH ROW EXECUTE FUNCTION update_workspace_entries_updated_at();

COMMIT;
`;

fs.writeFileSync('supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql', migrationSQL);
console.log('Migration generated successfully.');
