import { createClient } from '@supabase/supabase-js';

const requireEnv = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}${fallback ? ` (or ${fallback})` : ''}`);
  }
  return value;
};

const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function findUserWithData() {
  console.log('🔍 Finding users with call data...\n');
  
  const { data: users } = await supabase.auth.admin.listUsers();
  
  if (!users) {
    console.log('No users found');
    return;
  }
  
  for (const user of users.users) {
    const { count: callCount } = await supabase
      .from('fathom_calls')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    const { count: transcriptCount } = await supabase
      .from('fathom_transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    if (callCount && callCount > 0) {
      console.log(`✅ ${user.email}: ${callCount} calls, ${transcriptCount} transcripts`);
      
      // Get sample call
      const { data: sampleCall } = await supabase
        .from('fathom_calls')
        .select('recording_id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (sampleCall) {
        console.log(`   Latest: "${sampleCall.title}" (${sampleCall.recording_id}) on ${sampleCall.created_at.split('T')[0]}`);
      }
      
      // Get speakers
      const { data: speakers } = await supabase
        .from('fathom_transcripts')
        .select('speaker_name')
        .eq('user_id', user.id)
        .not('speaker_name', 'is', null)
        .limit(50);
      
      const unique = [...new Set(speakers?.map(s => s.speaker_name))];
      console.log(`   Speakers: ${unique.slice(0, 5).join(', ')}${unique.length > 5 ? ` +${unique.length - 5} more` : ''}`);
      console.log('');
    }
  }
  
  // Check if Edge Function is deployed
  console.log('\n🔌 Checking if chat-stream-v2 function is deployed...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat-stream-v2`, {
      method: 'OPTIONS',
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 404) {
      console.log('   ❌ Function NOT deployed - need to run: supabase functions deploy chat-stream-v2');
    } else if (response.status === 502) {
      console.log('   ⚠️  Function exists but erroring (502 Bad Gateway)');
    } else {
      console.log('   ✅ Function appears to be deployed');
    }
  } catch (e) {
    console.log('   ❌ Could not reach function endpoint:', e);
  }
}

findUserWithData();
