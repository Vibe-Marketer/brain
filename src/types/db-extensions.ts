/**
 * Database type extensions for tables and RPCs not yet in the auto-generated supabase.ts.
 *
 * These tables/RPCs exist in the database but `supabase gen types typescript` hasn't
 * been re-run to include them. Instead of using `(supabase as any)`, we use a typed
 * helper that preserves Supabase client methods while allowing any table name.
 *
 * To remove an entry: re-run `supabase gen types typescript`, verify the table appears
 * in supabase.ts, then delete the usage of `untypedFrom` / `untypedRpc` for that table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Calls supabase.from() for a table that isn't in the generated Database type.
 * Returns the same PostgrestQueryBuilder shape so .select(), .insert(), etc. work.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function untypedFrom(client: SupabaseClient<any>, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table)
}

/**
 * Calls supabase.rpc() for an RPC that isn't in the generated Database type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function untypedRpc(client: SupabaseClient<any>, fnName: string, args?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).rpc(fnName, args)
}
