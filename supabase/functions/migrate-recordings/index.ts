// supabase/functions/migrate-recordings/index.ts
// Background migration Edge Function for fathom_calls -> recordings + vault_entries
// Phase: 09-06 Bank/Vault Architecture
//
// Features:
// - Admin-only access (checks user_roles for ADMIN)
// - Uses service role to bypass RLS for migration
// - Calls migrate_batch_fathom_calls RPC
// - Returns progress stats (total, migrated, remaining)
// - Can be called repeatedly until complete=true

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const BATCH_SIZE = 100

Deno.serve(async (req) => {
  // Get origin for CORS
  const origin = req.headers.get('Origin')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Use service role for migration (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Check if caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      )
    }

    // Verify caller's identity
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      )
    }

    // Check admin role - only admins can run migration
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'ADMIN')
      .single()

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      )
    }

    // Get migration stats before running batch
    const { count: totalCalls } = await supabase
      .from('fathom_calls')
      .select('*', { count: 'exact', head: true })

    const { count: migratedCallsBefore } = await supabase
      .from('recordings')
      .select('*', { count: 'exact', head: true })
      .not('legacy_recording_id', 'is', null)

    // Check if already complete
    const remainingBefore = (totalCalls ?? 0) - (migratedCallsBefore ?? 0)
    if (remainingBefore === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Migration already complete',
          batch: {
            migrated: 0,
            errors: 0,
            batch_size: BATCH_SIZE
          },
          overall: {
            total_calls: totalCalls ?? 0,
            migrated: migratedCallsBefore ?? 0,
            remaining: 0,
            complete: true
          }
        }),
        { status: 200, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      )
    }

    // Run batch migration
    const { data: result, error: migrationError } = await supabase
      .rpc('migrate_batch_fathom_calls', { p_batch_size: BATCH_SIZE })

    if (migrationError) {
      console.error('Migration error:', migrationError)
      return new Response(
        JSON.stringify({ 
          error: migrationError.message,
          details: migrationError
        }),
        { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      )
    }

    // Extract results from the RPC response
    // migrate_batch_fathom_calls returns TABLE(migrated_count INTEGER, error_count INTEGER)
    const migrated = result?.[0]?.migrated_count ?? 0
    const errors = result?.[0]?.error_count ?? 0

    // Get updated stats after migration
    const { count: migratedCallsAfter } = await supabase
      .from('recordings')
      .select('*', { count: 'exact', head: true })
      .not('legacy_recording_id', 'is', null)

    const remaining = (totalCalls ?? 0) - (migratedCallsAfter ?? 0)
    const isComplete = remaining === 0

    // Log progress for monitoring
    console.log(`Migration batch complete: ${migrated} migrated, ${errors} errors. Total progress: ${migratedCallsAfter}/${totalCalls} (${remaining} remaining)`)

    return new Response(
      JSON.stringify({
        success: true,
        batch: {
          migrated,
          errors,
          batch_size: BATCH_SIZE
        },
        overall: {
          total_calls: totalCalls ?? 0,
          migrated: migratedCallsAfter ?? 0,
          remaining,
          complete: isComplete
        }
      }),
      { status: 200, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Unexpected error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    )
  }
})
