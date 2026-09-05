/**
 * identity-resolver.ts -- Phase 34 Plan 04: pure, DB-free identity-matching
 * functions for IDENT-02.
 *
 * Design constraint (34-CONTEXT.md / 34-04-PLAN.md, locked): verified
 * linkage ONLY. A display-name variant -- even an exact string match to
 * another person's known name -- must NEVER, by itself, set identity_id.
 * This is the single hardest guarantee in Phase 34 and is enforced here by
 * CONSTRUCTION, not merely by convention:
 *
 *   - evaluateDisplayNameCandidate's return type pins `identity_id` to the
 *     literal type `null` (not `string | null`) and `verified` to the
 *     literal type `false` (not `boolean`). It is a compile-time error to
 *     construct this shape with a truthy `verified` or a non-null
 *     `identity_id` -- the never-auto-link-on-name guarantee cannot be
 *     violated by a future edit to this function's body without also
 *     changing its type signature (which the centerpiece unit test would
 *     then catch at the type-check layer, before runtime).
 *   - resolveRow never conflates a real link with a display-name signal: if
 *     either resolveByVerifiedEmail or resolveByProviderParticipantId
 *     produces a match, the display-name candidate is discarded entirely
 *     (not recorded alongside a link) -- a row either links on strong
 *     evidence, or it does not link and MAY carry a weak non-linking
 *     candidate. Never both.
 *
 * Email normalization (A1, 34-RESEARCH.md Assumptions Log): lower(trim())
 * applied to BOTH the candidate input and the stored alias value at match
 * time, since `speakers.email`/`contacts.email` write-time normalization is
 * unverified -- the resolver cannot assume its inputs already arrived
 * normalized.
 *
 * No DB access in this file (mirrors supabase/functions/_shared/
 * event-resolver.ts's pure-functions style) -- the resolve-identities edge
 * function supplies the verified aliases and writes the result.
 */

/** A verified (or not) email alias row, as read from identity_aliases. */
export interface EmailAliasRecord {
  identity_id: string;
  /** Raw stored value -- normalized at match time, not assumed pre-normalized. */
  value: string;
  verified: boolean;
}

/** A verified (or not) provider-participant-id alias row, as read from identity_aliases. */
export interface ProviderAliasRecord {
  identity_id: string;
  value: string;
  provider: string;
  verified: boolean;
}

/** The outcome of a successful high-confidence match: sets identity_id. */
export interface ResolveMatch {
  identity_id: string;
}

/** Confidence assigned to every display-name candidate -- always < 1.0 (never full confidence, never linking). */
export const DISPLAY_NAME_CANDIDATE_CONFIDENCE = 0.3;

/** lower(trim()) normalization applied at match time to both sides (A1). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Exact, case-normalized match against VERIFIED email aliases only.
 * Unverified aliases are filtered out internally (defense in depth --
 * correct even if a caller accidentally passes an unfiltered list).
 *
 * Fails closed to null on empty/null/undefined/non-string input; never
 * throws.
 */
export function resolveByVerifiedEmail(
  candidateEmail: string | null | undefined,
  emailAliases: EmailAliasRecord[],
): ResolveMatch | null {
  if (typeof candidateEmail !== 'string') return null;
  const normalized = normalizeEmail(candidateEmail);
  if (normalized.length === 0) return null;
  if (!Array.isArray(emailAliases)) return null;

  const hit = emailAliases.find(
    (alias) => alias && alias.verified === true && normalizeEmail(alias.value) === normalized,
  );
  return hit ? { identity_id: hit.identity_id } : null;
}

/**
 * Exact match on (provider participant id + provider) against VERIFIED
 * provider-id aliases only. Unverified aliases are filtered out internally,
 * same defense-in-depth as resolveByVerifiedEmail.
 *
 * No normalization is applied to provider-participant-id values (unlike
 * email) -- provider IDs are opaque platform identifiers, not
 * human-typed/free-text values, so case-folding could itself introduce a
 * false match between two distinct provider-issued IDs.
 *
 * Fails closed to null on missing/empty providerId or provider; never
 * throws.
 */
export function resolveByProviderParticipantId(
  providerId: string | null | undefined,
  provider: string | null | undefined,
  providerAliases: ProviderAliasRecord[],
): ResolveMatch | null {
  if (typeof providerId !== 'string' || providerId.length === 0) return null;
  if (typeof provider !== 'string' || provider.length === 0) return null;
  if (!Array.isArray(providerAliases)) return null;

  const hit = providerAliases.find(
    (alias) =>
      alias && alias.verified === true && alias.value === providerId && alias.provider === provider,
  );
  return hit ? { identity_id: hit.identity_id } : null;
}

/**
 * A display-name candidate record: STRUCTURALLY incapable of linking.
 * `identity_id` is pinned to the literal type `null` and `verified` to the
 * literal type `false` -- see file header. This is IDENT-02's core
 * guarantee, enforced by the type system, not just by this function's
 * current implementation.
 */
export interface DisplayNameCandidate {
  alias_type: 'display_name';
  verified: false;
  confidence: number;
  identity_id: null;
  value: string;
}

/**
 * Records a display-name variant as a low-confidence, NON-LINKING candidate
 * signal. This function can never return a truthy `identity_id` -- not by
 * runtime check, but because the return type itself forbids it (see
 * DisplayNameCandidate above). The centerpiece negative unit test
 * (identity-resolver.test.ts) asserts this both by value and by relying on
 * this exact type shape.
 */
export function evaluateDisplayNameCandidate(displayName: string): DisplayNameCandidate {
  return {
    alias_type: 'display_name',
    verified: false,
    confidence: DISPLAY_NAME_CANDIDATE_CONFIDENCE,
    identity_id: null,
    value: typeof displayName === 'string' ? displayName.trim() : '',
  };
}

/** A candidate row's minimal shape needed to resolve at most one identity_id, or a non-linking display-name candidate. */
export interface CandidateRow {
  email?: string | null;
  providerParticipantId?: string | null;
  provider?: string | null;
  displayName?: string | null;
}

/**
 * The outcome of resolving one candidate row. `identity_id` and
 * `displayNameCandidate` are NEVER both non-null -- a row either links on
 * strong (verified email or provider-id) evidence, in which case no
 * display-name candidate is recorded at all, or it does not link and MAY
 * carry a weak, non-linking display-name candidate. This is the "never
 * conflate the two" contract from 34-04-PLAN.md's Task 2 action block.
 */
export interface ResolveRowResult {
  identity_id: string | null;
  displayNameCandidate: DisplayNameCandidate | null;
}

/**
 * Resolves a single candidate row against verified email + provider-id
 * aliases, per-table caller-supplied. Precedence: verified email match,
 * then verified provider-id match, then (only if neither linked) a
 * non-linking display-name candidate if a display name is present.
 *
 * Pure, DB-free, fails closed (returns { identity_id: null,
 * displayNameCandidate: null } on malformed/empty input) -- never throws.
 */
export function resolveRow(
  row: CandidateRow,
  emailAliases: EmailAliasRecord[],
  providerAliases: ProviderAliasRecord[],
): ResolveRowResult {
  if (!row || typeof row !== 'object') {
    return { identity_id: null, displayNameCandidate: null };
  }

  const emailMatch = resolveByVerifiedEmail(row.email, emailAliases);
  if (emailMatch) {
    return { identity_id: emailMatch.identity_id, displayNameCandidate: null };
  }

  const providerMatch = resolveByProviderParticipantId(row.providerParticipantId, row.provider, providerAliases);
  if (providerMatch) {
    return { identity_id: providerMatch.identity_id, displayNameCandidate: null };
  }

  const trimmedName = typeof row.displayName === 'string' ? row.displayName.trim() : '';
  if (trimmedName.length === 0) {
    return { identity_id: null, displayNameCandidate: null };
  }

  return { identity_id: null, displayNameCandidate: evaluateDisplayNameCandidate(trimmedName) };
}
