/**
 * autopilot-trust-admin (19-02) — explicit category trust rung changes.
 *
 * The autonomy ladder is authority, not a computed badge. A category may only
 * move to `auto` after the survival gate is met AND an authenticated admin
 * explicitly requests promotion. Actor identity always comes from
 * authenticateRequest; request bodies are never trusted for actor attribution.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

type TrustRung = 'manual' | 'eligible' | 'auto';
type TrustMetricRow = {
  category: string;
  rung: TrustRung;
  eligible: boolean;
  completed_fixes: number;
  survived_fixes: number;
  reopened_fixes: number;
  deferred_runs: number;
  survival_rate: number;
  threshold: number;
  min_fixes: number;
};

const payloadSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(120, 'Category must be 120 characters or fewer')
    .regex(/^[a-zA-Z0-9._:/ -]+$/, 'Category contains unsupported characters'),
  action: z.enum(['promote_auto', 'demote_manual', 'reset_eligible']),
  reason: z
    .string()
    .trim()
    .max(500, 'Reason must be 500 characters or fewer')
    .optional(),
});

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, supabase, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('has_role', {
      _user_id: authResult.userId,
      _role: 'ADMIN',
    });
    if (adminCheckError || !isAdmin) {
      if (adminCheckError) console.error('autopilot-trust-admin has_role failed:', adminCheckError);
      return jsonResponse({ success: false, error: 'Admin access required' }, 403, corsHeaders);
    }

    const rawBody = await req.json();
    const validation = payloadSchema.safeParse(rawBody);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message ?? 'Invalid input';
      return jsonResponse({ success: false, error: firstIssue }, 400, corsHeaders);
    }

    const { category, action, reason } = validation.data;

    const { data: metricsRows, error: metricsError } = await supabaseAdmin.rpc(
      'autopilot_trust_metrics',
    );
    if (metricsError) {
      console.error('Failed to read autopilot_trust_metrics:', metricsError);
      return jsonResponse({ success: false, error: 'Failed to load trust metrics' }, 500, corsHeaders);
    }

    const metric = ((metricsRows ?? []) as TrustMetricRow[]).find((row) => row.category === category);
    if (action === 'promote_auto' && (!metric || !metric.eligible)) {
      return jsonResponse(
        {
          success: false,
          error: 'category_not_eligible',
          category,
        },
        409,
        corsHeaders,
      );
    }

    const { data: currentRow, error: currentError } = await supabaseAdmin
      .from('autopilot_category_trust')
      .select('category, rung')
      .eq('category', category)
      .maybeSingle();
    if (currentError) {
      console.error('Failed to load category trust row:', currentError);
      return jsonResponse({ success: false, error: 'Failed to load category trust' }, 500, corsHeaders);
    }

    const oldRung = (currentRow?.rung ?? metric?.rung ?? 'manual') as TrustRung;
    const newRung: TrustRung =
      action === 'promote_auto' ? 'auto' : action === 'demote_manual' ? 'manual' : 'eligible';
    const timestamp = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      category,
      rung: newRung,
      updated_at: timestamp,
    };

    if (action === 'promote_auto') {
      updatePayload.last_promoted_by = authResult.userId;
      updatePayload.last_promoted_at = timestamp;
    } else if (action === 'demote_manual') {
      updatePayload.last_demoted_by = authResult.userId;
      updatePayload.last_demoted_at = timestamp;
    }

    const { error: upsertError } = await supabaseAdmin
      .from('autopilot_category_trust')
      .upsert(updatePayload, { onConflict: 'category' });
    if (upsertError) {
      console.error('Failed to update category trust rung:', upsertError);
      return jsonResponse({ success: false, error: 'Failed to update trust rung' }, 500, corsHeaders);
    }

    const { error: eventError } = await supabaseAdmin.from('autopilot_trust_events').insert({
      category,
      actor_id: authResult.userId,
      event_type:
        action === 'promote_auto'
          ? 'admin_promoted'
          : action === 'demote_manual'
            ? 'admin_demoted'
            : 'admin_reset_eligible',
      old_value: oldRung,
      new_value: newRung,
      metadata: {
        reason: reason?.trim() || null,
        action,
        eligible: metric?.eligible ?? false,
        completed_fixes: metric?.completed_fixes ?? 0,
        survival_rate: metric?.survival_rate ?? 0,
        threshold: metric?.threshold ?? null,
        min_fixes: metric?.min_fixes ?? null,
      },
    });
    if (eventError) {
      console.error('Failed to write autopilot trust event:', eventError);
      await supabaseAdmin
        .from('autopilot_category_trust')
        .update({ rung: oldRung, updated_at: new Date().toISOString() })
        .eq('category', category);
      return jsonResponse({ success: false, error: 'Failed to record trust event' }, 500, corsHeaders);
    }

    const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
      actor_user_id: authResult.userId,
      action: `autopilot_trust_${action}`,
      target_type: 'system',
      metadata: {
        category,
        old_rung: oldRung,
        new_rung: newRung,
        reason: reason?.trim() || null,
      },
    });
    if (auditError) {
      console.error('AUDIT LOG WRITE FAILED for autopilot-trust-admin:', auditError);
    }

    return jsonResponse({ success: true, category, action, old_rung: oldRung, new_rung: newRung }, 200, corsHeaders);
  } catch (err) {
    console.error('autopilot-trust-admin unhandled error:', err);
    return jsonResponse({ success: false, error: 'Internal error' }, 500, getCorsHeaders(req.headers.get('Origin')));
  }
});
