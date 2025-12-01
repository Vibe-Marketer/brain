/**
 * Get Available Models Edge Function
 * Fetches available models from Vercel AI Gateway API directly
 *
 * API Reference: https://vercel.com/docs/ai-gateway/models-and-providers
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI Gateway API base URL
const AI_GATEWAY_API_URL = 'https://ai-gateway.vercel.sh/v1/ai';

interface GatewayModel {
  id: string;
  name?: string;
  description?: string;
  modelType?: 'language' | 'embedding';
  pricing?: {
    input?: number;
    output?: number;
    cachedInputTokens?: number;
    cacheCreationInputTokens?: number;
  };
}

interface GatewayModelsResponse {
  models: GatewayModel[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const aiGatewayApiKey = Deno.env.get('VERCEL_AI_GATEWAY_API_KEY') || Deno.env.get('AI_GATEWAY_API_KEY');

    if (!aiGatewayApiKey) {
      console.log('No AI Gateway API key configured');
      return new Response(
        JSON.stringify({
          error: 'AI Gateway API key not configured',
          models: [],
          providers: [],
          defaultModel: null,
          hasGateway: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch available models from AI Gateway
    // The AI Gateway provides a /models endpoint to list available models
    const response = await fetch(`${AI_GATEWAY_API_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${aiGatewayApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway models fetch failed:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data: GatewayModelsResponse = await response.json();

    // Filter to only language models (not embedding models)
    const languageModels = data.models
      .filter((m) => m.modelType === 'language' || !m.modelType)
      .map((m) => ({
        id: m.id, // Format: 'creator/model-name' e.g., 'openai/gpt-4o'
        name: m.name || m.id.split('/')[1] || m.id,
        provider: m.id.split('/')[0], // Extract provider from id
        description: m.description || '',
        pricing: m.pricing,
      }));

    // Get unique providers
    const providers = [...new Set(languageModels.map((m) => m.provider))];

    // Default to gpt-4o if available, otherwise first model
    const defaultModel = languageModels.find((m) => m.id === 'openai/gpt-4o')?.id
      || languageModels[0]?.id
      || null;

    console.log(`Fetched ${languageModels.length} models from AI Gateway`);

    return new Response(
      JSON.stringify({
        models: languageModels,
        providers,
        defaultModel,
        hasGateway: true,
        totalCount: languageModels.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error getting available models:', error);

    // Return fallback models if gateway fails
    const fallbackModels = [
      { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable, multimodal' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Fast and efficient' },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', description: 'Latest Anthropic model' },
      { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Balanced speed & quality' },
      { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', description: 'Fast multimodal' },
    ];

    return new Response(
      JSON.stringify({
        models: fallbackModels,
        providers: ['openai', 'anthropic', 'google'],
        defaultModel: 'openai/gpt-4o',
        hasGateway: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models from AI Gateway',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
