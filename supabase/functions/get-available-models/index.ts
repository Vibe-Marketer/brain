import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize Supabase Client
    // Use Access Token for User Context
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )

    // 2. Identify User Role (Fail Safe)
    let userRole = 'FREE';
    try {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      
      if (user && !userError) {
        // Try to fetch role from DB
        const { data: roleData, error: roleError } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle to avoid 406 error if not found
        
        if (roleData) {
          userRole = roleData.role;
        } else {
            console.log(`User ${user.id} has no role assigned. Defaulting to FREE.`);
        }
      } else {
          console.warn('getUser failed or no user session:', userError);
      }
    } catch (e) {
      console.warn('Error checking user role:', e);
      // Swallow auth errors and proceed as FREE to ensure app doesn't crash
    }

    const ROLE_LEVELS: Record<string, number> = {
      'FREE': 0, 'PRO': 1, 'TEAM': 2, 'ADMIN': 3
    };
    const currentLevel = ROLE_LEVELS[userRole] || 0;

    // 3. Fetch Models from DB
    const { data: models, error: dbError } = await supabaseClient
      .from('ai_models')
      .select('*')
      .eq('is_enabled', true)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true });

    if (dbError) {
      console.error('DB Error fetching ai_models:', dbError);
      throw dbError; // Throw to trigger catch block
    }

    // 4. Filter Models by Tier
    let accessibleModels = (models || []).filter(m => {
      const modelTier = m.min_tier || 'FREE';
      const modelLevel = ROLE_LEVELS[modelTier] || 0;
      return currentLevel >= modelLevel;
    });

    // SAFETY NET: If user has 0 models (e.g. locked themselves out),
    // Force-include the System Default or GPT-4o Mini so the UI isn't broken.
    if (accessibleModels.length === 0) {
        console.warn(`User ${userRole} has 0 accessible models. Activating Emergency Fallback.`);
        
        // Try to find the system default in the full list
        const defaultModel = models?.find(m => m.is_default);
        
        if (defaultModel) {
            accessibleModels = [defaultModel];
        } else {
            // Hard fallback if DB is empty or weird
            accessibleModels = [{
                id: 'openai/gpt-4o-mini',
                name: 'GPT-4o Mini (Fallback)',
                provider: 'openai',
                context_length: 128000,
                pricing: { prompt: '0', completion: '0' },
                is_featured: true,
                is_default: true,
                min_tier: 'FREE',
                is_enabled: true
            } as any];
        }
    }

    // 5. Map to Response Format
    const mappedModels = accessibleModels.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextLength: m.context_length,
      pricing: m.pricing,
      isFeatured: m.is_featured,
      isDefault: m.is_default
    }));

    const providers = [...new Set(mappedModels.map(m => m.provider))];
    
    // Determine Default
    const systemDefaultId = mappedModels.find(m => m.isDefault)?.id;
    const defaultModel = systemDefaultId 
        || mappedModels.find(m => m.isFeatured)?.id 
        || mappedModels[0]?.id;

    return new Response(
      JSON.stringify({
        models: mappedModels,
        providers,
        defaultModel,
        hasOpenRouter: true,
        _debug: { role: userRole, level: currentLevel } // Helpful for debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('CRITICAL ERROR in get-available-models:', err);
    // Return a valid JSON error so frontend doesn't show "Network Error"
    // Also include a fallback model in the error response if possible so app survives? 
    // No, better to show the error message.
    return new Response(
      JSON.stringify({ 
          error: `Failed to load models: ${err.message || 'Unknown error'}`,
          models: [] 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
