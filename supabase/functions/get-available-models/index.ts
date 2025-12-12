import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Note: sentry-trace and baggage are needed for Sentry distributed tracing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Fetch enabled models from DB
    const { data: models, error } = await supabaseClient
      .from('ai_models')
      .select('*')
      .eq('is_enabled', true)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    // If no models in DB, fall back to hardcoded default (safety net)
    if (!models || models.length === 0) {
       // Return minimal default set if DB is empty to avoid breaking app before first sync
       return new Response(
        JSON.stringify({
          models: [
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
            { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'anthropic' }
          ],
          providers: ['openai', 'anthropic'],
          defaultModel: 'openai/gpt-4o-mini',
          hasOpenRouter: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mappedModels = models.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextLength: m.context_length,
      pricing: m.pricing,
      isFeatured: m.is_featured
    }))

    // Get unique providers
    const providers = [...new Set(mappedModels.map(m => m.provider))]
    
    // Determine default model
    // Try to find a featured OpenAI or Anthropic model, or just the first one
    const defaultModel = mappedModels.find(m => m.isFeatured)?.id || mappedModels[0]?.id

    return new Response(
      JSON.stringify({
        models: mappedModels,
        providers,
        defaultModel,
        hasOpenRouter: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error getting available models:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
