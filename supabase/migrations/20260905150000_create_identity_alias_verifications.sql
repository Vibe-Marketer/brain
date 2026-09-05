-- Migration: Create identity_alias_verifications (pending email-OTP ledger)
-- Purpose: Backs IDENT-03's email-ownership proof. A signed-in user can prove
--          they own a second email address via a 6-digit CSPRNG code, hashed
--          at rest (SHA-256), sent via the existing Resend integration
--          (request-email-alias-verification/index.ts) and confirmed
--          (confirm-email-alias-verification/index.ts) into a verified
--          identity_aliases row (Plan 02). This table NEVER touches the
--          Supabase-managed users table or the session -- it is a small,
--          self-contained pending-code ledger, not a Supabase Auth mechanism
--          (Supabase Auth is one-email-per-account; see 34-RESEARCH.md
--          Pitfall 1).
--          Service-role-only: RLS enabled+forced, NO authenticated/anon
--          policy at all -- the plaintext code is never stored (code_hash
--          only) and never round-trips through a client-readable row, proven
--          by rls-regression.test.ts's CLIENT_DENY_TABLES gate.
-- Author: Claude (GSD Phase 34 Plan 03 executor)
-- Date: 2026-09-05

-- ============================================================================
-- 1. TABLE: identity_alias_verifications
-- ============================================================================
-- UNIQUE(user_id, email): a repeat request for the same (user, email) pair
-- upserts (refreshes code/expiry) rather than accumulating duplicate pending
-- rows -- coalesces repeated requests for the same address (T-34-03-02).

CREATE TABLE IF NOT EXISTS identity_alias_verifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  code_hash   TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_identity_alias_verifications_user_email
  ON identity_alias_verifications(user_id, email);

-- Backs the per-user request rate limit (counts rows for a user within a
-- rolling window) enforced by request-email-alias-verification/index.ts.
CREATE INDEX IF NOT EXISTS idx_identity_alias_verifications_user_created
  ON identity_alias_verifications(user_id, created_at);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS: without it the table owner role bypasses RLS entirely (mirrors
-- every other table in this schema). Deliberately NO authenticated/anon
-- policy of any kind -- this table holds only a hash of a short-lived secret
-- code; a client should never be able to read a pending row, verified or not.

ALTER TABLE identity_alias_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_alias_verifications FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access" ON identity_alias_verifications;
CREATE POLICY "Service role full access"
  ON identity_alias_verifications FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE identity_alias_verifications IS
  'Pending email-ownership OTP ledger for IDENT-03. Holds only a SHA-256 hash '
  'of the 6-digit code (code_hash), never the plaintext. Service-role-only -- '
  'no authenticated/anon policy exists; a client can never read a row here '
  '(proven by rls-regression.test.ts CLIENT_DENY_TABLES). Never touches the '
  'Supabase-managed users table or the session -- '
  'confirm-email-alias-verification writes only to identities/identity_aliases '
  'on success, then deletes the pending row.';

COMMENT ON COLUMN identity_alias_verifications.code_hash IS
  'SHA-256 hex digest of the 6-digit code. The plaintext code exists only in '
  'transit (the Resend email) and the recipient''s inbox -- never at rest.';

COMMENT ON COLUMN identity_alias_verifications.attempts IS
  'Failed-confirmation counter. confirm-email-alias-verification increments '
  'this on every hash mismatch and deletes the row once attempts reaches 5 '
  '(hard brute-force cap, T-34-03-01).';

COMMENT ON COLUMN identity_alias_verifications.expires_at IS
  'Set to request time + 10 minutes. confirm-email-alias-verification rejects '
  'any submission after this timestamp, win or lose on the code match.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
