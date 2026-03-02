import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('supabase/functions/**/*.ts');
let changed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replacements
  const dict = [
    [/\bfilter_bank_id\b/g, 'filter_organization_id'],
    [/\bfilter_vault_id\b/g, 'filter_workspace_id'],
    [/\btarget_vault_id\b/g, 'target_workspace_id'],
    [/\bvault_id\b/g, 'workspace_id'],
    [/\bbank_id\b/g, 'organization_id'],
    [/\bactiveBankId\b/g, 'activeOrgId'],
    [/\bactiveVaultId\b/g, 'activeWorkspaceId'],
  ];

  for (const [regex, replacement] of dict) {
    if (content.match(regex)) {
      content = content.replace(regex, replacement);
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated: ${file}`);
    changed++;
  }
}

console.log(`Updated ${changed} files.`);
