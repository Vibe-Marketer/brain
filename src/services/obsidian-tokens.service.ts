/**
 * obsidian-tokens.service.ts
 *
 * Service for managing Obsidian personal API tokens.
 * These tokens are stored in mcp_tokens with token_source = 'obsidian'.
 * They are separate from MCP tokens (which go to AI clients).
 */

import { supabase } from '@/integrations/supabase/client'
import type { ExportableCall } from '@/lib/export-utils'
import type { CalendarInvitee } from '@/types/meetings'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObsidianToken {
  id: string
  user_id: string
  org_id: string
  name: string
  /** Only present immediately after generation — never re-exposed */
  token?: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface GeneratedObsidianToken extends ObsidianToken {
  /** Raw token value shown once at generation time */
  token: string
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetch all active (non-revoked) Obsidian tokens for the current user.
 * RLS on mcp_tokens restricts results to user_id = auth.uid().
 */
export async function getObsidianTokens(): Promise<ObsidianToken[]> {
  const { data, error } = await supabase
    .from('mcp_tokens')
    .select('id, user_id, org_id, name, created_at, last_used_at, revoked_at')
    .eq('token_source', 'obsidian')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch Obsidian tokens: ${error.message}`)
  }

  return (data ?? []) as ObsidianToken[]
}

/**
 * Generate a new Obsidian token via the generate_obsidian_token RPC.
 * Returns the raw token value — surface to the user exactly once.
 */
export async function generateObsidianToken(params: {
  org_id: string
  name: string
}): Promise<GeneratedObsidianToken> {
  const { data, error } = await supabase.rpc('generate_obsidian_token', {
    p_org_id: params.org_id,
    p_name: params.name.trim(),
  })

  if (error) {
    throw new Error(`Failed to generate Obsidian token: ${error.message}`)
  }

  // RPC returns TABLE — take first row
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    throw new Error('Token generation did not return a value')
  }

  return row as GeneratedObsidianToken
}

/**
 * Revoke an Obsidian token by setting revoked_at = now().
 * RLS ensures users can only revoke their own tokens.
 */
export async function revokeObsidianToken(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('token_source', 'obsidian')

  if (error) {
    throw new Error(`Failed to revoke Obsidian token: ${error.message}`)
  }
}

/**
 * Fetches all recordings for an org and maps them to ExportableCall[] for Obsidian export.
 * Uses two secondary queries to resolve workspace names.
 */
export async function fetchAllCallsForObsidianExport(orgId: string): Promise<ExportableCall[]> {
  // Step 1: Get all workspaces for this org → workspace_id → name map
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('organization_id', orgId)
  if (wsError) throw new Error(`Failed to fetch workspaces: ${wsError.message}`)

  const workspaceNameMap = new Map((workspaces ?? []).map((w) => [w.id, w.name as string]))
  const workspaceIds = (workspaces ?? []).map((w) => w.id)

  // Step 2: Build recording_id → workspace_name map via workspace_entries
  const recordingWorkspaceMap = new Map<string, string>()
  if (workspaceIds.length > 0) {
    const { data: entries } = await supabase
      .from('workspace_entries')
      .select('recording_id, workspace_id')
      .in('workspace_id', workspaceIds)
    for (const entry of entries ?? []) {
      const wsName = workspaceNameMap.get((entry as any).workspace_id)
      if (wsName && (entry as any).recording_id) {
        recordingWorkspaceMap.set((entry as any).recording_id, wsName)
      }
    }
  }

  // Step 3: Fetch all recordings for the org (with transcript)
  const { data: recordings, error: recError } = await supabase
    .from('recordings')
    .select(
      'id, legacy_recording_id, title, created_at, recording_start_time, recording_end_time, full_transcript, summary, source_metadata',
    )
    .eq('organization_id', orgId)
    .order('recording_start_time', { ascending: false, nullsFirst: false })
  if (recError) throw new Error(`Failed to fetch recordings: ${recError.message}`)

  // Step 4: Map to ExportableCall[]
  return (recordings ?? []).map((rec) => {
    const meta = ((rec as any).source_metadata ?? {}) as Record<string, unknown>
    return {
      recording_id: (rec as any).legacy_recording_id ?? rec.id,
      canonical_uuid: rec.id,
      title: rec.title,
      created_at: rec.created_at,
      recording_start_time: rec.recording_start_time ?? null,
      recording_end_time: (rec as any).recording_end_time ?? null,
      full_transcript: (rec as any).full_transcript ?? null,
      summary: rec.summary ?? null,
      recorded_by_name: (meta.recorded_by_name as string) ?? null,
      recorded_by_email: (meta.recorded_by_email as string) ?? null,
      calendar_invitees: Array.isArray(meta.calendar_invitees)
        ? (meta.calendar_invitees as CalendarInvitee[])
        : null,
      url: (meta.fathom_url as string) ?? (meta.zoom_share_url as string) ?? null,
      workspace_name: recordingWorkspaceMap.get(rec.id) ?? null,
    }
  })
}
