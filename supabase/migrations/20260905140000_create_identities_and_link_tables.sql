-- Migration: Create identities and identity_aliases tables; extend speakers/contacts/call_participants
-- Purpose: Establishes `identities` as the person-spine that reconciles speakers (user-scoped),
--          contacts (org-scoped), and call_participants (recording-scoped) via a nullable
--          identity_id FK on each -- none moved or deleted, every existing reader unchanged
--          (IDENT-01). This is the second non-org-scoped table in the schema after `events`
--          (Phase 30, EVT-04) -- visibility is granted via participation (call_participants.
--          identity_id + org membership, contacts.identity_id + org membership) or ownership
--          (identities.owner_user_id), never an org-scoping column, and never an org-admin
--          bypass. identity_aliases records typed evidence (email/provider_participant_id/
--          display_name) with a partial unique index so only VERIFIED rows are exclusive --
--          weak candidate signals (display-name variants) can coexist without blocking each
--          other. get_identity_evidence(p_identity_id) is a redacted SECURITY DEFINER RPC that
--          returns only (alias_type, confidence, evidence) -- never the raw `value` (email PII)
--          -- so IDENT-08's "visible on demand" confidence/evidence UI can be shown to any
--          authorized viewer without over-exposing PII to non-owners.
--          Every change is additive and NULL-safe: with identity_id NULL across the board (the
--          only state this migration produces -- the Phase 35+ resolver populates it), zero
--          current behavior changes -- proven by identity-schema-noop.integration.test.ts,
--          mirroring Phase 30's EVT-03 precedent.
--          user_can_view_identity() is SECURITY DEFINER from the start (not bolted on later like
--          events' user_participates_in_event) -- events' own CR-01 fix (a bare EXISTS subquery
--          against call_participants inherited call_participants' own org-membership-only RLS,
--          silently zeroing the participation branch for any non-org-member) is mirrored here as
--          a lesson learned, not repeated.
--          Reversibility-gate decision: option-a, approved as-is (Phase 34 Plan 01, Task 2).
-- Author: Claude (GSD Phase 34 Plan 02 executor)
-- Date: 2026-09-05

-- ============================================================================
-- 1. TABLE: identities
-- ============================================================================
-- No org-scoping column (mirrors events/EVT-04 -- a real person legitimately
-- spans multiple organizations). owner_user_id is nullable: an identity is
-- "claimed" only once a user verifies an email against it (IDENT-03, Plan 03);
-- an unclaimed/inferred identity (e.g. resolved via provider_participant_id
-- alone) has owner_user_id IS NULL until claimed (sets up Phase 39 DISCO-02).

CREATE TABLE IF NOT EXISTS identities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TABLE: identity_aliases
-- ============================================================================
-- Typed evidence ledger. `value` is PII (email address, provider participant
-- id, or display-name variant) -- normalized (lower/trim for email) at write
-- time by the Plan 03/04 writers, not enforced here. verified=true rows are
-- confirmed facts (e.g. a user proved ownership of an email); verified=false
-- rows are unconfirmed candidate signals (e.g. a display-name variant) that
-- must NEVER auto-link an identity on their own (IDENT-02).

CREATE TABLE IF NOT EXISTS identity_aliases (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID        NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  alias_type  TEXT        NOT NULL CHECK (alias_type IN ('email', 'provider_participant_id', 'display_name')),
  value       TEXT        NOT NULL,
  provider    TEXT,
  verified    BOOLEAN     NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  confidence  NUMERIC     CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  evidence    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. EXTEND speakers, contacts, call_participants: identity_id (IDENT-01)
-- ============================================================================
-- Nullable FK, ON DELETE SET NULL so deleting an identity never breaks a
-- speaker/contact/participant row. NULL means unresolved -- the only state
-- this migration produces (the Phase 35+ resolver populates it). No existing
-- reader is touched: purely additive per the Plan 01 reader inventory (46
-- SELECT-bearing call sites; see identity-schema-noop.integration.test.ts).

ALTER TABLE speakers
  ADD COLUMN IF NOT EXISTS identity_id UUID REFERENCES identities(id) ON DELETE SET NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS identity_id UUID REFERENCES identities(id) ON DELETE SET NULL;

ALTER TABLE call_participants
  ADD COLUMN IF NOT EXISTS identity_id UUID REFERENCES identities(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
-- Partial unique index: only VERIFIED aliases are exclusive -- two identities
-- can never both hold the same verified email/provider-id, while unverified
-- candidate signals (display-name variants) can coexist freely (IDENT-02).

CREATE UNIQUE INDEX IF NOT EXISTS identity_aliases_verified_unique
  ON identity_aliases(alias_type, value) WHERE verified = true;

CREATE INDEX IF NOT EXISTS idx_identity_aliases_identity_id
  ON identity_aliases(identity_id);

CREATE INDEX IF NOT EXISTS idx_identity_aliases_type_value
  ON identity_aliases(alias_type, value);

-- Back the user_can_view_identity() EXISTS predicates below.
CREATE INDEX IF NOT EXISTS idx_speakers_identity_id
  ON speakers(identity_id) WHERE identity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_identity_id
  ON contacts(identity_id) WHERE identity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_participants_identity_id
  ON call_participants(identity_id) WHERE identity_id IS NOT NULL;

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================
-- SECURITY DEFINER from the outset -- reads call_participants/contacts under
-- definer privileges so the identities RLS policy's participation branch is
-- actually reachable, rather than silently inheriting those tables' own
-- org-membership-only SELECT policies (the exact bug fixed for events after
-- the fact by 20260831020000's user_participates_in_event / CR-01).

CREATE OR REPLACE FUNCTION public.user_can_view_identity(p_identity_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identities i
    WHERE i.id = p_identity_id AND i.owner_user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM call_participants cp
    WHERE cp.identity_id = p_identity_id
      AND is_organization_member(cp.organization_id, p_user_id)
  ) OR EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.identity_id = p_identity_id
      AND is_organization_member(c.org_id, p_user_id)
  );
$$;

COMMENT ON FUNCTION public.user_can_view_identity(UUID, UUID) IS
  'SECURITY DEFINER check for identities RLS: owner OR a participant/contact linked to this '
  'identity via an organization the user belongs to. Reads call_participants/contacts under '
  'definer privileges so this check is reachable regardless of those tables'' own '
  'org-membership-only SELECT policies -- mirrors the events/user_participates_in_event CR-01 '
  'fix, applied here from the start rather than bolted on after a leak.';

CREATE OR REPLACE FUNCTION public.get_identity_evidence(p_identity_id UUID)
RETURNS TABLE(alias_type TEXT, confidence NUMERIC, evidence TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT alias_type, confidence, evidence
  FROM identity_aliases
  WHERE identity_id = p_identity_id AND verified = true
  ORDER BY confidence DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.get_identity_evidence(UUID) IS
  'Redacted evidence RPC (IDENT-08): returns only alias_type/confidence/evidence, NEVER the raw '
  '`value` column (email/provider-id PII). Deliberately callable by any authenticated user -- '
  'the payload is safe for any viewer who can already see the speaker label; the caller is '
  'responsible for having reached p_identity_id via a call_participants/contacts/speakers row '
  'RLS already authorized them to see.';

CREATE OR REPLACE FUNCTION public.update_identities_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS matters here: without it, the table owner role bypasses RLS
-- entirely (mirrors call_participants/events precedent).

ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identities FORCE ROW LEVEL SECURITY;

ALTER TABLE identity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_aliases FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================
-- Deliberately NO org-admin bypass on either table (T-34-02-03): contacts/
-- call_participants have org-member policies; identities/identity_aliases
-- must NOT be gated that way -- a real person's identity is not an
-- org-scoped artifact. Deliberately NO broad authenticated SELECT on
-- identity_aliases (T-34-02-02): the raw `value` column is PII; non-owners
-- read only the redacted get_identity_evidence() RPC above.

DROP POLICY IF EXISTS "users_can_view_linked_identities" ON identities;
CREATE POLICY "users_can_view_linked_identities"
  ON identities FOR SELECT
  USING (public.user_can_view_identity(id, auth.uid()));

DROP POLICY IF EXISTS "owner_can_update_own_identity" ON identities;
CREATE POLICY "owner_can_update_own_identity"
  ON identities FOR UPDATE
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access" ON identities;
CREATE POLICY "Service role full access"
  ON identities FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_can_view_own_aliases" ON identity_aliases;
CREATE POLICY "owner_can_view_own_aliases"
  ON identity_aliases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM identities i
      WHERE i.id = identity_aliases.identity_id
        AND i.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role full access" ON identity_aliases;
CREATE POLICY "Service role full access"
  ON identity_aliases FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION public.get_identity_evidence(UUID) TO authenticated;

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS identities_updated_at ON public.identities;
CREATE TRIGGER identities_updated_at
  BEFORE UPDATE ON public.identities
  FOR EACH ROW EXECUTE FUNCTION public.update_identities_updated_at();

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================

COMMENT ON TABLE identities IS
  'Person-spine reconciling speakers/contacts/call_participants via a nullable identity_id on '
  'each. Deliberately not scoped by organization -- the second such table after events (EVT-04). '
  'Visibility via participation or ownership only; no org-admin bypass. owner_user_id NULL means '
  'unclaimed (no verified email yet); identity_id NULL on a person-table row means unresolved, '
  'never broken.';

COMMENT ON COLUMN identities.owner_user_id IS
  'The auth.users row that has verified at least one email against this identity (IDENT-03). '
  'NULL means unclaimed -- an inferred/unresolved identity with no verified owner yet.';

COMMENT ON TABLE identity_aliases IS
  'Typed evidence ledger for identity resolution: email | provider_participant_id | '
  'display_name. verified=true rows are confirmed facts (unique per alias_type+value via the '
  'partial index below); verified=false rows are unconfirmed candidate signals that must never '
  'auto-link an identity on their own (IDENT-02). `value` is PII -- SELECT is owner-only; the '
  'broad-audience read path is get_identity_evidence(), never this table directly.';

COMMENT ON COLUMN identity_aliases.value IS
  'The raw alias value (email address, provider participant id, or display-name variant). PII '
  'for alias_type=email. Never exposed via get_identity_evidence() -- owner-only SELECT on this '
  'table is the only direct read path.';

COMMENT ON COLUMN identity_aliases.confidence IS
  'Confidence (0..1) this alias correctly identifies the linked identity. NULL/1.0 typical for '
  'verified rows; <1.0 for inferred/candidate signals.';

COMMENT ON COLUMN speakers.identity_id IS
  'The identity this speaker row resolves to. NULL means unresolved -- never means broken '
  '(IDENT-01).';

COMMENT ON COLUMN contacts.identity_id IS
  'The identity this contact resolves to. NULL means unresolved -- never means broken '
  '(IDENT-01).';

COMMENT ON COLUMN call_participants.identity_id IS
  'The identity this participant resolves to. NULL means unresolved -- never means broken '
  '(IDENT-01). Distinct from event_id (Phase 30, which meeting) and role/participant_type '
  '(which classification) -- identity_id answers "which real person".';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
