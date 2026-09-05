/**
 * Unit tests for the pure identity-resolver matching functions, written
 * BEFORE identity-resolver.ts exists (TDD RED -> GREEN, Phase 34 Plan 04
 * Task 1 -> Task 2).
 *
 * DB-free -- these are pure, rows-in/decisions-out functions (34-04-PLAN.md
 * interfaces block). The DB-touching resolve-identities edge function
 * delegates to these but is not exercised here.
 *
 * Placed under _shared/__tests__/ (not directly in _shared/) because
 * vitest.config.ts's `include` glob only matches "supabase/functions" +
 * any-depth + "/__tests__/" + "*.test.ts" -- mirrors
 * supabase/functions/_shared/__tests__/event-resolver.test.ts's plain-TS-
 * module import convention (no Deno runtime needed).
 *
 * THE CENTERPIECE: the never-auto-link-on-display-name-alone negative test
 * (IDENT-02's core guarantee) lives in the "evaluateDisplayNameCandidate"
 * and "resolveRow" describe blocks below.
 */
import { describe, expect, it } from 'vitest';
import {
  type EmailAliasRecord,
  evaluateDisplayNameCandidate,
  type ProviderAliasRecord,
  resolveByProviderParticipantId,
  resolveByVerifiedEmail,
  resolveRow,
} from '../identity-resolver.ts';

describe('resolveByVerifiedEmail', () => {
  const aliases: EmailAliasRecord[] = [
    { identity_id: 'id-alice', value: 'alice@example.com', verified: true },
    { identity_id: 'id-bob', value: 'bob@example.com', verified: true },
  ];

  it('returns the matching identity_id for an exact, case-normalized email hit against a verified alias', () => {
    const result = resolveByVerifiedEmail('alice@example.com', aliases);
    expect(result).toEqual({ identity_id: 'id-alice' });
  });

  it('returns null for a non-match', () => {
    const result = resolveByVerifiedEmail('nobody@example.com', aliases);
    expect(result).toBeNull();
  });

  it('matches a mixed-case / whitespace-padded input against a normalized verified alias (A1 -- normalizes at match time)', () => {
    const result = resolveByVerifiedEmail('  Alice@Example.COM  ', aliases);
    expect(result).toEqual({ identity_id: 'id-alice' });
  });

  it('also normalizes the stored alias side (mixed-case stored value still matches)', () => {
    const mixedCaseStored: EmailAliasRecord[] = [
      { identity_id: 'id-carol', value: '  Carol@Example.com ', verified: true },
    ];
    const result = resolveByVerifiedEmail('carol@example.com', mixedCaseStored);
    expect(result).toEqual({ identity_id: 'id-carol' });
  });

  it('does NOT link on an unverified email alias -- only verified aliases auto-link', () => {
    const unverified: EmailAliasRecord[] = [
      { identity_id: 'id-dave', value: 'dave@example.com', verified: false },
    ];
    const result = resolveByVerifiedEmail('dave@example.com', unverified);
    expect(result).toBeNull();
  });

  it('returns null for empty/null/undefined input without throwing', () => {
    expect(resolveByVerifiedEmail('', aliases)).toBeNull();
    expect(resolveByVerifiedEmail(null, aliases)).toBeNull();
    expect(resolveByVerifiedEmail(undefined, aliases)).toBeNull();
  });
});

describe('resolveByProviderParticipantId', () => {
  const providerAliases: ProviderAliasRecord[] = [
    { identity_id: 'id-alice', value: 'zoom-participant-123', provider: 'zoom', verified: true },
  ];

  it('links on an exact provider-id + provider match', () => {
    const result = resolveByProviderParticipantId('zoom-participant-123', 'zoom', providerAliases);
    expect(result).toEqual({ identity_id: 'id-alice' });
  });

  it('returns null when the provider-id matches but the provider differs', () => {
    const result = resolveByProviderParticipantId('zoom-participant-123', 'fathom', providerAliases);
    expect(result).toBeNull();
  });

  it('returns null when the provider matches but the id differs', () => {
    const result = resolveByProviderParticipantId('zoom-participant-999', 'zoom', providerAliases);
    expect(result).toBeNull();
  });

  it('does NOT link on an unverified provider-id alias', () => {
    const unverified: ProviderAliasRecord[] = [
      { identity_id: 'id-erin', value: 'zoom-participant-456', provider: 'zoom', verified: false },
    ];
    const result = resolveByProviderParticipantId('zoom-participant-456', 'zoom', unverified);
    expect(result).toBeNull();
  });

  it('returns null for missing providerId or provider without throwing', () => {
    expect(resolveByProviderParticipantId(null, 'zoom', providerAliases)).toBeNull();
    expect(resolveByProviderParticipantId('zoom-participant-123', null, providerAliases)).toBeNull();
  });
});

describe('evaluateDisplayNameCandidate -- THE CENTERPIECE NEGATIVE TEST (IDENT-02)', () => {
  it('a display-name variant, even an EXACT string match to another person\'s known name, NEVER produces identity_id -- returns a non-linking, low-confidence candidate only', () => {
    // "Alice Smith" is deliberately the exact display name of an existing,
    // resolved identity in spirit -- this test asserts that similarity (or
    // even exact string equality) of a NAME is structurally incapable of
    // linking, regardless of how confident a naive string-match might feel.
    const candidate = evaluateDisplayNameCandidate('Alice Smith');

    expect(candidate.identity_id).toBeNull();
    expect(candidate.verified).toBe(false);
    expect(candidate.alias_type).toBe('display_name');
    expect(candidate.confidence).toBeLessThan(1);
    expect(candidate.confidence).toBeGreaterThanOrEqual(0);
  });

  it('cannot be coerced into a linking shape -- the return type structurally forbids a non-null identity_id', () => {
    const candidate = evaluateDisplayNameCandidate('Bob Jones');
    // TypeScript enforces `identity_id: null` as a literal type at compile
    // time (not just `string | null`) -- this runtime assertion is the
    // proof-by-construction backstop for that structural guarantee.
    expect(candidate.identity_id).toBe(null);
  });
});

describe('resolveRow -- never conflates a display-name candidate with a real link', () => {
  const verifiedEmailAliases: EmailAliasRecord[] = [
    { identity_id: 'id-alice', value: 'alice@example.com', verified: true },
  ];
  const verifiedProviderAliases: ProviderAliasRecord[] = [
    { identity_id: 'id-bob', value: 'zoom-participant-123', provider: 'zoom', verified: true },
  ];

  it('links via verified email and returns no display-name candidate', () => {
    const result = resolveRow(
      { email: 'alice@example.com', displayName: 'Alice Smith' },
      verifiedEmailAliases,
      verifiedProviderAliases,
    );
    expect(result.identity_id).toBe('id-alice');
    expect(result.displayNameCandidate).toBeNull();
  });

  it('links via provider participant id and returns no display-name candidate', () => {
    const result = resolveRow(
      { providerParticipantId: 'zoom-participant-123', provider: 'zoom', displayName: 'Bob Jones' },
      verifiedEmailAliases,
      verifiedProviderAliases,
    );
    expect(result.identity_id).toBe('id-bob');
    expect(result.displayNameCandidate).toBeNull();
  });

  it('THE CENTERPIECE: a row whose ONLY signal is a display-name match ends with identity_id unset (null), and records a non-linking candidate instead', () => {
    const result = resolveRow(
      { displayName: 'Alice Smith' }, // same name as a real, resolved identity above -- must still not link
      verifiedEmailAliases,
      verifiedProviderAliases,
    );
    expect(result.identity_id).toBeNull();
    expect(result.displayNameCandidate).not.toBeNull();
    expect(result.displayNameCandidate?.identity_id).toBeNull();
    expect(result.displayNameCandidate?.verified).toBe(false);
  });

  it('returns no identity_id and no candidate when there is no signal at all', () => {
    const result = resolveRow({}, verifiedEmailAliases, verifiedProviderAliases);
    expect(result.identity_id).toBeNull();
    expect(result.displayNameCandidate).toBeNull();
  });
});
