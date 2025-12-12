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
    // Create client with user's auth context if present
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )

    // 1. Get User Role
    let userRole = 'FREE';
    try {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (user && !userError) {
        // Use the helper function if available, or query directly
        // For efficiency in edge function, we'll query the table directly
        const { data: roleData } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (roleData) {
          userRole = roleData.role;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch user role, defaulting to FREE', e);
    }

    const ROLE_LEVELS = {
      'FREE': 0,
      'PRO': 1,
      'TEAM': 2,
      'ADMIN': 3
    };

    const currentLevel = ROLE_LEVELS[userRole as keyof typeof ROLE_LEVELS] || 0;

    // 2. Fetch enabled models from DB
    // We select ALL enabled models first, then filter in memory to handle the Enum string comparison comfortably
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
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', isFeatured: true, isDefault: true }
          ],
          providers: ['openai'],
          defaultModel: 'openai/gpt-4o-mini',
          hasOpenRouter: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Filter models based on tier
    const accessibleModels = models.filter(m => {
      const modelTier = m.min_tier || 'FREE';
      const modelLevel = ROLE_LEVELS[modelTier as keyof typeof ROLE_LEVELS] || 0;
      return currentLevel >= modelLevel;
    });

    const mappedModels = accessibleModels.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextLength: m.context_length,
      pricing: m.pricing,
      isFeatured: m.is_featured,
      isDefault: m.is_default
    }))

    // Get unique providers
    const providers = [...new Set(mappedModels.map(m => m.provider))]
    
    // 4. Determine default model
    // Priority: Explicit System Default -> First Featured -> First available
    // Note: We check the FULL list for the default, to ensure we can identify it 
    // even if the user can't access it (though fallback logic handles replacement)
    const systemDefault = models.find(m => m.is_default)?.id;
    const fallbackDefault = mappedModels.find(m => m.isFeatured)?.id || mappedModels[0]?.id

    // If the system default is accessible to this user, use it. Otherwise fallback.
    const defaultModel = accessibleModels.find(m => m.id === systemDefault) 
      ? systemDefault 
      : fallbackDefault;

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
