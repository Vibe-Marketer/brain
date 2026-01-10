import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Usage Tracker for embedding and enrichment operations
 *
 * Logs token usage and costs to embedding_usage_logs table for billing/analytics.
 * Designed for fire-and-forget logging that doesn't block main processing.
 */

export type OperationType = 'embedding' | 'enrichment' | 'search' | 'chat';

// Pricing per 1M tokens (in USD)
const PRICING = {
  'text-embedding-3-small': {
    input: 0.02, // $0.02 / 1M tokens
    output: 0,
  },
  'gpt-4o-mini': {
    input: 0.15, // $0.15 / 1M tokens
    output: 0.60, // $0.60 / 1M tokens
  },
} as const;

type SupportedModel = keyof typeof PRICING;

/**
 * Calculate cost in cents from token count
 */
function calculateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number = 0
): number {
  const pricing = PRICING[model as SupportedModel];
  if (!pricing) {
    // Unknown model, return 0 cost
    return 0;
  }

  // Cost per token = price per 1M / 1,000,000
  // Convert to cents = * 100
  const inputCost = (inputTokens / 1_000_000) * pricing.input * 100;
  const outputCost = (outputTokens / 1_000_000) * pricing.output * 100;

  return inputCost + outputCost;
}

export interface UsageLogParams {
  userId: string;
  operationType: OperationType;
  model: string;
  inputTokens: number;
  outputTokens?: number;
  jobId?: string;
  recordingId?: number;
  chunkId?: string;
  sessionId?: string;
  batchSize?: number;
  requestId?: string;
  latencyMs?: number;
  errorMessage?: string;
}

/**
 * Log API usage to embedding_usage_logs table
 *
 * This is designed to be fire-and-forget - errors are logged but don't throw.
 * Usage logging should never block the main processing flow.
 */
export async function logUsage(
  supabase: SupabaseClient,
  params: UsageLogParams
): Promise<void> {
  try {
    const costCents = calculateCostCents(
      params.model,
      params.inputTokens,
      params.outputTokens || 0
    );

    const { error } = await supabase.from('embedding_usage_logs').insert({
      user_id: params.userId,
      operation_type: params.operationType,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens || 0,
      cost_cents: costCents,
      job_id: params.jobId || null,
      recording_id: params.recordingId || null,
      chunk_id: params.chunkId || null,
      session_id: params.sessionId || null,
      batch_size: params.batchSize || 1,
      request_id: params.requestId || null,
      latency_ms: params.latencyMs || null,
      error_message: params.errorMessage || null,
    });

    if (error) {
      // Log error but don't throw - usage tracking shouldn't break main flow
      console.error('Failed to log usage:', error.message);
    }
  } catch (err) {
    // Catch any unexpected errors
    console.error('Usage tracking error:', err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Batch log multiple usage entries efficiently
 *
 * Use this when you have multiple operations to log at once
 * (e.g., after processing a batch of embeddings)
 */
export async function logUsageBatch(
  supabase: SupabaseClient,
  entries: UsageLogParams[]
): Promise<void> {
  if (entries.length === 0) return;

  try {
    const rows = entries.map((params) => ({
      user_id: params.userId,
      operation_type: params.operationType,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens || 0,
      cost_cents: calculateCostCents(
        params.model,
        params.inputTokens,
        params.outputTokens || 0
      ),
      job_id: params.jobId || null,
      recording_id: params.recordingId || null,
      chunk_id: params.chunkId || null,
      session_id: params.sessionId || null,
      batch_size: params.batchSize || 1,
      request_id: params.requestId || null,
      latency_ms: params.latencyMs || null,
      error_message: params.errorMessage || null,
    }));

    const { error } = await supabase.from('embedding_usage_logs').insert(rows);

    if (error) {
      console.error('Failed to log usage batch:', error.message);
    }
  } catch (err) {
    console.error('Usage batch tracking error:', err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Estimate token count for text
 *
 * Simple estimation based on ~4 characters per token for English text.
 * This is a heuristic - actual token counts may vary by model.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
