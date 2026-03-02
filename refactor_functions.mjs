import fs from 'fs';
import { globSync } from 'glob';

// Directories to process
const dirs = [
  'src/services/**/*.ts',
  'src/hooks/**/*.ts',
  'src/hooks/**/*.tsx',
  'src/components/**/*.ts',
  'src/components/**/*.tsx',
  'src/lib/**/*.ts',
  'src/pages/**/*.ts',
  'src/pages/**/*.tsx',
  'supabase/functions/**/*.ts'
];

let files = [];
for (const dir of dirs) {
  files = files.concat(globSync(dir));
}

let changed = 0;

for (const file of files) {
  // skip types.ts as they are auto-generated
  if (file.endsWith('supabase/types.ts')) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replacements
  const dict = [
    // Tables
    [/\bfrom\(['`"]banks['`"]\)/g, "from('organizations')"],
    [/\bfrom\(['`"]bank_memberships['`"]\)/g, "from('organization_memberships')"],
    [/\bfrom\(['`"]vaults['`"]\)/g, "from('workspaces')"],
    [/\bfrom\(['`"]vault_memberships['`"]\)/g, "from('workspace_memberships')"],
    [/\bfrom\(['`"]vault_entries['`"]\)/g, "from('workspace_entries')"],

    // Edge Functions SQL Queries internal strings
    [/\bbanks\b/g, 'organizations'],
    [/\bbank_memberships\b/g, 'organization_memberships'],
    [/\bvaults\b/g, 'workspaces'],
    [/\bvault_memberships\b/g, 'workspace_memberships'],
    [/\bvault_entries\b/g, 'workspace_entries'],
    
    // Columns & Common Props
    [/\bbank_id\b/g, 'organization_id'],
    [/\bvault_id\b/g, 'workspace_id'],
    [/\bbank_owner\b/g, 'organization_owner'],
    [/\bbank_admin\b/g, 'organization_admin'],
    [/\bvault_owner\b/g, 'workspace_owner'],
    [/\bvault_admin\b/g, 'workspace_admin'],
    [/\bvault_type\b/g, 'workspace_type'],
  ];

  for (const [regex, replacement] of dict) {
    if (content.match(regex)) {
      content = content.replace(regex, replacement);
    }
  }

  // Check for the `.eq('bank_id'` -> `.eq('organization_id'` if any single quotes are in string
  content = content.replace(/\.eq\(['`"]bank_id['`"]/g, ".eq('organization_id'");
  content = content.replace(/\.eq\(['`"]vault_id['`"]/g, ".eq('workspace_id'");
  content = content.replace(/\.select\(['`"]\*, bank_id\)/g, ".select('*, organization_id)");

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated: ${file}`);
    changed++;
  }
}

console.log(`Updated ${changed} files.`);
