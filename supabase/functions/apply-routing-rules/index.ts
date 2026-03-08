/**
 * apply-routing-rules — Bulk apply routing rules to existing recordings.
 *
 * Evaluates all active routing rules against recordings that have not been
 * previously routed (no routing trace in source_metadata). Supports dry_run
 * mode to preview changes before committing.
 *
 * POST body: { organization_id: string, dry_run?: boolean }
 *
 * Returns: {
 *   total_evaluated: number,
 *   matched: number,
 *   moved: number,
 *   skipped: number,
 *   dry_run: boolean,
 *   matches: Array<{
 *     recording_id: string,
 *     title: string,
 *     rule_name: string,
 *     target_workspace_id: string,
 *     target_workspace_name: string | null,
 *     target_folder_id: string | null,
 *   }>
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { loadRoutingRules, evaluateRecordAgainstRules } from '../_shared/routing-engine.ts';
import type { ConnectorRecord } from '../_shared/connector-pipeline.ts';

const BATCH_SIZE = 50;
const PAGE_SIZE = 500;

const inputSchema = z.object({
  organization_id: z.string().uuid('organization_id must be a valid UUID'),
  dry_run: z.boolean().optional().default(true),
});

interface MatchResult {
  recording_id: string;
  title: string;
  rule_name: string;
  rule_id: string;
  target_workspace_id: string;
  target_workspace_name: string | null;
  target_folder_id: string | null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { organization_id: organizationId, dry_run: dryRun } = validation.data;

    // Verify user is a member of the organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Load routing rules once — reused for all recordings (fixes N+1)
    const rules = await loadRoutingRules(supabase, organizationId);

    if (rules.length === 0) {
      return new Response(
        JSON.stringify({
          total_evaluated: 0,
          matched: 0,
          moved: 0,
          skipped: 0,
          dry_run: dryRun,
          matches: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Load workspace names for response enrichment
    const { data: workspaceRows } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('organization_id', organizationId);

    const workspaceNameMap: Record<string, string> = {};
    for (const ws of workspaceRows ?? []) {
      workspaceNameMap[ws.id] = ws.name;
    }

    // Fetch unrouted recordings in pages to avoid memory/timeout issues
    const matches: MatchResult[] = [];
    let totalEvaluated = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: recordings, error: recError } = await supabase
        .from('recordings')
        .select('id, title, source_app, duration, recording_start_time, source_metadata, global_tags')
        .eq('organization_id', organizationId)
        .is('source_metadata->>routed_by_rule_id', null)
        .order('recording_start_time', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (recError) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch recordings: ${recError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const page = recordings ?? [];
      totalEvaluated += page.length;
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;

      // Evaluate each recording against cached rules (pure in-memory, no DB queries)
      for (const rec of page) {
        const connectorRecord: ConnectorRecord = {
          external_id: rec.source_metadata?.external_id ?? rec.id,
          source_app: rec.source_app ?? '',
          title: rec.title ?? '',
          full_transcript: '', // Not needed for routing evaluation
          recording_start_time: rec.recording_start_time ?? '',
          duration: rec.duration ?? undefined,
          source_metadata: rec.source_metadata ?? {},
        };

        // Merge global_tags into source_metadata for tag-based routing
        if (rec.global_tags && Array.isArray(rec.global_tags)) {
          connectorRecord.source_metadata = {
            ...connectorRecord.source_metadata,
            global_tags: rec.global_tags,
          };
        }

        const destination = evaluateRecordAgainstRules(rules, connectorRecord);

        if (destination) {
          matches.push({
            recording_id: rec.id,
            title: rec.title ?? 'Untitled',
            rule_name: destination.matchedRuleName,
            rule_id: destination.matchedRuleId,
            target_workspace_id: destination.workspaceId,
            target_workspace_name: workspaceNameMap[destination.workspaceId] ?? null,
            target_folder_id: destination.folderId,
          });
        }
      }
    }

    // If dry_run, return preview without making changes
    if (dryRun) {
      return new Response(
        JSON.stringify({
          total_evaluated: totalEvaluated,
          matched: matches.length,
          moved: 0,
          skipped: totalEvaluated - matches.length,
          dry_run: true,
          matches,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Execute: create/update workspace entries and stamp routing trace
    let movedCount = 0;

    // Process in concurrent batches
    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);
      const now = new Date().toISOString();

      const results = await Promise.allSettled(
        batch.map(async (match) => {
          // Upsert workspace_entry for the matched workspace
          const entryPayload: Record<string, unknown> = {
            workspace_id: match.target_workspace_id,
            recording_id: match.recording_id,
          };

          if (match.target_folder_id) {
            entryPayload['folder_id'] = match.target_folder_id;
          }

          const { error: entryError } = await supabase
            .from('workspace_entries')
            .upsert(entryPayload, {
              onConflict: 'workspace_id,recording_id',
            });

          if (entryError) {
            throw new Error(`workspace_entry upsert failed for ${match.recording_id}: ${entryError.message}`);
          }

          // Atomic JSONB merge — avoids read-modify-write race condition.
          // Uses Supabase's PostgREST JSONB concatenation via the || operator
          // by reading and updating in a single UPDATE statement.
          const routingTrace = {
            routed_by_rule_id: match.rule_id,
            routed_by_rule_name: match.rule_name,
            routed_at: now,
            routed_retroactively: true,
          };

          const { error: updateError } = await supabase.rpc('jsonb_merge_source_metadata', {
            p_recording_id: match.recording_id,
            p_merge_data: routingTrace,
          });

          // Fallback: if the RPC doesn't exist yet, use direct update
          if (updateError?.message?.includes('function') && updateError?.message?.includes('does not exist')) {
            const { data: existingRec } = await supabase
              .from('recordings')
              .select('source_metadata')
              .eq('id', match.recording_id)
              .single();

            const { error: fallbackError } = await supabase
              .from('recordings')
              .update({
                source_metadata: {
                  ...(existingRec?.source_metadata ?? {}),
                  ...routingTrace,
                },
              })
              .eq('id', match.recording_id);

            if (fallbackError) {
              throw new Error(`routing trace update failed for ${match.recording_id}: ${fallbackError.message}`);
            }
          } else if (updateError) {
            throw new Error(`routing trace update failed for ${match.recording_id}: ${updateError.message}`);
          }
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          movedCount++;
        } else {
          console.error('[apply-routing-rules] Batch item failed:', result.reason);
        }
      }
    }

    return new Response(
      JSON.stringify({
        total_evaluated: totalEvaluated,
        matched: matches.length,
        moved: movedCount,
        skipped: totalEvaluated - matches.length,
        dry_run: false,
        matches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[apply-routing-rules] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
