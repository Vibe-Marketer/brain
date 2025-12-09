import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';

// ============================================================================
// OPENROUTER CONFIGURATION
// All models routed through OpenRouter for unified access
// Using official @openrouter/ai-sdk-provider for AI SDK v5 compatibility
// ============================================================================

function createOpenRouterProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

interface ModelConfig {
  model: string; // OpenRouter format: 'provider/model-name'
  temperature?: number;
}

// Default model configuration - GLM-4.6 for best quality metadata extraction
const DEFAULT_MODEL: ModelConfig = {
  model: 'z-ai/glm-4.6',
  temperature: 0.3,
};

// Model presets for different use cases (OpenRouter format)
const MODEL_PRESETS: Record<string, ModelConfig> = {
  // Fast & cheap (default)
  'fast': { model: 'openai/gpt-4o-mini', temperature: 0.3 },
  'cheap': { model: 'openai/gpt-4o-mini', temperature: 0.3 },

  // High quality
  'quality': { model: 'openai/gpt-4o', temperature: 0.3 },
  'best': { model: 'anthropic/claude-3.5-sonnet', temperature: 0.3 },

  // Balanced
  'balanced': { model: 'google/gemini-1.5-flash', temperature: 0.3 },

  // Specific providers
  'openai': { model: 'openai/gpt-4o', temperature: 0.3 },
  'anthropic': { model: 'anthropic/claude-3.5-haiku', temperature: 0.3 },
  'google': { model: 'google/gemini-1.5-flash', temperature: 0.3 },
};

/**
 * Get a model instance via OpenRouter
 */
function getModel(config: ModelConfig) {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
  const openrouter = createOpenRouterProvider(apiKey);
  return openrouter(config.model);
}


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

// Metadata schema for structured output using Zod
const MetadataSchema = z.object({
  topics: z.array(z.string())
    .min(1)
    .max(5)
    .describe('1-5 main topics discussed (e.g., "pricing", "product features", "technical objections", "competition")'),

  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed'])
    .describe('Overall emotional tone of the conversation'),

  intent_signals: z.array(
    z.enum([
      'buying_signal',
      'objection',
      'question',
      'feature_request',
      'concern',
      'testimonial',
      'decision'
    ])
  ).describe('Detected conversation intents (select all that apply)'),

  entities: z.object({
    companies: z.array(z.string()).describe('Company names mentioned'),
    people: z.array(z.string()).describe('People names mentioned (excluding speakers)'),
    products: z.array(z.string()).describe('Product or service names mentioned'),
    technologies: z.array(z.string()).describe('Technologies or tools mentioned'),
  }).describe('Named entities extracted from the conversation'),
});

type ChunkMetadata = z.infer<typeof MetadataSchema>;

interface EnrichRequest {
  chunk_ids?: string[];
  recording_ids?: number[];
  auto_discover?: boolean;
  // Model selection - use preset name or custom config
  model_preset?: string;  // 'fast', 'quality', 'best', 'openai', 'anthropic', 'google'
  model_config?: ModelConfig;  // Or provide full config
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // API keys are checked in getModel() based on selected provider

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { chunk_ids, recording_ids, auto_discover, model_preset, model_config }: EnrichRequest = await req.json();

    // Resolve model configuration
    // Priority: model_config > model_preset > DEFAULT_MODEL
    let selectedModel: ModelConfig;
    if (model_config) {
      selectedModel = model_config;
    } else if (model_preset && MODEL_PRESETS[model_preset]) {
      selectedModel = MODEL_PRESETS[model_preset];
    } else {
      selectedModel = DEFAULT_MODEL;
    }

    console.log(`Using model: ${selectedModel.model}`);

    let chunksToProcess: Array<{ id: string; chunk_text: string; speaker_name: string | null }> = [];

    // Determine which chunks to process
    if (auto_discover) {
      // Find all chunks without metadata (topics is empty)
      console.log(`Auto-discovering chunks without metadata for user ${user.id}`);

      const { data: chunks, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, speaker_name')
        .eq('user_id', user.id)
        .is('topics', null);

      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }

      chunksToProcess = chunks || [];
      console.log(`Found ${chunksToProcess.length} chunks without metadata`);

    } else if (recording_ids && Array.isArray(recording_ids) && recording_ids.length > 0) {
      // Get all chunks for specified recordings
      const { data: chunks, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, speaker_name')
        .eq('user_id', user.id)
        .in('recording_id', recording_ids);

      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }

      chunksToProcess = chunks || [];
      console.log(`Found ${chunksToProcess.length} chunks for ${recording_ids.length} recordings`);

    } else if (chunk_ids && Array.isArray(chunk_ids) && chunk_ids.length > 0) {
      // Get specific chunks by ID
      const { data: chunks, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, speaker_name')
        .eq('user_id', user.id)
        .in('id', chunk_ids);

      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }

      chunksToProcess = chunks || [];
      console.log(`Found ${chunksToProcess.length} chunks from provided IDs`);

    } else {
      return new Response(
        JSON.stringify({ error: 'Either chunk_ids, recording_ids, or auto_discover=true is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (chunksToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No chunks to process',
          processed: 0,
          successful: 0,
          failed: 0,
          results: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${chunksToProcess.length} chunks for metadata extraction`);

    // Get the model instance using Vercel AI SDK
    const model = getModel(selectedModel);

    // Process each chunk
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const chunk of chunksToProcess) {
      try {
        console.log(`Extracting metadata for chunk ${chunk.id}...`);

        // Extract metadata using selected model
        const metadata = await extractMetadata(
          model,
          selectedModel.temperature ?? 0.3,
          chunk.chunk_text,
          chunk.speaker_name
        );

        // Update database with extracted metadata
        const { error: updateError } = await supabase
          .from('transcript_chunks')
          .update({
            topics: metadata.topics,
            sentiment: metadata.sentiment,
            intent_signals: metadata.intent_signals,
            entities: metadata.entities,
            updated_at: new Date().toISOString(),
          })
          .eq('id', chunk.id);

        if (updateError) {
          console.error(`Error updating chunk ${chunk.id}:`, updateError);
          failCount++;
          results.push({
            id: chunk.id,
            success: false,
            error: updateError.message,
          });
        } else {
          successCount++;
          results.push({
            id: chunk.id,
            success: true,
            metadata,
          });
          console.log(`Successfully enriched chunk ${chunk.id}`);
        }

      } catch (error) {
        console.error(`Error processing chunk ${chunk.id}:`, error);
        failCount++;
        results.push({
          id: chunk.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Metadata extraction complete: ${successCount} successful, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: chunksToProcess.length,
        successful: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enrich chunk metadata error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Extract metadata from a transcript chunk using OpenRouter via AI SDK v5
 * All models routed through OpenRouter for unified access
 */
async function extractMetadata(
  model: ReturnType<ReturnType<typeof createOpenRouter>>,  // OpenRouter AI SDK model instance
  temperature: number,
  chunkText: string,
  speakerName: string | null
): Promise<ChunkMetadata> {
  const prompt = `Analyze this sales/meeting transcript excerpt and extract structured metadata.

${speakerName ? `Speaker: ${speakerName}` : 'Speaker: Unknown'}

Transcript:
${chunkText}

Extract the following information:

1. **Topics** (1-5 main topics): What subjects are being discussed? Use concise labels like "pricing", "technical integration", "competitor comparison", "timeline concerns", etc.

2. **Sentiment** (positive, negative, neutral, mixed): What is the overall emotional tone?
   - Positive: enthusiastic, agreement, excitement
   - Negative: frustration, disagreement, concern
   - Neutral: factual, informational
   - Mixed: combination of positive and negative

3. **Intent signals**: What conversational intents are present?
   - buying_signal: expressions of interest in purchasing or moving forward
   - objection: concerns or pushback about the product/service
   - question: requests for information or clarification
   - feature_request: requests for specific capabilities
   - concern: worries about implementation, cost, etc.
   - testimonial: positive feedback or success stories
   - decision: mentions of decision-making or next steps

4. **Entities**: Extract named entities:
   - companies: Any company or organization names
   - people: Any person names (excluding the speakers themselves)
   - products: Product or service names mentioned
   - technologies: Technologies, tools, or platforms mentioned

Be precise and only extract information that is clearly present in the text.`;

  const result = await generateObject({
    model,  // Any Vercel AI SDK model works here!
    schema: MetadataSchema,
    prompt,
    temperature,
  });

  return result.object;
}
