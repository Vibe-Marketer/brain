import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  cleanupPhase38FixtureGraph,
  createPhase38FixtureGraph,
  type Phase38FixtureGraph,
} from '../../../../src/test/phase38-fixtures'
import {
  assertDedicatedTestProject,
  getIntegrationTestFetchConfig,
  integrationDbReachable,
} from '../../../../src/test/integration-setup'

type JsonRecord = Record<string, unknown>

async function bearerFor(graph: Phase38FixtureGraph, role: 'owner' | 'confirmedParticipant' | 'unrelated') {
  const session = await graph.clients.signedIn[role].auth.getSession()
  const token = session.data.session?.access_token
  if (!token) throw new Error(`missing ${role} fixture access token`)
  return token
}

function functionUrl(): { url: string; anonKey: string } {
  const config = getIntegrationTestFetchConfig()
  if (!config) throw new Error('dedicated test fetch configuration is unavailable')
  return {
    url: `${assertDedicatedTestProject(config.url)}/functions/v1/recording-access`,
    anonKey: config.anonKey,
  }
}

async function invoke(
  body: JsonRecord,
  token?: string,
): Promise<{ response: Response; json: JsonRecord }> {
  const target = functionUrl()
  const response = await fetch(target.url, {
    method: 'POST',
    headers: {
      apikey: target.anonKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return { response, json: await response.json() as JsonRecord }
}

function expectRpcRows(label: string, result: { data: unknown; error: { message: string } | null }) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  if (!Array.isArray(result.data) || result.data.length === 0) {
    throw new Error(`${label}: RPC returned no rows`)
  }
  return result.data as JsonRecord[]
}

describe.skipIf(!integrationDbReachable)('recording-access trusted email boundary', () => {
  let graph: Phase38FixtureGraph

  beforeAll(async () => {
    graph = await createPhase38FixtureGraph(`phase38-email-${Date.now()}`)
  }, 60_000)

  afterAll(async () => {
    if (graph) await cleanupPhase38FixtureGraph(graph)
  }, 60_000)

  async function createPendingRequest(): Promise<string> {
    const result = await graph.clients.signedIn.confirmedParticipant.rpc('request_recording_access', {
      p_recording_id: graph.ids.uuidRecordingId,
    })
    const row = expectRpcRows('request_recording_access', result)[0]
    const requestId = row.request_id ?? row.id
    if (typeof requestId !== 'string') throw new Error('request RPC did not return a request UUID')
    return requestId
  }

  it('rejects a request with no JWT', async () => {
    const result = await invoke({ request_id: crypto.randomUUID() })
    expect(result.response.status).toBe(401)
    expect(result.json).toMatchObject({ code: expect.any(String) })
  })

  it('rejects a bad JWT without exposing whether the request exists', async () => {
    const result = await invoke(
      { request_id: crypto.randomUUID() },
      'not-a-valid-jwt',
    )
    expect(result.response.status).toBe(401)
    expect(JSON.stringify(result.json)).not.toMatch(/owner|requester|recording|email/i)
  })

  it('rejects authenticated callers who are neither the requester nor owner', async () => {
    const requestId = await createPendingRequest()
    const result = await invoke({ request_id: requestId }, await bearerFor(graph, 'unrelated'))
    expect(result.response.status).toBe(404)
    expect(result.json).toEqual({ code: 'REQUEST_NOT_AVAILABLE', error: 'This access request is no longer available.' })
  })

  it('accepts only request_id and rejects client-supplied trusted email fields', async () => {
    const requestId = await createPendingRequest()
    const token = await bearerFor(graph, 'confirmedParticipant')
    const forged = await invoke({
      request_id: requestId,
      owner_email: 'attacker@example.invalid',
      requester_name: '<img src=x onerror=alert(1)>',
      meeting_title: '<script>forged title</script>',
      evidence: 'forged evidence',
    }, token)
    expect(forged.response.status).toBe(400)
    expect(forged.json).toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('loads trusted values server-side, escapes dynamic text, and delivers once for retries', async () => {
    const requestId = await createPendingRequest()
    const token = await bearerFor(graph, 'confirmedParticipant')

    await graph.admin.from('recordings').update({
      title: 'Quarterly <script>alert("meeting")</script> & review',
    }).eq('id', graph.ids.uuidRecordingId)
    await graph.admin.from('call_participants').update({
      name: 'Requester <img src=x onerror=alert(1)>',
    }).eq('recording_id', graph.ids.uuidRecordingId)
      .eq('identity_id', graph.ids.confirmedIdentityId)

    const first = await invoke({ request_id: requestId }, token)
    const retry = await invoke({ request_id: requestId }, token)
    expect(first.response.status).toBe(200)
    expect(retry.response.status).toBe(200)

    const outbox = await graph.admin
      .from('recording_access_email_outbox')
      .select('request_id, status, attempt_count, payload_snapshot')
      .eq('request_id', requestId)
    expect(outbox.error).toBeNull()
    expect(outbox.data).toHaveLength(1)
    expect(outbox.data?.[0]).toMatchObject({ request_id: requestId })

    const serialized = JSON.stringify(outbox.data?.[0]?.payload_snapshot ?? {})
    expect(serialized).toContain('&lt;script&gt;')
    expect(serialized).toContain('&lt;img')
    expect(serialized).not.toContain('<script>')
    expect(serialized).not.toContain('<img')
  }, 30_000)

  it('keeps the request, notification, audit, and retryable outbox after provider failure', async () => {
    const requestId = await createPendingRequest()
    const token = await bearerFor(graph, 'confirmedParticipant')
    const result = await invoke({ request_id: requestId }, token)
    expect([200, 202, 503]).toContain(result.response.status)

    const [request, notification, audit, outbox] = await Promise.all([
      graph.admin.from('recording_access_requests').select('id, status').eq('id', requestId).single(),
      graph.admin.from('user_notifications').select('id').eq('type', 'recording_access_requested').contains('metadata', { request_id: requestId }),
      graph.admin.from('recording_access_audit_log').select('id').eq('request_id', requestId).eq('action', 'requested'),
      graph.admin.from('recording_access_email_outbox').select('request_id, status, attempt_count').eq('request_id', requestId).single(),
    ])
    expect(request.error).toBeNull()
    expect(notification.error).toBeNull()
    expect(notification.data).toHaveLength(1)
    expect(audit.error).toBeNull()
    expect(audit.data).toHaveLength(1)
    expect(outbox.error).toBeNull()
    expect(outbox.data?.status).toMatch(/pending|failed|sent/)
    expect(outbox.data?.attempt_count).toBeGreaterThanOrEqual(1)
  }, 30_000)
})
