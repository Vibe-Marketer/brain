import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  console.log('URL:', supabaseUrl);
  
  // Authenticate
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.CALLVAULTAI_LOGIN!,
    password: process.env.CALLVAULTAI_LOGIN_PASSWORD!,
  });
  
  if (error || !data.session) {
    console.error('Auth failed:', error);
    return;
  }
  
  const token = data.session.access_token;
  console.log('Got token (first 50 chars):', token.substring(0, 50) + '...');
  console.log('Token length:', token.length);
  console.log('User:', data.user.email);
  
  // Test RPC call directly
  console.log('\n--- Testing RPC call ---');
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_available_metadata', {
    p_user_id: data.user.id,
    p_metadata_type: 'speakers',
  });
  console.log('RPC result:', rpcError ? rpcError : rpcData);
  
  // Test edge function with token
  console.log('\n--- Testing edge function ---');
  const response = await fetch(`${supabaseUrl}/functions/v1/chat-stream-v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'List my calls' }],
      model: 'openai/gpt-4o-mini',
    }),
  });
  
  console.log('Status:', response.status);
  if (!response.ok) {
    const text = await response.text();
    console.log('Error body:', text);
  } else {
    console.log('Success! Reading stream...');
    const reader = response.body?.getReader();
    if (reader) {
      let chunks = '';
      const decoder = new TextDecoder();
      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks += decoder.decode(value);
      }
      console.log('First chunks:', chunks.substring(0, 500));
    }
  }
}

main().catch(console.error);
