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
import { getCorsHeaders } from '../_shared/cors.ts';
import { resolveRoutingDestination } from '../_shared/routing-engine.ts';
import type { ConnectorRecord } from '../_shared/connector-pipeline.ts';

const BATCH_SIZE = 50;

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

    // Parse request body
    const body = await req.json();
    const organizationId = body.organization_id as string;
    const dryRun = body.dry_run !== false; // Default to dry_run=true for safety

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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

    // Load workspace names for response enrichment
    const { data: workspaceRows } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('organization_id', organizationId);

    const workspaceNameMap: Record<string, string> = {};
    for (const ws of workspaceRows ?? []) {
      workspaceNameMap[ws.id] = ws.name;
    }

    // Fetch recordings without routing trace (not yet routed)
    // source_metadata->>'routed_by_rule_id' IS NULL means no rule has been applied
    const { data: recordings, error: recError } = await supabase
      .from('recordings')
      .select('id, title, source_app, duration, recording_start_time, source_metadata, global_tags')
      .eq('organization_id', organizationId)
      .is('source_metadata->>routed_by_rule_id', null)
      .order('recording_start_time', { ascending: false });

    if (recError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch recordings: ${recError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const allRecordings = recordings ?? [];
    const totalEvaluated = allRecordings.length;

    // Evaluate each recording against routing rules
    interface MatchResult {
      recording_id: string;
      title: string;
      rule_name: string;
      rule_id: string;
      target_workspace_id: string;
      target_workspace_name: string | null;
      target_folder_id: string | null;
    }

    const matches: MatchResult[] = [];

    for (const rec of allRecordings) {
      // Build a ConnectorRecord-compatible shape for the routing engine
      const connectorRecord: ConnectorRecord = {
        external_id: rec.source_metadata?.external_id ?? rec.id,
        source_app: rec.source_app ?? '',
        title: rec.title ?? '',
        full_transcript: '', // Not needed for routing evaluation
        recording_start_time: rec.recording_start_time ?? '',
        duration: rec.duration ?? undefined,
        source_metadata: rec.source_metadata ?? {},
      };

      // Add global_tags into source_metadata for tag-based routing
      if (rec.global_tags && Array.isArray(rec.global_tags)) {
        connectorRecord.source_metadata = {
          ...connectorRecord.source_metadata,
          global_tags: rec.global_tags,
        };
      }

      const destination = await resolveRoutingDestination(
        supabase,
        organizationId,
        connectorRecord,
      );

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

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < matches.length; i += BATCH_SIZE) {
      const batch = matches.slice(i, i + BATCH_SIZE);

      for (const match of batch) {
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
          console.error(
            `[apply-routing-rules] Failed to upsert workspace_entry for recording ${match.recording_id}:`,
            entryError,
          );
          continue;
        }

        // Stamp routing trace on the recording's source_metadata
        // Use raw SQL via RPC to do a JSONB merge without overwriting existing keys
        const { data: existingRec } = await supabase
          .from('recordings')
          .select('source_metadata')
          .eq('id', match.recording_id)
          .single();

        const updatedMetadata = {
          ...(existingRec?.source_metadata ?? {}),
          routed_by_rule_id: match.rule_id,
          routed_by_rule_name: match.rule_name,
          routed_at: new Date().toISOString(),
          routed_retroactively: true,
        };

        const { error: updateError } = await supabase
          .from('recordings')
          .update({ source_metadata: updatedMetadata })
          .eq('id', match.recording_id);

        if (updateError) {
          console.error(
            `[apply-routing-rules] Failed to stamp routing trace for recording ${match.recording_id}:`,
            updateError,
          );
          continue;
        }

        movedCount++;
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
