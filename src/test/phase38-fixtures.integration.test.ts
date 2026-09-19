import { describe, expect, it } from 'vitest'

import {
  cleanupPhase38FixtureGraph,
  createPhase38FixtureGraph,
  findPhase38FixtureResidue,
} from '@/test/phase38-fixtures'
import {
  PHASE38_EVENT_AGGREGATION_CASES,
  PHASE38_PARTICIPATION_BOUNDARY_CASES,
  PHASE38_PROVIDER_SIGNAL_CASES,
} from '@/test/fixtures/phase38-provider-event-kind'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '@/test/integration-setup'

describe('Phase 38 provider and event boundary fixtures', () => {
  it('pins every documented Zoom type and every non-Zoom/internal source', () => {
    const zoom = PHASE38_PROVIDER_SIGNAL_CASES.filter((fixture) => fixture.sourceApp === 'zoom')
    expect(zoom.map((fixture) => fixture.signal)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 99, null, 'malformed', 42,
    ])
    expect(zoom.filter((fixture) => fixture.expected === 'webinar').map((fixture) => fixture.signal))
      .toEqual([5, 6, 9])

    expect(PHASE38_PROVIDER_SIGNAL_CASES.map((fixture) => fixture.sourceApp)).toEqual(
      expect.arrayContaining([
        'fathom', 'fireflies', 'read-ai', 'grain', 'plaud', 'youtube',
        'file-upload', 'paste-transcript', 'manual-mcp-import',
      ]),
    )
    expect(PHASE38_PROVIDER_SIGNAL_CASES.find((fixture) => fixture.sourceApp === 'grain'))
      .toMatchObject({ expected: 'unknown', metadata: { grain_meeting_type: { name: 'Executive webinar' } } })
  })

  it('pins positive-webinar aggregation, neutral unknowns, and the 49/50 boundary', () => {
    expect(PHASE38_EVENT_AGGREGATION_CASES).toEqual(expect.arrayContaining([
      expect.objectContaining({ signals: ['webinar', 'unknown'], suppressesDiscovery: true }),
      expect.objectContaining({ signals: ['webinar', 'non_webinar'], suppressesDiscovery: true }),
      expect.objectContaining({ signals: ['non_webinar', 'unknown'], suppressesDiscovery: false }),
      expect.objectContaining({ signals: ['unknown'], suppressesDiscovery: false }),
    ]))
    expect(PHASE38_PARTICIPATION_BOUNDARY_CASES).toEqual(expect.arrayContaining([
      expect.objectContaining({ confirmedIdentityCount: 49, suppressesDiscovery: false }),
      expect.objectContaining({ confirmedIdentityCount: 50, suppressesDiscovery: true }),
      expect.objectContaining({ requesterEvidence: 'invitee_only', mayDiscover: false }),
      expect.objectContaining({ requesterEvidence: 'organization_only', mayDiscover: false }),
      expect.objectContaining({ requesterEvidence: 'unverified', mayDiscover: false }),
    ]))
  })
})

describe.skipIf(!integrationDbReachable)('Phase 38 fixture graph lifecycle', () => {
  const admin = makeIntegrationClient()

  for (const cycle of [1, 2]) {
    it(`creates and fully cleans isolated fixture cycle ${cycle}`, async () => {
      const prefix = `phase38-p01-c${cycle}-${Date.now()}`
      const graph = await createPhase38FixtureGraph(prefix)

      expect(graph.prefix).toBe(prefix)
      expect(graph.recordings.uuidOnly.fathomProviderId).toBeNull()
      expect(Object.keys(graph.clients.signedIn)).toHaveLength(8)
      expect(graph.participants.confirmed.identityId).toBeTruthy()
      expect(graph.participants.inviteeOnly.identityId).toBeTruthy()

      await cleanupPhase38FixtureGraph(graph)
      await expect(findPhase38FixtureResidue(admin, prefix)).resolves.toEqual({
        authUsers: 0,
        organizations: 0,
        events: 0,
        recordings: 0,
        participants: 0,
        identities: 0,
        aliases: 0,
        shareLinks: 0,
        accessLogs: 0,
      })
    }, 120_000)
  }
})
