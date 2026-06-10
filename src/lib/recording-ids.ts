/**
 * Recording ID translation helpers.
 *
 * Background: CallVault has two parallel recording-ID systems:
 *
 *   1. Canonical recording UUID — `recordings.id` (uuid). Used by all migrated tables:
 *      workspace_entries, call_tag_assignments, transcript_tag_assignments,
 *      call_speakers, call_participants, categories, personal_*_recordings.
 *
 *   2. Numeric Fathom provider ID — `fathom_raw_calls.recording_id` (bigint). Used by:
 *      fathom_calls, fathom_transcripts, folder_assignments.call_recording_id,
 *      recordings.fathom_provider_id (the bridge column).
 *
 * Passing a number where a UUID is expected → Postgres throws
 * `invalid input syntax for type uuid: "143800259"` and the entire query fails.
 *
 * This module is the canonical boundary. All code that crosses ID systems MUST go
 * through here — see `toRecordingUuid` and `toRecordingUuidBatch`.
 *
 * See `.planning/phases/30-uuid-legacy-id-root-cause-fix/30-CONTEXT.md` for the
 * locked design decisions and full schema audit.
 */

import { supabase } from '@/integrations/supabase/client'
import { logger } from '@/lib/logger'

/** Accepted input shape for any helper in this module. */
export type RecordingIdInput = string | number

/** A row resolved from `recordings` with both keys + the source app. */
export interface ResolvedRecording {
  uuid: string
  fathomProviderId: number | null
  sourceApp: string | null
}

/** UUID v4-ish pattern. Case-insensitive 8-4-4-4-12 hex. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns true if `input` looks like a numeric Fathom recording ID
 * (a JavaScript `number`, or a string of digits only).
 */
export function isLegacyId(input: RecordingIdInput): boolean {
  if (typeof input === 'number') return Number.isFinite(input)
  return /^\d+$/.test(input)
}

/**
 * Returns true if `input` is a recording UUID string.
 * Numbers always return false (numbers are never UUIDs).
 */
export function isRecordingUuid(input: RecordingIdInput): boolean {
  if (typeof input !== 'string') return false
  return UUID_REGEX.test(input)
}

/**
 * Resolve a single ID (number or UUID string) to the canonical recording UUID.
 *
 * - UUID string              → returned unchanged (no DB call)
 * - Number / numeric string  → SELECT id FROM recordings WHERE fathom_provider_id = ?
 * - Orphan row (no match)    → returns null (caller decides how to handle)
 *
 * Optional `orgId` scopes the lookup to a single org (preferred for safety —
 * prevents cross-org leakage when a numeric ID collides across orgs).
 *
 * Never throws on missing rows — logs a warning and returns null. Throws only
 * if the Supabase call itself errors (network, RLS denial, schema mismatch).
 */
export async function toRecordingUuid(
  input: RecordingIdInput,
  opts?: { orgId?: string | null }
): Promise<string | null> {
  // Short-circuit: already a UUID, no DB round trip needed.
  if (isRecordingUuid(input)) {
    return input as string
  }

  if (!isLegacyId(input)) {
    logger.warn('[recording-ids] toRecordingUuid received non-UUID, non-numeric input', { input })
    return null
  }

  const fathomProviderId = typeof input === 'number' ? input : Number(input)

  let query = supabase
    .from('recordings')
    .select('id')
    .eq('fathom_provider_id', fathomProviderId)

  if (opts?.orgId) {
    query = query.eq('organization_id', opts.orgId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    logger.error('[recording-ids] toRecordingUuid lookup failed', { input, error })
    throw error
  }

  if (!data) {
    logger.warn('[recording-ids] orphan Fathom provider id (no matching recordings.id)', { fathomProviderId })
    return null
  }

  return (data as { id: string }).id
}

/**
 * Bulk variant. Accepts mixed `(string | number)[]` and returns the resolved rows.
 * Unresolved IDs are silently dropped (no row returned for them).
 *
 * Splits inputs into two `.in()` queries — one against `fathom_provider_id` for
 * numerics, one against `id` for UUIDs — and runs them in parallel. This mirrors
 * the inline pattern at `src/components/transcripts/TranscriptsTab.tsx:1129-1161`
 * which is the original (verified-correct) implementation.
 *
 * Returns the shape consumed by `resolveRecordingIds`:
 *   { resolved: ResolvedRecording[], uuids: string[], legacyIds: number[] }
 */
export async function toRecordingUuidBatch(
  inputs: RecordingIdInput[],
  opts?: { orgId?: string | null }
): Promise<{ resolved: ResolvedRecording[]; uuids: string[]; legacyIds: number[] }> {
  const numericIds: number[] = []
  const uuidStrings: string[] = []

  for (const id of inputs) {
    if (isRecordingUuid(id)) {
      uuidStrings.push(id as string)
    } else if (isLegacyId(id)) {
      numericIds.push(typeof id === 'number' ? id : Number(id))
    } else {
      logger.warn('[recording-ids] toRecordingUuidBatch dropped unrecognized input', { id })
    }
  }

  const promises: Promise<{ data: Array<{ id: string; fathom_provider_id: number | null; source_app: string | null }> | null; error: unknown }>[] = []

  if (numericIds.length > 0) {
    let q = supabase
      .from('recordings')
      .select('id, fathom_provider_id, source_app')
      .in('fathom_provider_id', numericIds)
    if (opts?.orgId) q = q.eq('organization_id', opts.orgId)
    promises.push(
      (q as unknown as Promise<{ data: Array<{ id: string; fathom_provider_id: number | null; source_app: string | null }> | null; error: unknown }>)
    )
  }

  if (uuidStrings.length > 0) {
    let q = supabase
      .from('recordings')
      .select('id, fathom_provider_id, source_app')
      .in('id', uuidStrings)
    if (opts?.orgId) q = q.eq('organization_id', opts.orgId)
    promises.push(
      (q as unknown as Promise<{ data: Array<{ id: string; fathom_provider_id: number | null; source_app: string | null }> | null; error: unknown }>)
    )
  }

  const results = await Promise.all(promises)

  const resolved: ResolvedRecording[] = []
  for (const { data, error } of results) {
    if (error) {
      logger.error('[recording-ids] toRecordingUuidBatch lookup failed', { error })
      throw error
    }
    for (const r of data || []) {
      resolved.push({
        uuid: r.id,
        fathomProviderId: r.fathom_provider_id,
        sourceApp: r.source_app,
      })
    }
  }

  return {
    resolved,
    uuids: resolved.map((r) => r.uuid),
    legacyIds: resolved.map((r) => r.fathomProviderId).filter((n): n is number => n !== null),
  }
}
