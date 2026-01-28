import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

console.log("Get Available Models Function Loaded (v3)");

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[Request] ${req.method} ${req.url}`);
    
    // 1. Initialize Supabase Client
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
          .maybeSingle();
        
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
    }
    
    console.log(`User Role determined: ${userRole}`);

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
      throw dbError;
    }

    // 4. Filter Models by Tier
    // Define explicit type for model to avoid implicit any
    interface AIModelDB {
        id: string;
        name: string;
        provider: string;
        context_length: number;
        pricing: any;
        is_featured: boolean;
        is_default: boolean;
        min_tier: string;
    }

    let accessibleModels = (models as AIModelDB[] || []).filter((m: AIModelDB) => {
      const modelTier = m.min_tier || 'FREE';
      const modelLevel = ROLE_LEVELS[modelTier] || 0;
      return currentLevel >= modelLevel;
    });
    
    console.log(`Models Found: ${models?.length || 0}. Accessible: ${accessibleModels.length}`);

    // SAFETY NET: Locked Out User Fallback
    if (accessibleModels.length === 0) {
        console.warn(`User ${userRole} has 0 accessible models. Activating Emergency Fallback.`);
        const defaultModel = models?.find((m: AIModelDB) => m.is_default);
        if (defaultModel) {
            accessibleModels = [defaultModel as AIModelDB];
        } else {
             // Absolute Worst Case
             accessibleModels = [{
                id: 'openai/gpt-4o-mini',
                name: 'GPT-4o Mini (Fallback)',
                provider: 'openai',
                context_length: 128000,
                pricing: { prompt: '0', completion: '0' },
                is_featured: true,
                is_default: true,
                min_tier: 'FREE' 
            } as any];
        }
    }

    // 5. Map to Response Format
    const mappedModels = accessibleModels.map((m: AIModelDB) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextLength: m.context_length,
      pricing: m.pricing,
      isFeatured: m.is_featured,
      isDefault: m.is_default
    }));

    const providers = [...new Set(mappedModels.map((m: any) => m.provider))];
    
    // Determine Default
    const systemDefaultId = mappedModels.find((m: any) => m.isDefault)?.id;
    const defaultModel = systemDefaultId 
        || mappedModels.find((m: any) => m.isFeatured)?.id 
        || mappedModels[0]?.id;

    return new Response(
      JSON.stringify({
        models: mappedModels,
        providers,
        defaultModel,
        hasOpenRouter: true,
        _debug: { role: userRole, level: currentLevel }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('CRITICAL ERROR:', err);
    return new Response(
      JSON.stringify({ 
          error: `Failed to load models: ${err.message || 'Unknown error'}`,
          models: [] 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
