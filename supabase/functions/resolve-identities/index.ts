/**
 * resolve-identities — Phase 34 Plan 04: forward-only identity resolver.
 *
 * Mirrors resolve-events (Phase 31 Plan 01): shared-secret gated, NOT
 * user-JWT authenticated, delegates all matching decisions to a pure
 * _shared module. This endpoint:
 *   1. Rejects any request missing/mismatching X-Reconcile-Secret with 401,
 *      BEFORE any DB work.
 *   2. Zod-validates a forward-only body ({ mode: 'forward', since?: ISO }).
 *   3. Loads every VERIFIED email + provider-participant-id alias
 *      (service-role read of identity_aliases).
 *   4. For speakers/contacts/call_participants rows with identity_id IS
 *      NULL created at/after the cutover, delegates to
 *      _shared/identity-resolver.ts's resolveRow: a verified-email or
 *      provider-id match UPDATEs that row's identity_id; a display-name-
 *      only signal is tallied in the response summary and NEVER sets
 *      identity_id (IDENT-02's core guarantee).
 *
 * Cutover (forward-only, no historical backfill): defaults to
 * 2026-09-05T14:00:00Z, the timestamp Plan 02's migration
 * (20260905140000_create_identities_and_link_tables.sql) added the
 * identity_id column to TEST -- rows created before this moment are never
 * swept by default. Callers may pass an explicit `since` to move the
 * cutover forward (never backward via this endpoint's own default -- an
 * earlier `since` is still forward-only in that it never triggers a
 * backfill of the pre-identity-spine corpus without an explicit, deliberate
 * caller choice).
 *
 * Display-name candidates are NOT persisted to identity_aliases by this
 * function: identity_aliases.identity_id is NOT NULL (Plan 02's schema), so
 * a display-name-only signal on a row with no OTHER resolved evidence has
 * no identity to attach candidate evidence to. Identity creation is lazy
 * (created only on verified-email or provider-id resolution, per Plan 01's
 * locked design) -- a display-name match alone must never manufacture an
 * identity to hang itself on, since that would be a backdoor way to let
 * name-similarity influence the identity graph. Display-name signals are
 * therefore only ever tallied (displayNameCandidates count in the
 * response), never written -- this is stricter than, not a shortcut around,
 * the never-auto-link guarantee.
 *
 * Deploy (deferred to Plan 07):
 *   supabase functions deploy resolve-identities --use-api --no-verify-jwt
 *   (shared-secret auth happens in application code, not Supabase's JWT
 *   gate -- reuses the existing RECONCILE_SECRET, already gating
 *   resolve-events/fathom-reconcile; no new secret).
 *
 * Trigger/cron wiring is explicitly OUT OF SCOPE for this plan -- this
 * function ships inert-until-invoked, exactly like resolve-events did
 * before Phase 32 wired its cron.
 *
 * Env vars required:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
 *   - RECONCILE_SECRET (shared secret; also gates resolve-events/fathom-reconcile)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  type EmailAliasRecord,
  type ProviderAliasRecord,
  resolveRow,
} from '../_shared/identity-resolver.ts';

const requestSchema = z.object({
  mode: z.literal('forward'),
  since: z.string().datetime().optional(),
});

/** Plan 02's migration timestamp -- the identity spine's own creation moment on TEST. Forward-only default cutover. */
const DEFAULT_CUTOVER = '2026-09-05T14:00:00Z';

/** The three tables Plan 02 extended with a nullable identity_id (IDENT-01). call_speakers is deliberately excluded -- it never gained the column. */
const CANDIDATE_TABLES = ['speakers', 'contacts', 'call_participants'] as const;
type CandidateTable = (typeof CANDIDATE_TABLES)[number];

interface CandidateRowShape {
  id: string;
  email: string | null;
  name: string | null;
}

interface ResolveSummary {
  scanned: number;
  linked: number;
  displayNameCandidates: number;
  errors: number;
  byTable: Record<CandidateTable, { scanned: number; linked: number }>;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Shared-secret gate BEFORE any DB work -- this endpoint is
    //    forward-only-batch-triggered, never user-JWT (mirrors
    //    resolve-events/fathom-reconcile's reconcile mode).
    const secret = req.headers.get('X-Reconcile-Secret');
    const expected = Deno.env.get('RECONCILE_SECRET');
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Validate request body -- forward-only, no historical backfill mode exists.
    const body = await req.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const since = validation.data.since ?? DEFAULT_CUTOVER;

    // 4. Service-role client -- this endpoint has no user session to bind to.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Load every VERIFIED alias once -- both email and provider-id types.
    //    Unverified aliases are never fetched at all here (defense in depth
    //    on top of identity-resolver.ts's own internal verified-only filter).
    const { data: aliasRows, error: aliasError } = await supabase
      .from('identity_aliases')
      .select('identity_id, alias_type, value, provider, verified')
      .eq('verified', true)
      .in('alias_type', ['email', 'provider_participant_id']);

    if (aliasError) {
      console.error('[resolve-identities] alias lookup failed closed:', aliasError.message);
      return new Response(JSON.stringify({ error: aliasError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailAliases: EmailAliasRecord[] = [];
    const providerAliases: ProviderAliasRecord[] = [];
    for (const row of aliasRows ?? []) {
      if (row.alias_type === 'email') {
        emailAliases.push({ identity_id: row.identity_id, value: row.value, verified: row.verified });
      } else if (row.alias_type === 'provider_participant_id' && row.provider) {
        providerAliases.push({
          identity_id: row.identity_id,
          value: row.value,
          provider: row.provider,
          verified: row.verified,
        });
      }
    }

    const summary: ResolveSummary = {
      scanned: 0,
      linked: 0,
      displayNameCandidates: 0,
      errors: 0,
      byTable: {
        speakers: { scanned: 0, linked: 0 },
        contacts: { scanned: 0, linked: 0 },
        call_participants: { scanned: 0, linked: 0 },
      },
    };

    // 6. Forward-only sweep: only rows with identity_id IS NULL, created
    //    at/after the cutover. No historical backfill (T-34-04-05).
    for (const table of CANDIDATE_TABLES) {
      const { data: rows, error: rowsError } = await supabase
        .from(table)
        .select('id, email, name, created_at')
        .is('identity_id', null)
        .gte('created_at', since)
        .limit(500);

      if (rowsError) {
        console.error(`[resolve-identities] ${table} fetch failed closed:`, rowsError.message);
        summary.errors++;
        continue;
      }

      for (const row of (rows ?? []) as CandidateRowShape[]) {
        summary.scanned++;
        summary.byTable[table].scanned++;

        // No provider-participant-id column exists on any of the three
        // tables today (reader-inventory.md's "Match sites for the
        // resolver" table) -- the provider-id path is implemented and
        // unit-proven in identity-resolver.ts for forward compatibility,
        // but has no live source value to pass here until a future
        // migration adds one. Only email + display-name signals are real
        // inputs today.
        const result = resolveRow({ email: row.email, displayName: row.name }, emailAliases, providerAliases);

        if (result.identity_id) {
          // High-confidence auto-link ONLY: verified email or provider-id
          // match (IDENT-02). Never derived from result.displayNameCandidate.
          const { error: updateError } = await supabase
            .from(table)
            .update({ identity_id: result.identity_id })
            .eq('id', row.id);

          if (updateError) {
            console.error(`[resolve-identities] ${table} update failed closed:`, updateError.message);
            summary.errors++;
            continue;
          }
          summary.linked++;
          summary.byTable[table].linked++;
          continue;
        }

        if (result.displayNameCandidate) {
          // NEVER sets identity_id and NEVER written to identity_aliases:
          // identity_aliases.identity_id is NOT NULL (Plan 02 schema) and
          // identity creation is lazy (email/provider-id only) -- a
          // display-name-only row with no other evidence has no identity to
          // attach candidate evidence to. Tallied for observability only.
          summary.displayNameCandidates++;
        }
      }
    }

    // 7. Return the sweep summary. This function never reads or writes the
    //    Supabase auth user store -- verified aliases are Plan 03's
    //    responsibility (OTP confirm), not this resolver's.
    return new Response(JSON.stringify({ success: true, since, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[resolve-identities] handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
