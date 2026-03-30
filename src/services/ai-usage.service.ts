import { supabase } from '@/integrations/supabase/client'
import { getSafeUser } from '@/lib/auth-utils'

/**
 * AI Usage Service — fetches monthly AI action usage from the database.
 *
 * Uses the get_monthly_ai_usage RPC function which reads from the ai_usage table.
 * Returns the raw usage count; the hook layer combines this with subscription limits.
 *
 * Table: ai_usage (id, user_id, org_id, action_type, recording_id, month_year, created_at)
 * RPC: get_monthly_ai_usage(p_user_id UUID, p_month_year TEXT) RETURNS INTEGER
 */

/**
 * Fetches the number of AI actions used in the current calendar month.
 *
 * @returns Number of AI actions used this month (0 if none found)
 * @throws Error if user is not authenticated or the RPC call fails
 */
export async function getMonthlyAiUsage(): Promise<number> {
  const { user, error: authError } = await getSafeUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  // Format current month as YYYY-MM (e.g., "2026-03")
  const monthYear = new Date().toISOString().slice(0, 7)

  const { data, error } = await supabase.rpc('get_monthly_ai_usage', {
    p_user_id: user.id,
    p_month_year: monthYear,
  })

  if (error) {
    throw new Error(`Failed to fetch AI usage: ${error.message}`)
  }

  return (data as number) ?? 0
}
