import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NTAwNywiZXhwIjoyMDc5NDUxMDA3fQ.a8Lp_JzIk4f4ROiRPBTNGZgnTMQ6Ok5rRuQzkx3stv8';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzUwMDcsImV4cCI6MjA3OTQ1MTAwN30.jkT4qFvOuRnyMexcOfgt1AZSbrRFyDsJfPVsGdA0BUo';

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Test target user - a@vibeos.com has the most data (1207 calls)
const TEST_USER_EMAIL = 'a@vibeos.com';
const TEST_USER_ID = 'ad6cdef0-8dc0-4ad5-bfe7-f0e1bce01be4';

async function getAuthToken(): Promise<string> {
  // Use service role to directly create a session
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_USER_EMAIL,
  });
  
  if (error) throw new Error(`Failed to generate auth: ${error.message}`);
  
  // Extract token from the link
  const url = new URL(data.properties.action_link);
  const token = url.searchParams.get('token');
  
  if (!token) throw new Error('No token in magic link');
  
  // Verify the token by exchanging it for a session
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: sessionData, error: sessionError } = await anonClient.auth.verifyOtp({
    token_hash: token,
    type: 'magiclink',
  });
  
  if (sessionError || !sessionData.session) {
    throw new Error(`Session verification failed: ${sessionError?.message}`);
  }
  
  console.log(`✅ Authenticated as: ${sessionData.user.email}\n`);
  return sessionData.session.access_token;
}

async function testTool(token: string, query: string, testName: string) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🧪 ${testName}`);
  console.log(`${'─'.repeat(70)}`);
  console.log(`Query: "${query}"`);
  
  const result = { 
    toolsCalled: [] as string[], 
    hasData: false, 
    hasError: false, 
    message: '',
    responseLength: 0 
  };
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat-stream-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: query }],
        model: 'openai/gpt-4o-mini',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      result.hasError = true;
      result.message = `HTTP ${response.status}: ${error}`;
      console.log(`❌ ${result.message}`);
      return result;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      result.hasError = true;
      result.message = 'No response body';
      return result;
    }

    let fullResponse = '';
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim() || !line.startsWith('0:')) continue;
        
        try {
          const json = JSON.parse(line.slice(2));
          
          if (json.type === 'text-delta') {
            fullResponse += json.textDelta;
          } else if (json.type === 'tool-call') {
            result.toolsCalled.push(json.toolName);
            console.log(`  🔧 ${json.toolName}(${JSON.stringify(json.args).slice(0, 80)}...)`);
          } else if (json.type === 'tool-result') {
            const res = json.result;
            
            if (res?.error) {
              result.hasError = true;
              console.log(`  ❌ ERROR: ${res.message || res.error}`);
            } else if (res?.message && !res.results && !res.values && !res.calls && !res.recording_id) {
              console.log(`  ⚠️  NO DATA: ${res.message}`);
            } else {
              const count = 
                res.results?.length ||
                res.values?.length || 
                res.calls?.length ||
                (res.recording_id ? 1 : 0);
              
              if (count > 0) {
                result.hasData = true;
                console.log(`  ✅ Got ${count} result(s)`);
                
                // Show first result preview
                if (res.results?.[0]) {
                  console.log(`     Preview: "${res.results[0].text?.slice(0, 100) || res.results[0].call_title || 'N/A'}..."`);
                } else if (res.values?.[0]) {
                  console.log(`     Values: ${res.values.slice(0, 5).join(', ')}${res.values.length > 5 ? '...' : ''}`);
                } else if (res.calls?.[0]) {
                  console.log(`     First call: "${res.calls[0].title}"`);
                } else if (res.recording_id) {
                  console.log(`     Call: "${res.title}"`);
                }
              } else {
                console.log(`  ⚠️  Empty result object`);
              }
            }
          }
        } catch (e) {
          // Skip parse errors
        }
      }
    }

    result.responseLength = fullResponse.length;
    result.message = fullResponse.slice(0, 300) + (fullResponse.length > 300 ? '...' : '');
    
    console.log(`\n📝 Response (${fullResponse.length} chars): "${result.message}"`);
    
    return result;
    
  } catch (error) {
    result.hasError = true;
    result.message = String(error);
    console.error(`❌ ${error}`);
    return result;
  }
}

async function runAllTests() {
  console.log('\n🚀 CallVault RAG FUNCTIONAL TEST SUITE');
  console.log('='.repeat(70));
  
  const token = await getAuthToken();
  
  // Get test data for targeted queries
  const { data: recentCall } = await adminClient
    .from('fathom_calls')
    .select('recording_id, title, created_at')
    .eq('user_id', TEST_USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const { data: speakers } = await adminClient
    .from('fathom_transcripts')
    .select('speaker_name')
    .eq('user_id', TEST_USER_ID)
    .not('speaker_name', 'is', null)
    .limit(20);
  
  const uniqueSpeakers = [...new Set(speakers?.map(s => s.speaker_name))];
  const testSpeaker = uniqueSpeakers[0] || 'Andrew';
  
  console.log(`\n📊 Test Data Available:`);
  console.log(`   - Recent call: "${recentCall?.title}" (ID: ${recentCall?.recording_id})`);
  console.log(`   - Test speaker: "${testSpeaker}"`);
  console.log(`   - Unique speakers: ${uniqueSpeakers.length}`);

  const tests = [
    { name: '1️⃣  searchTranscriptsByQuery', query: 'What did people say about AI or automation?' },
    { name: '2️⃣  searchBySpeaker', query: `What topics did ${testSpeaker} discuss?` },
    { name: '3️⃣  searchByDateRange', query: 'What was discussed in calls from the last 7 days?' },
    { name: '4️⃣  searchByCategory', query: 'Show me team meetings' },
    { name: '5️⃣  searchByIntentSignal', query: 'What objections or concerns came up?' },
    { name: '6️⃣  searchBySentiment', query: 'Find positive feedback or happy moments' },
    { name: '7️⃣  getCallDetails', query: `Tell me about recording ${recentCall?.recording_id}` },
    { name: '8️⃣  getCallsList', query: 'List my 5 most recent calls' },
    { name: '9️⃣  getAvailableMetadata (speakers)', query: 'What speakers do I have?' },
    { name: '🔟 getAvailableMetadata (categories)', query: 'What categories are in my calls?' },
    { name: '1️⃣1️⃣  advancedSearch', query: 'Find mentions of OpenClaw or agent in recent calls from the last month' },
  ];

  const summary = {
    working: [] as string[],
    broken: [] as string[],
    erroring: [] as string[],
  };

  for (const test of tests) {
    const result = await testTool(token, test.query, test.name);
    
    if (result.hasError) {
      summary.erroring.push(test.name);
    } else if (!result.hasData && result.toolsCalled.length > 0) {
      summary.broken.push(test.name);
    } else if (result.hasData) {
      summary.working.push(test.name);
    } else {
      summary.broken.push(test.name);
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n\n' + '='.repeat(70));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(70));
  
  console.log(`\n✅ ACTUALLY WORKING (${summary.working.length}/${tests.length}):`);
  summary.working.forEach(t => console.log(`   ${t}`));
  
  console.log(`\n⚠️  SILENTLY BROKEN (${summary.broken.length}/${tests.length}) - no errors but no data:`);
  summary.broken.forEach(t => console.log(`   ${t}`));
  
  console.log(`\n❌ ERRORING (${summary.erroring.length}/${tests.length}):`);
  summary.erroring.forEach(t => console.log(`   ${t}`));
  
  console.log('\n' + '='.repeat(70));
}

runAllTests().catch(console.error);
