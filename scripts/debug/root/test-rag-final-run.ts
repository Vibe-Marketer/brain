import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

const requireEnv = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}${fallback ? ` (or ${fallback})` : ''}`);
  }
  return value;
};

dotenv.config();

const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(supabaseUrl, anonKey);

// Use the admin test account from .env
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.CALLVAULTAI_LOGIN!,
    password: process.env.CALLVAULTAI_LOGIN_PASSWORD!,
  });
  
  if (error || !data.session) {
    throw new Error(`Auth failed: ${error?.message}`);
  }
  
  console.log(`✓ Authenticated as: ${data.user.email} (${data.user.id})\n`);
  return data.session.access_token;
}

async function testQuery(token: string, messages: any[], testName: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${testName}`);
  console.log(`${'='.repeat(70)}`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat-stream-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        model: 'openai/gpt-4o-mini',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ HTTP ${response.status}:`, error);
      return { success: false, error };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: 'No response body' };
    }

    let fullResponse = '';
    let toolCalls: any[] = [];
    let toolResults: any[] = [];
    
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('0:')) {
          try {
            const json = JSON.parse(line.slice(2));
            if (json.type === 'text-delta') {
              fullResponse += json.textDelta;
            } else if (json.type === 'tool-call') {
              toolCalls.push(json);
              console.log(`  🔧 ${json.toolName}`);
            } else if (json.type === 'tool-result') {
              toolResults.push(json);
              const hasError = json.result && typeof json.result === 'object' && json.result.error;
              if (hasError) {
                console.log(`  ❌ Tool error: ${json.result.error}`);
              } else {
                console.log(`  ✓ ${json.toolName} returned results`);
              }
            }
          } catch (e) {
            // Skip parse errors
          }
        }
      }
    }

    console.log(`\n📝 ${fullResponse.slice(0, 300)}${fullResponse.length > 300 ? '...' : ''}\n`);
    
    const hasToolErrors = toolResults.some(r => r.result && typeof r.result === 'object' && r.result.error);
    
    return {
      success: !hasToolErrors,
      response: fullResponse,
      toolCalls,
      toolResults,
    };
    
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    return { success: false, error };
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('E2E RAG TOOLS TEST - CallVault');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  const token = await getAuthToken();

  const tests = [
    { name: 'Tool 1: searchTranscriptsByQuery', messages: [{ role: 'user', content: 'What did people say about AI?' }] },
    { name: 'Tool 2: searchBySpeaker', messages: [{ role: 'user', content: 'What did Andrew say?' }] },
    { name: 'Tool 3: searchByDateRange', messages: [{ role: 'user', content: 'Show calls from last week' }] },
    { name: 'Tool 4: searchByCategory', messages: [{ role: 'user', content: 'Show team meetings' }] },
    { name: 'Tool 5: getAvailableMetadata', messages: [{ role: 'user', content: 'What speakers do I have?' }] },
    { name: 'Tool 6: getCallDetails', messages: [{ role: 'user', content: 'Tell me about my most recent call' }] },
    { name: 'Tool 7: getCallsList', messages: [{ role: 'user', content: 'List my recent calls' }] },
    { name: 'Tool 8: advancedSearch', messages: [{ role: 'user', content: 'Find mentions of planning in team meetings' }] },
  ];

  const results = { passed: 0, failed: 0, details: [] as any[] };

  for (const test of tests) {
    const result = await testQuery(token, test.messages, test.name);
    
    if (result.success) {
      results.passed++;
      results.details.push({ test: test.name, status: 'PASS' });
    } else {
      results.failed++;
      results.details.push({ test: test.name, status: 'FAIL', error: result.error });
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✓ PASSED: ${results.passed}/${tests.length}`);
  console.log(`✗ FAILED: ${results.failed}/${tests.length}\n`);
  
  results.details.forEach(d => {
    console.log(`  ${d.status === 'PASS' ? '✅' : '❌'} ${d.test}`);
    if (d.error) console.log(`     Error: ${JSON.stringify(d.error).slice(0, 100)}`);
  });
  
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
