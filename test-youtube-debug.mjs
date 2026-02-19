import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdG1ybmpzdWJmenJncnRkcWV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzUwMDcsImV4cCI6MjA3OTQ1MTAwN30.jkT4qFvOuRnyMexcOfgt1AZSbrRFyDsJfPVsGdA0BUo';

async function debugYouTubeImport() {
  console.log('=== YouTube Import Debug Test ===\n');
  
  // Test video URLs
  const testCases = [
    { name: 'Standard URL', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { name: 'Short URL', url: 'https://youtu.be/dQw4w9WgXcQ' },
    { name: 'Direct ID', url: 'dQw4w9WgXcQ' },
  ];
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Step 1: Check authentication
  console.log('Step 1: Checking authentication...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('❌ Authentication failed:', authError?.message || 'No user');
    console.log('\nℹ️  You need to be logged in to test YouTube import');
    console.log('   Run this test from the browser console while logged in, or');
    console.log('   Authenticate first using supabase.auth.signInWithPassword()');
    return;
  }
  
  console.log('✅ Authenticated as:', user.email);
  console.log('   User ID:', user.id, '\n');
  
  // Step 2: Test each URL format
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    console.log('---');
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('youtube-import', {
        body: { videoUrl: testCase.url },
      });
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error('❌ Error:', error);
        console.log('   Duration:', duration + 'ms');
      } else if (data) {
        console.log('✅ Success!');
        console.log('   Step:', data.step);
        console.log('   Recording ID:', data.recordingId);
        console.log('   Title:', data.title);
        console.log('   Duration:', duration + 'ms');
        
        if (data.exists) {
          console.log('   ℹ️  Video already imported');
        }
      } else {
        console.log('⚠️  No data returned');
      }
    } catch (err) {
      console.error('❌ Exception:', err.message);
      console.error('   Full error:', err);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

debugYouTubeImport().catch(console.error);
