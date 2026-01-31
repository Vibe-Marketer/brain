/**
 * CHECK CLIENT HEALTH EDGE FUNCTION
 *
 * Scheduled function that checks for overdue contacts and creates health alerts.
 * Runs daily via pg_cron or Supabase scheduler.
 *
 * Features:
 * - Checks contacts with track_health = true
 * - Uses per-contact threshold or falls back to user default
 * - Creates in-app notifications for overdue contacts
 * - Optional email alerts via automation-email function
 * - 7-day cooldown prevents alert spam
 *
 * Environment Variables:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key
 *
 * Scheduling:
 * To run this daily, set up a pg_cron job or Supabase scheduled function:
 * SELECT cron.schedule('check-client-health', '0 9 * * *', $$
 *   SELECT net.http_post(
 *     url := 'https://YOUR_PROJECT.supabase.co/functions/v1/check-client-health',
 *     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
 *   );
 * $$);
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface Contact {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  track_health: boolean;
  last_seen_at: string | null;
  health_alert_threshold_days: number | null;
  last_alerted_at: string | null;
}

interface UserContactSettings {
  user_id: string;
  default_health_threshold_days: number;
}

interface HealthCheckResult {
  usersChecked: number;
  contactsChecked: number;
  alertsCreated: number;
  errors: string[];
}

/**
 * Calculate days since a given date
 */
function daysSince(dateString: string | null): number {
  if (!dateString) return Infinity;
  const date = new Date(dateString);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if cooldown period has passed (7 days since last alert)
 */
function cooldownPassed(lastAlertedAt: string | null): boolean {
  if (!lastAlertedAt) return true;
  return daysSince(lastAlertedAt) >= 7;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: HealthCheckResult = {
      usersChecked: 0,
      contactsChecked: 0,
      alertsCreated: 0,
      errors: [],
    };

    // Get all unique users who have tracked contacts
    const { data: usersWithTracking, error: usersError } = await supabase
      .from('contacts')
      .select('user_id')
      .eq('track_health', true);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!usersWithTracking || usersWithTracking.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users with tracked contacts',
          result,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(usersWithTracking.map((c) => c.user_id))];
    result.usersChecked = uniqueUserIds.length;

    // Process each user
    for (const userId of uniqueUserIds) {
      try {
        // Get user's default settings
        const { data: settings } = await supabase
          .from('user_contact_settings')
          .select('default_health_threshold_days')
          .eq('user_id', userId)
          .maybeSingle();

        const defaultThreshold = (settings as UserContactSettings | null)?.default_health_threshold_days || 14;

        // Get tracked contacts for this user
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', userId)
          .eq('track_health', true);

        if (contactsError) {
          result.errors.push(`User ${userId}: ${contactsError.message}`);
          continue;
        }

        // Process each contact
        for (const contact of (contacts as Contact[]) || []) {
          result.contactsChecked++;

          // Use per-contact threshold or fall back to user default
          const threshold = contact.health_alert_threshold_days || defaultThreshold;
          const daysSinceSeen = daysSince(contact.last_seen_at);

          // Check if overdue
          if (daysSinceSeen > threshold) {
            // Check cooldown
            if (!cooldownPassed(contact.last_alerted_at)) {
              continue; // Skip - recently alerted
            }

            // Create notification
            const { error: notifError } = await supabase.from('user_notifications').insert({
              user_id: userId,
              type: 'health_alert',
              title: `${contact.name || contact.email} may need attention`,
              body: `It's been ${daysSinceSeen === Infinity ? 'a while' : `${daysSinceSeen} days`} since your last call with this contact.`,
              metadata: {
                contact_id: contact.id,
                contact_name: contact.name,
                contact_email: contact.email,
                days_since_seen: daysSinceSeen === Infinity ? null : daysSinceSeen,
                threshold_days: threshold,
              },
            });

            if (notifError) {
              result.errors.push(`Notification for ${contact.email}: ${notifError.message}`);
              continue;
            }

            // Update last_alerted_at to reset cooldown
            const { error: updateError } = await supabase
              .from('contacts')
              .update({ last_alerted_at: new Date().toISOString() })
              .eq('id', contact.id);

            if (updateError) {
              result.errors.push(`Update last_alerted_at for ${contact.email}: ${updateError.message}`);
            }

            result.alertsCreated++;
          }
        }
      } catch (userError) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        result.errors.push(`User ${userId}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Health check complete: ${result.alertsCreated} alerts created`,
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Health check error:', errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
