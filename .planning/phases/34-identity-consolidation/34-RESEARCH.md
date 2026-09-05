# Phase 34: Identity Consolidation - Research

**Researched:** 2026-09-05
**Domain:** Postgres/Supabase identity-graph schema design, RLS, Supabase Auth email verification, React settings UI
**Confidence:** MEDIUM-HIGH (schema facts are HIGH/VERIFIED via live migration reads; the email-verification mechanism required a correction to CONTEXT.md's assumption, flagged below; frontend reader inventory is INCOMPLETE — flagged as first planning task)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `identities` + `identity_aliases` new tables; `speakers`/`contacts`/`call_participants` each gain nullable `identity_id` — none moved/deleted, existing readers unchanged.
- Verified linkage only — never auto-link on name similarity alone (IDENT-02/03).
- Multi-email: any of a user's verified emails resolves calls to the one identity.

### Claude's Discretion (Grey Areas — batch-accepted defaults, see Open Questions for a correction to Grey Area 1)
- **Grey Area 1 (email verification mechanism):** Recommended default was "reuse Supabase Auth's existing email-verification primitive (the same OTP/magic-link mechanism already used for account signup/login)." **Research finding: this is not literally achievable as stated — see Open Questions #1.** A corrected, spirit-preserving approach is recommended in Architecture Patterns below.
- **Grey Area 2 (where "add verified email" UI lives):** Account/profile settings page, wherever the existing user-settings surface is. **Found: `src/components/settings/AccountTab.tsx`, rendered from `src/pages/Settings.tsx`.**
- **Grey Area 3 (confidence/evidence display):** Not a new page — a tooltip/popover/badge on resolved speaker labels, using this codebase's existing design system (Radix popover/tooltip primitives, Remix Icons only, no Lucide).

### Deferred Ideas (OUT OF SCOPE)
- Full "we found N events associated with your verified identities" onboarding moment — likely Phase 39 (Discovery and Claim), not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDENT-01 | `identities` spine reconciles `speakers`/`contacts`/`call_participants` via nullable `identity_id`; none moved/deleted; existing readers unchanged | Exact current schemas verified for all three tables (Standard Stack / Architecture Patterns). Concrete additive migration provided. Reader-inventory gap flagged as Wave-0/first-task item — not exhaustively enumerated this session. |
| IDENT-02 | Resolution spans email aliases, provider participant IDs, display-name variants — never auto-links on name similarity alone | `identity_aliases` schema with `alias_type` enum + verified-only uniqueness designed so only email/provider-ID hits can auto-link; display-name variants are recorded as low-confidence, non-linking signals (Architecture Patterns, Common Pitfalls). |
| IDENT-03 | User can attach multiple owned, verified emails so calls under any resolve to one person | Corrected verification mechanism (custom OTP + existing Resend integration) documented in Architecture Patterns and Open Questions #1, since the CONTEXT.md-assumed Supabase-Auth-native approach does not support multi-email accounts. |
| IDENT-08 | Every resolved speaker label carries confidence + evidence, visible on demand | `get_identity_evidence()` redacted RPC design (Architecture Patterns) satisfies "visible on demand" without leaking raw email PII to every viewer; matches Grey Area 3's UI recommendation. |
</phase_requirements>

## Summary

This phase is schema-and-plumbing work with one small, real UI surface. The three existing person tables were read directly from their migration files (not from generated types, which don't yet include an `identities` concept — there is none in the codebase today). `speakers` is the oldest and simplest: user-scoped, `UNIQUE(user_id, email)`, and has a previously-undocumented legacy reader — `call_speakers`, a many-to-many join to the legacy `fathom_calls` (BIGINT-keyed) table. `contacts` is scoped by **both** `user_id` and `org_id` (not `organization_id` — a real naming inconsistency vs. `call_participants.organization_id` that will bite anyone writing a cross-table identity resolver). `call_participants` already carries three separate person-classification columns from two different migrations (`participant_type`: attendee/speaker/host, and `role`: organizer/invitee/attendee/speaker, added by Phase 30's EVT-05) — `identity_id` will be a fourth. None of this is contradictory, but a planner unaware of it will conflate `participant_type` and `role`.

The single most important finding is a correction to CONTEXT.md's Grey Area 1: **Supabase Auth does not support multiple emails per account.** `auth.users` has exactly one `email` column, and `supabase.auth.updateUser({ email })` *replaces* the login email rather than adding a second one — confirmed against this codebase's own usage (only `updateUser({ password })` and `resetPasswordForEmail` exist here today; no email-change flow exists to model against) and against Supabase's own community documentation. The spirit of "reuse existing infrastructure" is still achievable, just via a different concrete mechanism: this codebase already has a working transactional-email integration (Resend, used by `send-org-invite` and `send-support-ticket`) that a small custom OTP table + two edge functions can reuse, without touching `auth.users` or the user's session at all.

Architecturally, `identities` should follow the same **non-org-scoped** RLS pattern this milestone already established for `events` (Phase 30), not the `is_organization_member`-only pattern used by `contacts`/`call_participants` — a real person's identity legitimately spans organizations. `identities.owner_user_id` should be nullable from day one: an identity is "claimed" (owned by a signed-up user) only once an email is verified against it, which sets up Phase 39's DISCO-02 claim flow as "set `owner_user_id`" on a pre-existing, already-resolved identity rather than a new schema concept.

**Primary recommendation:** Add `identities` (nullable `owner_user_id`) + `identity_aliases` (typed, with a partial-unique index on `verified = true` rows only) as new tables; add nullable `identity_id` to all three existing tables; reuse `is_organization_member`-style SECURITY DEFINER helpers for RLS but scope `identities` visibility the way `events` is scoped (participation-or-ownership, never `organization_id`); build email verification as two small edge functions using a custom hashed-OTP table + the existing Resend integration, never Supabase Auth's `updateUser`/`verifyOtp`.

## Architectural Responsibility Map

This app is a Vite SPA (client-rendered React) talking to Supabase Edge Functions and Postgres directly — there is no SSR/frontend-server tier to consider.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `identities`/`identity_aliases` storage + RLS | Database/Storage | — | Postgres tables + RLS policies are the source of truth; no app-layer authorization substitute per this codebase's established pattern (`FORCE ROW LEVEL SECURITY` everywhere). |
| Identity resolution (matching verified email / provider ID to an identity, setting `identity_id`) | API/Backend (Edge Function or SQL function) | Database (constraints/triggers as a backstop) | Mirrors the existing `resolve-events` edge-function pattern (Phase 30-33) — resolution logic lives in TypeScript/SQL functions, not client code. |
| Email OTP generation, send, confirm | API/Backend (2 new Edge Functions) | Database (pending-code storage) | Must never run client-side (secret code, rate limiting, Resend API key are server-only concerns). |
| "Add email" settings UI | Browser/Client (React) | API/Backend (the 2 edge functions above) | Extends existing `AccountTab.tsx`; no new page. |
| Confidence/evidence popover on speaker labels | Browser/Client (React, Radix popover) | API/Backend (`get_identity_evidence` RPC) | UI reads a redacted RPC, never raw `identity_aliases.value` (email), to avoid over-exposing PII to viewers who aren't the identity owner. |

## Standard Stack

No new frameworks or major libraries are needed. This phase reuses the existing stack end-to-end.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard (here) |
|---------|---------|---------|--------------|
| Supabase JS SDK | already installed | DB access, Edge Function invocation | Already the only DB/RPC access pattern in this codebase. |
| Zod | already installed | Validate email input, OTP code shape | Already the mandated input-validation library per `supabase/CLAUDE.md`. |
| Resend (raw HTTP, no SDK package) | n/a — direct `fetch()` to `api.resend.com` | Send the OTP email | `supabase/functions/send-org-invite/index.ts` [VERIFIED: codebase] already does exactly this; reuse the same `RESEND_API_KEY` / `RESEND_DOMAIN_VERIFIED` secrets and `DEFAULT_FROM` pattern. No new package to install. |
| Radix UI (`@radix-ui/react-popover` or `-tooltip`) | already installed | IDENT-08 evidence-on-demand affordance | Already the project's dialog/popover primitive per `src/CLAUDE.md`. |
| Remix Icons (`@remixicon/react`) | already installed | Any icon on the new UI | Hard constraint (root `CLAUDE.md`) — Lucide is forbidden. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Deno `crypto.getRandomValues()` / Web Crypto `crypto.subtle.digest` | Deno runtime built-in | Generate + hash the OTP code | Never use `Math.random()` for a security code (see Security Domain). No package needed — this is a runtime built-in in Deno edge functions. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom OTP table + Resend | Supabase `auth.admin.generateLink()` (service-role) to produce a magic-link token, then a custom confirm route | Avoids writing your own code generator, but `generateLink`'s `type: 'magiclink'`/`'signup'` still binds the token to an `auth.users` row for that email — verifying it either creates a phantom second account (if none exists) or authenticates as a different existing account (if one does). Doesn't cleanly solve "prove ownership while staying logged in as myself." Rejected for that reason. |
| Storing the identity resolver as a SQL function | A Deno edge function (`resolve-identities`), mirroring `resolve-events` | Either works; an edge function is more consistent with this milestone's established pattern (Phase 30-33 all resolve via `resolve-events`), and is easier to feature-flag/shadow-mode later if needed. Recommend edge function for consistency, SQL function acceptable if the team prefers less deploy surface. |

**Installation:** None. No `npm install` / new Supabase extension needed for this phase.

## Package Legitimacy Audit

**N/A — no new external packages are introduced by this phase.** Every capability (transactional email, popovers, validation, crypto) reuses an already-installed dependency or a Deno/Postgres built-in. The Package Legitimacy Gate is not applicable; skip slopcheck.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (React SPA)                                              │
│  AccountTab.tsx ── "Add email" form                               │
│     │  1. POST email                                              │
│     ▼                                                              │
└─────┼──────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Edge Function: request-email-alias-verification                  │
│  - authenticateRequest() (existing shared helper)                │
│  - Zod-validate email                                             │
│  - generate 6-digit code via crypto.getRandomValues()             │
│  - hash code (SHA-256), store in identity_alias_verifications     │
│    (user_id, email, code_hash, expires_at, attempts=0)            │
│  - send code via Resend (reuse send-org-invite's HTTP pattern)    │
└─────┼──────────────────────────────────────────────────────────────┘
      │  2. user reads email, submits code
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Edge Function: confirm-email-alias-verification                  │
│  - authenticateRequest()                                          │
│  - look up pending row by (user_id, email); check expiry + attempts│
│  - hash submitted code, compare; increment attempts on mismatch   │
│  - on match: get-or-create identities row (owner_user_id = user)  │
│  - upsert identity_aliases (alias_type='email', verified=true,    │
│    evidence='verified email', confidence=1.0)                     │
│  - delete the pending verification row                            │
└─────┼──────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Identity resolver (edge function or SQL function, forward-only,   │
│ triggered on new call_participants / speakers / contacts rows —   │
│ mirrors resolve-events' hook point)                                │
│  - exact match on a VERIFIED identity_aliases.value → set          │
│    identity_id (high confidence, auto-link)                       │
│  - exact match on provider_participant_id → set identity_id        │
│    (high confidence, auto-link)                                   │
│  - display-name variant alone → record as an UNVERIFIED, low-      │
│    confidence candidate alias; NEVER sets identity_id by itself    │
└─────┼──────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Postgres: identities, identity_aliases (new)                      │
│          speakers.identity_id, contacts.identity_id,               │
│          call_participants.identity_id (new, nullable, additive)   │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ get_identity_evidence(identity_id) RPC (SECURITY DEFINER)          │
│  → confidence + evidence text only, never the raw email/value      │
│  → consumed by a Radix popover on speaker labels wherever they     │
│    already render (IDENT-08 "visible on demand")                  │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
supabase/functions/
├── request-email-alias-verification/index.ts   # new
├── confirm-email-alias-verification/index.ts    # new
├── resolve-identities/index.ts                  # new (or extend resolve-events)
└── _shared/
    └── identity-resolver.ts                     # new — pure matching functions, unit-testable

supabase/migrations/
└── 2026090X000000_create_identities_and_link_tables.sql   # new

src/
├── services/
│   └── identity.service.ts        # new — calls the two edge functions + reads identity_aliases
├── hooks/
│   └── useIdentityAliases.ts      # new — TanStack Query wrapper
├── components/
│   ├── settings/AccountTab.tsx    # EXTEND — add "Verified emails" section
│   └── shared/IdentityEvidenceBadge.tsx   # new — Radix popover, Remix icon
```

### Pattern 1: Non-org-scoped RLS for a person-spine table (mirrors `events`)
**What:** `identities` cannot be gated by `is_organization_member(organization_id, ...)` because one person legitimately spans multiple organizations — exactly the reasoning that made `events` (Phase 30, EVT-04) the first non-org-scoped table in this schema.
**When to use:** Any table whose rows represent a real-world entity (person, in this case) rather than a workspace-scoped artifact.
**Example:**
```sql
-- Source: pattern verified against supabase/migrations/20260831000001_create_events_and_extend_participants.sql
-- and supabase/migrations/20260831020000_fix_events_participation_rls_and_updated_at_trigger.sql
-- (the CR-01 fix for events' own participation-RLS bug is directly relevant precedent — see Common Pitfalls)

CREATE OR REPLACE FUNCTION user_can_view_identity(p_identity_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM identities i WHERE i.id = p_identity_id AND i.owner_user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM call_participants cp
    WHERE cp.identity_id = p_identity_id AND is_organization_member(cp.organization_id, p_user_id)
  ) OR EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.identity_id = p_identity_id AND is_organization_member(c.org_id, p_user_id)
    -- contacts uses org_id, NOT organization_id -- verified in this research, see Common Pitfalls
  );
$$;

ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identities FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_linked_identities" ON identities
  FOR SELECT USING (user_can_view_identity(id, auth.uid()));

CREATE POLICY "owner_can_update_own_identity" ON identities
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "service_role_full_access_identities" ON identities
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Pattern 2: Verified-only uniqueness on the alias table (never auto-link on weak signals)
**What:** A partial unique index that only constrains `verified = true` rows lets low-confidence candidate signals (display-name variants) coexist without blocking each other, while still making it impossible for two identities to both claim the same verified email.
**When to use:** Any evidence table where some rows are confirmed facts and others are unconfirmed candidates.
**Example:**
```sql
-- Source: pattern derived from this milestone's existing precedent of a partial
-- unique index scoped to a decision state (event_match_decisions' own partial
-- unique index, Phase 31 P02 STATE.md note) applied to the identity-alias problem.
CREATE TABLE identity_aliases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id   UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  alias_type    TEXT NOT NULL CHECK (alias_type IN ('email','provider_participant_id','display_name')),
  value         TEXT NOT NULL,               -- normalized: lower(trim(...)) for email
  provider      TEXT,                        -- e.g. 'zoom','fathom' -- only for provider_participant_id
  verified      BOOLEAN NOT NULL DEFAULT false,
  verified_at   TIMESTAMPTZ,
  confidence    NUMERIC,                     -- NULL/1.0 for verified; <1.0 for inferred display-name signal
  evidence      TEXT NOT NULL,               -- short human-readable summary for IDENT-08
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX identity_aliases_verified_unique
  ON identity_aliases(alias_type, value) WHERE verified = true;
```

### Pattern 3: Redacted evidence RPC (satisfies IDENT-08 without leaking PII)
**What:** A `SECURITY DEFINER` function that returns only `confidence` + `evidence` text, never the raw `value` column (email address), so the confidence/evidence popover can be shown to any viewer who can already see the speaker label — not just the identity's owner.
**When to use:** Whenever a UI needs to show "why was this resolved" without exposing the underlying PII to a wider audience than currently has access to it.
**Example:**
```sql
CREATE OR REPLACE FUNCTION get_identity_evidence(p_identity_id UUID)
RETURNS TABLE(alias_type TEXT, confidence NUMERIC, evidence TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT alias_type, confidence, evidence
  FROM identity_aliases
  WHERE identity_id = p_identity_id AND verified = true
  ORDER BY confidence DESC NULLS LAST;
$$;
-- Caller contract: only invoke for an identity_id the viewer already reached via
-- a call_participants/contacts/speakers row they're authorized to see (RLS on
-- those tables already enforces that boundary; this RPC does not re-check it).
```

### Anti-Patterns to Avoid
- **Reusing `supabase.auth.updateUser({ email })` to "add" a second email:** it replaces the login email; it does not add one. Confirmed against this codebase (only used for password change here) and Supabase's own community docs (see Sources). Do not build IDENT-03 on this call.
- **A single wide UNIQUE(alias_type, value) covering all rows:** would block legitimate low-confidence candidate duplicates from ever being recorded pre-resolution. Scope uniqueness to `verified = true` only (Pattern 2).
- **Gating `identities` RLS with `is_organization_member` alone:** would either over-restrict (a person who spans two orgs can't be seen as one identity from either) or require choosing one org arbitrarily. Use the participation-based pattern (Pattern 1) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending the verification email | A new SMTP client / new email provider | The existing Resend HTTP integration (`RESEND_API_KEY`, `RESEND_DOMAIN_VERIFIED`, pattern in `send-org-invite/index.ts`) [VERIFIED: codebase] | Already configured, already in production use; a second provider adds an operational secret and a second failure mode for no benefit. |
| OTP code randomness | `Math.random()` or a JS string-shuffle | `crypto.getRandomValues()` (Deno/Web Crypto built-in) | `Math.random()` is not cryptographically secure; a guessable OTP defeats the entire verification purpose. See Security Domain. |
| Email format validation | A hand-rolled regex | Zod's `.email()` | Already the mandated pattern per `supabase/CLAUDE.md`'s Input Validation Requirements section. |
| Cross-org visibility guard for a person-spanning table | Bespoke per-query `organization_id` filtering | The `events`-precedent SECURITY DEFINER helper pattern (Pattern 1) + registration in `CROSS_ORG_TABLES` (`src/test/rls-regression.test.ts`) | This exact class of bug (an unreachable/incorrect participation check) was found and fixed once already this milestone (Phase 30 CR-01) — reuse the fixed pattern rather than re-deriving it. |

**Key insight:** Every piece this phase needs — transactional email, crypto-random values, input validation, a non-org-scoped RLS pattern, a partial-unique-index evidence ledger — already has a working precedent somewhere in this exact codebase from the last four phases of this same milestone. The research risk here is not "what library to pick," it's "don't miss the precedent that already exists three migrations ago."

## Common Pitfalls

### Pitfall 1: Assuming Supabase Auth supports multiple emails per account
**What goes wrong:** Building IDENT-03 around `supabase.auth.updateUser({ email: newEmail })`, expecting it to "add" an email. It instead changes the account's one and only login email — the old email stops working for login once confirmed.
**Why it happens:** CONTEXT.md's own Grey Area 1 recommendation assumed a same-mechanism reuse was straightforward; it is not, because Supabase Auth's data model is one-email-per-account by design.
**How to avoid:** Never call `updateUser({ email })` or `verifyOtp({ type: 'email' })` targeting a secondary address as part of this feature. Build a small custom OTP table + two edge functions (Architecture Patterns, Pattern in diagram above) that never touch `auth.users`.
**Warning signs:** Any task or code review that has the login email changing, or a second `auth.users` row being created, as a side effect of "adding an email."

### Pitfall 2: `contacts.org_id` vs `call_participants.organization_id` naming inconsistency
**What goes wrong:** A resolver or RLS helper written against `contacts.organization_id` will fail to compile/silently misbehave (the column doesn't exist under that name).
**Why it happens:** `contacts` was originally user-only-scoped (`20260131000003_create_contacts_table.sql`) and had `org_id` bolted on later (`20260310150000_contacts_org_scoping.sql`); `call_participants` was designed org-scoped from the start (`20260309120000_call_participants.sql`) with the fuller name `organization_id`.
**How to avoid:** Always check the exact column name per table before writing cross-table SQL. `contacts` → `org_id`. `call_participants` → `organization_id`. `identities`/`identity_aliases` (new, this phase) should use `organization_id`-style full naming for anything new, since two of three existing tables already use the long form.
**Warning signs:** A Postgres "column does not exist" error, or (worse) a silently-wrong join if a generic column name happens to exist on both sides.

### Pitfall 3: Confusing `call_participants.participant_type` with `call_participants.role`
**What goes wrong:** Writing identity-resolution logic that reads `role` when it means `participant_type`, or vice versa — they look similar (`attendee` and `speaker` appear in both) but are separate columns from separate migrations with separate purposes.
**Why it happens:** `participant_type` (`attendee`/`speaker`/`host`) was added in the original `call_participants` migration (Mar 2026); `role` (`organizer`/`invitee`/`attendee`/`speaker`) was added five months later by Phase 30's EVT-05 for the event model. Both are nullable/present today; neither was removed when the other was added.
**How to avoid:** Treat `participant_type` as the original "how was this row sourced" classification and `role` as the event-model's calendar/attendance classification. Identity resolution's speaker-alibi-adjacent logic (Phase 33's `has_confirmed_speech`) already keys off `role`/`has_confirmed_speech`, not `participant_type` — follow that precedent rather than introducing a third interpretation.
**Warning signs:** A query or migration comment that treats the two columns as interchangeable.

### Pitfall 4: A 6-digit OTP with no attempt limit is brute-forceable
**What goes wrong:** A 6-digit numeric code has only 1,000,000 possibilities. Without a hard cap on verification attempts and a short expiry, an attacker (or a buggy retry loop) can brute-force it well within the code's lifetime.
**Why it happens:** It's easy to build the "happy path" (generate, send, compare-on-submit) and forget the abuse case, especially since nothing else in this codebase's existing auth flows needed this (password reset relies on Supabase's own rate-limited magic-link tokens, not a short numeric code).
**How to avoid:** Store only a hash of the code (`crypto.subtle.digest('SHA-256', ...)`), set a short expiry (e.g., 10 minutes), track an `attempts` counter, and hard-invalidate the pending row after N failed attempts (e.g., 5). Rate-limit the *request* endpoint per-user too (reuse the `RateLimiter` pattern already documented in `supabase/CLAUDE.md`'s OWASP section) so one account can't spam-generate codes to extend the brute-force window.
**Warning signs:** A verification edge function with no `attempts` column and no per-user request throttling.

### Pitfall 5: The three existing tables' frontend readers were not exhaustively enumerated this session
**What goes wrong:** A migration or RLS change that's correct against every reader this research found, but breaks a reader it didn't find, silently.
**Why it happens:** Context budget in this research session did not allow a full `rg "\.from\('speakers'\)|\.from\('contacts'\)|\.from\('call_participants'\)"` sweep of `src/`. Confirmed readers: `get_people_summary`, `get_recordings_for_person` (both SQL, verified), and the event-resolution matcher (`resolve-events`, per MATCH-06). A likely-but-unverified legacy reader: `call_speakers` (join table to `fathom_calls`).
**How to avoid:** Make "enumerate every `.from('speakers')` / `.from('contacts')` / `.from('call_participants')` call site in `src/` and `supabase/functions/`" the plan's first task, before any migration is written — cheap (a few grep calls), and directly de-risks IDENT-01's "existing readers unchanged" success criterion.
**Warning signs:** None visible until a specific untested reader breaks — which is exactly why this should be an explicit task, not an assumption.

## Code Examples

### Edge function skeleton for OTP request (follows this repo's established Deno function template)
```typescript
// Source: pattern from supabase/CLAUDE.md's "index.ts Structure Template" +
// supabase/functions/send-org-invite/index.ts's Resend call shape [VERIFIED: codebase]
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { z } from 'https://esm.sh/zod@3.23.8';

const RESEND_API_URL = 'https://api.resend.com/emails';

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, '0');
}

// Inside the handler, after authenticateRequest():
const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(await req.json());
const code = generateCode();
const codeHash = await hashCode(code);
await supabase.from('identity_alias_verifications').upsert({
  user_id: userId, email, code_hash: codeHash,
  expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), attempts: 0,
}, { onConflict: 'user_id,email' });
// then POST to RESEND_API_URL exactly as send-org-invite/index.ts does, with the code in the template
```

### Existing RLS helper being extended, for reference
```sql
-- Source: supabase/migrations/20260309120000_call_participants.sql [VERIFIED: codebase]
-- This is the existing org-membership helper reused (not reinvented) in Pattern 1 above.
CREATE POLICY "Organization members can view call participants"
  ON call_participants FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Three disconnected person tables (`speakers`, `contacts`, `call_participants`) | Same three tables, now joined by a shared, nullable `identity_id` pointing at a new `identities` spine | This phase | Enables cross-org, cross-email person resolution without a destructive schema merge (explicitly ruled out by the milestone's own Out of Scope table). |
| Event-only non-org-scoped RLS precedent (`events`, Phase 30) | Extended to a second non-org-scoped concept (`identities`) | This phase | `identities` becomes the second table in the schema (after `events`) whose RLS is participation-based rather than `organization_id`-based — a pattern, not a one-off. |

**Deprecated/outdated:** Nothing in this phase deprecates prior work — this is purely additive, consistent with the milestone's "additive, nullable, no existing reader broken" discipline (EVT-02, IDENT-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Email normalization (lowercase/trim) at write time is currently only confirmed for `call_participants` (its own migration comment says "stored lowercase"); it is **not verified** whether `speakers.email` / `contacts.email` are normalized the same way at their write sites. | Common Pitfalls, Architecture | If `speakers`/`contacts` emails aren't normalized, a naive exact-match resolver against `identity_aliases.value` (which will be normalized) could silently fail to match rows with mixed-case stored emails. Planner should grep write sites (`.toLowerCase()` near `.from('speakers')`/`.from('contacts')` inserts) before finalizing the resolver's match logic. |
| A2 | It is assumed `identities.owner_user_id` should be nullable (supporting unclaimed/inferred identities for future Phase 39 claim flow) rather than always non-null. CONTEXT.md does not explicitly lock this. | Architecture Patterns, Summary | If Andrew intends every identity to always be user-owned from creation (no "unclaimed person cluster" concept in v2.2), the nullable design adds unused flexibility rather than solving a real Phase 34 need — low risk either way since nullable is a superset, but worth a one-line confirmation. |
| A3 | It is assumed the identity resolver runs as a new edge function (`resolve-identities`) following the `resolve-events` precedent, rather than as a synchronous trigger fired on insert to `speakers`/`contacts`/`call_participants`. Not locked in CONTEXT.md. | Architecture Patterns | If synchronous/trigger-based resolution is actually preferred (simpler, no cron/sweep needed), the plan's task breakdown would differ; low risk to reverse later since it's an implementation-detail choice, not a schema choice. |
| A4 | The full set of frontend/edge-function readers of `speakers`, `contacts`, and `call_participants` was **not** exhaustively enumerated this session (see Common Pitfall 5) — only `get_people_summary`, `get_recordings_for_person`, and the event resolver were confirmed. | Common Pitfalls, Phase Requirements | If an unenumerated reader has an implicit assumption about `call_participants`/`speakers`/`contacts` schema shape (e.g., a `SELECT *`-based type expectation), adding a new nullable column is very unlikely to break it — but this hasn't been proven, only argued from Postgres's additive-column safety. |

## Open Questions

1. **Grey Area 1's literal mechanism is not achievable — how should the plan word the correction?**
   - What we know: Supabase Auth is one-email-per-account. This codebase already has Resend integrated for transactional email. A custom hashed-OTP table + two edge functions preserves the *spirit* of "reuse existing infrastructure, don't build a parallel pipeline" (it reuses Resend and the existing `authenticateRequest` JWT pattern) while avoiding the broken `updateUser`/`verifyOtp` path.
   - What's unclear: Whether Andrew, on seeing this correction, would prefer a different tradeoff (e.g., accepting that "adding an email" literally re-points the login email via Supabase Auth's native flow, with the user's original email demoted to a secondary alias) — this would be simpler to build but has real UX/security tradeoffs (session/JWT email-claim implications, "Secure email change" double-confirmation settings).
   - Recommendation: Proceed with the custom-OTP approach in this research as the default; flag the correction explicitly to Andrew (or resolve via `/gsd:discuss-phase` if a fresh discussion pass is warranted) rather than silently re-implementing Grey Area 1 as originally worded.

2. **Should Phase 34 create an `identities` row for every existing user proactively, or lazily on first email verification?**
   - What we know: The milestone's overall philosophy is "forward-only, no historical backfill" (Decisions Resolved #2, applied to MATCH). Nothing in IDENT-01..08 explicitly requires a backfill.
   - What's unclear: Whether `speakers`/`contacts`/`call_participants` rows for a user who has NOT yet verified any email should still get resolved against each other (e.g., matching two of the user's own `speakers` rows by provider-participant-ID alone, with no verified email in the picture yet).
   - Recommendation: Lazy creation (an `identities` row is created the first time a user verifies an email, or the first time a deterministic non-email signal — provider participant ID — needs one) is simpler and consistent with the forward-only philosophy. Flag for planner confirmation.

3. **Frontend reader inventory (Common Pitfall 5 / Assumption A4) — should be resolved as the plan's first task**, not left as a research gap carried into execution.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Resend API (`RESEND_API_KEY`, `RESEND_DOMAIN_VERIFIED` secrets) | Sending the OTP email | ✓ (already configured for `send-org-invite`/`send-support-ticket` in production) [VERIFIED: codebase] | — | None needed — already live. |
| Supabase CLI, linked to prod (`vltmrnjsubfzrgrtdqey`) | Migrations, edge function deploys | ✓ (used continuously through Phases 30-33) | — | — |
| Deno Web Crypto (`crypto.getRandomValues`, `crypto.subtle`) | OTP generation + hashing | ✓ (Deno runtime built-in, no install) | — | — |
| `is_organization_member` SECURITY DEFINER helper | RLS reuse for `contacts`/`call_participants` join checks in `user_can_view_identity` | ✓ (already exists, used throughout `contacts`/`call_participants` RLS) [VERIFIED: codebase] | — | — |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest [VERIFIED: codebase — `supabase/CLAUDE.md`, `vitest.config.ts` referenced throughout STATE.md] |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <path-to-file>` |
| Full suite command | `npm run test:integration` (integration) + `npx vitest run` (unit) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDENT-01 | New nullable `identity_id` columns don't change existing reader output when NULL | integration | `npx vitest run supabase/functions/_shared/__tests__/identity-schema-noop.integration.test.ts` (mirrors `src/test/event-schema-noop.integration.test.ts`'s EVT-03 pattern) | ❌ Wave 0 |
| IDENT-01 | `identities`/`identity_aliases` registered in the cross-org isolation gate | integration | `npx vitest run src/test/rls-regression.test.ts` (add to `CROSS_ORG_TABLES` array) | ✅ file exists, needs new entries |
| IDENT-02 | Email/provider-ID match auto-links; display-name-alone never does | unit | `npx vitest run supabase/functions/_shared/__tests__/identity-resolver.test.ts` | ❌ Wave 0 |
| IDENT-03 | OTP request/confirm: happy path, expiry, attempt-limit brute-force guard | integration | `npx vitest run supabase/functions/confirm-email-alias-verification/__tests__/*.integration.test.ts` (mirrors `polar-create-customer.regression.test.ts`'s pattern) | ❌ Wave 0 |
| IDENT-08 | `get_identity_evidence` returns confidence+evidence, never raw `value` | integration | `npx vitest run supabase/functions/_shared/__tests__/identity-evidence-rpc.integration.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file>` for the file(s) touched.
- **Per wave merge:** `npm run test:integration` + `src/test/rls-regression.test.ts` explicitly (cross-org isolation is the highest-blast-radius risk in this phase, per this milestone's own SAFE-04/SAFE-05 precedent).
- **Phase gate:** Full suite green before `/gsd:verify-work`, matching every prior phase in this milestone.

### Wave 0 Gaps
- [ ] `supabase/functions/_shared/__tests__/identity-schema-noop.integration.test.ts` — covers IDENT-01, mirrors the existing `event-schema-noop.integration.test.ts` pattern
- [ ] `supabase/functions/_shared/__tests__/identity-resolver.test.ts` — covers IDENT-02
- [ ] `supabase/functions/confirm-email-alias-verification/__tests__/*.integration.test.ts` — covers IDENT-03
- [ ] `supabase/functions/_shared/__tests__/identity-evidence-rpc.integration.test.ts` — covers IDENT-08
- [ ] New entries in `src/test/rls-regression.test.ts`'s `CROSS_ORG_TABLES` array for `identities` + `identity_aliases`
- [ ] Frontend component test coverage for the new "Verified emails" section in `AccountTab.tsx` and the evidence popover — **not verified whether this repo has an established component-testing convention (e.g., React Testing Library)**; flagged rather than assumed. If none exists, this is acceptable as manual-only per this phase's small UI surface, with a note in the plan.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OTP code MUST be generated via `crypto.getRandomValues()` (CSPRNG), never `Math.random()`. Code stored as a SHA-256 hash, never plaintext. |
| V3 Session Management | no (this phase's verification flow deliberately never touches `auth.users` or the active session — see Pitfall 1) | — |
| V4 Access Control | yes | `identities`/`identity_aliases` RLS per Pattern 1/2 above; `FORCE ROW LEVEL SECURITY` on both new tables, matching every existing table in this schema. |
| V5 Input Validation | yes | Zod `.email()` for the address; a strict 6-digit numeric pattern for the submitted code. |
| V6 Cryptography | yes | SHA-256 hash of the OTP code at rest (Web Crypto `crypto.subtle.digest`) — never store the raw code. |
| V7 Error Handling / Rate Limiting (V-11 in some ASVS versions) | yes | Hard attempt cap (e.g., 5) + short expiry (e.g., 10 min) on code confirmation; per-user request throttling on the send endpoint, reusing the `RateLimiter` pattern already documented in `supabase/CLAUDE.md`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OTP brute-force (1,000,000 6-digit combinations) | Spoofing | Attempt cap + short expiry + hashed storage (Pitfall 4). |
| Email-bombing (attacker spams "add email" requests to flood a victim's inbox or exhaust Resend quota) | Denial of Service | Per-user rate limit on the request endpoint (reuse existing `RateLimiter` class pattern). |
| Cross-org identity leakage (an org member sees another org's private participant/contact data through a shared `identity_id` join) | Information Disclosure | Pattern 1's participation-based RLS + explicit `CROSS_ORG_TABLES` registration + `rls-regression.test.ts` proof, mirroring SAFE-04/SAFE-05's already-proven approach in this exact milestone. |
| PII over-exposure via the evidence UI (raw email shown to viewers who aren't the identity owner) | Information Disclosure | `get_identity_evidence()` RPC returns confidence + evidence text only, never `identity_aliases.value` (Pattern 3). |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `supabase/migrations/00000000000000_consolidated_schema.sql` — `speakers` and legacy `call_speakers` table definitions
- `supabase/migrations/20260131000003_create_contacts_table.sql` — original `contacts` schema
- `supabase/migrations/20260310150000_contacts_org_scoping.sql` — `contacts.org_id` addition, RLS policies, naming
- `supabase/migrations/20260309120000_call_participants.sql` — `call_participants` schema, `get_people_summary`, `get_recordings_for_person`, `is_organization_member` RLS usage
- `supabase/migrations/20260831000001_create_events_and_extend_participants.sql` — Phase 30's `event_id`/`role`/`has_confirmed_speech` additions to `call_participants`, non-org-scoped RLS precedent
- `src/components/settings/AccountTab.tsx`, `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx` — confirmed existing Supabase Auth usage is password-only, no existing email-add/verify flow
- `supabase/functions/send-org-invite/index.ts` — confirmed Resend integration pattern
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.orca/drops/SPEC-event-resolution-and-provenance.md` — phase requirements, decisions, and this milestone's established patterns (event_match_decisions partial-unique-index precedent, CR-01 RLS-bug precedent, CROSS_ORG_TABLES gate)
- `CLAUDE.md`, `src/CLAUDE.md`, `supabase/CLAUDE.md` (this repo) — design system, RLS conventions, RateLimiter pattern, input validation rules

### Secondary (MEDIUM confidence)
- [Can a user have multiple emails? · supabase discussion #20611](https://github.com/orgs/supabase/discussions/20611) — confirms Supabase Auth has no native multi-email support
- [Identity Linking | Supabase Docs](https://supabase.com/docs/guides/auth/auth-identity-linking) — confirms `linkIdentity()` is OAuth-provider-scoped, not a general secondary-email mechanism

### Tertiary (LOW confidence)
- None relied upon for a load-bearing claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack / existing schema facts: HIGH — read directly from migration files this session, not inferred.
- Email verification mechanism: MEDIUM-HIGH — the negative claim (Supabase Auth doesn't support multi-email) is corroborated by both this codebase's own usage and an external community source; the specific custom-OTP design is a recommendation, not something verified as "the" answer.
- Architecture (RLS pattern, table design): HIGH for the pattern-reuse parts (directly modeled on this milestone's own proven `events` precedent), MEDIUM for the identity_id linkage-trigger mechanism (edge function vs. trigger — Assumption A3).
- Frontend reader completeness: LOW — explicitly flagged as an incomplete inventory, recommended as the plan's first task.

**Research date:** 2026-09-05
**Valid until:** 30 days (stable schema domain; re-verify if any of Phases 35-39 land first and touch these same tables)
