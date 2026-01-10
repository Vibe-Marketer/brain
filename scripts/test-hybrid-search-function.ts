#!/usr/bin/env node
/**
 * HYBRID SEARCH FUNCTION TEST SCRIPT
 * ===================================
 *
 * Tests that the hybrid_search_transcripts function is accessible
 * via Supabase RPC and has the correct 16-parameter signature.
 *
 * This script verifies:
 * 1. Function exists and is callable (no "function not found" error)
 * 2. Function accepts all 16 parameters including new metadata filters
 * 3. PostgREST schema cache is up-to-date
 *
 * Usage:
 *   npx tsx scripts/test-hybrid-search-function.ts
 *
 * Environment Variables Required:
 *   VITE_SUPABASE_URL or SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (private)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// =============================================
// CONFIGURATION
// =============================================

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================
// TEST RESULTS TRACKING
// =============================================

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

const results: TestResult[] = [];

function logTest(result: TestResult): void {
  results.push(result);
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, result.details);
  }
  console.log('');
}

// =============================================
// TEST 1: Basic Function Call
// =============================================

async function testBasicFunctionCall(): Promise<TestResult> {
  // Create a dummy embedding (all zeros - 1536 dimensions for text-embedding-3-small)
  const dummyEmbedding = new Array(1536).fill(0);

  try {
    const { data, error } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: 'test',
      query_embedding: dummyEmbedding,
      match_count: 5,
    });

    if (error) {
      // Check for the specific "function not found" error
      if (error.message.includes('function') && error.message.includes('not found')) {
        return {
          name: 'Basic Function Call',
          passed: false,
          message: 'CRITICAL: Function not found in schema cache',
          details: error.message,
        };
      }

      // Other errors might be acceptable (e.g., no data, permission issues)
      // but the function at least exists
      return {
        name: 'Basic Function Call',
        passed: false,
        message: `Function call failed: ${error.message}`,
        details: error,
      };
    }

    return {
      name: 'Basic Function Call',
      passed: true,
      message: `Function is callable, returned ${data?.length ?? 0} results`,
      details: { resultCount: data?.length ?? 0 },
    };
  } catch (err) {
    return {
      name: 'Basic Function Call',
      passed: false,
      message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      details: err,
    };
  }
}

// =============================================
// TEST 2: All 16 Parameters
// =============================================

async function testAll16Parameters(): Promise<TestResult> {
  const dummyEmbedding = new Array(1536).fill(0);

  try {
    const { data, error } = await supabase.rpc('hybrid_search_transcripts', {
      // Core parameters (6)
      query_text: 'test query',
      query_embedding: dummyEmbedding,
      match_count: 10,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 60,
      // Original filters (6)
      filter_user_id: null,
      filter_date_start: null,
      filter_date_end: null,
      filter_speakers: null,
      filter_categories: null,
      filter_recording_ids: null,
      // NEW metadata filters (4)
      filter_topics: null,
      filter_sentiment: null,
      filter_intent_signals: null,
      filter_user_tags: null,
    });

    if (error) {
      // Check for parameter-related errors
      if (error.message.includes('filter_intent_signals') ||
          error.message.includes('filter_user_tags') ||
          error.message.includes('filter_topics') ||
          error.message.includes('filter_sentiment')) {
        return {
          name: 'All 16 Parameters',
          passed: false,
          message: 'New metadata filter parameters not recognized',
          details: error.message,
        };
      }

      if (error.message.includes('function') && error.message.includes('not found')) {
        return {
          name: 'All 16 Parameters',
          passed: false,
          message: 'Function with 16 parameters not found (likely old 12/15 param version)',
          details: error.message,
        };
      }

      return {
        name: 'All 16 Parameters',
        passed: false,
        message: `Function call failed: ${error.message}`,
        details: error,
      };
    }

    return {
      name: 'All 16 Parameters',
      passed: true,
      message: 'Function accepts all 16 parameters including new metadata filters',
      details: { resultCount: data?.length ?? 0 },
    };
  } catch (err) {
    return {
      name: 'All 16 Parameters',
      passed: false,
      message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      details: err,
    };
  }
}

// =============================================
// TEST 3: New Metadata Filters
// =============================================

async function testMetadataFilters(): Promise<TestResult> {
  const dummyEmbedding = new Array(1536).fill(0);

  try {
    // Test with actual filter values (not null)
    const { data, error } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: 'test',
      query_embedding: dummyEmbedding,
      match_count: 5,
      // Test new metadata filters with actual values
      filter_topics: ['pricing', 'objections'],
      filter_sentiment: 'positive',
      filter_intent_signals: ['buying_signal', 'objection'],
      filter_user_tags: ['important', 'follow-up'],
    });

    if (error) {
      // Check for type mismatch errors
      if (error.message.includes('type') || error.message.includes('array')) {
        return {
          name: 'Metadata Filter Types',
          passed: false,
          message: 'Filter parameter type mismatch',
          details: error.message,
        };
      }

      return {
        name: 'Metadata Filter Types',
        passed: false,
        message: `Function call with filters failed: ${error.message}`,
        details: error,
      };
    }

    return {
      name: 'Metadata Filter Types',
      passed: true,
      message: 'Function accepts metadata filter values correctly',
      details: { resultCount: data?.length ?? 0 },
    };
  } catch (err) {
    return {
      name: 'Metadata Filter Types',
      passed: false,
      message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      details: err,
    };
  }
}

// =============================================
// TEST 4: Return Type Verification
// =============================================

async function testReturnType(): Promise<TestResult> {
  const dummyEmbedding = new Array(1536).fill(0);

  try {
    const { data, error } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: 'test',
      query_embedding: dummyEmbedding,
      match_count: 1,
    });

    if (error) {
      return {
        name: 'Return Type Verification',
        passed: false,
        message: `Cannot verify return type: ${error.message}`,
        details: error,
      };
    }

    if (!data || data.length === 0) {
      return {
        name: 'Return Type Verification',
        passed: true,
        message: 'No results to verify return type, but function is callable (OK)',
        details: { note: 'Cannot verify return columns without data' },
      };
    }

    const firstResult = data[0];
    const expectedColumns = [
      'chunk_id',
      'recording_id',
      'chunk_text',
      'chunk_index',
      'speaker_name',
      'speaker_email',
      'call_date',
      'call_title',
      'call_category',
      'topics',
      'sentiment',
      'intent_signals',
      'user_tags',
      'entities',
      'similarity_score',
      'fts_rank',
      'rrf_score',
    ];

    const missingColumns = expectedColumns.filter(col => !(col in firstResult));

    if (missingColumns.length > 0) {
      return {
        name: 'Return Type Verification',
        passed: false,
        message: `Missing return columns: ${missingColumns.join(', ')}`,
        details: { missingColumns, actualColumns: Object.keys(firstResult) },
      };
    }

    return {
      name: 'Return Type Verification',
      passed: true,
      message: 'All expected return columns present including user_tags and entities',
      details: { columns: Object.keys(firstResult) },
    };
  } catch (err) {
    return {
      name: 'Return Type Verification',
      passed: false,
      message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      details: err,
    };
  }
}

// =============================================
// TEST 5: get_available_metadata Function
// =============================================

async function testMetadataDiscoveryFunction(): Promise<TestResult> {
  try {
    // Test with a random UUID - function should still work even without matching data
    const { data, error } = await supabase.rpc('get_available_metadata', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_metadata_type: 'topics',
    });

    if (error) {
      if (error.message.includes('function') && error.message.includes('not found')) {
        return {
          name: 'get_available_metadata Function',
          passed: false,
          message: 'Companion function not found - migration may be incomplete',
          details: error.message,
        };
      }

      return {
        name: 'get_available_metadata Function',
        passed: false,
        message: `Function call failed: ${error.message}`,
        details: error,
      };
    }

    return {
      name: 'get_available_metadata Function',
      passed: true,
      message: 'Metadata discovery function is accessible',
      details: { returnedData: data },
    };
  } catch (err) {
    return {
      name: 'get_available_metadata Function',
      passed: false,
      message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      details: err,
    };
  }
}

// =============================================
// MAIN EXECUTION
// =============================================

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         HYBRID SEARCH FUNCTION TEST                                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');
  console.log('═'.repeat(80));
  console.log('RUNNING TESTS');
  console.log('═'.repeat(80));
  console.log('');

  // Run tests sequentially
  logTest(await testBasicFunctionCall());
  logTest(await testAll16Parameters());
  logTest(await testMetadataFilters());
  logTest(await testReturnType());
  logTest(await testMetadataDiscoveryFunction());

  // Summary
  console.log('═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log('');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Tests Failed: ${failed}/${total}`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('');
    console.log('The hybrid_search_transcripts function is correctly deployed and accessible.');
    console.log('PostgREST schema cache is up-to-date.');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('');
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    console.log('');
    console.log('TROUBLESHOOTING:');
    console.log('');
    console.log('1. If function not found in schema cache:');
    console.log('   - Apply migration: supabase/migrations/20260108000004_enhance_chat_tools_metadata_filters.sql');
    console.log('   - Run: NOTIFY pgrst, \'reload schema\';');
    console.log('');
    console.log('2. If parameter not recognized:');
    console.log('   - Migration may be partially applied');
    console.log('   - Drop function and reapply migration');
    console.log('');
    console.log('3. If return type issues:');
    console.log('   - Function signature may be outdated');
    console.log('   - Reapply migration to update return type');
    console.log('');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
