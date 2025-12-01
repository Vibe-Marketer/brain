/**
 * Get Available Models Edge Function
 * Returns available AI models for the chat interface
 *
 * Supports all models available through Vercel AI SDK providers:
 * - OpenAI: GPT-4o, GPT-4o-mini, GPT-4.1, o1, o3
 * - Anthropic: Claude 4 Sonnet, Claude 3.5 Sonnet/Haiku
 * - Google: Gemini 2.0/1.5 Flash/Pro
 * - xAI: Grok 3/2
 * - Groq: Llama, Mixtral (fast inference)
 * - Mistral: Large, Medium, Small
 * - DeepSeek: DeepSeek V3, R1
 * - Perplexity: Sonar models
 *
 * API Reference: https://sdk.vercel.ai/providers/ai-sdk-providers
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive model list based on Vercel AI SDK supported providers
// Models are grouped by provider and ordered by capability
const AVAILABLE_MODELS = [
  // OpenAI Models
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'openai', description: 'Latest flagship model' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable, multimodal' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Fast and efficient' },
  { id: 'openai/o1', name: 'o1', provider: 'openai', description: 'Advanced reasoning' },
  { id: 'openai/o1-mini', name: 'o1 Mini', provider: 'openai', description: 'Fast reasoning' },
  { id: 'openai/o3-mini', name: 'o3 Mini', provider: 'openai', description: 'Latest reasoning model' },

  // Anthropic Models
  { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', description: 'Latest Claude model' },
  { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Balanced quality & speed' },
  { id: 'anthropic/claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', description: 'Fast and affordable' },
  { id: 'anthropic/claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', description: 'Most capable Claude 3' },

  // Google Models
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', description: 'Fast multimodal' },
  { id: 'google/gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Thinking', provider: 'google', description: 'Reasoning model' },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', description: 'Best for complex tasks' },
  { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', description: 'Fast and efficient' },

  // xAI Models (Grok)
  { id: 'xai/grok-3', name: 'Grok 3', provider: 'xai', description: 'Latest xAI model' },
  { id: 'xai/grok-3-fast', name: 'Grok 3 Fast', provider: 'xai', description: 'Faster Grok 3' },
  { id: 'xai/grok-2-1212', name: 'Grok 2', provider: 'xai', description: 'Powerful reasoning' },
  { id: 'xai/grok-2-vision-1212', name: 'Grok 2 Vision', provider: 'xai', description: 'Multimodal Grok' },

  // Groq Models (Fast inference)
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', description: 'Fast Llama inference' },
  { id: 'groq/llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', description: 'Ultra-fast inference' },
  { id: 'groq/mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', description: 'Fast MoE model' },
  { id: 'groq/gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq', description: 'Fast Google model' },

  // Mistral Models
  { id: 'mistral/mistral-large-latest', name: 'Mistral Large', provider: 'mistral', description: 'Most capable Mistral' },
  { id: 'mistral/mistral-medium-latest', name: 'Mistral Medium', provider: 'mistral', description: 'Balanced performance' },
  { id: 'mistral/mistral-small-latest', name: 'Mistral Small', provider: 'mistral', description: 'Fast and efficient' },
  { id: 'mistral/codestral-latest', name: 'Codestral', provider: 'mistral', description: 'Optimized for code' },

  // DeepSeek Models
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', description: 'Latest DeepSeek model' },
  { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', description: 'Reasoning model' },

  // Perplexity Models
  { id: 'perplexity/sonar-pro', name: 'Sonar Pro', provider: 'perplexity', description: 'Best for research' },
  { id: 'perplexity/sonar', name: 'Sonar', provider: 'perplexity', description: 'Fast web search' },
  { id: 'perplexity/sonar-reasoning', name: 'Sonar Reasoning', provider: 'perplexity', description: 'With reasoning' },

  // Cohere Models
  { id: 'cohere/command-r-plus', name: 'Command R+', provider: 'cohere', description: 'Most capable Cohere' },
  { id: 'cohere/command-r', name: 'Command R', provider: 'cohere', description: 'Balanced Cohere model' },

  // Together.ai Models
  { id: 'togetherai/meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B', provider: 'togetherai', description: 'Largest open model' },
  { id: 'togetherai/Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B', provider: 'togetherai', description: 'Strong multilingual' },

  // Fireworks Models
  { id: 'fireworks/accounts/fireworks/models/llama-v3p1-70b-instruct', name: 'Llama 3.1 70B', provider: 'fireworks', description: 'Fast Llama hosting' },
];

// Provider order for display
const PROVIDER_ORDER = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'groq',
  'mistral',
  'deepseek',
  'perplexity',
  'cohere',
  'togetherai',
  'fireworks',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check which provider API keys are configured
    const configuredProviders = new Set<string>();

    // Check for provider-specific keys
    if (Deno.env.get('OPENAI_API_KEY')) configuredProviders.add('openai');
    if (Deno.env.get('ANTHROPIC_API_KEY')) configuredProviders.add('anthropic');
    if (Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY')) configuredProviders.add('google');
    if (Deno.env.get('XAI_API_KEY')) configuredProviders.add('xai');
    if (Deno.env.get('GROQ_API_KEY')) configuredProviders.add('groq');
    if (Deno.env.get('MISTRAL_API_KEY')) configuredProviders.add('mistral');
    if (Deno.env.get('DEEPSEEK_API_KEY')) configuredProviders.add('deepseek');
    if (Deno.env.get('PERPLEXITY_API_KEY')) configuredProviders.add('perplexity');
    if (Deno.env.get('COHERE_API_KEY')) configuredProviders.add('cohere');
    if (Deno.env.get('TOGETHER_AI_API_KEY')) configuredProviders.add('togetherai');
    if (Deno.env.get('FIREWORKS_API_KEY')) configuredProviders.add('fireworks');

    // If AI Gateway is configured, all providers are available
    const hasGateway = !!(Deno.env.get('VERCEL_AI_GATEWAY_API_KEY') || Deno.env.get('AI_GATEWAY_API_KEY'));
    if (hasGateway) {
      // Gateway provides access to all models
      PROVIDER_ORDER.forEach(p => configuredProviders.add(p));
    }

    // Filter models to only those with configured providers
    // If no providers configured, show all models (user will configure keys)
    const availableModels = configuredProviders.size > 0
      ? AVAILABLE_MODELS.filter(m => configuredProviders.has(m.provider))
      : AVAILABLE_MODELS;

    // Get unique providers in display order
    const providers = PROVIDER_ORDER.filter(p =>
      availableModels.some(m => m.provider === p)
    );

    // Default to gpt-4o if available, otherwise first model
    const defaultModel = availableModels.find((m) => m.id === 'openai/gpt-4o')?.id
      || availableModels[0]?.id
      || null;

    console.log(`Returning ${availableModels.length} models from ${providers.length} providers`);

    return new Response(
      JSON.stringify({
        models: availableModels,
        providers,
        defaultModel,
        hasGateway,
        totalCount: availableModels.length,
        configuredProviders: Array.from(configuredProviders),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error getting available models:', error);

    // Return all models as fallback
    return new Response(
      JSON.stringify({
        models: AVAILABLE_MODELS,
        providers: PROVIDER_ORDER,
        defaultModel: 'openai/gpt-4o',
        hasGateway: false,
        error: error instanceof Error ? error.message : 'Failed to load models',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
