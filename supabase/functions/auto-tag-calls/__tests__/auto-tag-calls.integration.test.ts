/**
 * Integration test — auto-tag-calls Edge Function (BUG-01, Phase 30).
 *
 * Invokes the LIVE deployed `auto-tag-calls` function via the Supabase
 * client. Uses `dryRun: true` so OpenRouter is queried but tags are NOT
 * written back to fathom_raw_calls / recordings — keeps the suite cheap
 * and free of side effects on production data.
 *
 * Skips cleanly when SUPABASE_SERVICE_ROLE_KEY (or the test-specific
 * SUPABASE_TEST_SERVICE_ROLE_KEY) is not set.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../../../../src/test/integration-setup'

const TEST_LEGACY_ID =
  999_000_000 + Math.floor((Date.now() % 1_000_000) / 10)
const TEST_TITLE = '[phase-30-04 auto-tag integration] do-not-touch'

describe.skipIf(!integrationDbReachable)('BUG-01: auto-tag-calls integration', () => {
  const db = makeIntegrationClient()

  let orgId: string
  let userId: string
  let recordingId: string

  beforeAll(async () => {
    // Donor: pick the first existing fathom recording — gives us a valid
    // org_id + user_id pair without needing to provision auth.users.
    const donor = await db
      .from('recordings')
      .select('organization_id, owner_user_id')
      .eq('source_app', 'fathom')
      .limit(1)
      .maybeSingle()

    if (donor.error || !donor.data) {
      throw new Error(
        `Integration setup failed — no donor recording found: ${donor.error?.message}`
      )
    }

    orgId = donor.data.organization_id as string
    userId = donor.data.owner_user_id as string

    // Cleanup any leftover fixtures from a prior aborted run
    await db
      .from('recordings')
      .delete()
      .eq('legacy_recording_id', TEST_LEGACY_ID)
      .eq('organization_id', orgId)
    await db.from('fathom_raw_calls').delete().eq('recording_id', TEST_LEGACY_ID)

    // Seed a fathom_raw_calls row so auto-tag-calls has source content to read
    const fathomInsert = await db.from('fathom_raw_calls').insert({
      recording_id: TEST_LEGACY_ID,
      user_id: userId,
      title: TEST_TITLE,
      full_transcript:
        'Hello. This is a brief test transcript. We discussed product onboarding and customer support handoff. Goodbye.',
      summary: 'Brief test call discussing onboarding handoff to support.',
      source_platform: 'fathom',
      recording_start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      recording_end_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    })

    if (fathomInsert.error) {
      throw new Error(
        `Failed to seed fathom_raw_calls: ${fathomInsert.error.message}`
      )
    }

    // Seed a recordings row mirroring the fathom call
    const recInsert = await db
      .from('recordings')
      .insert({
        legacy_recording_id: TEST_LEGACY_ID,
        organization_id: orgId,
        owner_user_id: userId,
        title: TEST_TITLE,
        source_app: 'fathom',
        source_call_id: String(TEST_LEGACY_ID),
        full_transcript:
          'Hello. This is a brief test transcript. We discussed product onboarding and customer support handoff. Goodbye.',
        summary: 'Brief test call discussing onboarding handoff to support.',
        source_metadata: { integration_test: 'phase-30-04' },
      })
      .select('id')
      .single()

    if (recInsert.error || !recInsert.data) {
      throw new Error(`Failed to seed recordings: ${recInsert.error?.message}`)
    }
    recordingId = recInsert.data.id as string
  })

  afterAll(async () => {
    if (recordingId) {
      await db.from('recordings').delete().eq('id', recordingId)
    }
    await db.from('fathom_raw_calls').delete().eq('recording_id', TEST_LEGACY_ID)
  })

  it('invokes auto-tag-calls with a Fathom numeric recordingId without UUID type error', async () => {
    // dryRun=true ensures we don't actually write auto_tags back. We still
    // hit the full DB pipeline (lookup tag_preferences, query historical
    // patterns, etc.) — which is what would have crashed pre-fix.
    const invokeResp = await db.functions.invoke('auto-tag-calls', {
      body: {
        recordingIds: [TEST_LEGACY_ID],
        user_id: userId,
        organization_id: orgId,
        dryRun: true,
      },
    })

    // The critical signal: no `invalid input syntax for type uuid` error.
    // The function may legitimately return non-2xx if OpenRouter quota is
    // exhausted, but it should NEVER fail on a UUID type error.
    const errorMessage = invokeResp.error?.message ?? ''
    expect(errorMessage).not.toMatch(/invalid input syntax for type uuid/i)

    // If invocation succeeded, double-check the payload doesn't carry a
    // UUID type error in its error trace.
    if (invokeResp.data) {
      const payloadJson = JSON.stringify(invokeResp.data)
      expect(payloadJson).not.toMatch(/invalid input syntax for type uuid/i)
    }
  }, 60_000)
})
