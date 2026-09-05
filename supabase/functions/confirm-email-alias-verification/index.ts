/**
 * CONFIRM EMAIL ALIAS VERIFICATION EDGE FUNCTION (Phase 34, Plan 03, IDENT-03)
 *
 * The security-critical half of the custom email-ownership flow started by
 * request-email-alias-verification/index.ts. A signed-in user submits the
 * 6-digit code they received; on a correct match this links the email to
 * their identity (get-or-create `identities`, upsert a verified
 * `identity_aliases` row) -- it NEVER re-points the account's login email via
 * Supabase Auth and NEVER writes to the Supabase-managed users table or the
 * session (34-RESEARCH.md Pitfall 1). All writes go through the service-role
 * client.
 *
 * Security:
 * - T-34-03-01: expiry (10 min) + a hard 5-attempt cap that deletes the
 *   pending row are both enforced before the code is ever compared.
 * - T-34-03-03: the submitted code is hashed (otp.ts) and compared against
 *   code_hash -- the plaintext is never persisted or echoed back.
 * - T-34-03-05: rejects (409) if the email is already a verified alias on a
 *   DIFFERENT identity, rather than violating identity_aliases_verified_unique.
 * - Deliberately generic error messages on lookup-miss vs. expiry vs. wrong
 *   code -- does not reveal which case occurred.
 *
 * Accepts POST with: { email: string, code: string }
 */

import { z } from 'https://esm.sh/zod@3.23.8';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { hashCode } from '../_shared/otp.ts';

const MAX_ATTEMPTS = 5;
const GENERIC_INVALID_MESSAGE = 'Invalid or expired code.';

const confirmSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const authResult = await authenticateRequest(req, authClient, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const rawBody = await req.json();
    const validation = confirmSchema.safeParse(rawBody);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ success: false, error: errorMessage, code: 'VALIDATION_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { email, code } = validation.data;

    // Service-role for everything below: reads/writes a client-deny table
    // and writes identities/identity_aliases regardless of RLS.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const pending = await supabase
      .from('identity_alias_verifications')
      .select('id, code_hash, expires_at, attempts')
      .eq('user_id', userId)
      .eq('email', email)
      .maybeSingle();

    if (pending.error) {
      throw new Error(`Failed to look up pending verification: ${pending.error.message}`);
    }

    // Do not reveal whether the row is missing vs. expired vs. never requested.
    if (!pending.data) {
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_INVALID_MESSAGE, code: 'INVALID_OR_EXPIRED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(pending.data.expires_at as string).getTime() < Date.now()) {
      await supabase.from('identity_alias_verifications').delete().eq('id', pending.data.id);
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_INVALID_MESSAGE, code: 'INVALID_OR_EXPIRED' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const submittedHash = await hashCode(code);
    if (submittedHash !== pending.data.code_hash) {
      const newAttempts = (pending.data.attempts as number) + 1;

      // Hard brute-force cap (T-34-03-01): invalidate the row entirely once
      // 5 wrong submissions have been made -- the user must request a fresh
      // code, resetting the attacker's window.
      if (newAttempts >= MAX_ATTEMPTS) {
        await supabase.from('identity_alias_verifications').delete().eq('id', pending.data.id);
        return new Response(
          JSON.stringify({ success: false, error: GENERIC_INVALID_MESSAGE, code: 'INVALID_OR_EXPIRED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateAttempts = await supabase
        .from('identity_alias_verifications')
        .update({ attempts: newAttempts })
        .eq('id', pending.data.id);
      if (updateAttempts.error) {
        throw new Error(`Failed to record failed attempt: ${updateAttempts.error.message}`);
      }

      return new Response(
        JSON.stringify({ success: false, error: GENERIC_INVALID_MESSAGE, code: 'INVALID_OR_EXPIRED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Code matched. Get-or-create this user's identity (reuse if they
    // already own one; owner_user_id has no UNIQUE constraint, so guard
    // against an unexpected multi-row match with .limit(1)).
    let identityId: string;
    const existingIdentity = await supabase
      .from('identities')
      .select('id')
      .eq('owner_user_id', userId)
      .limit(1)
      .maybeSingle();
    if (existingIdentity.error) {
      throw new Error(`Failed to look up identity: ${existingIdentity.error.message}`);
    }

    if (existingIdentity.data) {
      identityId = existingIdentity.data.id as string;
    } else {
      const created = await supabase
        .from('identities')
        .insert({ owner_user_id: userId })
        .select('id')
        .single();
      if (created.error || !created.data) {
        throw new Error(`Failed to create identity: ${created.error?.message}`);
      }
      identityId = created.data.id as string;
    }

    // T-34-03-05: never let two identities both claim the same verified
    // email -- reject before writing rather than relying solely on the
    // partial unique index (identity_aliases_verified_unique) to catch it.
    const existingAlias = await supabase
      .from('identity_aliases')
      .select('id, identity_id')
      .eq('alias_type', 'email')
      .eq('value', email)
      .eq('verified', true)
      .maybeSingle();
    if (existingAlias.error) {
      throw new Error(`Failed to check existing alias: ${existingAlias.error.message}`);
    }

    if (existingAlias.data && existingAlias.data.identity_id !== identityId) {
      return new Response(
        JSON.stringify({ success: false, error: 'This email is already verified on another account.', code: 'ALREADY_CLAIMED' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nowIso = new Date().toISOString();
    if (existingAlias.data) {
      // Idempotent re-confirm of an email already verified on THIS identity.
      const updateAlias = await supabase
        .from('identity_aliases')
        .update({ verified: true, verified_at: nowIso, confidence: 1.0, evidence: 'verified email' })
        .eq('id', existingAlias.data.id);
      if (updateAlias.error) {
        throw new Error(`Failed to update verified alias: ${updateAlias.error.message}`);
      }
    } else {
      const insertAlias = await supabase.from('identity_aliases').insert({
        identity_id: identityId,
        alias_type: 'email',
        value: email,
        verified: true,
        verified_at: nowIso,
        confidence: 1.0,
        evidence: 'verified email',
      });
      if (insertAlias.error) {
        // A concurrent confirm could race past the pre-check above and hit
        // the partial unique index (identity_aliases_verified_unique) --
        // treat that as the same 409 double-claim outcome.
        return new Response(
          JSON.stringify({ success: false, error: 'This email is already verified on another account.', code: 'ALREADY_CLAIMED' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Success -- delete the pending row so the code cannot be replayed.
    await supabase.from('identity_alias_verifications').delete().eq('id', pending.data.id);

    return new Response(
      JSON.stringify({ success: true, identity_id: identityId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in confirm-email-alias-verification:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message, code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
