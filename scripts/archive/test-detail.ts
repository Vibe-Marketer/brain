import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.CALLVAULTAI_LOGIN!,
    password: process.env.CALLVAULTAI_LOGIN_PASSWORD!,
  });
  
  if (error || !data.session) {
    console.error('Auth failed:', error);
    return;
  }
  
  const token = data.session.access_token;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/chat-stream-legacy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Search my calls for pricing discussions' }],
    }),
  });
  
  console.log('Status:', response.status);
  
  const reader = response.body?.getReader();
  if (!reader) return;
  
  const decoder = new TextDecoder();
  let fullText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    fullText += chunk;
  }
  
  console.log('\nFull response:\n', fullText);
}

main().catch(console.error);
