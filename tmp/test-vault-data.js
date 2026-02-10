// Test script to verify vault data loading
// Run this in browser console at http://localhost:8080/vaults

async function testVaultData() {
  console.log('Testing vault data loading...');
  
  // Get Supabase client from window
  const supabase = window.supabase;
  if (!supabase) {
    console.error('❌ Supabase client not found on window');
    return;
  }
  
  console.log('✅ Supabase client found');
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user?.id);
  
  // Test vault membership
  const vaultId = '2e57f0aa-e0bb-4e54-a602-33c9e606f2bf';
  console.log('Testing vault:', vaultId);
  
  // Check if user is member
  const { data: membership, error: memError } = await supabase
    .from('vault_memberships')
    .select('*')
    .eq('vault_id', vaultId)
    .eq('user_id', user.id)
    .single();
    
  console.log('Membership:', membership, 'Error:', memError);
  
  // Try to fetch vault entries
  const { data: entries, error: entriesError } = await supabase
    .from('vault_entries')
    .select(`
      id,
      local_tags,
      recording:recordings (
        id,
        title,
        bank_id,
        owner_user_id
      )
    `)
    .eq('vault_id', vaultId)
    .limit(5);
    
  console.log('Entries count:', entries?.length);
  console.log('Entries error:', entriesError);
  console.log('First entry:', entries?.[0]);
}

testVaultData();
