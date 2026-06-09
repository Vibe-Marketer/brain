/**
 * api-tokens.service.ts
 *
 * Service for managing CallVault REST API tokens.
 * These tokens are stored in mcp_tokens with token_source = 'api'.
 * They authenticate requests to the CallVault REST API (api.callvaultai.com/v1/*).
 *
 * Distinct from MCP tokens (AI clients).
 * Token values are generated server-side by the generate_api_token RPC.
 */

import { supabase } from '@/integrations/supabase/client'
import type { ExportableCall } from '@/lib/export-utils'
import type { CalendarInvitee } from '@/types/meetings'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiTokenScope = 'organization' | 'workspace'

export interface ApiToken {
  id: string
  user_id: string
  org_id: string
  workspace_id: string | null
  name: string
  scope: ApiTokenScope
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface GeneratedApiToken extends ApiToken {
  /** Raw token value shown once at generation time — never re-exposed after this */
  token: string
}

export interface GenerateApiTokenParams {
  org_id: string
  name: string
  scope?: ApiTokenScope
  workspace_id?: string
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetch all active (non-revoked) API tokens for the current user.
 * RLS on mcp_tokens restricts results to user_id = auth.uid().
 * Filters to token_source = 'api' so MCP and Obsidian tokens are never included.
 */
export async function getApiTokens(): Promise<ApiToken[]> {
  const { data, error } = await supabase
    .from('mcp_tokens')
    .select('id, user_id, org_id, workspace_id, name, scope, created_at, last_used_at, revoked_at')
    .eq('token_source', 'api')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch API tokens: ${error.message}`)
  }

  return (data ?? []) as ApiToken[]
}

/**
 * Generate a new CallVault API token via the generate_api_token RPC.
 * Returns the raw token value — surface to the user exactly once.
 *
 * The RPC hard-codes token_source = 'api' and uses cv_api_ prefix.
 */
export async function generateApiToken(params: GenerateApiTokenParams): Promise<GeneratedApiToken> {
  const { data, error } = await supabase.rpc('generate_api_token', {
    p_org_id: params.org_id,
    p_name: params.name.trim(),
    p_scope: params.scope ?? 'organization',
    p_workspace_id: params.workspace_id ?? null,
  })

  if (error) {
    throw new Error(`Failed to generate API token: ${error.message}`)
  }

  // RPC returns TABLE — take first row
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    throw new Error('Token generation did not return a value')
  }

  return row as GeneratedApiToken
}

/**
 * Revoke an API token by setting revoked_at = now().
 * RLS ensures users can only revoke their own tokens.
 * Filters by token_source = 'api' as an extra safety boundary.
 */
export async function revokeApiToken(id: string): Promise<void> {
  const { error } = await supabase
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('token_source', 'api')

  if (error) {
    throw new Error(`Failed to revoke API token: ${error.message}`)
  }
}

// ─── Export utilities ─────────────────────────────────────────────────────────

/**
 * Fetches all recordings for an org and maps them to ExportableCall[] for
 * Obsidian-format ZIP export. Backed by the user's authenticated session
 * (no separate token needed — access is controlled by Supabase RLS).
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
