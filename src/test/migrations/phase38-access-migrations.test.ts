import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const MIGRATION_FILES = {
  schema: 'supabase/migrations/20260919000001_phase38_access_policy_schema.sql',
  rls: 'supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql',
  shareBridge: 'supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql',
  copyEvent: 'supabase/migrations/20260919000004_phase38_copy_event_preservation.sql',
} as const

const migrationPath = (relativePath: string): string => resolve(process.cwd(), relativePath)

const migration = (relativePath: string): string => readFileSync(migrationPath(relativePath), 'utf8')

const withoutComments = (sql: string): string => sql
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--.*$/gm, '')

interface FunctionBlock {
  name: string
  sql: string
}

const functionBlocks = (sql: string): FunctionBlock[] => {
  const blocks: FunctionBlock[] = []
  const matcher = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\([\s\S]*?\$\$;/gi
  for (const match of sql.matchAll(matcher)) {
    blocks.push({ name: match[1], sql: match[0] })
  }
  return blocks
}

const phase38Sql = (): string => Object.values(MIGRATION_FILES).map(migration).join('\n')

describe('Phase 38 access migrations static safety gates', () => {
  for (const [label, relativePath] of Object.entries(MIGRATION_FILES)) {
    it(`expected ${label} migration exists at ${relativePath}`, () => {
      expect(
        existsSync(migrationPath(relativePath)),
        `Missing expected Phase 38 migration: ${relativePath}`,
      ).toBe(true)
    })
  }

  it('all four migrations are additive and preserve legacy share keys, rows, tokens, and logs', () => {
    const sql = withoutComments(phase38Sql())

    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN)\b/i)
    expect(sql).not.toMatch(/\bALTER\s+TABLE\s+(?:public\.)?call_share_links[\s\S]*?\bRENAME\b/i)
    expect(sql).not.toMatch(/\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?call_recording_id\b/i)
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+(?:public\.)?call_share_links\b/i)
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+(?:public\.)?call_share_access_log\b/i)
    expect(sql).not.toMatch(/\bUPDATE\s+(?:public\.)?call_share_links\s+SET[\s\S]*?share_token\s*=/i)
    expect(sql).not.toMatch(/\b(?:encode|gen_random_bytes|gen_random_uuid|uuid_generate_v4)\s*\([^)]*\)[\s\S]{0,120}\bshare_token\b/i)

    expect(sql).toMatch(/ALTER\s+TABLE\s+public\.call_share_links[\s\S]*?ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+recording_id\s+UUID/i)
    expect(sql).toMatch(/call_recording_id/i)
    expect(sql).toMatch(/call_share_access_log/i)
  })

  it('every SECURITY DEFINER function pins an empty path and uses qualified Phase 38 objects', () => {
    const sql = withoutComments(phase38Sql())
    const definers = functionBlocks(sql).filter((block) => /SECURITY\s+DEFINER/i.test(block.sql))
    expect(definers.length, 'Expected hardened Phase 38 SECURITY DEFINER functions').toBeGreaterThan(0)

    const phaseObjects = [
      'recordings',
      'user_settings',
      'events',
      'call_participants',
      'identities',
      'identity_aliases',
      'recording_access_requests',
      'recording_access_grants',
      'recording_access_audit_log',
      'recording_access_email_outbox',
      'user_notifications',
      'call_share_links',
      'call_share_access_log',
      'workspace_entries',
    ].join('|')
    const unqualifiedObject = new RegExp(
      `\\b(?:FROM|JOIN|INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(?!public\\.|auth\\.)(?:${phaseObjects})\\b`,
      'i',
    )

    for (const block of definers) {
      expect(block.sql, `${block.name} must pin empty search_path`).toMatch(/SET\s+search_path\s*=\s*''/i)
      expect(block.sql, `${block.name} contains an unqualified Phase 38 object`).not.toMatch(unqualifiedObject)
    }
  })

  it('SECURITY DEFINER execution is revoked from PUBLIC/anon and granted only to intended roles', () => {
    const sql = withoutComments(phase38Sql())
    const definers = functionBlocks(sql).filter((block) => /SECURITY\s+DEFINER/i.test(block.sql))

    for (const block of definers) {
      const escapedName = block.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(sql, `${block.name} must revoke PUBLIC and anon`).toMatch(
        new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escapedName}\\s*\\([^;]*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon`, 'i'),
      )
    }

    expect(sql).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*?\s+TO\s+(?:PUBLIC|anon)\b/i)
    const grants = [...sql.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*?\s+TO\s+([a-z_]+)/gi)]
    for (const grant of grants) {
      expect(['authenticated', 'service_role']).toContain(grant[1].toLowerCase())
    }
  })

  it('notification INSERT is tightened so authenticated clients cannot forge notices', () => {
    const sql = withoutComments(migration(MIGRATION_FILES.rls))
    expect(sql).toMatch(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?["']?Service can insert notifications["']?\s+ON\s+public\.user_notifications/i)
    expect(sql).toMatch(/REVOKE\s+INSERT\s+ON\s+(?:TABLE\s+)?public\.user_notifications\s+FROM\s+(?:PUBLIC\s*,\s*)?anon\s*,\s*authenticated/i)
    expect(sql).not.toMatch(/CREATE\s+POLICY[\s\S]*?ON\s+public\.user_notifications\s+FOR\s+INSERT[\s\S]*?WITH\s+CHECK\s*\(\s*true\s*\)/i)
  })

  it('share bridge retains call_recording_id and adds a UUID compatibility path without token rewrites', () => {
    const sql = withoutComments(migration(MIGRATION_FILES.shareBridge))
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+recording_id\s+UUID/i)
    expect(sql).toMatch(/REFERENCES\s+public\.recordings\s*\(\s*id\s*\)/i)
    expect(sql).toMatch(/call_recording_id/i)
    expect(sql).toMatch(/recording_id\s+IS\s+NOT\s+NULL[\s\S]*?call_recording_id\s+IS\s+NOT\s+NULL/i)
    expect(sql).not.toMatch(/share_token\s*=/i)
  })

  it('latest bodies for all three exact copy signatures preserve v_source.event_id', () => {
    const sql = withoutComments(migration(MIGRATION_FILES.copyEvent))
    const signatures = [
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.copy_recording_to_org\s*\(\s*p_recording_id\s+UUID\s*,\s*p_target_org_id\s+UUID\s*,\s*p_target_workspace_id\s+UUID\s*,\s*p_delete_original\s+BOOLEAN/si,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.copy_recording_to_organization\s*\(\s*p_recording_id\s+UUID\s*,\s*p_target_org_id\s+UUID/si,
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.route_recording_cross_org\s*\(\s*p_recording_id\s+UUID\s*,\s*p_target_org_id\s+UUID\s*,\s*p_user_id\s+UUID\s*,\s*p_delete_source\s+BOOLEAN[\s\S]*?p_target_workspace_id\s+UUID/si,
    ]

    for (const signature of signatures) expect(sql).toMatch(signature)

    const expectedNames = [
      'copy_recording_to_org',
      'copy_recording_to_organization',
      'route_recording_cross_org',
    ]
    const blocks = functionBlocks(sql).filter((block) => expectedNames.includes(block.name))
    expect(blocks.map((block) => block.name).sort()).toEqual([...expectedNames].sort())
    for (const block of blocks) {
      expect(block.sql, `${block.name} must insert event_id`).toMatch(/\bevent_id\b/i)
      expect(block.sql, `${block.name} must copy exact source event_id`).toMatch(/\bv_source\.event_id\b/i)
    }
  })
})
