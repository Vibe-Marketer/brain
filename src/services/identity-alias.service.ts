import { supabase } from '@/integrations/supabase/client'

/**
 * Identity Alias Service — pure async wrapper over the email-alias
 * verification edge functions (Phase 34-03) plus the owner-scoped
 * verified-email list read (identity_aliases, Phase 34-02 RLS).
 *
 * Security: identity_aliases SELECT is owner-scoped RLS — a caller's JWT
 * only ever sees rows tied to their own identity (see 34-06-PLAN.md threat
 * model T-34-06-02). All verification authority is server-side in the two
 * edge functions; this service only relays email + code (T-34-06-01).
 */

export interface VerifiedEmailAlias {
  id: string
  value: string
  verified: boolean
  verified_at: string | null
}

export interface DisconnectVerifiedEmailResult {
  status: 'disconnected'
}

/** Thrown by requestEmailVerification/confirmEmailVerification with the
 * edge function's own error message + machine-readable `code` (e.g.
 * ALREADY_CLAIMED, RATE_LIMITED, INVALID_OR_EXPIRED, VALIDATION_ERROR)
 * so the hook/UI can toast distinct messages per T-34-06-04. */
export class IdentityAliasError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'IdentityAliasError'
    this.code = code
  }
}

/** Extracts the edge function's JSON error body (status + { error, code })
 * from a supabase.functions.invoke FunctionsHttpError. Falls back to a
 * generic message if the body can't be parsed (e.g. a network failure
 * before the function even ran). */
async function toIdentityAliasError(
  error: unknown,
  fallbackMessage: string,
): Promise<IdentityAliasError> {
  const context = (error as { context?: Response })?.context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (body?.error) {
        return new IdentityAliasError(body.error, body.code ?? 'UNKNOWN_ERROR')
      }
    } catch {
      // Body wasn't JSON — fall through to the generic message below.
    }
  }
  const message = error instanceof Error ? error.message : fallbackMessage
  return new IdentityAliasError(message, 'UNKNOWN_ERROR')
}

/**
 * Lists the caller's currently verified email aliases.
 * RLS scopes this to the caller's own identity — no cross-user read is
 * possible from the client (T-34-06-02).
 */
export async function listVerifiedEmails(): Promise<VerifiedEmailAlias[]> {
  const { data, error } = await supabase
    .from('identity_aliases')
    .select('id, value, verified, verified_at')
    .eq('alias_type', 'email')
    .eq('verified', true)
    .order('verified_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch verified emails: ${error.message}`)
  }
  return data ?? []
}

/**
 * Deactivates one caller-owned, verified, non-primary email alias.
 *
 * The client sends only the opaque alias row id. Ownership, active status,
 * and primary-email protection are derived atomically by the caller-scoped
 * RPC; the client never mutates identity or participant evidence directly.
 */
export async function disconnectVerifiedEmailAlias(
  aliasId: string,
): Promise<DisconnectVerifiedEmailResult> {
  const { data, error } = await supabase.rpc(
    'disconnect_my_verified_email_alias',
    { p_alias_id: aliasId },
  )

  if (error) {
    throw await toIdentityAliasError(
      error,
      'Failed to disconnect verified email.',
    )
  }

  if (data !== true) {
    throw new IdentityAliasError(
      'Failed to disconnect verified email.',
      'DISCONNECT_FAILED',
    )
  }

  return { status: 'disconnected' }
}

/**
 * Requests an emailed verification code for a new address the caller
 * claims to own. The code itself is never returned (T-34-06-04) — it is
 * emailed via Resend by the edge function.
 */
export async function requestEmailVerification(email: string): Promise<void> {
  const { error } = await supabase.functions.invoke('request-email-alias-verification', {
    body: { email },
  })

  if (error) {
    throw await toIdentityAliasError(error, 'Failed to send verification code.')
  }
}

/**
 * Confirms a previously requested code, linking the email to the caller's
 * identity as a verified alias on success.
 */
export async function confirmEmailVerification(
  email: string,
  code: string,
): Promise<{ identity_id: string }> {
  const { data, error } = await supabase.functions.invoke<{
    success: boolean
    identity_id: string
  }>('confirm-email-alias-verification', {
    body: { email, code },
  })

  if (error) {
    throw await toIdentityAliasError(error, 'Failed to verify code.')
  }

  return { identity_id: data?.identity_id ?? '' }
}
