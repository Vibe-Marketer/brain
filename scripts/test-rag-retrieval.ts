#!/usr/bin/env node
/**
 * RAG RETRIEVAL QUALITY TEST SUITE
 * =================================
 *
 * Tests the quality of hybrid search retrieval using:
 * - MRR (Mean Reciprocal Rank): How quickly we find the first relevant result
 * - Precision@K: What percentage of top K results are relevant
 *
 * Usage:
 *   npx tsx scripts/test-rag-retrieval.ts <user_id>
 *
 * Or with npm:
 *   npm run test:rag <user_id>
 *
 * Example:
 *   npx tsx scripts/test-rag-retrieval.ts 550e8400-e29b-41d4-a716-446655440000
 *
 * Environment Variables Required:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (private)
 *   OPENAI_API_KEY - OpenAI API key for embeddings
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// =============================================
// CONFIGURATION
// =============================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================
// TYPE DEFINITIONS
// =============================================

interface TestQuery {
  query: string;
  expectedTopics: string[];  // Topics we expect to find in relevant results
  expectedIntents?: string[];  // Intent signals we expect
  expectedSentiment?: string;  // Expected sentiment (optional)
  description: string;  // Human-readable description
}

interface RetrievalResult {
  chunk_id: string;
  chunk_text: string;
  topics: string[];
  sentiment: string;
  intent_signals: string[];
  rrf_score: number;
  similarity_score: number;
  fts_rank: number;
  recording_id: number;
  speaker_name: string;
  call_title: string;
}

interface QueryTestResult {
  query: string;
  description: string;
  mrr: number;
  precisionAt5: number;
  precisionAt10: number;
  topResults: Array<{
    rank: number;
    isRelevant: boolean;
    snippet: string;
    topics: string[];
    intent: string[];
    rrfScore: number;
  }>;
  totalReturned: number;
  relevantCount: number;
}

interface TestSuiteReport {
  timestamp: string;
  userId: string;
  totalQueries: number;
  metrics: {
    averageMRR: number;
    averagePrecisionAt5: number;
    averagePrecisionAt10: number;
  };
  queryResults: QueryTestResult[];
}

// =============================================
// TEST QUERIES
// =============================================
// Customize these for your meeting transcript use case

const TEST_QUERIES: TestQuery[] = [
  {
    query: "What pricing objections did customers mention?",
    expectedTopics: ["pricing", "cost", "budget", "price", "expensive"],
    expectedIntents: ["objection", "concern"],
    description: "Find pricing-related objections",
  },
  {
    query: "Show me buying signals from prospects",
    expectedTopics: ["decision", "purchase", "timeline", "contract", "deal"],
    expectedIntents: ["buying_signal"],
    expectedSentiment: "positive",
    description: "Find positive buying indicators",
  },
  {
    query: "What questions did customers ask about integrations?",
    expectedTopics: ["integration", "api", "technical", "connect", "sync"],
    expectedIntents: ["question"],
    description: "Find integration-related questions",
  },
  {
    query: "Find positive feedback about the product",
    expectedTopics: ["feedback", "review", "experience", "satisfaction"],
    expectedIntents: ["testimonial"],
    expectedSentiment: "positive",
    description: "Find positive testimonials",
  },
  {
    query: "What feature requests came up in calls?",
    expectedTopics: ["feature", "improvement", "wishlist", "enhancement"],
    expectedIntents: ["feature_request"],
    description: "Find feature requests",
  },
  {
    query: "Show me concerns about data security",
    expectedTopics: ["security", "data", "privacy", "compliance", "encryption"],
    expectedIntents: ["concern", "objection"],
    description: "Find security-related concerns",
  },
  {
    query: "What did customers say about competitor products?",
    expectedTopics: ["competitor", "comparison", "alternative"],
    expectedIntents: ["comparison"],
    description: "Find competitor mentions",
  },
  {
    query: "Find decision makers expressing interest",
    expectedTopics: ["decision", "interest", "evaluate", "consider"],
    expectedIntents: ["buying_signal"],
    description: "Find decision maker interest signals",
  },
  {
    query: "What implementation timeline concerns were raised?",
    expectedTopics: ["timeline", "implementation", "deployment", "onboarding"],
    expectedIntents: ["concern", "question"],
    description: "Find timeline-related concerns",
  },
  {
    query: "Show me technical questions about the API",
    expectedTopics: ["api", "technical", "integration", "endpoint"],
    expectedIntents: ["question"],
    description: "Find API-related technical questions",
  },
];

// =============================================
// RELEVANCE CHECKING
// =============================================

/**
 * Check if a result matches expected criteria
 * Returns true if the result has overlapping topics OR intents OR sentiment
 */
function isRelevant(result: RetrievalResult, testQuery: TestQuery): boolean {
  // Check topic overlap (case-insensitive partial matching)
  const topicMatch = testQuery.expectedTopics.some(expectedTopic =>
    result.topics?.some(actualTopic =>
      actualTopic.toLowerCase().includes(expectedTopic.toLowerCase()) ||
      expectedTopic.toLowerCase().includes(actualTopic.toLowerCase())
    )
  );

  // Check intent overlap (if specified)
  const intentMatch = !testQuery.expectedIntents ||
    testQuery.expectedIntents.some(expectedIntent =>
      result.intent_signals?.some(actualIntent =>
        actualIntent.toLowerCase() === expectedIntent.toLowerCase()
      )
    );

  // Check sentiment match (if specified)
  const sentimentMatch = !testQuery.expectedSentiment ||
    result.sentiment?.toLowerCase() === testQuery.expectedSentiment.toLowerCase();

  // Result is relevant if it matches topics AND (intents OR sentiment)
  // Or if it matches intents AND sentiment (even without topic match)
  return (topicMatch && (intentMatch || sentimentMatch)) ||
         (intentMatch && sentimentMatch);
}

// =============================================
// METRICS CALCULATION
// =============================================

/**
 * Calculate Mean Reciprocal Rank (MRR)
 * Returns 1/rank of first relevant result, or 0 if none found
 */
function calculateMRR(results: RetrievalResult[], testQuery: TestQuery): number {
  for (let i = 0; i < results.length; i++) {
    if (isRelevant(results[i], testQuery)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Calculate Precision@K
 * Returns percentage of top K results that are relevant
 */
function calculatePrecisionAtK(results: RetrievalResult[], testQuery: TestQuery, k: number): number {
  const topK = results.slice(0, k);
  const relevantCount = topK.filter(r => isRelevant(r, testQuery)).length;
  return topK.length > 0 ? relevantCount / topK.length : 0;
}

// =============================================
// EMBEDDING GENERATION
// =============================================

/**
 * Generate embedding using OpenAI text-embedding-3-small
 */
async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[]> {
  // Use OpenAI directly for embeddings (OpenRouter doesn't support embeddings)
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// =============================================
// QUERY TESTING
// =============================================

/**
 * Run retrieval test for a single query
 */
async function testQuery(testQuery: TestQuery, userId: string): Promise<QueryTestResult> {
  console.log(`\n  Query: "${testQuery.query}"`);
  console.log(`  Expected: topics=[${testQuery.expectedTopics.join(', ')}]${
    testQuery.expectedIntents ? `, intents=[${testQuery.expectedIntents.join(', ')}]` : ''
  }${testQuery.expectedSentiment ? `, sentiment=${testQuery.expectedSentiment}` : ''}`);

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(testQuery.query);

    // Call hybrid search
    const { data: results, error } = await supabase.rpc('hybrid_search_transcripts', {
      query_text: testQuery.query,
      query_embedding: queryEmbedding,
      match_count: 10,
      filter_user_id: userId,
    });

    if (error) {
      console.error(`  ERROR: ${error.message}`);
      return {
        query: testQuery.query,
        description: testQuery.description,
        mrr: 0,
        precisionAt5: 0,
        precisionAt10: 0,
        topResults: [],
        totalReturned: 0,
        relevantCount: 0,
      };
    }

    if (!results || results.length === 0) {
      console.log(`  WARNING: No results returned`);
      return {
        query: testQuery.query,
        description: testQuery.description,
        mrr: 0,
        precisionAt5: 0,
        precisionAt10: 0,
        topResults: [],
        totalReturned: 0,
        relevantCount: 0,
      };
    }

    // Calculate metrics
    const mrr = calculateMRR(results, testQuery);
    const precisionAt5 = calculatePrecisionAtK(results, testQuery, 5);
    const precisionAt10 = calculatePrecisionAtK(results, testQuery, 10);
    const relevantCount = results.filter((r: RetrievalResult) => isRelevant(r, testQuery)).length;

    // Format top results
    const topResults = results.slice(0, 5).map((r: RetrievalResult, i: number) => ({
      rank: i + 1,
      isRelevant: isRelevant(r, testQuery),
      snippet: r.chunk_text.substring(0, 120).replace(/\n/g, ' ') + '...',
      topics: r.topics || [],
      intent: r.intent_signals || [],
      rrfScore: r.rrf_score,
    }));

    console.log(`  Results: ${results.length} chunks, ${relevantCount} relevant`);
    console.log(`  MRR: ${mrr.toFixed(3)} | P@5: ${precisionAt5.toFixed(3)} | P@10: ${precisionAt10.toFixed(3)}`);

    return {
      query: testQuery.query,
      description: testQuery.description,
      mrr,
      precisionAt5,
      precisionAt10,
      topResults,
      totalReturned: results.length,
      relevantCount,
    };
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return {
      query: testQuery.query,
      description: testQuery.description,
      mrr: 0,
      precisionAt5: 0,
      precisionAt10: 0,
      topResults: [],
      totalReturned: 0,
      relevantCount: 0,
    };
  }
}

// =============================================
// TEST SUITE EXECUTION
// =============================================

/**
 * Run full test suite
 */
async function runTestSuite(userId: string): Promise<TestSuiteReport> {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         RAG RETRIEVAL QUALITY TEST SUITE                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`User ID: ${userId}`);
  console.log(`Test Queries: ${TEST_QUERIES.length}`);
  console.log('');

  // Verify database connection and chunks exist
  console.log('Checking database connection...');
  const { count, error: countError } = await supabase
    .from('transcript_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    console.error(`ERROR: Failed to connect to database - ${countError.message}`);
    process.exit(1);
  }

  console.log(`Found ${count || 0} transcript chunks for this user\n`);

  if (!count || count === 0) {
    console.error('ERROR: No transcript chunks found for this user');
    console.error('Please run embedding job first to create chunks with embeddings');
    process.exit(1);
  }

  console.log('═'.repeat(80));
  console.log('RUNNING TESTS');
  console.log('═'.repeat(80));

  const results: QueryTestResult[] = [];
  let totalMRR = 0;
  let totalPrecision5 = 0;
  let totalPrecision10 = 0;

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const testQuery = TEST_QUERIES[i];
    console.log(`\n[${i + 1}/${TEST_QUERIES.length}] ${testQuery.description}`);

    const result = await testQuery(testQuery, userId);
    results.push(result);

    totalMRR += result.mrr;
    totalPrecision5 += result.precisionAt5;
    totalPrecision10 += result.precisionAt10;

    // Small delay to avoid rate limits
    if (i < TEST_QUERIES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`Average MRR:         ${(totalMRR / TEST_QUERIES.length).toFixed(3)}`);
  console.log(`Average P@5:         ${(totalPrecision5 / TEST_QUERIES.length).toFixed(3)}`);
  console.log(`Average P@10:        ${(totalPrecision10 / TEST_QUERIES.length).toFixed(3)}`);
  console.log('');
  console.log('INTERPRETATION:');
  console.log('  MRR > 0.8  = Excellent (first relevant result in top 1-2)');
  console.log('  MRR > 0.5  = Good (first relevant result in top 2-3)');
  console.log('  MRR > 0.3  = Fair (first relevant result in top 3-4)');
  console.log('  MRR < 0.3  = Needs improvement');
  console.log('');
  console.log('  P@5 > 0.8  = Excellent quality (80%+ of top 5 relevant)');
  console.log('  P@5 > 0.6  = Good quality (60%+ of top 5 relevant)');
  console.log('  P@5 > 0.4  = Fair quality (40%+ of top 5 relevant)');
  console.log('  P@5 < 0.4  = Needs improvement');
  console.log('');

  // Create report
  const report: TestSuiteReport = {
    timestamp: new Date().toISOString(),
    userId,
    totalQueries: TEST_QUERIES.length,
    metrics: {
      averageMRR: totalMRR / TEST_QUERIES.length,
      averagePrecisionAt5: totalPrecision5 / TEST_QUERIES.length,
      averagePrecisionAt10: totalPrecision10 / TEST_QUERIES.length,
    },
    queryResults: results,
  };

  // Save report to file
  const reportDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportPath = path.join(reportDir, `rag-test-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Full report saved to: ${reportPath}`);
  console.log('');

  return report;
}

// =============================================
// CLI EXECUTION
// =============================================

async function main() {
  const userId = process.argv[2] || process.env.TEST_USER_ID;

  if (!userId) {
    console.error('ERROR: User ID required');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx scripts/test-rag-retrieval.ts <user_id>');
    console.error('');
    console.error('Or set TEST_USER_ID environment variable:');
    console.error('  TEST_USER_ID=your-user-id npm run test:rag');
    process.exit(1);
  }

  try {
    await runTestSuite(userId);
    process.exit(0);
  } catch (error) {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run if called directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

// Export for programmatic use
export { runTestSuite, testQuery, TEST_QUERIES };
