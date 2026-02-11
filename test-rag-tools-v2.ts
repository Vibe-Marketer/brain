import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzUwMDcsImV4cCI6MjA3OTQ1MTAwN30.jkT4qFvOuRnyMexcOfgt1AZSbrRFyDsJfPVsGdA0BUo';

const supabase = createClient(supabaseUrl, anonKey);

//Test user from .env comments: sepihe5967@gavrom.com / Password1!

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'sepihe5967@gavrom.com',
    password: 'Password1!',
  });
  
  if (error || !data.session) {
    throw new Error(`Auth failed: ${error?.message}`);
  }
  
  console.log(`✓ Authenticated as: ${data.user.email} (${data.user.id})\n`);
  return data.session.access_token;
}

// Test a single query
async function testQuery(token: string, messages: any[], testName: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(70)}`);
  
  try {
    const response = await fetch('https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/chat-stream-v2', {
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

    // Stream the response
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ No response body');
      return { success: false, error: 'No response body' };
    }

    let fullResponse = '';
    const toolCalls: any[] = [];
    const toolResults: any[] = [];
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('0:')) {
          try {
            const json = JSON.parse(line.slice(2));
            
            if (json.type === 'text-delta') {
              fullResponse += json.textDelta;
            } else if (json.type === 'tool-call') {
              toolCalls.push(json);
              console.log(`  🔧 Tool: ${json.toolName}`);
              console.log(`     Args:`, JSON.stringify(json.args).slice(0, 150));
            } else if (json.type === 'tool-result') {
              toolResults.push(json);
              const resultPreview = typeof json.result === 'string' 
                ? json.result.slice(0, 200) 
                : JSON.stringify(json.result).slice(0, 300);
              console.log(`  ✅ Result for ${json.toolName}:`, resultPreview, json.result && JSON.stringify(json.result).length > 300 ? '...' : '');
              
              // Check for empty or error results
              if (json.result && typeof json.result === 'object') {
                if (json.result.error) {
                  console.log(`     ⚠️  ERROR in result: ${json.result.message || json.result.error}`);
                } else if (json.result.message && !json.result.results) {
                  console.log(`     ⚠️  NO RESULTS: ${json.result.message}`);
                } else if (json.result.results && Array.isArray(json.result.results)) {
                  console.log(`     ✓ Found ${json.result.results.length} results`);
                } else if (json.result.values && Array.isArray(json.result.values)) {
                  console.log(`     ✓ Found ${json.result.values.length} values`);
                } else if (json.result.calls && Array.isArray(json.result.calls)) {
                  console.log(`     ✓ Found ${json.result.calls.length} calls`);
                } else if (json.result.recording_id) {
                  console.log(`     ✓ Got call details for recording ${json.result.recording_id}`);
                }
              }
            }
          } catch (e) {
            // Skip parsing errors for non-JSON lines
          }
        }
      }
    }

    console.log(`\n📝 AI Response (${fullResponse.length} chars):`);
    console.log(fullResponse.slice(0, 800) + (fullResponse.length > 800 ? '\n...(truncated)' : ''));
    
    return {
      success: true,
      response: fullResponse,
      toolCalls,
      toolResults,
    };
    
  } catch (error) {
    console.error('❌ Request failed:', error);
    return { success: false, error: String(error) };
  }
}

async function runTests() {
  console.log('🧪 CallVault RAG Tools Functional Test\n');
  console.log('=' + '='.repeat(69));
  
  const token = await getAuthToken();
  
  const serviceSupabase = createClient(supabaseUrl, anonKey);
  await serviceSupabase.auth.setSession({ access_token: token, refresh_token: '' });
  
  // Get real data for targeted tests
  const { data: calls } = await serviceSupabase
    .from('fathom_calls')
    .select('recording_id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  
  const { data: speakers } = await serviceSupabase
    .from('fathom_transcripts')
    .select('speaker_name')
    .not('speaker_name', 'is', null)
    .limit(10);
  
  const uniqueSpeakers = [...new Set(speakers?.map(s => s.speaker_name))].filter(Boolean);
  
  console.log(`📊 Available test data:`);
  console.log(`   - Calls: ${calls?.length || 0} recent`);
  console.log(`   - Speakers: ${uniqueSpeakers.length} unique`);
  if (calls && calls.length > 0) {
    console.log(`   - Sample: "${calls[0].title}" (ID: ${calls[0].recording_id})`);
  }
  if (uniqueSpeakers.length > 0) {
    console.log(`   - Sample speaker: "${uniqueSpeakers[0]}"`);
  }

  const tests = [
    {
      name: '1. searchTranscriptsByQuery - "AI" keyword',
      messages: [{ role: 'user', content: 'What did people say about AI?' }],
    },
    {
      name: `2. searchBySpeaker - "${uniqueSpeakers[0] || 'Unknown'}"`,
      messages: [{ role: 'user', content: `What did ${uniqueSpeakers[0] || 'John'} talk about?` }],
    },
    {
      name: '3. searchByDateRange - Last 7 days',
      messages: [{ role: 'user', content: 'Show me what was discussed in the last week' }],
    },
    {
      name: '4. getAvailableMetadata - speakers list',
      messages: [{ role: 'user', content: 'What speakers do I have?' }],
    },
    {
      name: '5. getAvailableMetadata - categories list',
      messages: [{ role: 'user', content: 'What categories are in my calls?' }],
    },
    {
      name: `6. getCallDetails - Recording ${calls?.[0]?.recording_id || '123'}`,
      messages: [{ role: 'user', content: `Tell me about the call "${calls?.[0]?.title || 'my latest call'}"` }],
    },
    {
      name: '7. getCallsList - Recent calls list',
      messages: [{ role: 'user', content: 'List my recent calls' }],
    },
    {
      name: '8. advancedSearch - Multi-filter query',
      messages: [{ role: 'user', content: 'Find mentions of OpenClaw or AI in recent team calls' }],
    },
    {
      name: '9. searchByIntentSignal - Questions',
      messages: [{ role: 'user', content: 'What questions came up in my calls?' }],
    },
    {
      name: '10. compareCalls - Multiple recordings',
      messages: [{ 
        role: 'user', 
        content: calls && calls.length >= 2 
          ? `Compare recordings ${calls[0].recording_id} and ${calls[1].recording_id}` 
          : 'Compare my last two calls'
      }],
    },
  ];

  const results = {
    working: [] as string[],
    silentlyBroken: [] as string[],
    erroring: [] as string[],
    details: [] as any[],
  };

  for (const test of tests) {
    const result = await testQuery(token, test.messages, test.name);
    
    if (result.success) {
      // Analyze tool results for quality
      let hasError = false;
      let hasEmptyResults = false;
      let hasActualData = false;
      
      if (result.toolResults) {
        for (const tr of result.toolResults) {
          if (tr.result && typeof tr.result === 'object') {
            if (tr.result.error) {
              hasError = true;
            } else if (tr.result.message && !tr.result.results && !tr.result.values && !tr.result.calls && !tr.result.recording_id) {
              hasEmptyResults = true;
            } else if (
              (tr.result.results && tr.result.results.length > 0) ||
              (tr.result.values && tr.result.values.length > 0) ||
              (tr.result.calls && tr.result.calls.length > 0) ||
              tr.result.recording_id
            ) {
              hasActualData = true;
            }
          }
        }
      }
      
      if (hasError) {
        results.erroring.push(test.name);
      } else if (hasEmptyResults && !hasActualData) {
        results.silentlyBroken.push(test.name);
      } else if (hasActualData) {
        results.working.push(test.name);
      } else {
        results.silentlyBroken.push(test.name);
      }
      
      results.details.push({
        test: test.name,
        status: hasActualData ? 'WORKING' : (hasError ? 'ERROR' : 'EMPTY'),
        toolCalls: result.toolCalls?.length || 0,
        hasResults: hasActualData,
      });
    } else {
      results.erroring.push(test.name);
      results.details.push({
        test: test.name,
        status: 'FAIL',
        error: result.error,
      });
    }
    
    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(70));
  console.log(`\n✅ ACTUALLY WORKING (${results.working.length}):`);
  results.working.forEach(t => console.log(`   - ${t}`));
  
  console.log(`\n⚠️  SILENTLY BROKEN (${results.silentlyBroken.length}) - runs but returns empty/useless:` );
  results.silentlyBroken.forEach(t => console.log(`   - ${t}`));
  
  console.log(`\n❌ ERRORING (${results.erroring.length}):`);
  results.erroring.forEach(t => console.log(`   - ${t}`));
  
  console.log(`\n\n🔍 Details:`);
  results.details.forEach(d => {
    const icon = d.status === 'WORKING' ? '✅' : (d.status === 'ERROR' || d.status === 'FAIL' ? '❌' : '⚠️ ');
    console.log(`${icon} ${d.test}`);
    if (d.status !== 'FAIL') {
      console.log(`     Tool calls: ${d.toolCalls}, Has data: ${d.hasResults}`);
    } else {
      console.log(`     Error: ${d.error}`);
    }
  });
}

runTests().catch(console.error);
