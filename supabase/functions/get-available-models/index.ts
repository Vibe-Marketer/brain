/**
 * Get Available Models Edge Function
 * Fetches available models from OpenRouter API
 *
 * OpenRouter provides a unified API to 300+ models from leading providers:
 * - OpenAI: GPT-4o, GPT-4.1, o1, o3
 * - Anthropic: Claude 4 Opus/Sonnet, Claude 3.5 Sonnet/Haiku
 * - Google: Gemini 2.0/1.5 Flash/Pro
 * - xAI: Grok 3/2
 * - Meta: Llama 3.3/3.1
 * - Mistral: Large, Medium, Small
 * - DeepSeek: DeepSeek V3, R1
 * - And many more...
 *
 * API Reference: https://openrouter.ai/docs/api-reference/models/get-models
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OpenRouter API endpoint
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// Provider display names and colors for the UI
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  'z-ai': 'Z.AI',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'google': 'Google',
  'xai': 'xAI',
  'meta-llama': 'Meta',
  'mistralai': 'Mistral',
  'deepseek': 'DeepSeek',
  'perplexity': 'Perplexity',
  'cohere': 'Cohere',
  'qwen': 'Qwen',
  'nvidia': 'NVIDIA',
  'microsoft': 'Microsoft',
};

// Provider order for display (preferred providers first)
const PROVIDER_ORDER = [
  'openai',     // OpenAI first - GPT-4.1 series is default
  'anthropic',
  'google',
  'xai',
  'z-ai',
  'meta-llama',
  'mistralai',
  'deepseek',
  'perplexity',
  'cohere',
  'qwen',
  'nvidia',
  'microsoft',
];

// Featured models to prioritize (show at top of each provider section)
const FEATURED_MODELS = new Set([
  // OpenAI GPT-4.1 series (newest, most economical)
  'openai/gpt-4.1-nano',  // Fastest/cheapest - default for chat
  'openai/gpt-4.1-mini',  // Mid-tier, great performance
  'openai/gpt-4.1',       // Full GPT-4.1
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o1',
  'openai/o1-mini',
  'openai/o3-mini',
  // Anthropic
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-haiku',
  // Google
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-pro-preview',
  'google/gemini-1.5-pro',
  'google/gemini-1.5-flash',
  // xAI
  'xai/grok-3-beta',
  'xai/grok-2-1212',
  // Z.AI
  'z-ai/glm-4.6',
  // Meta
  'meta-llama/llama-3.3-70b-instruct',
  'meta-llama/llama-3.1-405b-instruct',
  // DeepSeek
  'deepseek/deepseek-chat-v3-0324',
  'deepseek/deepseek-r1',
  // Mistral
  'mistralai/mistral-large-2411',
  'mistralai/codestral-2501',
]);

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

    if (!openrouterApiKey) {
      console.log('No OpenRouter API key configured');
      return new Response(
        JSON.stringify({
          error: 'OpenRouter API key not configured',
          models: [],
          providers: [],
          defaultModel: null,
          hasOpenRouter: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch available models from OpenRouter
    const response = await fetch(`${OPENROUTER_API_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter models fetch failed:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data: OpenRouterModelsResponse = await response.json();

    // Filter to only text-to-text models (language models, not image/audio)
    const languageModels = data.data
      .filter((m) => {
        // Exclude embedding models
        if (m.id.includes('embed')) return false;
        // Exclude image generation models
        if (m.id.includes('dall-e') || m.id.includes('midjourney') || m.id.includes('stable-diffusion')) return false;
        // Exclude audio/speech models
        if (m.id.includes('whisper') || m.id.includes('tts')) return false;
        // Include text models
        const modality = m.architecture?.modality || 'text->text';
        return modality === 'text->text' || modality.includes('text');
      })
      .map((m) => {
        // Extract provider from model ID (format: provider/model-name)
        const provider = m.id.split('/')[0];

        // Calculate pricing per 1M tokens
        const promptPrice = parseFloat(m.pricing.prompt) * 1000000;
        const completionPrice = parseFloat(m.pricing.completion) * 1000000;

        return {
          id: m.id,
          name: m.name || m.id.split('/')[1] || m.id,
          provider: provider,
          providerDisplayName: PROVIDER_DISPLAY_NAMES[provider] || provider,
          // Don't send long descriptions - just use model name in dropdown
          contextLength: m.context_length,
          pricing: {
            prompt: promptPrice,
            completion: completionPrice,
          },
          isFeatured: FEATURED_MODELS.has(m.id),
        };
      });

    // Sort models: featured first within each provider, then by name
    languageModels.sort((a, b) => {
      // Featured models first
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      // Then alphabetically by name
      return a.name.localeCompare(b.name);
    });

    // Get unique providers and sort by preferred order
    const providersSet = new Set(languageModels.map((m) => m.provider));
    const providers = PROVIDER_ORDER.filter((p) => providersSet.has(p));
    // Add any providers not in our preferred list at the end
    for (const p of providersSet) {
      if (!providers.includes(p)) {
        providers.push(p);
      }
    }

    // Default to GPT-4.1-nano (fastest/cheapest) if available, otherwise first featured model
    const defaultModel = languageModels.find((m) => m.id === 'openai/gpt-4.1-nano')?.id
      || languageModels.find((m) => m.id === 'openai/gpt-4.1-mini')?.id
      || languageModels.find((m) => m.id === 'openai/gpt-4o-mini')?.id
      || languageModels.find((m) => m.isFeatured)?.id
      || languageModels[0]?.id
      || null;

    console.log(`Fetched ${languageModels.length} models from OpenRouter across ${providers.length} providers`);

    return new Response(
      JSON.stringify({
        models: languageModels,
        providers,
        providerDisplayNames: PROVIDER_DISPLAY_NAMES,
        defaultModel,
        hasOpenRouter: true,
        totalCount: languageModels.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error getting available models:', error);

    // Return fallback models if OpenRouter fails
    const fallbackModels = [
      { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', providerDisplayName: 'OpenAI', isFeatured: true },
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'openai', providerDisplayName: 'OpenAI', isFeatured: true },
      { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', providerDisplayName: 'OpenAI', isFeatured: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', providerDisplayName: 'OpenAI', isFeatured: true },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', providerDisplayName: 'Anthropic', isFeatured: true },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', providerDisplayName: 'Anthropic', isFeatured: true },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'google', providerDisplayName: 'Google', isFeatured: true },
      { id: 'xai/grok-3-beta', name: 'Grok 3', provider: 'xai', providerDisplayName: 'xAI', isFeatured: true },
      { id: 'z-ai/glm-4.6', name: 'GLM-4.6', provider: 'z-ai', providerDisplayName: 'Z.AI', isFeatured: true },
    ];

    return new Response(
      JSON.stringify({
        models: fallbackModels,
        providers: ['openai', 'anthropic', 'google', 'xai', 'z-ai'],
        providerDisplayNames: PROVIDER_DISPLAY_NAMES,
        defaultModel: 'openai/gpt-4.1-nano',
        hasOpenRouter: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models from OpenRouter',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
