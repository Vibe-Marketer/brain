import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  cleanupPhase38FixtureGraph,
  createPhase38FixtureGraph,
  type Phase38FixtureGraph,
} from '../../../../src/test/phase38-fixtures'
import { integrationDbReachable } from '../../../../src/test/integration-setup'
import { listSharedCallsTool } from '../tools/read/list_shared_calls'
import type { McpToken, ToolHandlerContext } from '../tools/_types'
import { createShareLinkTool } from '../tools/write/create_share_link'
import { revokeShareLinkTool } from '../tools/write/revoke_share_link'

type RpcBody = {
  result?: { content?: Array<{ type?: string; text?: string }> }
  error?: unknown
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
  let graph: Phase38FixtureGraph

  beforeAll(async () => {
    graph = await createPhase38FixtureGraph(`phase38-mcp-${Date.now()}`)
    const entry = await graph.admin.from('workspace_entries').insert({
      workspace_id: graph.ids.workspaceId,
      recording_id: graph.ids.uuidRecordingId,
    })
    if (entry.error && !entry.error.message.toLowerCase().includes('duplicate')) {
      throw new Error(`create MCP workspace entry: ${entry.error.message}`)
    }
  }, 60_000)

  afterAll(async () => {
    if (graph) await cleanupPhase38FixtureGraph(graph)
  }, 60_000)

  function token(role: 'owner' | 'grantRecipient'): McpToken {
    return {
      id: `${role}-token`,
      user_id: graph.users[role].id,
      org_id: graph.ids.organizationId,
      workspace_id: null,
      scope: 'organization',
      name: `Phase 38 ${role}`,
      enabled_categories: null,
    }
  }

  function context(
    role: 'owner' | 'grantRecipient',
    params: Record<string, unknown>,
  ): ToolHandlerContext {
    return {
      id: 38,
      params,
      supabase: graph.admin,
      mcpToken: token(role),
      corsHeaders: {},
      fetchOrgWorkspaceIds: async () => ({ ids: [graph.ids.workspaceId], error: false }),
    }
  }

  it.fails('creates, lists, and revokes a UUID-only non-Fathom share with markdown /s/<token> output', async () => {
    const createResponse = await createShareLinkTool.handler(context('owner', {
      recording_id: graph.ids.uuidRecordingId,
      recipient_email: graph.users.grantRecipient.email,
      expires_in_days: 7,
    }))
    const createText = await markdown(createResponse)
    expect(createText).toContain('Share link created:')
    expect(createText).toMatch(/https:\/\/app\.callvaultai\.com\/s\/[A-Za-z0-9_-]+/)
    expect(createText).not.toContain('/shared/')

    const row = await graph.admin
      .from('call_share_links')
      .select('id, recording_id, call_recording_id, share_token')
      .eq('recording_id', graph.ids.uuidRecordingId)
      .eq('user_id', graph.users.owner.id)
      .single()
    expect(row.error).toBeNull()
    expect(row.data).toMatchObject({
      recording_id: graph.ids.uuidRecordingId,
      call_recording_id: null,
    })

    const listText = await markdown(await listSharedCallsTool.handler(context('grantRecipient', { limit: 20 })))
    expect(listText).toContain(graph.ids.uuidRecordingId)
    expect(listText).toContain(`${graph.prefix} UUID recording`)

    const revokeText = await markdown(await revokeShareLinkTool.handler(context('owner', {
      share_link_id: row.data?.id,
    })))
    expect(revokeText).toBe('Share link revoked')
    const revoked = await graph.admin.from('call_share_links').select('status').eq('id', row.data?.id).single()
    expect(revoked.data?.status).toBe('revoked')
  }, 30_000)

  it('keeps legacy-only sharing usable through the isolated fallback', async () => {
    const listText = await markdown(await listSharedCallsTool.handler(context('grantRecipient', { limit: 20 })))
    expect(listText).toContain(graph.ids.legacyRecordingId)
    expect(listText).toContain(`${graph.prefix} legacy recording`)

    const revokeText = await markdown(await revokeShareLinkTool.handler(context('owner', {
      share_link_id: graph.ids.legacyShareLinkId,
    })))
    expect(revokeText).toBe('Share link revoked')
  })
})
