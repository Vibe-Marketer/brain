import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NTAwNywiZXhwIjoyMDc5NDUxMDA3fQ.a8Lp_JzIk4f4ROiRPBTNGZgnTMQ6Ok5rRuQzkx3stv8';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzUwMDcsImV4cCI6MjA3OTQ1MTAwN30.jkT4qFvOuRnyMexcOfgt1AZSbrRFyDsJfPVsGdA0BUo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Get a test user and their auth token
async function getTestUserToken(): Promise<{ userId: string; token: string }> {
  // Get first user from the database
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error || !users || users.users.length === 0) {
    throw new Error('No users found in database');
  }
  
  const testUser = users.users[0];
  console.log(`Using test user: ${testUser.email} (${testUser.id})`);
  
  // Create a session token for this user
  const { data: session, error: sessionError } = await supabase.auth.admin.createUser({
    email: testUser.email!,
    email_confirm: true,
  });
  
  // Actually, let's use the service role key to impersonate
  return { userId: testUser.id, token: serviceRoleKey };
}

// Test a single query
async function testQuery(token: string, messages: any[], testName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log(`${'='.repeat(60)}`);
  
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
              console.log(`  🔧 Tool called: ${json.toolName}`);
              console.log(`     Args:`, JSON.stringify(json.args, null, 2));
            } else if (json.type === 'tool-result') {
              toolResults.push(json);
              console.log(`  ✓ Tool result for ${json.toolName}:`, 
                typeof json.result === 'string' ? json.result.slice(0, 200) : JSON.stringify(json.result, null, 2).slice(0, 300)
              );
            }
          } catch (e) {
            // Skip parsing errors
          }
        }
      }
    }

    console.log(`\n📝 Final response:\n${fullResponse.slice(0, 500)}${fullResponse.length > 500 ? '...' : ''}\n`);
    
    return {
      success: true,
      response: fullResponse,
      toolCalls,
      toolResults,
    };
    
  } catch (error) {
    console.error('❌ Request failed:', error);
    return { success: false, error };
  }
}

async function runTests() {
  console.log('🚀 Starting RAG Tools Functional Tests\n');
  
  const { userId, token } = await getTestUserToken();
  
  // Get some real data to use in tests
  const { data: sampleCall } = await supabase
    .from('fathom_calls')
    .select('recording_id, title')
    .limit(1)
    .single();
  
  const { data: sampleSpeaker } = await supabase
    .from('fathom_transcripts')
    .select('speaker_name')
    .not('speaker_name', 'is', null)
    .limit(1)
    .single();

  const tests = [
    {
      name: '1. searchTranscriptsByQuery - Search for "AI" mentions',
      messages: [{ role: 'user', content: 'What did people say about AI in my calls?' }],
    },
    {
      name: `2. searchBySpeaker - Search for speaker "${sampleSpeaker?.speaker_name}"`,
      messages: [{ role: 'user', content: `What did ${sampleSpeaker?.speaker_name} say in their calls?` }],
    },
    {
      name: '3. searchByDateRange - Last week',
      messages: [{ role: 'user', content: 'Show me calls from last week' }],
    },
    {
      name: '4. searchByCategory - TEAM category',
      messages: [{ role: 'user', content: 'Show me team meetings' }],
    },
    {
      name: '5. getAvailableMetadata - speakers',
      messages: [{ role: 'user', content: 'What speakers do I have in my calls?' }],
    },
    {
      name: '6. getAvailableMetadata - categories',
      messages: [{ role: 'user', content: 'What categories are available?' }],
    },
    {
      name: `7. getCallDetails - Recording ${sampleCall?.recording_id}`,
      messages: [{ role: 'user', content: `Tell me about recording ${sampleCall?.recording_id}` }],
    },
    {
      name: '8. getCallsList - Recent calls',
      messages: [{ role: 'user', content: 'List my recent calls' }],
    },
    {
      name: '9. advancedSearch - Multi-filter',
      messages: [{ role: 'user', content: 'Find mentions of planning in team meetings from last month' }],
    },
  ];

  const results = {
    passed: 0,
    failed: 0,
    details: [] as any[],
  };

  for (const test of tests) {
    const result = await testQuery(token, test.messages, test.name);
    
    if (result.success) {
      results.passed++;
      results.details.push({
        test: test.name,
        status: 'PASS',
        toolCalls: result.toolCalls?.length || 0,
        hasResults: result.toolResults && result.toolResults.length > 0,
      });
    } else {
      results.failed++;
      results.details.push({
        test: test.name,
        status: 'FAIL',
        error: result.error,
      });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✓ Passed: ${results.passed}/${tests.length}`);
  console.log(`✗ Failed: ${results.failed}/${tests.length}`);
  console.log('\nDetails:');
  results.details.forEach(d => {
    console.log(`  ${d.status === 'PASS' ? '✓' : '✗'} ${d.test}`);
    if (d.status === 'PASS') {
      console.log(`     - Tool calls: ${d.toolCalls}, Has results: ${d.hasResults}`);
    } else {
      console.log(`     - Error: ${d.error}`);
    }
  });
}

runTests().catch(console.error);
