import { describe, expect, it } from 'vitest'

import {
  PHASE39_TEST_PROJECT_REF,
  assertPhase39TestProject,
  cleanupPhase39FixtureGraph,
  createPhase39FixtureGraph,
  findPhase39FixtureResidue,
} from '@/test/phase39-fixtures'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '@/test/integration-setup'

describe('Phase 39 fixture target guard', () => {
  it('accepts only the dedicated Phase 39 TEST project', () => {
    expect(assertPhase39TestProject(`https://${PHASE39_TEST_PROJECT_REF}.supabase.co`))
      .toBe(`https://${PHASE39_TEST_PROJECT_REF}.supabase.co`)
    expect(() => assertPhase39TestProject('https://vltmrnjsubfzrgrtdqey.supabase.co'))
      .toThrow(/production/i)
    expect(() => assertPhase39TestProject('https://another-test-ref.supabase.co'))
      .toThrow(/dedicated TEST project/i)
    expect(() => assertPhase39TestProject('http://localhost:54321'))
      .toThrow(/dedicated TEST project/i)
  })
})

describe.skipIf(!integrationDbReachable)('Phase 39 fixture graph lifecycle', () => {
  const admin = makeIntegrationClient()

  for (const cycle of [1, 2]) {
    it(`creates every authorization/privacy fixture and fully cleans cycle ${cycle}`, async () => {
      const prefix = `phase39-p01-c${cycle}-${Date.now()}`
      const graph = await createPhase39FixtureGraph(prefix)

      expect(Object.keys(graph.users).sort()).toEqual([
        'calendarOnly',
        'confirmedPrimary',
        'conflictingAliasOwner',
        'disconnectedAlias',
        'nameOnly',
        'organizationOnly',
        'owner',
        'unrelated',
        'unverifiedAlias',
        'verifiedAlias',
      ])
      expect(Object.keys(graph.events).sort()).toEqual([
        'aliasAvailable',
        'calendarOnlyDenied',
        'confirmedPrimaryNeedsAction',
        'disconnectedAliasDenied',
        'mixedCopies',
        'nameOnlyDenied',
        'notificationBaseline',
        'organizationOnlyDenied',
        'participants49',
        'participants50',
        'participants51',
        'requestApproved',
        'requestCooldown',
        'requestPending',
        'requestRejected',
        'unverifiedAliasDenied',
        'webinarDenied',
      ])
      expect(graph.participants.confirmedPrimary.identityId).toBeNull()
      expect(graph.participants.verifiedAlias.identityId).toBeNull()
      expect(graph.participants.calendarOnly.hasConfirmedSpeech).toBe(false)
      expect(graph.participantBoundaries).toEqual({
        participants49: 49,
        participants50: 50,
        participants51: 51,
      })
      expect(graph.requests).toMatchObject({
        pending: { status: 'pending' },
        approved: { status: 'approved' },
        rejected: { status: 'denied' },
        cooldown: { status: 'denied' },
      })

      await cleanupPhase39FixtureGraph(graph)
      await expect(findPhase39FixtureResidue(admin, prefix)).resolves.toEqual({
        authUsers: 0,
        organizations: 0,
        events: 0,
        recordings: 0,
        participants: 0,
        identities: 0,
        aliases: 0,
        requests: 0,
        grants: 0,
        notifications: 0,
      })
    }, 180_000)
  }
})
