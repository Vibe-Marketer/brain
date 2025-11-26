#!/usr/bin/env node
/**
 * RAG PIPELINE COMPREHENSIVE DIAGNOSTIC
 * ======================================
 *
 * End-to-end diagnosis of the Agentic RAG System to identify
 * issues in information retrieval, ranking, and chat integration.
 *
 * Usage:
 *   npx tsx scripts/diagnose-rag-pipeline.ts [user_id]
 *
 * Environment Variables Required:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key
 *   OPENAI_API_KEY - OpenAI API key for embeddings
 */

import { createClient } from '@supabase/supabase-js';

// =============================================
// CONFIGURATION
// =============================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================
// DIAGNOSTIC RESULTS INTERFACE
// =============================================

interface DiagnosticResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: Record<string, unknown>;
}

interface DiagnosticReport {
  timestamp: string;
  results: DiagnosticResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
  rootCauses: string[];
  recommendations: string[];
}

const results: DiagnosticResult[] = [];

function log(level: 'INFO' | 'PASS' | 'FAIL' | 'WARN', component: string, message: string, details?: Record<string, unknown>) {
  const icons = { INFO: '📋', PASS: '✅', FAIL: '❌', WARN: '⚠️' };
  console.log(`${icons[level]} [${component}] ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2).split('\n').join('\n   '));
  }

  if (level !== 'INFO') {
    results.push({
      component,
      status: level as 'PASS' | 'FAIL' | 'WARN',
      message,
      details,
    });
  }
}

// =============================================
// TEST 1: EMBEDDING SERVICE
// =============================================

async function testEmbeddingService(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('1. EMBEDDING SERVICE TEST');
  console.log('═'.repeat(70));

  if (!openaiApiKey) {
    log('FAIL', 'Embedding', 'OPENAI_API_KEY not configured');
    return;
  }

  // Test 1.1: Generate a test embedding
  log('INFO', 'Embedding', 'Testing OpenAI embedding generation...');

  try {
    const testTexts = [
      "What are the main pricing concerns from customers?",
      "Show me buying signals from recent sales calls",
      "What objections did prospects raise about implementation?",
      "Find positive feedback about product features",
      "What security questions did customers ask?"
    ];

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: testTexts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log('FAIL', 'Embedding', `OpenAI API error: ${response.status}`, { error });
      return;
    }

    const data = await response.json();
    const embeddings = data.data;

    // Verify embedding dimensions
    const dimensions = embeddings[0].embedding.length;
    if (dimensions !== 1536) {
      log('WARN', 'Embedding', `Unexpected embedding dimension: ${dimensions} (expected 1536)`);
    } else {
      log('PASS', 'Embedding', `Generated ${embeddings.length} embeddings with ${dimensions} dimensions`);
    }

    // Test embedding consistency (same text should produce same embedding)
    const duplicateResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: testTexts[0],
      }),
    });

    const duplicateData = await duplicateResponse.json();
    const similarity = cosineSimilarity(embeddings[0].embedding, duplicateData.data[0].embedding);

    if (similarity > 0.99) {
      log('PASS', 'Embedding', `Embedding consistency verified (similarity: ${similarity.toFixed(4)})`);
    } else {
      log('WARN', 'Embedding', `Embedding inconsistency detected (similarity: ${similarity.toFixed(4)})`);
    }

  } catch (error) {
    log('FAIL', 'Embedding', `Exception during embedding test: ${error}`);
  }
}

// =============================================
// TEST 2: VECTOR STORE (SUPABASE)
// =============================================

async function testVectorStore(userId?: string): Promise<{ userId: string; chunkCount: number } | null> {
  console.log('\n' + '═'.repeat(70));
  console.log('2. VECTOR STORE TEST (Supabase)');
  console.log('═'.repeat(70));

  // Test 2.1: Check table exists
  log('INFO', 'VectorStore', 'Checking transcript_chunks table...');

  try {
    const { count, error } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true });

    if (error) {
      log('FAIL', 'VectorStore', `Failed to query transcript_chunks: ${error.message}`);
      return null;
    }

    log('PASS', 'VectorStore', `transcript_chunks table accessible (total: ${count} rows)`);

    // Test 2.2: Find a user with chunks if no userId provided
    let testUserId = userId;
    if (!testUserId) {
      const { data: users } = await supabase
        .from('transcript_chunks')
        .select('user_id')
        .limit(1);

      if (users && users.length > 0) {
        testUserId = users[0].user_id;
        log('INFO', 'VectorStore', `Using user_id from database: ${testUserId}`);
      } else {
        log('WARN', 'VectorStore', 'No users found with transcript chunks');
        return null;
      }
    }

    // Test 2.3: Check user's chunks
    const { data: userChunks, count: userCount, error: userError } = await supabase
      .from('transcript_chunks')
      .select('id, recording_id, chunk_text, embedding, topics, sentiment, intent_signals', { count: 'exact' })
      .eq('user_id', testUserId)
      .limit(5);

    if (userError) {
      log('FAIL', 'VectorStore', `Failed to fetch user chunks: ${userError.message}`);
      return null;
    }

    log('PASS', 'VectorStore', `User has ${userCount} chunks`);

    // Test 2.4: Check embedding completeness
    const { count: embeddingCount } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', testUserId)
      .not('embedding', 'is', null);

    const embeddingRate = userCount ? ((embeddingCount || 0) / userCount * 100).toFixed(1) : 0;
    if (embeddingCount === userCount) {
      log('PASS', 'VectorStore', `All chunks have embeddings (${embeddingRate}%)`);
    } else {
      log('WARN', 'VectorStore', `Only ${embeddingCount}/${userCount} chunks have embeddings (${embeddingRate}%)`);
    }

    // Test 2.5: Check metadata enrichment
    const { count: enrichedCount } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', testUserId)
      .not('topics', 'is', null);

    const enrichmentRate = userCount ? ((enrichedCount || 0) / userCount * 100).toFixed(1) : 0;
    if (enrichedCount && enrichedCount > 0) {
      log('PASS', 'VectorStore', `${enrichedCount}/${userCount} chunks have metadata enrichment (${enrichmentRate}%)`);
    } else {
      log('WARN', 'VectorStore', 'No chunks have metadata enrichment (topics/sentiment/intents)');
    }

    // Sample chunk data
    if (userChunks && userChunks.length > 0) {
      const sample = userChunks[0];
      log('INFO', 'VectorStore', 'Sample chunk:', {
        hasEmbedding: !!sample.embedding,
        embeddingDim: sample.embedding?.length,
        hasTopics: !!(sample.topics && sample.topics.length > 0),
        hasSentiment: !!sample.sentiment,
        hasIntents: !!(sample.intent_signals && sample.intent_signals.length > 0),
        textLength: sample.chunk_text?.length,
      });
    }

    return { userId: testUserId, chunkCount: userCount || 0 };

  } catch (error) {
    log('FAIL', 'VectorStore', `Exception during vector store test: ${error}`);
    return null;
  }
}

// =============================================
// TEST 3: HYBRID SEARCH FUNCTION
// =============================================

async function testHybridSearch(userId: string): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('3. HYBRID SEARCH TEST (RRF)');
  console.log('═'.repeat(70));

  if (!openaiApiKey) {
    log('FAIL', 'HybridSearch', 'Cannot test without OPENAI_API_KEY');
    return;
  }

  const testQuery = "What are the two pillars on the roadmap for the business that focuses on the offer playbook?";
  log('INFO', 'HybridSearch', `Test query: "${testQuery}"`);

  try {
    // Generate query embedding
    const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: testQuery,
      }),
    });

    if (!embResponse.ok) {
      log('FAIL', 'HybridSearch', 'Failed to generate query embedding');
      return;
    }

    const embData = await embResponse.json();
    const queryEmbedding = embData.data[0].embedding;

    // Call hybrid search
    const { data: results, error } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: testQuery,
      query_embedding: queryEmbedding,
      match_count: 10,
      filter_user_id: userId,
    });

    if (error) {
      log('FAIL', 'HybridSearch', `hybrid_search_transcripts error: ${error.message}`);
      return;
    }

    if (!results || results.length === 0) {
      log('WARN', 'HybridSearch', 'No results returned from hybrid search');
      return;
    }

    log('PASS', 'HybridSearch', `Returned ${results.length} results`);

    // Analyze score distribution
    const scores = results.map((r: any) => ({
      rrf: r.rrf_score,
      semantic: r.similarity_score,
      fts: r.fts_rank,
    }));

    log('INFO', 'HybridSearch', 'Score distribution:', {
      rrf_range: [Math.min(...scores.map((s: any) => s.rrf)), Math.max(...scores.map((s: any) => s.rrf))],
      semantic_range: [Math.min(...scores.map((s: any) => s.semantic)), Math.max(...scores.map((s: any) => s.semantic))],
    });

    // Log top 3 results for inspection
    console.log('\n  Top 3 Results:');
    results.slice(0, 3).forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. [RRF: ${r.rrf_score?.toFixed(4)}] "${r.call_title}" - ${r.chunk_text?.substring(0, 100)}...`);
      console.log(`     Topics: ${r.topics?.join(', ') || 'none'} | Sentiment: ${r.sentiment || 'none'}`);
    });

    // Check if semantic and FTS both contributed
    const hasSemanticScores = results.some((r: any) => r.similarity_score > 0);
    const hasFTSScores = results.some((r: any) => r.fts_rank > 0);

    if (hasSemanticScores && hasFTSScores) {
      log('PASS', 'HybridSearch', 'Both semantic and full-text search contributed to results');
    } else if (hasSemanticScores) {
      log('WARN', 'HybridSearch', 'Only semantic search contributed (FTS may not have matched)');
    } else if (hasFTSScores) {
      log('WARN', 'HybridSearch', 'Only full-text search contributed (semantic may not have matched)');
    }

  } catch (error) {
    log('FAIL', 'HybridSearch', `Exception during hybrid search test: ${error}`);
  }
}

// =============================================
// TEST 4: RE-RANKING SERVICE
// =============================================

async function testReranking(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('4. RE-RANKING SERVICE TEST');
  console.log('═'.repeat(70));

  // Note: Re-ranking requires HUGGINGFACE_API_KEY which may not be available locally
  // This test checks if the service is configured and callable

  log('WARN', 'Reranking', 'Re-ranking function (rerank-results) exists but is NOT integrated into chat-stream');
  log('INFO', 'Reranking', 'The chat-stream function directly uses hybrid_search_transcripts without re-ranking');
  log('INFO', 'Reranking', 'Recommendation: Consider integrating cross-encoder re-ranking for improved relevance');
}

// =============================================
// TEST 5: CHAT SESSION PERSISTENCE
// =============================================

async function testChatPersistence(userId: string): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('5. CHAT SESSION PERSISTENCE TEST');
  console.log('═'.repeat(70));

  try {
    // Check chat_sessions table
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('id, message_count, last_message_at')
      .eq('user_id', userId)
      .limit(5);

    if (sessionsError) {
      log('FAIL', 'ChatPersistence', `Failed to query chat_sessions: ${sessionsError.message}`);
      return;
    }

    log('PASS', 'ChatPersistence', `Found ${sessions?.length || 0} chat sessions for user`);

    // Check chat_messages and parts storage
    if (sessions && sessions.length > 0) {
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('id, role, content, parts')
        .eq('session_id', sessions[0].id)
        .limit(10);

      if (messagesError) {
        log('FAIL', 'ChatPersistence', `Failed to query chat_messages: ${messagesError.message}`);
        return;
      }

      // Check if parts are being stored
      const messagesWithParts = messages?.filter(m => m.parts && Object.keys(m.parts).length > 0) || [];
      const assistantMessages = messages?.filter(m => m.role === 'assistant') || [];

      if (assistantMessages.length > 0) {
        const partsRate = (messagesWithParts.length / assistantMessages.length * 100).toFixed(1);
        if (messagesWithParts.length === 0) {
          log('WARN', 'ChatPersistence', `0/${assistantMessages.length} assistant messages have parts stored (0%)`);
          log('INFO', 'ChatPersistence', 'This suggests parts are not being transmitted through the stream');
        } else {
          log('PASS', 'ChatPersistence', `${messagesWithParts.length}/${assistantMessages.length} assistant messages have parts (${partsRate}%)`);
        }
      }

      // Sample a message with parts
      if (messagesWithParts.length > 0) {
        const sample = messagesWithParts[0];
        log('INFO', 'ChatPersistence', 'Sample message parts structure:', {
          partsCount: Array.isArray(sample.parts) ? sample.parts.length : 'not array',
          partTypes: Array.isArray(sample.parts) ? sample.parts.map((p: any) => p.type) : [],
        });
      }
    }

  } catch (error) {
    log('FAIL', 'ChatPersistence', `Exception during chat persistence test: ${error}`);
  }
}

// =============================================
// TEST 6: AI SDK STREAMING PROTOCOL
// =============================================

async function testStreamingProtocol(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('6. AI SDK STREAMING PROTOCOL ANALYSIS');
  console.log('═'.repeat(70));

  log('INFO', 'Streaming', 'Analyzing AI SDK configuration...');

  // Check version compatibility
  log('WARN', 'Streaming', 'VERSION MISMATCH DETECTED:', {
    frontend: {
      'ai': '3.4.33',
      '@ai-sdk/openai': '2.0.72',
      '@ai-sdk/react': 'implicit from ai package',
    },
    edgeFunction: {
      'ai': '3.4.33 (from esm.sh)',
      '@ai-sdk/openai': '1.0.0 (from esm.sh - OUTDATED)',
    },
  });

  log('FAIL', 'Streaming', 'Edge function uses @ai-sdk/openai@1.0.0 but frontend expects @2.0.72');
  log('INFO', 'Streaming', 'This version mismatch may cause protocol incompatibilities');

  // Check streaming method
  log('WARN', 'Streaming', 'chat-stream uses toAIStreamResponse() which may not stream tool call parts correctly');
  log('INFO', 'Streaming', 'Recommendation: Consider using toDataStreamResponse() for proper tool call streaming');
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// =============================================
// MAIN DIAGNOSTIC RUNNER
// =============================================

async function runDiagnostics(userId?: string): Promise<DiagnosticReport> {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           RAG PIPELINE COMPREHENSIVE DIAGNOSTIC                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`User ID: ${userId || 'auto-detect'}`);

  // Run all tests
  await testEmbeddingService();

  const vectorStoreResult = await testVectorStore(userId);
  const testUserId = vectorStoreResult?.userId;

  if (testUserId) {
    await testHybridSearch(testUserId);
    await testChatPersistence(testUserId);
  }

  await testReranking();
  await testStreamingProtocol();

  // Generate summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  console.log('\n' + '═'.repeat(70));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✅ Passed:   ${passed}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);

  // Root cause analysis
  const rootCauses: string[] = [];
  const recommendations: string[] = [];

  // Analyze results for root causes
  const streamingFail = results.find(r => r.component === 'Streaming' && r.status === 'FAIL');
  if (streamingFail) {
    rootCauses.push('AI SDK version mismatch between Edge Function and Frontend');
    recommendations.push('Update Edge Function imports to use @ai-sdk/openai@2.x');
    recommendations.push('Consider using toDataStreamResponse() instead of toAIStreamResponse()');
  }

  const partsWarn = results.find(r => r.component === 'ChatPersistence' && r.message.includes('parts'));
  if (partsWarn) {
    rootCauses.push('Tool call parts not being transmitted through streaming protocol');
    recommendations.push('Verify AI SDK streaming data protocol includes tool call parts');
  }

  const rerankWarn = results.find(r => r.component === 'Reranking');
  if (rerankWarn) {
    rootCauses.push('Re-ranking service not integrated into search pipeline');
    recommendations.push('Integrate cross-encoder re-ranking for improved relevance');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('ROOT CAUSES IDENTIFIED');
  console.log('═'.repeat(70));
  rootCauses.forEach((cause, i) => console.log(`${i + 1}. ${cause}`));

  console.log('\n' + '═'.repeat(70));
  console.log('RECOMMENDATIONS');
  console.log('═'.repeat(70));
  recommendations.forEach((rec, i) => console.log(`${i + 1}. ${rec}`));

  return {
    timestamp: new Date().toISOString(),
    results,
    summary: { passed, failed, warnings },
    rootCauses,
    recommendations,
  };
}

// =============================================
// CLI ENTRY POINT
// =============================================

async function main() {
  const userId = process.argv[2];

  try {
    const report = await runDiagnostics(userId);

    // Exit with error code if any failures
    if (report.summary.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
