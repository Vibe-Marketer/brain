import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../../../../src/test/integration-setup'
import { listSharedCallsTool } from '../tools/read/list_shared_calls'
import type { McpToken, ToolHandlerContext } from '../tools/_types'
import { createShareLinkTool } from '../tools/write/create_share_link'
import { revokeShareLinkTool } from '../tools/write/revoke_share_link'

type RpcBody = {
  result?: { content?: Array<{ type?: string; text?: string }> }
  error?: unknown
}

interface McpFixture {
  admin: SupabaseClient
  prefix: string
  organizationId: string
  workspaceId: string
  ownerId: string
  ownerEmail: string
  uuidRecordingId: string
  legacyRecordingId: string
  legacyProviderId: number
  legacyShareLinkId: string
}

function requireNoError(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`)
}

async function createMcpFixture(): Promise<McpFixture> {
  const admin = makeIntegrationClient()
  const prefix = `phase38-mcp-${Date.now()}`
  const uuidRecordingId = crypto.randomUUID()
  const legacyRecordingId = crypto.randomUUID()
  const legacyProviderId = 8_000_000_000_000_000 + Math.floor(Math.random() * 100_000_000)

  const donor = await admin
    .from('recordings')
    .select('organization_id, owner_user_id')
    .not('organization_id', 'is', null)
    .not('owner_user_id', 'is', null)
    .limit(1)
    .single()
  requireNoError('load organization donor', donor.error)
  if (!donor.data?.organization_id || !donor.data.owner_user_id) {
    throw new Error('organization donor omitted organization or owner ID')
  }

  const workspace = await admin
    .from('workspaces')
    .select('id')
    .eq('organization_id', donor.data.organization_id)
    .limit(1)
    .single()
  requireNoError('load donor workspace', workspace.error)

  const owner = await admin.auth.admin.getUserById(donor.data.owner_user_id)
  if (owner.error || !owner.data.user.email) {
    throw new Error(`load donor owner email: ${owner.error?.message ?? 'missing email'}`)
  }

  const recordings = await admin.from('recordings').insert([
    {
      id: uuidRecordingId,
      organization_id: donor.data.organization_id,
      owner_user_id: donor.data.owner_user_id,
      title: `${prefix} UUID recording`,
      source_app: 'grain',
      source_call_id: `${prefix}-grain`,
      fathom_provider_id: null,
      source_metadata: { integration_test: 'phase-38-mcp-uuid-bridge' },
    },
    {
      id: legacyRecordingId,
      organization_id: donor.data.organization_id,
      owner_user_id: donor.data.owner_user_id,
      title: `${prefix} legacy recording`,
      source_app: 'fathom',
      source_call_id: `${prefix}-fathom`,
      fathom_provider_id: legacyProviderId,
      source_metadata: { integration_test: 'phase-38-mcp-legacy-fallback' },
    },
  ])
  requireNoError('create bridge recordings', recordings.error)

  const entry = await admin.from('workspace_entries').insert([
    { workspace_id: workspace.data.id, recording_id: uuidRecordingId },
    { workspace_id: workspace.data.id, recording_id: legacyRecordingId },
  ])
  if (entry.error && !entry.error.message.toLowerCase().includes('duplicate key')) {
    throw new Error(`create bridge workspace entries: ${entry.error.message}`)
  }

  const legacyCall = await admin.from('fathom_calls').insert({
    recording_id: legacyProviderId,
    user_id: donor.data.owner_user_id,
    canonical_recording_id: legacyRecordingId,
    title: `${prefix} legacy recording`,
    source_platform: 'fathom',
    metadata: { integration_test: 'phase-38-mcp-legacy-fallback' },
    created_at: new Date().toISOString(),
  })
  requireNoError('create legacy fallback call', legacyCall.error)

  const legacyShare = await admin.from('call_share_links').insert({
    call_recording_id: legacyProviderId,
    user_id: donor.data.owner_user_id,
    created_by_user_id: donor.data.owner_user_id,
    share_token: `${prefix}-legacy`,
    recipient_email: owner.data.user.email,
    status: 'active',
  }).select('id').single()
  requireNoError('create legacy fallback share', legacyShare.error)

  return {
    admin,
    prefix,
    organizationId: donor.data.organization_id,
    workspaceId: workspace.data.id,
    ownerId: donor.data.owner_user_id,
    ownerEmail: owner.data.user.email,
    uuidRecordingId,
    legacyRecordingId,
    legacyProviderId,
    legacyShareLinkId: legacyShare.data.id,
  }
}

async function cleanupMcpFixture(fixture: McpFixture, uuidShareLinkId: string | null): Promise<void> {
  const failures: string[] = []
  const step = async (
    label: string,
    operation: () => PromiseLike<{ error: { message: string } | null }>,
  ) => {
    const result = await operation()
    if (result.error) failures.push(`${label}: ${result.error.message}`)
  }

  if (uuidShareLinkId) {
    await step('UUID share link', () => fixture.admin.from('call_share_links').delete().eq('id', uuidShareLinkId))
  }
  await step('legacy share link', () => fixture.admin.from('call_share_links').delete().eq('id', fixture.legacyShareLinkId))
  await step('legacy Fathom call', () => fixture.admin.from('fathom_calls').delete().eq('recording_id', fixture.legacyProviderId))
  await step('UUID workspace entry', () => fixture.admin.from('workspace_entries').delete().eq('recording_id', fixture.uuidRecordingId))
  await step('legacy workspace entry', () => fixture.admin.from('workspace_entries').delete().eq('recording_id', fixture.legacyRecordingId))
  await step('bridge recordings', () => fixture.admin.from('recordings').delete().in('id', [
    fixture.uuidRecordingId,
    fixture.legacyRecordingId,
  ]))

  if (failures.length > 0) throw new Error(`MCP fixture cleanup failed:\n${failures.join('\n')}`)
}

async function markdown(response: Response): Promise<string> {
  const body = await response.json() as RpcBody
  expect(body.error).toBeUndefined()
  expect(body.result).toEqual({
    content: [expect.objectContaining({ type: 'text', text: expect.any(String) })],
  })
  expect(Object.keys(body.result ?? {})).toEqual(['content'])
  const text = body.result?.content?.[0]?.text
  if (!text) throw new Error('MCP response omitted content[0].text')
  expect(() => JSON.parse(text)).toThrow()
  return text
}

describe.skipIf(!integrationDbReachable)('MCP UUID share bridge', () => {
  let fixture: McpFixture
  let uuidShareLinkId: string | null = null

  beforeAll(async () => {
    fixture = await createMcpFixture()
  }, 60_000)

  afterAll(async () => {
    if (fixture) await cleanupMcpFixture(fixture, uuidShareLinkId)
  }, 60_000)

  function token(): McpToken {
    return {
      id: 'phase-38-owner-token',
      user_id: fixture.ownerId,
      org_id: fixture.organizationId,
      workspace_id: null,
      scope: 'organization',
      name: 'Phase 38 owner',
      enabled_categories: null,
    }
  }

  function context(params: Record<string, unknown>): ToolHandlerContext {
    return {
      id: 38,
      params,
      supabase: fixture.admin,
      mcpToken: token(),
      corsHeaders: {},
      fetchOrgWorkspaceIds: async () => ({ ids: [fixture.workspaceId], error: false }),
    }
  }

  it.fails('creates, lists, and revokes a UUID-only non-Fathom share with markdown /s/<token> output', async () => {
    const createResponse = await createShareLinkTool.handler(context({
      recording_id: fixture.uuidRecordingId,
      recipient_email: fixture.ownerEmail,
      expires_in_days: 7,
    }))
    const createText = await markdown(createResponse)
    expect(createText).toContain('Share link created:')
    expect(createText).toMatch(/https:\/\/app\.callvaultai\.com\/s\/[A-Za-z0-9_-]+/)
    expect(createText).not.toContain('/shared/')

    const row = await fixture.admin
      .from('call_share_links')
      .select('id, recording_id, call_recording_id, share_token')
      .eq('recording_id', fixture.uuidRecordingId)
      .eq('user_id', fixture.ownerId)
      .single()
    expect(row.error).toBeNull()
    expect(row.data).toMatchObject({
      recording_id: fixture.uuidRecordingId,
      call_recording_id: null,
    })
    uuidShareLinkId = row.data?.id ?? null

    const listText = await markdown(await listSharedCallsTool.handler(context({ limit: 20 })))
    expect(listText).toContain(fixture.uuidRecordingId)
    expect(listText).toContain(`${fixture.prefix} UUID recording`)

    const revokeText = await markdown(await revokeShareLinkTool.handler(context({
      share_link_id: uuidShareLinkId,
    })))
    expect(revokeText).toBe('Share link revoked')
    const revoked = await fixture.admin.from('call_share_links').select('status').eq('id', uuidShareLinkId).single()
    expect(revoked.data?.status).toBe('revoked')
  }, 30_000)

  it('keeps legacy-only sharing usable through the isolated fallback', async () => {
    const listText = await markdown(await listSharedCallsTool.handler(context({ limit: 20 })))
    expect(listText).toContain(fixture.legacyRecordingId)

    const revokeText = await markdown(await revokeShareLinkTool.handler(context({
      share_link_id: fixture.legacyShareLinkId,
    })))
    expect(revokeText).toBe('Share link revoked')
  })
})
