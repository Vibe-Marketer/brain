import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// DIRECT OPENAI API IMPLEMENTATION
// The AI SDK has zod bundling issues with esm.sh that cause "safeParseAsync is not a function" errors.
// We bypass the AI SDK entirely and use native fetch with OpenAI API structured outputs.
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

// Metadata schema as JSON Schema for OpenAI structured outputs
const MetadataJsonSchema = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: { type: 'string' },
      description: '1-5 main topics discussed (e.g., "pricing", "product features", "technical objections", "competition")',
    },
    sentiment: {
      type: 'string',
      enum: ['positive', 'negative', 'neutral', 'mixed'],
      description: 'Overall emotional tone of the conversation',
    },
    intent_signals: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['buying_signal', 'objection', 'question', 'feature_request', 'concern', 'testimonial', 'decision'],
      },
      description: 'Detected conversation intents (select all that apply)',
    },
    entities: {
      type: 'object',
      properties: {
        companies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Company names mentioned',
        },
        people: {
          type: 'array',
          items: { type: 'string' },
          description: 'People names mentioned (excluding speakers)',
        },
        products: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product or service names mentioned',
        },
        technologies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Technologies or tools mentioned',
        },
      },
      required: ['companies', 'people', 'products', 'technologies'],
      additionalProperties: false,
    },
  },
  required: ['topics', 'sentiment', 'intent_signals', 'entities'],
  additionalProperties: false,
};

// TypeScript type for extracted metadata
interface ChunkMetadata {
  topics: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  intent_signals: Array<'buying_signal' | 'objection' | 'question' | 'feature_request' | 'concern' | 'testimonial' | 'decision'>;
  entities: {
    companies: string[];
    people: string[];
    products: string[];
    technologies: string[];
  };
}

interface EnrichRequest {
  chunk_ids?: string[];
  recording_ids?: number[];
  auto_discover?: boolean;
}

/**
 * Extract metadata from a transcript chunk using OpenAI GPT-4o-mini with structured outputs
 */
async function extractMetadata(
  openaiApiKey: string,
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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing sales and meeting transcripts. Extract structured metadata accurately and concisely.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'metadata_extraction',
          strict: true,
          schema: MetadataJsonSchema,
        },
      },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  const metadata: ChunkMetadata = JSON.parse(content);

  // Validate topics array length (1-5)
  if (metadata.topics.length === 0) {
    metadata.topics = ['general'];
  } else if (metadata.topics.length > 5) {
    metadata.topics = metadata.topics.slice(0, 5);
  }

  return metadata;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chunk_ids, recording_ids, auto_discover }: EnrichRequest = await req.json();

    // Service-role invocation (from process-embeddings pipeline)
    // When chunk_ids are explicitly provided, we trust the caller (internal edge function)
    // and don't require user authentication - the chunks were just created with valid user_id
    const isServiceRoleCall = chunk_ids && Array.isArray(chunk_ids) && chunk_ids.length > 0;

    let userId: string | null = null;

    // For user-authenticated requests (recording_ids or auto_discover), verify user
    if (!isServiceRoleCall) {
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

      userId = user.id;
    }

    let chunksToProcess: Array<{ id: string; chunk_text: string; speaker_name: string | null }> = [];

    // Determine which chunks to process
    if (isServiceRoleCall) {
      // Service-role call with explicit chunk_ids (from process-embeddings pipeline)
      // Fetch chunks directly by ID - they were just created by a trusted internal caller
      const { data: chunks, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, speaker_name')
        .in('id', chunk_ids!);

      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }

      chunksToProcess = chunks || [];

    } else if (auto_discover && userId) {
      // Find all chunks without metadata (topics is empty)
      const { data: chunks, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, speaker_name')
        .eq('user_id', userId)
        .is('topics', null);

      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }

      chunksToProcess = chunks || [];

    } else if (recording_ids && Array.isArray(recording_ids) && recording_ids.length > 0 && userId) {
      // Get all chunks for specified recordings
      const { data: chunks, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, speaker_name')
        .eq('user_id', userId)
        .in('recording_id', recording_ids);

      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }

      chunksToProcess = chunks || [];

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

    // Process each chunk
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const chunk of chunksToProcess) {
      try {
        // Extract metadata using OpenAI GPT-4o-mini
        const metadata = await extractMetadata(
          openaiApiKey,
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
        }

      } catch (error) {
        failCount++;
        results.push({
          id: chunk.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

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
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
