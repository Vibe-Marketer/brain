import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  console.log('1. Authenticating...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.CALLVAULTAI_LOGIN!,
    password: process.env.CALLVAULTAI_LOGIN_PASSWORD!,
  });
  
  if (error || !data.session) {
    console.error('Auth failed:', error);
    return;
  }
  
  const token = data.session.access_token;
  console.log(`   ✓ Got token for ${data.user.email}`);
  
  // Test simple hello message
  console.log('\n2. Calling chat-stream-v2 with simple message...');
  
  const startTime = Date.now();
  const response = await fetch(`${supabaseUrl}/functions/v1/chat-stream-v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Say hello' }],
      model: 'openai/gpt-4o-mini',
    }),
  });
  
  const elapsed = Date.now() - startTime;
  console.log(`   Response: ${response.status} ${response.statusText} (${elapsed}ms)`);
  
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  console.log('   Headers:', JSON.stringify(responseHeaders, null, 2));
  
  if (!response.ok) {
    const text = await response.text();
    console.log('   Error body:', text);
    return;
  }
  
  console.log('\n3. Reading response stream...');
  const reader = response.body?.getReader();
  if (!reader) {
    console.log('   No response body');
    return;
  }
  
  const decoder = new TextDecoder();
  let chunks = 0;
  let totalBytes = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks++;
    totalBytes += value.length;
    if (chunks <= 5) {
      console.log(`   Chunk ${chunks}:`, decoder.decode(value).substring(0, 200));
    }
  }
  
  console.log(`   Total: ${chunks} chunks, ${totalBytes} bytes`);
  console.log('\n✓ Success!');
}

main().catch(console.error);
