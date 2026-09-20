import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

const TEST_PROJECT_REF = 'swjzxiddcrtaqixsfaac'
const PRODUCTION_PROJECT_REF = 'vltmrnjsubfzrgrtdqey'

function requiredTestDatabaseUrl(): string {
  const value = process.env.SUPABASE_TEST_DB_URL?.trim()
  if (!value) throw new Error('SUPABASE_TEST_DB_URL is required for the Phase 38 migration replay test')
  const parsed = new URL(value)
  const targetEvidence = `${parsed.hostname}:${parsed.username}`
  if (!targetEvidence.includes(TEST_PROJECT_REF) || targetEvidence.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('SUPABASE_TEST_DB_URL does not identify the dedicated Phase 38 TEST project')
  }
  return value
}

const migration = (filename: string): string => readFileSync(
  resolve(process.cwd(), 'supabase/migrations', filename),
  'utf8',
)

async function expectRoleInsertDenied(
  client: Client,
  role: 'authenticated' | 'anon',
  shareLinkId: string,
): Promise<void> {
  await client.query('SAVEPOINT phase38_denied_insert')
  await client.query(`SET LOCAL ROLE ${role}`)
  try {
    await expect(client.query(
      'INSERT INTO public.call_share_access_log (share_link_id, accessed_by_user_id) VALUES ($1, NULL)',
      [shareLinkId],
    )).rejects.toThrow()
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT phase38_denied_insert')
    await client.query('RESET ROLE')
  }
}

describe('Phase 38 access-log restoration migration', () => {
  it('replays absent and existing table shapes transactionally and enforces role behavior', async () => {
    const client = new Client({ connectionString: requiredTestDatabaseUrl(), ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
      await client.query('BEGIN')
      await client.query('DROP TABLE public.call_share_access_log')
      await client.query(migration('20260919000003_phase38_share_link_uuid_bridge.sql'))
      const repairSql = migration('20260919000009_phase38_restore_share_access_log.sql')
      await client.query(repairSql)

      const catalog = await client.query<{
        accessor_nullable: string
        rls_enabled: boolean
        owner_policy: number
        indexes: number
        foreign_keys: number
      }>(`
        SELECT
          (SELECT is_nullable FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'call_share_access_log'
             AND column_name = 'accessed_by_user_id') AS accessor_nullable,
          (SELECT relrowsecurity FROM pg_catalog.pg_class
           WHERE oid = 'public.call_share_access_log'::regclass) AS rls_enabled,
          (SELECT COUNT(*)::int FROM pg_catalog.pg_policy
           WHERE polrelid = 'public.call_share_access_log'::regclass
             AND polname = 'Owners can view access logs for their share links') AS owner_policy,
          (SELECT COUNT(*)::int FROM pg_catalog.pg_indexes
           WHERE schemaname = 'public' AND tablename = 'call_share_access_log') AS indexes,
          (SELECT COUNT(*)::int FROM pg_catalog.pg_constraint
           WHERE conrelid = 'public.call_share_access_log'::regclass AND contype = 'f') AS foreign_keys
      `)
      expect(catalog.rows[0]).toMatchObject({
        accessor_nullable: 'YES',
        rls_enabled: true,
        owner_policy: 1,
        indexes: 4,
        foreign_keys: 2,
      })

      const donor = await client.query<{ id: string; owner_user_id: string }>(`
        SELECT id, owner_user_id
        FROM public.recordings
        WHERE owner_user_id IS NOT NULL
        ORDER BY id
        LIMIT 1
      `)
      expect(donor.rowCount).toBe(1)
      const link = await client.query<{ id: string; user_id: string }>(`
        INSERT INTO public.call_share_links (
          recording_id, call_recording_id, user_id, created_by_user_id,
          share_token, status
        ) VALUES ($1, NULL, $2, $2, $3, 'active')
        RETURNING id, user_id
      `, [
        donor.rows[0].id,
        donor.rows[0].owner_user_id,
        `phase38-migration-${Date.now()}`,
      ])
      expect(link.rowCount).toBe(1)
      const unrelated = await client.query<{ id: string }>(`
        SELECT id FROM auth.users WHERE id <> $1 ORDER BY id LIMIT 1
      `, [link.rows[0].user_id])
      expect(unrelated.rowCount).toBe(1)

      const inserted = await client.query<{ id: string }>(`
        INSERT INTO public.call_share_access_log (share_link_id, accessed_by_user_id)
        VALUES ($1, NULL) RETURNING id
      `, [link.rows[0].id])
      expect(inserted.rowCount).toBe(1)

      await client.query('SET LOCAL ROLE authenticated')
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [link.rows[0].user_id])
      const ownerRead = await client.query<{ count: string }>(
        'SELECT COUNT(*) FROM public.call_share_access_log WHERE id = $1',
        [inserted.rows[0].id],
      )
      expect(ownerRead.rows[0].count).toBe('1')
      await client.query('RESET ROLE')

      await client.query('SET LOCAL ROLE authenticated')
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [unrelated.rows[0].id])
      const unrelatedRead = await client.query<{ count: string }>(
        'SELECT COUNT(*) FROM public.call_share_access_log WHERE id = $1',
        [inserted.rows[0].id],
      )
      expect(unrelatedRead.rows[0].count).toBe('0')
      await client.query('RESET ROLE')

      await expectRoleInsertDenied(client, 'authenticated', link.rows[0].id)
      await expectRoleInsertDenied(client, 'anon', link.rows[0].id)

      await client.query(repairSql)
      const preserved = await client.query<{ accessed_by_user_id: string | null }>(
        'SELECT accessed_by_user_id FROM public.call_share_access_log WHERE id = $1',
        [inserted.rows[0].id],
      )
      expect(preserved.rows).toEqual([{ accessed_by_user_id: null }])
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      await client.end()
    }
  }, 120_000)
})
