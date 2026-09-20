import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  CANARY_MARKER,
  EXPECTED_ROLES,
  assertTargetGuard,
  buildCanaryUsers,
  evaluateLegacyInventory,
  formatInventoryEvidence,
  provisionCanary,
  cleanupCanary,
  stableUnresolvedFingerprint,
  type CanaryAdapter,
  type CanaryManifest,
} from '../phase38-production-canary.js'

const TEST_REF = 'swjzxiddcrtaqixsfaac'
const PROD_REF = 'vltmrnjsubfzrgrtdqey'

class FakeAdapter implements CanaryAdapter {
  readonly createdUsers: Array<{ id: string; email: string; role: string }> = []
  readonly deletedUsers: string[] = []
  graphCreated = false
  graphCleaned = false
  failGraph = false

  async createAuthUser(input: { email: string; password: string; role: string; runId: string }) {
    const user = { id: `user-${input.role}`, email: input.email, role: input.role }
    this.createdUsers.push(user)
    return user.id
  }

  async deleteAuthUser(id: string) {
    if (!this.deletedUsers.includes(id)) this.deletedUsers.push(id)
  }

  async createGraph(_manifest: CanaryManifest) {
    this.graphCreated = true
    if (this.failGraph) throw new Error('synthetic graph failure')
  }

  async cleanupGraph(_manifest: CanaryManifest) {
    this.graphCleaned = true
  }

  async residue(manifest: CanaryManifest) {
    const remainingUsers = manifest.users.filter((user) => !this.deletedUsers.includes(user.id)).length
    return { authUsers: remainingUsers, graphRows: this.graphCleaned ? 0 : Number(this.graphCreated) }
  }
}

function manifestPath(label: string): string {
  return `/tmp/phase38-${label}-${randomUUID()}.json`
}

describe('Phase 38 production canary safety contracts', () => {
  it('requires exact target refs and explicit production mutation confirmation', () => {
    expect(() => assertTargetGuard({
      target: 'test', projectRef: TEST_REF, action: 'provision', confirmation: undefined,
    })).not.toThrow()
    expect(() => assertTargetGuard({
      target: 'test', projectRef: PROD_REF, action: 'inventory', confirmation: undefined,
    })).toThrow(/TEST project ref/i)
    expect(() => assertTargetGuard({
      target: 'production', projectRef: PROD_REF, action: 'provision', confirmation: undefined,
    })).toThrow(/confirm-production/i)
    expect(() => assertTargetGuard({
      target: 'production', projectRef: PROD_REF, action: 'cleanup', confirmation: PROD_REF,
    })).not.toThrow()
  })

  it('builds exactly the six approved roles using reserved non-routable addresses', () => {
    const users = buildCanaryUsers('abc123')
    expect(users).toHaveLength(6)
    expect(users.map((user) => user.role)).toEqual(EXPECTED_ROLES)
    expect(new Set(users.map((user) => user.email)).size).toBe(6)
    expect(users.every((user) => user.email.endsWith('@phase38.invalid'))).toBe(true)
  })

  it('provisions six users, writes a mode-0600 manifest, and cleans idempotently', async () => {
    const adapter = new FakeAdapter()
    const path = manifestPath('success')
    const manifest = await provisionCanary(adapter, {
      target: 'test', projectRef: TEST_REF, manifestPath: path, runId: 'success123',
    })

    expect(adapter.createdUsers).toHaveLength(6)
    expect(adapter.graphCreated).toBe(true)
    expect(manifest.marker).toBe(CANARY_MARKER)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(path, 'utf8')).users).toHaveLength(6)

    await cleanupCanary(adapter, manifest, path)
    await cleanupCanary(adapter, manifest, path)
    expect(new Set(adapter.deletedUsers).size).toBe(6)
    await expect(adapter.residue(manifest)).resolves.toEqual({ authUsers: 0, graphRows: 0 })
  })

  it('cleans exactly the partially created run when graph provisioning fails', async () => {
    const adapter = new FakeAdapter()
    adapter.failGraph = true
    const path = manifestPath('partial')

    await expect(provisionCanary(adapter, {
      target: 'test', projectRef: TEST_REF, manifestPath: path, runId: 'partial123',
    })).rejects.toThrow(/synthetic graph failure/)
    expect(adapter.createdUsers).toHaveLength(6)
    expect(new Set(adapter.deletedUsers)).toEqual(new Set(adapter.createdUsers.map((user) => user.id)))
    expect(adapter.graphCleaned).toBe(true)
  })

  it('computes an order-independent fingerprint and accepts only the approved two-row baseline', () => {
    const unresolved = [
      { identity: 'row-b|owner-b|22', classification: 'cross_owner_only' as const },
      { identity: 'row-a|owner-a|11', classification: 'source_absent' as const },
    ]
    const fingerprint = stableUnresolvedFingerprint(unresolved)
    expect(stableUnresolvedFingerprint([...unresolved].reverse())).toBe(fingerprint)

    const inventory = evaluateLegacyInventory({
      shareLinks: [
        { id: 'row-a', user_id: 'owner-a', recording_id: null, call_recording_id: 11 },
        { id: 'row-b', user_id: 'owner-b', recording_id: null, call_recording_id: 22 },
      ],
      recordings: [
        { id: 'recording-cross', owner_user_id: 'different-owner', fathom_provider_id: 22 },
      ],
      expectedFingerprint: fingerprint,
    })
    expect(inventory).toMatchObject({
      unresolvedCount: 2,
      sourceAbsentCount: 1,
      crossOwnerOnlyCount: 1,
      ambiguousCount: 0,
      unsafeCrossOwnerAssignments: 0,
      keylessCount: 0,
      status: 'PASS',
    })
  })

  it('rejects fingerprint drift, same-owner ambiguity, unsafe UUID assignment, and keyless rows', () => {
    const inventory = evaluateLegacyInventory({
      shareLinks: [
        { id: 'ambiguous', user_id: 'owner-a', recording_id: null, call_recording_id: 11 },
        { id: 'unsafe', user_id: 'owner-a', recording_id: 'recording-cross', call_recording_id: null },
        { id: 'keyless', user_id: 'owner-a', recording_id: null, call_recording_id: null },
      ],
      recordings: [
        { id: 'one', owner_user_id: 'owner-a', fathom_provider_id: 11 },
        { id: 'two', owner_user_id: 'owner-a', fathom_provider_id: 11 },
        { id: 'recording-cross', owner_user_id: 'different-owner', fathom_provider_id: 22 },
      ],
      expectedFingerprint: `sha256:${'0'.repeat(64)}`,
    })
    expect(inventory.status).toBe('STOP')
    expect(inventory.ambiguousCount).toBe(1)
    expect(inventory.unsafeCrossOwnerAssignments).toBe(1)
    expect(inventory.keylessCount).toBe(1)
  })

  it('formats only redacted aggregate inventory evidence', () => {
    const evidence = formatInventoryEvidence({
      unresolvedCount: 2,
      sourceAbsentCount: 1,
      crossOwnerOnlyCount: 1,
      ambiguousCount: 0,
      unsafeCrossOwnerAssignments: 0,
      keylessCount: 0,
      fingerprint: `sha256:${'a'.repeat(64)}`,
      status: 'PASS',
    })
    expect(evidence).toContain('"unresolvedCount":2')
    expect(evidence).toContain(`sha256:${'a'.repeat(64)}`)
    expect(evidence).not.toMatch(/row-a|owner-a|recording-cross|phase38\.invalid|token|service/i)
  })
})
