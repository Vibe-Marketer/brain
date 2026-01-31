import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Usage Tracker for embedding and enrichment operations
 *
 * Logs token usage and costs to embedding_usage_logs table for billing/analytics.
 * Designed for fire-and-forget logging that doesn't block main processing.
 */

export type OperationType = 'embedding' | 'enrichment' | 'search' | 'chat';

// Pricing per 1M tokens (in USD)
// Sources: OpenRouter pricing (https://openrouter.ai/models), OpenAI pricing
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI Embeddings
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },

  // OpenAI Chat Models (direct)
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },

  // OpenAI via OpenRouter (same pricing as direct)
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'openai/gpt-4-turbo': { input: 10.00, output: 30.00 },
  'openai/gpt-4.1': { input: 2.00, output: 8.00 },
  'openai/gpt-4.1-mini': { input: 0.40, output: 1.60 },

  // Anthropic via OpenRouter
  'anthropic/claude-3-opus': { input: 15.00, output: 75.00 },
  'anthropic/claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'anthropic/claude-3-sonnet': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'anthropic/claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },

  // Google via OpenRouter
  'google/gemini-pro': { input: 0.50, output: 1.50 },
  'google/gemini-pro-1.5': { input: 1.25, output: 5.00 },
  'google/gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },

  // Chinese models via OpenRouter
  'z-ai/glm-4.6': { input: 0.05, output: 0.05 },

  // DeepSeek models
  'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek/deepseek-coder': { input: 0.14, output: 0.28 },
};

/**
 * Normalize model name to match pricing table
 *
 * Handles various formats:
 * - OpenRouter format: "anthropic/claude-3-haiku" (kept as-is)
 * - Direct format: "gpt-4o-mini" (kept as-is)
 * - Full date suffix: "anthropic/claude-3-haiku-20240307" (kept as-is, has entry)
 */
function normalizeModelName(model: string): string {
  // Model names are stored with their full identifier
  // Just trim whitespace and lowercase for matching
  return model.trim();
}

/**
 * Calculate cost in cents from token count
 */
function calculateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number = 0
): number {
  const normalizedModel = normalizeModelName(model);
  const pricing = PRICING[normalizedModel];

  if (!pricing) {
    // Log warning for unknown models to help identify missing pricing
    console.warn(`[usage-tracker] Unknown model pricing: ${model}. Recording 0 cost.`);
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
