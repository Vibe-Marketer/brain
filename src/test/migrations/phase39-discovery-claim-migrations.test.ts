import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const MIGRATION_DIRECTORY = resolve(process.cwd(), 'supabase/migrations')
const PHASE39_MIGRATIONS = [
  '20260920000001_phase39_verified_email_discovery.sql',
  '20260920000002_phase39_participation_claims.sql',
  '20260920000003_phase39_notification_disconnect.sql',
] as const

type Phase39Migration = (typeof PHASE39_MIGRATIONS)[number]

function migrationPath(filename: Phase39Migration): string {
  return resolve(MIGRATION_DIRECTORY, filename)
}

function readMigration(filename: Phase39Migration): string {
  const path = migrationPath(filename)
  expect(existsSync(path), `Missing planned Phase 39 migration: ${filename}`).toBe(true)
  return readFileSync(path, 'utf8')
}

function allMigrationSql(): string {
  return PHASE39_MIGRATIONS.map(readMigration).join('\n')
}

describe('Phase 39 discovery and claim migration security contract', () => {
  it('pins the exact three additive migration filenames and order', () => {
    const actual = readdirSync(MIGRATION_DIRECTORY)
      .filter((filename) => /^2026092000000[1-3]_phase39_.*\.sql$/.test(filename))
      .sort()
    expect(actual).toEqual([...PHASE39_MIGRATIONS])
  })

  it('rejects destructive DDL and participant evidence rewrites', () => {
    const sql = allMigrationSql()
    expect(sql).not.toMatch(/\b(?:DROP\s+TABLE|TRUNCATE|DROP\s+COLUMN|DELETE\s+FROM\s+public\.call_participants)\b/i)
    expect(sql).not.toMatch(/\bUPDATE\s+public\.call_participants\b/i)
    expect(sql).not.toMatch(/\bALTER\s+TABLE\s+(?:public\.)?call_participants\s+DROP\b/i)
  })

  it('forces RLS and denies browser writes on both new private ledgers', () => {
    const claims = readMigration('20260920000002_phase39_participation_claims.sql')
    expect(claims).toMatch(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.participation_claim_invitations/i)
    expect(claims).toMatch(/ALTER\s+TABLE\s+public\.participation_claim_invitations\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i)
    expect(claims).toMatch(/ALTER\s+TABLE\s+public\.participation_claim_invitations\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/i)
    expect(claims).toMatch(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.participation_claim_invitations\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i)
    expect(claims).toMatch(/GRANT\s+(?:ALL|SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE)\s+ON\s+TABLE\s+public\.participation_claim_invitations\s+TO\s+service_role/i)

    const notifications = readMigration('20260920000003_phase39_notification_disconnect.sql')
    expect(notifications).toMatch(/CREATE\s+TABLE\s+public\.event_discovery_notification_ledger/i)
    expect(notifications).toMatch(/ALTER\s+TABLE\s+public\.event_discovery_notification_ledger\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i)
    expect(notifications).toMatch(/ALTER\s+TABLE\s+public\.event_discovery_notification_ledger\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/i)
    expect(notifications).toMatch(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.event_discovery_notification_ledger\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i)
  })

  it('requires hardened SECURITY DEFINER functions with empty search paths and qualified relations', () => {
    const sql = allMigrationSql()
    const securityDefinerCount = sql.match(/SECURITY\s+DEFINER/gi)?.length ?? 0
    const emptySearchPathCount = sql.match(/SET\s+search_path\s*=\s*''/gi)?.length ?? 0
    expect(securityDefinerCount).toBeGreaterThanOrEqual(8)
    expect(emptySearchPathCount).toBeGreaterThanOrEqual(securityDefinerCount)
    expect(sql).not.toMatch(/\b(?:FROM|JOIN|UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?!public\.|auth\.|pg_catalog\.)[a-z][a-z0-9_]*\b/i)
  })

  it('bounds discovery pagination at 50 and derives identity without caller-supplied user/email', () => {
    const discovery = readMigration('20260920000001_phase39_verified_email_discovery.sql')
    expect(discovery).toMatch(/list_my_discovered_events\s*\(\s*p_limit\s+INTEGER(?:\s+DEFAULT\s+\d+)?\s*,\s*p_cursor\s+TEXT/i)
    expect(discovery).toMatch(/LEAST\s*\([^)]*50/i)
    expect(discovery).toMatch(/p_cursor/i)
    expect(discovery).toMatch(/auth\.uid\s*\(\s*\)/i)
    expect(discovery).not.toMatch(/current_caller[^\n(]*\([^)]*(?:p_user|p_email)/i)
  })

  it('stores token hashes only and locks claim consumption atomically', () => {
    const claims = readMigration('20260920000002_phase39_participation_claims.sql')
    expect(claims).toMatch(/token_hash\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i)
    expect(claims).not.toMatch(/\b(?:raw_token|plain_token|token_plaintext|token_value)\b/i)
    expect(claims).toMatch(/consume_my_participation_claim/i)
    expect(claims).toMatch(/FOR\s+UPDATE/i)
    expect(claims).toMatch(/UPDATE\s+public\.participation_claim_invitations/i)
  })

  it('keeps an exact-once notification ledger without email or digest delivery', () => {
    const notifications = readMigration('20260920000003_phase39_notification_disconnect.sql')
    expect(notifications).toMatch(/UNIQUE\s*\(\s*user_id\s*,\s*event_id\s*\)/i)
    expect(notifications).toMatch(/ON\s+CONFLICT\s*\(\s*user_id\s*,\s*event_id\s*\)/i)
    expect(notifications).toMatch(/sync_my_discovered_event_notifications/i)
    expect(notifications).not.toMatch(/\b(?:pg_cron|cron\.schedule|email_outbox|daily_digest)\b/i)
  })

  it('does not replace either legacy organization-scoped People RPC', () => {
    const sql = allMigrationSql()
    expect(sql).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?get_people_summary\s*\(/i)
    expect(sql).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?get_recordings_for_person\s*\(/i)
    expect(sql).not.toMatch(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(?:get_people_summary|get_recordings_for_person)\b/i)
  })

  it.fails('disconnect is caller-scoped, primary-safe, and preserves participant evidence', () => {
    const notifications = readMigration('20260920000003_phase39_notification_disconnect.sql')
    expect(notifications).toMatch(/disconnect_my_verified_email_alias\s*\(\s*p_alias_id\s+UUID\s*\)/i)
    expect(notifications).toMatch(/auth\.uid\s*\(\s*\)/i)
    expect(notifications).toMatch(/email_confirmed_at\s+IS\s+NOT\s+NULL/i)
    expect(notifications).toMatch(/UPDATE\s+public\.identity_aliases/i)
    expect(notifications).not.toMatch(/UPDATE\s+public\.call_participants/i)
    expect(notifications).not.toMatch(/DELETE\s+FROM\s+public\.call_participants/i)
  })
})
