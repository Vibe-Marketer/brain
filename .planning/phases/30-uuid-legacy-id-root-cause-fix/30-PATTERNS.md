---
phase: 30
phase_name: UUID / Legacy-ID Root-Cause Fix
mapped: 2026-05-11
status: Pattern mapping complete
---

# Phase 30 Pattern Map

For each new/modified file, the closest existing analog and its key code excerpt.

## New File: `src/lib/recording-ids.ts`

**Closest analog:** `src/hooks/useWorkspaceAssignment.ts:29-46` (single UUID resolver) + `src/components/transcripts/TranscriptsTab.tsx:1129-1161` (bulk resolver, lines 1130-1146).

**Why this analog:** Both already implement the exact resolution logic — `recordings.legacy_recording_id` → `recordings.id`. The new helper centralizes both shapes (single + bulk) into one importable module.

**Pattern excerpt (from `useWorkspaceAssignment.ts:31-46`):**
```ts
const { data: resolvedRecordingId } = useQuery({
  queryKey: ['recording-uuid-lookup', legacyRecordingId, activeOrgId],
  queryFn: async (): Promise<string | null> => {
    if (!legacyRecordingId || !activeOrgId) return null

    const { data, error } = await supabase
      .from('recordings')
      .select('id')
      .eq('legacy_recording_id', legacyRecordingId)
      .eq('organization_id', activeOrgId)
      .maybeSingle()

    if (error) throw error
    return data?.id || null
  },
  enabled: !recordingId && !!legacyRecordingId && !!activeOrgId,
  staleTime: 10 * 60 * 1000,
})
```

**Pattern excerpt (from `TranscriptsTab.tsx:1130-1161`):**
```ts
const resolveRecordingIds = async (ids: (number | string)[]) => {
  const numericIds = ids.filter((id): id is number => typeof id === 'number');
  const stringIds = ids.filter((id): id is string => typeof id === 'string');

  const results: { uuid: string; legacyId: number | null; sourceApp: string | null }[] = [];

  if (numericIds.length > 0) {
    const { data } = await supabase
      .from('recordings')
      .select('id, legacy_recording_id, source_app')
      .in('legacy_recording_id', numericIds);
    (data || []).forEach((r) => results.push({ uuid: r.id, legacyId: r.legacy_recording_id, sourceApp: r.source_app }));
  }

  if (stringIds.length > 0) {
    const { data } = await supabase
      .from('recordings')
      .select('id, legacy_recording_id, source_app')
      .in('id', stringIds);
    (data || []).forEach((r) => results.push({ uuid: r.id, legacyId: r.legacy_recording_id, sourceApp: r.source_app }));
  }

  return results;
};
```

**Conventions to follow:**
- Service file naming: `recording-ids.ts` (kebab-case, no `.service.ts` since this is `lib/`, not `services/`).
- Path alias: import as `import { toRecordingUuid } from '@/lib/recording-ids'`.
- Pure async fn pattern (no React) so it's testable AND reusable from both service files and React hooks.
- Logger import: `import { logger } from '@/lib/logger'` if anything logs.

## New File: `src/lib/__tests__/recording-ids.test.ts`

**Closest analog:** `src/services/__tests__/data-movement.service.test.ts` (mock chain pattern at lines 29-50).

**Pattern excerpt:**
```ts
function makeChain(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: null, error: null, ...result }
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'or', 'order', 'filter', 'is']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue(resolved)
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved)
  chain.then = (resolve: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve)
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(resolved).catch(reject)
  return chain as unknown as ReturnType<typeof supabase.from>
}
```

**Conventions:** mocks acceptable for this unit test only (testing pure resolution logic). Integration tests use real DB.

## New File: `src/services/__tests__/folders.integration.test.ts`

**Closest analog:** None in this codebase — this is a new test category. Closest pattern is `supabase/tests/rls_permissions_test.sql` (pgTAP SQL, not Vitest).

**Pattern to establish:**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const TEST_DB_URL = process.env.VITE_SUPABASE_TEST_URL || 'http://localhost:54321'
const TEST_DB_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

const supa = createClient(TEST_DB_URL, TEST_DB_KEY || '')

const SKIP_INTEGRATION = !TEST_DB_KEY

describe.skipIf(SKIP_INTEGRATION)('folders integration', () => {
  let testRecordingUuid: string
  const testLegacyId = 99999999 // out of Fathom range

  beforeAll(async () => {
    // Seed: a recording with id=<uuid>, legacy_recording_id=99999999
    const { data } = await supa.from('recordings').insert({
      legacy_recording_id: testLegacyId,
      title: 'TEST — phase 30 integration',
      organization_id: '...',
      owner_user_id: '...',
    }).select('id').single()
    testRecordingUuid = data.id
  })

  afterAll(async () => {
    await supa.from('folder_assignments').delete().eq('call_recording_id', testLegacyId)
    await supa.from('recordings').delete().eq('id', testRecordingUuid)
  })

  it('assignCallToFolder mirrors folder_assignments AND workspace_entries', async () => {
    // ...
  })
})
```

**Conventions:**
- Test file path: alongside the unit `__tests__/` folders, named `.integration.test.ts` to distinguish from mocked tests.
- Use `describe.skipIf` so CI/contributors without a test DB don't break.
- Document the env-var setup in a comment at the top of the file.

## New File: `supabase/functions/auto-tag-calls/__tests__/auto-tag-calls.integration.test.ts`

**Closest analog:** Existing Vitest tests in `supabase/functions/**/__tests__` (per `vitest.config.ts:17`). No integration tests currently — same new-category status.

**Conventions:** Same env-var-skipped pattern as above. Test invokes the deployed edge function endpoint (not local Deno) using a real auth token from the test project.

## Modified File: `src/components/transcripts/SyncTab.tsx`

**Pattern excerpt (target — lines 340-358):**
```ts
const loadTagAssignments = async (recordingIds: string[]) => {
  try {
    const { data } = await supabase
      .from('call_tag_assignments')
      .select('recording_id, tag_id')
      .in('recording_id', recordingIds);  // ← BUG: numeric strings passed to UUID column
```

**Fix pattern (mirror `useMeetingsSync.ts:145-172`):**
```ts
const loadTagAssignments = async (recordingIds: string[]) => {
  const { uuids } = await toRecordingUuidBatch(recordingIds)
  if (uuids.length === 0) return
  try {
    const { data } = await supabase
      .from('call_tag_assignments')
      .select('recording_id, tag_id')
      .in('recording_id', uuids);
```

## Modified File: `src/hooks/useCallAnalytics.ts`

**Pattern excerpt (target — lines 114-117):**
```ts
const { count: speakersCount } = await supabase
  .from('call_speakers')
  .select('*', { count: 'exact', head: true })
  .in('recording_id', callsWithInvitees.map(c => c.recording_id));  // ← BIGINT → UUID column
```

**Fix pattern:**
```ts
const legacyIds = callsWithInvitees.map(c => c.recording_id as number).filter(Boolean)
const { uuids } = await toRecordingUuidBatch(legacyIds)
const { count: speakersCount } = await supabase
  .from('call_speakers')
  .select('*', { count: 'exact', head: true })
  .in('recording_id', uuids);
```

## Modified File: `src/components/transcript-library/TranscriptTable.tsx`

**Pattern excerpt (target — line 343):**
```ts
folderAssignments={folderAssignments[call.recording_id] || []}
```

**Fix pattern (mirror the dual-key pattern already used for tags on line 341):**
```ts
folderAssignments={
  folderAssignments[String(call.recording_id)] ||
  folderAssignments[String((call as any).legacy_recording_id)] ||
  []
}
```

(Stronger fix: thread `legacy_recording_id` through the `Meeting` type explicitly so the `as any` cast goes away — see Plan 02 task list.)

## PATTERN MAPPING COMPLETE
