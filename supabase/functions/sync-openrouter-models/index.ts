import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Sync OpenRouter Models function starting...')

// CORS headers - including sentry-trace and baggage for Sentry distributed tracing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length?: number
  pricing: {
    prompt: string
    completion: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      console.error('Auth error:', userError)
      throw new Error('Unauthorized')
    }

    // Check if user has ADMIN role
    const { data: roleData } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'ADMIN'
    })

    if (!roleData) {
      console.error('Role check failed for user:', user.id)
      throw new Error('Forbidden: Admin access required')
    }

    // Fetch latest models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models')
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    const models: OpenRouterModel[] = data.data
    
    console.log(`Fetched ${models.length} models from OpenRouter`)

    // Upsert models into database
    let upsertCount = 0
    let errorCount = 0
    const batchSize = 50

    for (let i = 0; i < models.length; i += batchSize) {
      const batch = models.slice(i, i + batchSize).map(m => ({
        id: m.id,
        name: m.name,
        // Extract provider from ID (e.g. "openai/gpt-4" -> "openai")
        provider: m.id.split('/')[0] || 'unknown',
        context_length: m.context_length || 0,
        pricing: m.pricing,
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabaseClient
        .from('ai_models')
        .upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        
      if (error) {
        console.error('Batch upsert error:', error)
        errorCount += batch.length
      } else {
        upsertCount += batch.length
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${upsertCount} models`,
        total: models.length,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
