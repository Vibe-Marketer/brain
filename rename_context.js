const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx}');
let changed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  if (content.includes('useBankContext')) {
    content = content.replace(/useBankContext/g, 'useOrganizationContext');
    content = content.replace(/@\/hooks\/useBankContext/g, '@/hooks/useOrganizationContext');
  }

  if (content.includes('useVaults')) {
    content = content.replace(/useVaults/g, 'useWorkspaces');
    content = content.replace(/@\/hooks\/useVaults/g, '@/hooks/useWorkspaces');
  }

  if (content.includes('useVaultMutations')) {
    content = content.replace(/useVaultMutations/g, 'useWorkspaceMutations');
    content = content.replace(/@\/hooks\/useVaultMutations/g, '@/hooks/useWorkspaceMutations');
    content = content.replace(/useCreateVault/g, 'useCreateWorkspace');
    content = content.replace(/useUpdateVault/g, 'useUpdateWorkspace');
    content = content.replace(/useDeleteVault/g, 'useDeleteWorkspace');
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
    changed++;
  }
}

console.log(`Changed ${changed} files.`);
