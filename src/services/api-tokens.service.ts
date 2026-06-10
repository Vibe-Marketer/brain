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
import { resolveShareUrl } from '@/lib/recording-source-url'
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

interface SupabaseErrorLike {
  message: string
}

interface PagedSupabaseQuery<Row> {
  range(from: number, to: number): Promise<{ data: Row[] | null; error: SupabaseErrorLike | null }>
}

interface WorkspaceRow {
  id: string
  name: string
}

interface WorkspaceEntryRow {
  recording_id: string
  workspace_id: string
}

interface RecordingExportRow {
  id: string
  legacy_recording_id: number | null
  title: string
  created_at: string
  recording_start_time: string | null
  recording_end_time: string | null
  full_transcript: string | null
  summary: string | null
  source_metadata: Record<string, unknown> | null
}

const EXPORT_PAGE_SIZE = 1000
const FILTER_CHUNK_SIZE = 1000

async function fetchPagedRows<Row>(
  buildQuery: () => PagedSupabaseQuery<Row>,
  errorLabel: string,
): Promise<Row[]> {
  const rows: Row[] = []
  let from = 0

  while (true) {
    const to = from + EXPORT_PAGE_SIZE - 1
    const { data, error } = await buildQuery().range(from, to)

    if (error) {
      throw new Error(`${errorLabel}: ${error.message}`)
    }

    const page = data ?? []
    rows.push(...page)

    if (page.length < EXPORT_PAGE_SIZE) {
      return rows
    }

    from += EXPORT_PAGE_SIZE
  }
}

function chunkList<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function getStringMetadata(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function getCalendarInvitees(metadata: Record<string, unknown>): CalendarInvitee[] | null {
  const invitees = metadata.calendar_invitees
  return Array.isArray(invitees) ? (invitees as CalendarInvitee[]) : null
}

function resolveExportShareUrl(metadata: Record<string, unknown>): string | null {
  const providerShareUrl =
    getStringMetadata(metadata, 'fathom_url') ?? getStringMetadata(metadata, 'zoom_share_url')

  return resolveShareUrl({
    share_url: providerShareUrl,
    source_metadata: metadata,
  })
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetch all active (non-revoked) API tokens for the current user.
 * RLS on mcp_tokens restricts results to user_id = auth.uid().
 * Filters to token_source = 'api' so MCP tokens are never included.
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
  const workspaces = await fetchPagedRows<WorkspaceRow>(
    () =>
      supabase
        .from('workspaces')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name', { ascending: true }) as unknown as PagedSupabaseQuery<WorkspaceRow>,
    'Failed to fetch workspaces',
  )

  const workspaceNameMap = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]))
  const workspaceIds = workspaces.map((workspace) => workspace.id)

  // Step 2: Build recording_id → workspace_name map via workspace_entries
  const recordingWorkspaceMap = new Map<string, string>()
  if (workspaceIds.length > 0) {
    for (const workspaceIdChunk of chunkList(workspaceIds, FILTER_CHUNK_SIZE)) {
      const entries = await fetchPagedRows<WorkspaceEntryRow>(
        () =>
          supabase
            .from('workspace_entries')
            .select('recording_id, workspace_id')
            .in('workspace_id', workspaceIdChunk) as unknown as PagedSupabaseQuery<WorkspaceEntryRow>,
        'Failed to fetch workspace entries',
      )

      for (const entry of entries) {
        const wsName = workspaceNameMap.get(entry.workspace_id)
        if (wsName && entry.recording_id) {
          recordingWorkspaceMap.set(entry.recording_id, wsName)
        }
      }
    }
  }

  // Step 3: Fetch all recordings for the org (with transcript)
  const recordings = await fetchPagedRows<RecordingExportRow>(
    () =>
      supabase
        .from('recordings')
        .select(
          'id, legacy_recording_id, title, created_at, recording_start_time, recording_end_time, full_transcript, summary, source_metadata',
        )
        .eq('organization_id', orgId)
        .order('recording_start_time', { ascending: false, nullsFirst: false }) as unknown as PagedSupabaseQuery<RecordingExportRow>,
    'Failed to fetch recordings',
  )

  // Step 4: Map to ExportableCall[]
  return recordings.map((rec) => {
    const meta = rec.source_metadata ?? {}
    return {
      recording_id: rec.legacy_recording_id ?? rec.id,
      canonical_uuid: rec.id,
      title: rec.title,
      created_at: rec.created_at,
      recording_start_time: rec.recording_start_time ?? null,
      recording_end_time: rec.recording_end_time ?? null,
      full_transcript: rec.full_transcript ?? null,
      summary: rec.summary ?? null,
      recorded_by_name: getStringMetadata(meta, 'recorded_by_name'),
      recorded_by_email: getStringMetadata(meta, 'recorded_by_email'),
      calendar_invitees: getCalendarInvitees(meta),
      url: resolveExportShareUrl(meta),
      workspace_name: recordingWorkspaceMap.get(rec.id) ?? null,
    }
  })
}
