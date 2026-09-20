import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'

import { afterEach, describe, expect, it } from 'vitest'

import {
  CANARY_MARKER,
  PRODUCTION_PROJECT_REF,
  TEST_PROJECT_REF,
  assertSourceFingerprint,
  assertTargetGuard,
  cleanupCanary,
  formatEvidence,
  provisionCanary,
  type CanaryAdapter,
  type CanaryManifest,
  type CanaryUserSpec,
} from '../phase39-production-canary.js'

class FakeAdapter implements CanaryAdapter {
  calls: string[] = []
  users = new Set<string>()
  graphRows = 0
  failAfterUsers?: number

  async createAuthUser(input: CanaryUserSpec): Promise<string> {
    this.calls.push(`create:${input.role}`)
    if (this.failAfterUsers !== undefined && this.users.size >= this.failAfterUsers) {
      throw new Error('synthetic partial provision failure')
    }
    const id = `00000000-0000-4000-8000-${String(this.users.size + 1).padStart(12, '0')}`
    this.users.add(id)
    return id
  }

  async deleteAuthUser(id: string): Promise<void> {
    this.calls.push('delete:user')
    this.users.delete(id)
  }

  async createGraph(_manifest: CanaryManifest): Promise<void> {
    this.calls.push('create:graph')
    this.graphRows = 9
  }

  async verifyGraph(_manifest: CanaryManifest): Promise<Record<string, number | string | boolean>> {
    this.calls.push('verify:graph')
    return {
      discovery_count: 1,
      claim_winners: 1,
      claim_replay_denied: true,
      notification_count: 1,
      content_rows: 0,
      participants_preserved: 1,
    }
  }

  async cleanupGraph(_manifest: CanaryManifest): Promise<void> {
    this.calls.push('cleanup:graph')
    this.graphRows = 0
  }

  async residue(_manifest?: CanaryManifest): Promise<{ authUsers: number; graphRows: number }> {
    this.calls.push('check:residue')
    return { authUsers: this.users.size, graphRows: this.graphRows }
  }
}

const paths: string[] = []
const fingerprint = `sha256:${'a'.repeat(64)}`

function manifestPath(label: string): string {
  const path = `/tmp/phase39-${label}-${randomUUID()}.json`
  paths.push(path)
  return path
}

afterEach(() => {
  paths.length = 0
})

describe('Phase 39 canary guards', () => {
  it('rejects target/ref mismatches before any adapter I/O', async () => {
    const adapter = new FakeAdapter()
    await expect(provisionCanary(adapter, {
      target: 'test',
      projectRef: PRODUCTION_PROJECT_REF,
      sourceFingerprint: fingerprint,
      expectedSourceFingerprint: fingerprint,
      manifestPath: manifestPath('wrong-ref'),
      runId: 'wrongref',
    })).rejects.toThrow(/exact TEST project ref/i)
    expect(adapter.calls).toEqual([])
  })

  it('requires the exact production confirmation before mutation', () => {
    expect(() => assertTargetGuard({
      target: 'production',
      projectRef: PRODUCTION_PROJECT_REF,
      action: 'provision',
      confirmation: 'almost',
    })).toThrow(/confirm-production/i)
  })

  it('allows TEST without a production confirmation', () => {
    expect(() => assertTargetGuard({
      target: 'test', projectRef: TEST_PROJECT_REF, action: 'verify',
    })).not.toThrow()
  })

  it('rejects source drift before any adapter I/O', async () => {
    const adapter = new FakeAdapter()
    await expect(provisionCanary(adapter, {
      target: 'test',
      projectRef: TEST_PROJECT_REF,
      sourceFingerprint: `sha256:${'b'.repeat(64)}`,
      expectedSourceFingerprint: fingerprint,
      manifestPath: manifestPath('drift'),
      runId: 'drift',
    })).rejects.toThrow(/source fingerprint drift/i)
    expect(adapter.calls).toEqual([])
  })

  it('rejects malformed fingerprints', () => {
    expect(() => assertSourceFingerprint('not-a-hash', 'not-a-hash'))
      .toThrow(/fingerprint/i)
  })
})

describe('Phase 39 canary lifecycle', () => {
  it('writes a mode-0600 cryptographically marked manifest and verifies the behavior matrix', async () => {
    const adapter = new FakeAdapter()
    const path = manifestPath('success')
    const manifest = await provisionCanary(adapter, {
      target: 'test', projectRef: TEST_PROJECT_REF,
      sourceFingerprint: fingerprint, expectedSourceFingerprint: fingerprint,
      manifestPath: path, runId: 'success',
    })

    expect(manifest.marker).toBe(CANARY_MARKER)
    expect(manifest.users).toHaveLength(3)
    expect(manifest.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(manifest.tokenHash).not.toContain(manifest.token)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(path, 'utf8')).token).toBe(manifest.token)
    expect(await adapter.verifyGraph(manifest)).toMatchObject({
      discovery_count: 1,
      claim_winners: 1,
      claim_replay_denied: true,
      notification_count: 1,
      content_rows: 0,
      participants_preserved: 1,
    })

    await cleanupCanary(adapter, manifest, path)
    await cleanupCanary(adapter, manifest, path)
    expect(await adapter.residue(manifest)).toEqual({ authUsers: 0, graphRows: 0 })
    expect(existsSync(path)).toBe(false)
  })

  it('cleans partial provisioning and removes its manifest', async () => {
    const adapter = new FakeAdapter()
    adapter.failAfterUsers = 1
    const path = manifestPath('partial')

    await expect(provisionCanary(adapter, {
      target: 'test', projectRef: TEST_PROJECT_REF,
      sourceFingerprint: fingerprint, expectedSourceFingerprint: fingerprint,
      manifestPath: path, runId: 'partial',
    })).rejects.toThrow(/partial provision failure/i)

    expect(await adapter.residue({} as CanaryManifest)).toEqual({ authUsers: 0, graphRows: 0 })
    expect(existsSync(path)).toBe(false)
  })

  it('redacts secrets, URLs, emails, UUIDs, tokens, provider IDs, and payloads from evidence', () => {
    const output = formatEvidence({
      status: 'PASS',
      sourceFingerprint: fingerprint,
      counts: { auth_users: 0, graph_rows: 0 },
      privateValues: [
        'operator@example.com',
        '00000000-0000-4000-8000-000000000001',
        'https://example.com/claim?token=raw-secret',
        'raw-secret',
        'provider_123456',
        JSON.stringify({ private: 'payload' }),
      ],
    })

    expect(output).toContain('"status":"PASS"')
    expect(output).toContain(fingerprint)
    expect(output).not.toMatch(/operator@example\.com|00000000-0000|https?:|raw-secret|provider_123456|payload/)
  })
})
