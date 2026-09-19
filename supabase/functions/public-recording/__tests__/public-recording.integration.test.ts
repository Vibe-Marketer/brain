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

const ALLOWED_KEYS = [
  'call_name',
  'duration',
  'full_transcript',
  'recording_id',
  'recording_start_time',
] as const

const FORBIDDEN_KEYS = [
  'access_level', 'event_id', 'organization_id', 'owner_user_id', 'provider',
  'recorded_by_email', 'share_url', 'source_app', 'source_call_id', 'source_metadata',
  'summary', 'thumbnail_url', 'workspace_id',
] as const

function endpoint(recordingId: string): { url: string; anonKey: string } {
  const config = getIntegrationTestFetchConfig()
  if (!config) throw new Error('dedicated test fetch configuration is unavailable')
  const base = assertDedicatedTestProject(config.url)
  return {
    url: `${base}/functions/v1/public-recording?recording_id=${encodeURIComponent(recordingId)}`,
    anonKey: config.anonKey,
  }
}

async function getPublicRecording(recordingId: string) {
  const target = endpoint(recordingId)
  const response = await fetch(target.url, { headers: { apikey: target.anonKey } })
  return { response, body: await response.json() as Record<string, unknown> }
}

describe.skipIf(!integrationDbReachable)('public-recording allowlisted response', () => {
  let graph: Phase38FixtureGraph

  beforeAll(async () => {
    graph = await createPhase38FixtureGraph(`phase38-pub-${Date.now().toString(36)}`)
  }, 60_000)

  afterAll(async () => {
    if (graph) await cleanupPhase38FixtureGraph(graph)
  }, 60_000)

  async function setLevel(level: 'private' | 'attendees' | 'invitees' | 'organization' | 'link' | 'public') {
    const result = await graph.admin.from('recordings').update({ access_level: level }).eq('id', graph.ids.uuidRecordingId)
    if (result.error) throw new Error(`set access level ${level}: ${result.error.message}`)
  }

  it('returns exactly the five safe content keys for an explicitly Public recording', async () => {
    await setLevel('public')
    const result = await getPublicRecording(graph.ids.uuidRecordingId)
    expect(result.response.status).toBe(200)
    expect(Object.keys(result.body).sort()).toEqual([...ALLOWED_KEYS])
    expect(result.body).toMatchObject({
      recording_id: graph.ids.uuidRecordingId,
      call_name: expect.any(String),
    })
    for (const key of FORBIDDEN_KEYS) expect(result.body).not.toHaveProperty(key)
  })

  it.each(['private', 'attendees', 'invitees', 'organization', 'link'] as const)(
    'returns the same generic unavailable response for %s',
    async (level) => {
      await setLevel(level)
      const result = await getPublicRecording(graph.ids.uuidRecordingId)
      expect(result.response.status).toBe(404)
      expect(result.body).toEqual({ code: 'RECORDING_NOT_AVAILABLE', error: 'This recording is not available.' })
      for (const key of [...ALLOWED_KEYS, ...FORBIDDEN_KEYS]) expect(result.body).not.toHaveProperty(key)
    },
  )

  it('does not distinguish missing and malformed UUID requests from non-Public recordings', async () => {
    await setLevel('private')
    const [privateResult, missingResult, malformedResult] = await Promise.all([
      getPublicRecording(graph.ids.uuidRecordingId),
      getPublicRecording(crypto.randomUUID()),
      getPublicRecording('not-a-uuid'),
    ])
    expect(privateResult.response.status).toBe(404)
    expect(missingResult.response.status).toBe(404)
    expect(malformedResult.response.status).toBe(404)
    expect(missingResult.body).toEqual(privateResult.body)
    expect(malformedResult.body).toEqual(privateResult.body)
  })
})
