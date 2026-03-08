/**
 * Returns true when a Supabase/PostgREST error indicates the queried
 * relation (table/view) does not exist — typically HTTP 404 with
 * PostgreSQL code 42P01.
 *
 * Used to gracefully degrade when a migration has not yet been deployed
 * to the hosted Supabase instance (e.g. migration 20260306).
 */
export function isTableMissing(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  if (error.message?.includes('does not exist')) return true
  if (error.details?.includes('does not exist')) return true
  return false
}
