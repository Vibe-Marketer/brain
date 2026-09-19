import { supabase } from '@/integrations/supabase/client'
import {
  ACCESS_LEVELS,
  ACCESS_POLICY_ORIGINS,
  type AccessPolicyOrigin,
  type AccessPolicyRpcCode,
  type AccountAccessDefault,
  type RecordingAccessLevel,
  type StoredRecordingAccessPolicy,
} from '@/types/access-policy'

const STABLE_RPC_CODES = [
  'AUTHENTICATION_REQUIRED',
  'INVALID_ACCESS_LEVEL',
  'RECORDING_NOT_AVAILABLE',
] as const satisfies readonly AccessPolicyRpcCode[]

interface DatabaseErrorLike {
  code?: unknown
  details?: unknown
  hint?: unknown
  message?: unknown
}

export class AccessPolicyServiceError extends Error {
  readonly code: AccessPolicyRpcCode

  constructor(code: AccessPolicyRpcCode) {
    super(code)
    this.name = 'AccessPolicyServiceError'
    this.code = code
  }
}

function isRecordingAccessLevel(value: unknown): value is RecordingAccessLevel {
  return typeof value === 'string' && ACCESS_LEVELS.some((level) => level === value)
}

function isAccessPolicyOrigin(value: unknown): value is AccessPolicyOrigin {
  return typeof value === 'string' && ACCESS_POLICY_ORIGINS.some((origin) => origin === value)
}

function firstRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data
}

function stableRpcCode(error: DatabaseErrorLike): AccessPolicyRpcCode | null {
  const source = [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')

  return STABLE_RPC_CODES.find((code) => source.includes(code)) ?? null
}

function errorMessage(error: DatabaseErrorLike): string {
  return typeof error.message === 'string' && error.message.length > 0
    ? error.message
    : 'unknown database error'
}

function handleDatabaseError(context: string, error: DatabaseErrorLike): never {
  const stableCode = stableRpcCode(error)
  if (stableCode) {
    throw new AccessPolicyServiceError(stableCode)
  }
  throw new Error(`${context}: ${errorMessage(error)}`)
}

function parseAccountDefault(data: unknown, context: string): AccountAccessDefault {
  const row = firstRow(data)
  if (
    typeof row !== 'object' ||
    row === null ||
    !('default_recording_access_level' in row) ||
    !isRecordingAccessLevel(row.default_recording_access_level)
  ) {
    throw new Error(`${context}: invalid response`)
  }
  return { accessLevel: row.default_recording_access_level }
}

function parseRecordingPolicy(data: unknown, context: string): StoredRecordingAccessPolicy {
  const row = firstRow(data)
  if (
    typeof row !== 'object' ||
    row === null ||
    !('access_level' in row) ||
    !('access_policy_origin' in row) ||
    !isRecordingAccessLevel(row.access_level) ||
    !isAccessPolicyOrigin(row.access_policy_origin)
  ) {
    throw new Error(`${context}: invalid response`)
  }
  return {
    accessLevel: row.access_level,
    origin: row.access_policy_origin,
  }
}

/**
 * Reads the current user's future-recording default through the existing RLS
 * policy on user_settings. The Phase 38 schema has a setter RPC but no getter
 * RPC; a missing row therefore has the database default of Private.
 */
export async function getAccountAccessDefault(): Promise<AccountAccessDefault> {
  const context = 'Failed to get account access default'
  const { data, error } = await supabase
    .from('user_settings')
    .select('default_recording_access_level')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()

  if (error) handleDatabaseError(context, error)
  if (!data) return { accessLevel: 'private' }
  return parseAccountDefault(data, context)
}

export async function setAccountAccessDefault(
  accessLevel: RecordingAccessLevel,
): Promise<AccountAccessDefault> {
  const context = 'Failed to set account access default'
  const { data, error } = await supabase.rpc('set_default_recording_access_level', {
    p_access_level: accessLevel,
  })

  if (error) handleDatabaseError(context, error)
  return parseAccountDefault(data, context)
}

export async function getRecordingAccessPolicy(
  recordingId: string,
): Promise<StoredRecordingAccessPolicy> {
  const context = 'Failed to get recording access policy'
  const { data, error } = await supabase.rpc('get_recording_access_policy', {
    p_recording_id: recordingId,
  })

  if (error) handleDatabaseError(context, error)
  if (!Array.isArray(data) || data.length === 0) {
    throw new AccessPolicyServiceError('RECORDING_NOT_AVAILABLE')
  }
  return parseRecordingPolicy(data, context)
}

export async function setRecordingAccessLevel(
  recordingId: string,
  accessLevel: RecordingAccessLevel,
): Promise<StoredRecordingAccessPolicy> {
  const context = 'Failed to set recording access level'
  const { data, error } = await supabase.rpc('set_recording_access_level', {
    p_recording_id: recordingId,
    p_access_level: accessLevel,
  })

  if (error) handleDatabaseError(context, error)
  return parseRecordingPolicy(data, context)
}

export async function resetRecordingAccessLevel(
  recordingId: string,
): Promise<StoredRecordingAccessPolicy> {
  const context = 'Failed to reset recording access level'
  const { data, error } = await supabase.rpc('reset_recording_access_level', {
    p_recording_id: recordingId,
  })

  if (error) handleDatabaseError(context, error)
  return parseRecordingPolicy(data, context)
}

export const accessPolicyService = {
  getAccountAccessDefault,
  setAccountAccessDefault,
  getRecordingAccessPolicy,
  setRecordingAccessLevel,
  resetRecordingAccessLevel,
}
