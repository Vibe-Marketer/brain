import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecretTest {
  name: string;
  exists: boolean;
  hasValue: boolean;
  length?: number;
  preview?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Test Supabase credentials first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Critical: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing',
          supabaseUrl: !!supabaseUrl,
          supabaseServiceKey: !!supabaseServiceKey
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check authorization
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

    // List of all secrets to test
    const secretsToTest = [
      // Core Supabase
      { key: 'SUPABASE_URL', required: true },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true },
      
      // New Supabase keys (they mentioned migration)
      { key: 'SB_PUBLISHABLE_KEY', required: false },
      { key: 'SB_SECRET', required: false },
      
      // Fathom OAuth - Development
      { key: 'FATHOM_OAUTH_CLIENT_ID_DEV', required: true },
      { key: 'FATHOM_OAUTH_CLIENT_SECRET_DEV', required: true },
      
      // Fathom OAuth - Production
      { key: 'FATHOM_OAUTH_CLIENT_ID', required: false },
      { key: 'FATHOM_OAUTH_CLIENT_SECRET', required: false },
      
      // AI API Keys
      { key: 'OPENAI_API_KEY', required: true },
      { key: 'ANTHROPIC_API_KEY', required: false },
      { key: 'GEMINI_API_KEY', required: false },
    ];

    const results: SecretTest[] = [];
    let criticalMissing = 0;

    for (const { key, required } of secretsToTest) {
      const value = Deno.env.get(key);
      const exists = value !== undefined && value !== null;
      const hasValue = exists && value.trim().length > 0;
      
      results.push({
        name: key,
        exists,
        hasValue,
        length: hasValue ? value.length : 0,
        preview: hasValue ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}` : undefined,
      });

      if (required && !hasValue) {
        criticalMissing++;
      }
    }

    // Test database connection
    let dbConnectionTest = { success: false, error: '' };
    try {
      const { error } = await supabase
        .from('user_settings')
        .select('user_id')
        .limit(1);
      
      dbConnectionTest = {
        success: !error,
        error: error?.message || ''
      };
    } catch (e) {
      dbConnectionTest = {
        success: false,
        error: e instanceof Error ? e.message : String(e)
      };
    }

    // Test OpenAI API (if key exists)
    let openaiTest = { attempted: false, success: false, error: '' };
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
          },
        });
        openaiTest = {
          attempted: true,
          success: response.ok,
          error: response.ok ? '' : `HTTP ${response.status}`
        };
      } catch (e) {
        openaiTest = {
          attempted: true,
          success: false,
          error: e instanceof Error ? e.message : String(e)
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: criticalMissing === 0,
        summary: {
          totalSecrets: results.length,
          configured: results.filter(r => r.hasValue).length,
          missing: results.filter(r => !r.hasValue).length,
          criticalMissing,
        },
        secrets: results,
        tests: {
          database: dbConnectionTest,
          openai: openaiTest,
        },
        recommendations: criticalMissing > 0 ? [
          'Run: supabase secrets list',
          'Set missing secrets: supabase secrets set SECRET_NAME="value"',
          'Redeploy functions: supabase functions deploy',
        ] : [
          '✅ All critical secrets configured!',
          'Optional: Configure AI keys for future features',
        ],
      }, null, 2),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error testing secrets:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
