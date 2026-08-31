# Phase 30: Schema Reconciliation + Event Model Foundation - Research

**Researched:** 2026-08-31
**Domain:** Supabase/Postgres schema truthfulness (SAFE-07) + additive event-model schema (EVT-01/02/03/04/05/07) + CI cross-org isolation gate (SAFE-05)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None marked as separate "Decisions" section — see Claude's Discretion below, which contains the governing constraints for this phase (CONTEXT.md merges both under one heading since smart-discuss was skipped for this infrastructure phase).

### Claude's Discretion
All implementation choices are at Claude's discretion — this is a pure infrastructure phase (schema truthfulness + additive schema foundation), no user-facing behavior to decide on. Governing constraints, already locked in the spec and requirements docs (not open questions):
- Forward-only, additive only: `IF NOT EXISTS` everywhere, every new column nullable, every existing RPC signature preserved (per REQUIREMENTS.md Constraints, spec Decisions Made #3).
- `events` lives in the same Supabase Postgres database as `recordings` — no physical separation. It is simply the first non-org-scoped table; RLS grants via participation/ownership, never `organization_id` (EVT-04; resolved Open Question 1, spec Decisions Resolved).
- SAFE-07 must run first and resolve F16 (migration folder ≠ schema truth: `recordings`/`organizations`/`workspaces` not created by any committed migration; `20260228000001` references nonexistent `public.vaults`) and F17 (`supabase.ts` missing `ai_generated_title`/`ai_title_generated_at`) before any new migration is authored.
- Follow the `COALESCE`-then-fallback reader pattern from `20260618160000_recordings_canonical_ai_title.sql` as the model for EVT-03's byte-identical-when-NULL guarantee.
- Event reads join through `workspace_entries` (EVT-07) — `recordings` has no `workspace_id` column and none should be assumed or added.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope (skipped; infrastructure-only).

### Additional hard constraint (from PROJECT.md, carried into STATE.md)
This phase executes on the `v2.2-event-resolution` branch, not `main` — the branch is already cut and currently checked out `[VERIFIED: git branch --show-current]`. This overrides the repo's normal direct-to-main workflow (root `CLAUDE.md` "Single-Operator Default") for the whole v2.2 milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-07 | Regenerate `src/types/supabase.ts` from the live DB, reconcile against `supabase/migrations/`, resolve F16/F17 before any new migration. | Live types regenerated and diffed in this research session (see "F16/F17 — Verified Current State" below). Exact diff captured; concrete resolution path documented. |
| EVT-01 | `events` table exists, UUID-keyed, canonical start/end/resolution confidence, no content columns. | Recommended column set below, modeled on `call_participants`/`recordings` conventions. Confirmed `events` does not exist live today. |
| EVT-02 | `recordings.event_id` nullable and additive. NULL means unresolved, never broken. | Confirmed live `recordings` shape (27 columns, no `event_id` yet). `ADD COLUMN IF NOT EXISTS` pattern confirmed via precedent migration. |
| EVT-03 | `get_workspace_recordings`, `global_search`, chat, and MCP return byte-identical results when `event_id` IS NULL. Proven by test. | All four code paths located and read in full. All use explicit column lists, never `SELECT *`, on `recordings` — structurally low-risk. Concrete test strategy documented. "Chat" code path identified with a caveat (see Open Questions). |
| EVT-04 | `events` not org-scoped; RLS via participation or owned capture, never `organization_id`. | Reusable `auth.email()` RLS precedent found and read (`20260309100000_fix_invitation_rls_auth_email.sql`), including the exact bug it fixed (auth.users 403). Concrete policy sketch provided. |
| EVT-05 | `call_participants` extended (not replaced): `event_id`, role (organizer/invitee/attendee/speaker), `has_confirmed_speech`. `sources[]` stays. | Full current `call_participants` migration + live shape read. **Critical finding:** requested role vocabulary conflicts with the existing `participant_type` CHECK constraint — must be a new column, not a rename/extension of `participant_type`. |
| EVT-07 | Event-level reads join through `workspace_entries`; no `workspace_id` on `recordings` assumed. | Confirmed live: `recordings` has no `workspace_id` column. `workspace_entries` shape confirmed live. All 4 EVT-03 read paths already join this way. |
| SAFE-05 | `events` and extended `call_participants` registered in `CROSS_ORG_TABLES` CI gate. | Full test harness read (`src/test/rls-regression.test.ts`, 931 lines). **Critical finding:** `call_participants` is already registered — no action needed. `events` cannot use the existing generic mechanism (no org-scoped filter column exists) — needs bespoke test code, not just an array entry. Documented in detail below. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

From root `CLAUDE.md` and `supabase/CLAUDE.md` — treat as authoritative, same weight as locked decisions:

| Directive | Source | Applies to this phase |
|-----------|--------|------------------------|
| Migration filename: `YYYYMMDDHHMMSS_descriptive_name.sql` | `supabase/CLAUDE.md` | Every new migration file |
| Migration header: `-- Migration:` / `-- Purpose:` / `-- Author:` / `-- Date:` comment block | `supabase/CLAUDE.md` | Every new migration file |
| Section banners: `TABLE` / `INDEXES` / `ROW LEVEL SECURITY` / `RLS POLICIES` / `COMMENTS`, `====` delimited | `supabase/CLAUDE.md` | Every new migration file |
| All DB fields snake_case | `supabase/CLAUDE.md` | `event_id`, `role`, `has_confirmed_speech`, `resolution_confidence`, etc. |
| All tables MUST have RLS enabled | `supabase/CLAUDE.md` | `events` (new); `call_participants` already has it |
| Migrations affecting prod read `DATABASE_URL` from `.env`, verify prod ref `vltmrnjsubfzrgrtdqey` before connecting | Root `CLAUDE.md` | Any live-DB introspection or migration apply step |
| Single-repo, `npm` only, no pnpm/bun | Root `CLAUDE.md` | N/A — no package installs this phase |
| Direct-to-main workflow | Root `CLAUDE.md` | **Overridden** for this milestone — see User Constraints above (branch `v2.2-event-resolution`) |
| Docker not running on this machine; use `--use-api` for edge function deploys | `supabase/CLAUDE.md` | Not applicable — no edge function deploys in this phase |
| RLS regression CI gate: append new tables to `CROSS_ORG_TABLES` array in `src/test/rls-regression.test.ts` | `supabase/CLAUDE.md` | Directly implements SAFE-05 — see Architecture Patterns below for why `events` needs more than an array entry |

## Summary

This phase has two genuinely separate halves that the plan should keep distinct: **(1) a documentation/reconciliation task** (SAFE-07 — make the schema record truthful) and **(2) a small, purely additive DDL task** (EVT-01/02/05/07 — one new table, two extended tables) **gated by a non-trivial CI test design problem** (SAFE-05/EVT-03 — proving isolation for a table that, by design, has no org-scoping column to test against).

For SAFE-07, this research session ran `supabase gen types typescript --linked` against the live, already-linked prod project (`vltmrnjsubfzrgrtdqey`) and diffed it against the committed `src/types/supabase.ts`. The diff is small and fully enumerated below — it is **not** the sprawling drift the spec's F16 finding might suggest. The committed types file is stale by about 7 migrations' worth of changes (two new tables, ~15 columns across 3 tables, 3 RPCs) — all of which are already-applied, in-sync migrations. Regenerating and committing the file resolves F17 completely. F16 is a separate, deeper issue: this research traced the exact historical gap — `recordings.bank_id` → `recordings.organization_id` and the `banks`/`bank_memberships` → `organizations`/`organization_memberships` rename have **no corresponding migration file at all** (unlike the sibling `vaults` → `workspaces` rename, which **is** captured in `20260301000001_rename_vaults_to_workspaces.sql`). This means `supabase/migrations/` cannot be replayed from an empty database to reconstruct the current schema — the live database, not the migration folder, is the only source of truth. No CI job currently attempts a fresh replay, so this is a latent, not active, risk. SAFE-07's job is to document this gap and stop treating the migration folder as authoritative going forward — not to fabricate a historical migration to paper over already-correct live data.

For the additive schema, every one of the four EVT-03 read paths (`get_workspace_recordings`, `global_search`, the MCP `ask_call`/`search_calls` tools, and — tentatively — a chat surface) was read in full. All four use explicit column lists on `recordings`, never `SELECT *`. This is structurally reassuring: adding a nullable `recordings.event_id` column cannot silently change any of their output shapes, because none of them would pick it up without an explicit code change. The byte-identical proof required by EVT-03 is therefore mostly a **regression-test-writing exercise**, not a risky behavior change — the four functions genuinely do not need their bodies touched this phase.

The hardest real design problem in this phase is **SAFE-05 for `events` specifically**. The existing `CROSS_ORG_TABLES` CI gate (`src/test/rls-regression.test.ts`) is a generic loop that filters each registered table by one of eight hardcoded column names (`organization_id`, `org_id`, `user_id`, `recording_id`, `workspace_id`, `folder_id`, `reporter_id`, `ticket_id`) and asserts a foreign org's JWT sees zero rows. `events` has none of these columns by design (EVT-04 explicitly forbids an `organization_id` column) — so it cannot be added as a one-line array entry. It needs a bespoke, hand-written test block (following the existing `CLIENT_DENY_TABLES` precedent for "this table needs different assertion logic" rather than the main loop). `call_participants`, by contrast, is **already registered** in `CROSS_ORG_TABLES` (`filterColumn: "recording_id"`) — SAFE-05's `call_participants` half is already satisfied and needs no new array entry.

**Primary recommendation:** Treat this phase as three independent, sequenced units of work — (1) regenerate + commit types, write a short reconciliation note, no schema change; (2) one additive migration creating `events` + extending `recordings`/`call_participants`, following the `call_participants` migration's own section structure as the closest same-repo precedent; (3) extend `src/test/rls-regression.test.ts` with a bespoke `events` isolation test (not a `CROSS_ORG_TABLES` array entry) plus a new byte-identical regression test asserting `get_workspace_recordings`/`global_search`/MCP output is unchanged. Do not touch `get_workspace_recordings`, `global_search`, or any MCP tool body this phase — the requirement is proof of no-change, not a change.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema truth reconciliation (SAFE-07: regenerate `src/types/supabase.ts`) | Database / Storage | — | Pure introspection of live Postgres schema; output is a build artifact consumed by the frontend/backend type system, not a runtime behavior |
| `events` table + RLS (EVT-01, EVT-04) | Database / Storage | API / Backend | Table + RLS policy live in Postgres; the access boundary they enforce is exercised by future Edge Functions/RPCs (Phase 31+), not this phase |
| `recordings.event_id` (EVT-02) | Database / Storage | — | Additive column, no application code changes required this phase |
| `call_participants` extension (EVT-05) | Database / Storage | — | Additive columns; existing trigger (`populate_participants_from_source_metadata`) is untouched — it does not need to populate the new columns this phase |
| Event-aware reads via `workspace_entries` (EVT-07) | API / Backend | Database / Storage | The join pattern is enforced in RPC/Edge Function SQL (`get_workspace_recordings`, `global_search`, MCP tools), not at the table level |
| Byte-identical proof (EVT-03) | API / Backend | — | The four read paths are Postgres RPCs (`get_workspace_recordings`, `global_search`) and a Deno Edge Function (`mcp-server`) — this is a backend regression-test concern |
| `CROSS_ORG_TABLES` CI gate extension (SAFE-05) | API / Backend | — | Test-and-CI tooling that exercises the RLS boundary from real JWTs (`authenticated` role), i.e. it tests the API/Backend access surface, not a production runtime tier itself |

## Standard Stack

No new libraries, frameworks, or npm packages are introduced by this phase. Everything needed is already installed and in use.

### Core (already installed — confirmed this session)
| Tool | Version | Purpose | Evidence |
|------|---------|---------|----------|
| Supabase CLI | 2.101.0 | `supabase gen types typescript --linked` for SAFE-07; already linked to prod ref `vltmrnjsubfzrgrtdqey` | `[VERIFIED: local environment — supabase --version]` |
| `@supabase/supabase-js` | ^2.84.0 | RLS regression test client (anon-key JWT sessions) | `[VERIFIED: package.json]` |
| vitest | ^4.0.16 | Test runner for `src/test/rls-regression.test.ts` extension and new byte-identical regression test | `[VERIFIED: package.json, vitest.config.ts]` |
| Postgres (Supabase-managed) | live prod: PostgREST `14.5` per fresh introspection (committed types say `13.0.5` — one more F17-class drift item) | Target database for the new migration | `[VERIFIED: supabase gen types typescript --linked, diffed against committed file]` |

### Supporting
| Tool | Purpose | When used |
|------|---------|-----------|
| `pg` (^8.18.0, devDependency) | Available for any ad hoc verification scripts against `DATABASE_URL` | Optional — CLI-based introspection (`--linked`) already worked without it |

### Alternatives Considered
Not applicable — no library choice exists in this phase. The one real "which tool" decision is how to regenerate types (see Common Pitfalls: `npm run gen:types` vs `supabase gen types typescript --linked`).

**Installation:** None required — everything used this session was already present (`supabase` CLI on `PATH`, project already linked, `node_modules` already installed).

## Package Legitimacy Audit

Not applicable — this phase installs no external packages (no `npm install`, no new dependencies). Skipping the Package Legitimacy Gate per its own scope ("whenever this phase installs external packages").

## Architecture Patterns

### F16/F17 — Verified Current State (ground truth, not spec restatement)

This research regenerated live types directly (`supabase gen types typescript --linked`, exit 0, 6093 lines) and diffed against the committed `src/types/supabase.ts` (5912 lines). Full diff evidence:

**F17 resolved by regeneration — the committed file is missing, relative to live:**
- Two tables entirely: `fathom_calls_orphan_report` (referenced today only in `CLIENT_DENY_TABLES` in the RLS test — it does exist live), `organization_invitation_workspaces` (from `20260829224421_org_invite_workspace_selection.sql`).
- `recordings.ai_generated_title` / `recordings.ai_title_generated_at` — exactly the spec's F17 claim, confirmed still true.
- ~9 columns on the tickets table (`canary_consecutive_passes`, `canary_dry_run`, `canary_required_passes`, `critic_notes`, `critic_reviewed_at`, `critic_score`, `critic_verdict`) from `20260729120000_add_critic_review_columns.sql` and `20260829231202_canary_progressive_verification.sql`.
- ~9 columns on `sync_jobs` (`date_end`, `date_start`, `last_heartbeat_at`, `mode`, `organization_id`, `provider_cursor`, `source_app`, `source_id`, `workspace_id`) from the sync-jobs durable-resource/heartbeat migrations.
- Three RPCs: `get_decrypted_source_credential`, `get_org_call_participant_contacts`, `reap_stale_sync_jobs`.
- Cosmetic: `PostgrestVersion` string, enum array formatting (single-line vs multi-line — same values), missing `graphql_public` schema.

**Conclusion:** every one of these corresponds to an already-applied, already-in-sync migration. The types file is simply stale by ~7 migrations (last regenerated before `20260625`-ish). This is a mechanical `npm run gen:types`-class fix, not a schema archaeology problem.

**F16 — traced with hard evidence, and it is a different (deeper) class of problem than F17:**

1. `recordings` **is** created by a committed migration — `20260131000007_create_recordings_tables.sql` — but that migration creates `bank_id UUID NOT NULL REFERENCES banks(id)`, not `organization_id`. `[VERIFIED: Read of migration file]`
2. The live table has `organization_id UUID NOT NULL`, confirmed via fresh introspection, and **no** `bank_id` column. `[VERIFIED: live types]`
3. Searching every migration filename for a bank→organization or `bank_id`→`organization_id` rename found **nothing**. Contrast: the sibling `vaults`→`workspaces` rename **is** fully captured (`20260301000001_rename_vaults_to_workspaces.sql`, 34.6K — a real, complete rename migration).
4. By `20260306000000_personal_organization_and_home.sql` (2026-03-06), the migration stream simply starts assuming `organizations`, `organization_memberships`, and `recordings.organization_id` already exist — with zero prior CREATE or RENAME statement for any of them anywhere in `supabase/migrations/`.
5. Separately, `20260228000001_workspace_redesign_schema.sql` (real filename — not `add_vault_id_to_recordings.sql` as initially guessed from the spec) references `public.vaults(id)` as an FK target. This part of F16 is **less alarming than it sounds**: `vaults` genuinely existed at that point in the migration timeline (created by `20260131000006_create_vaults_tables.sql`), and the rename to `workspaces` happens later (`20260301000001`) via a true `ALTER TABLE ... RENAME`, which Postgres propagates transparently to dependent FKs. A full top-to-bottom replay would **not** break at this specific file. It would break at the undocumented banks→organizations transition instead.

**Practical implication for the plan:** `supabase/migrations/` cannot be used to spin up a fresh database that matches prod (a `supabase db push` from empty would fail once it reaches code that assumes `organizations`/`bank_id`-renamed-to-`organization_id` state, since no migration performs that step). No CI job currently attempts this (`ci.yml` has no fresh-DB-replay job), so this is presently a **latent** risk, not a broken build. SAFE-07 should be scoped as: (a) regenerate and commit `src/types/supabase.ts` [mechanical], (b) write a short, permanent note (in the new migration's header comment, or a small doc) recording that the migration folder is a historical log, not a replay script, and specifically that the banks→organizations lineage has an undocumented gap — so nobody spends a future afternoon trying to `supabase db reset` this project from scratch and wondering why it fails. **Do not** attempt to author a synthetic "rename banks to organizations" migration against prod — the live data is already correct; a replay-only migration would be pure risk with no benefit and could conflict with the live schema's actual history (e.g., ordering of subsequent ALTERs).

### Live-verified target schema (what the new migration's `ALTER`/`CREATE` statements are actually operating against)

Captured directly from `supabase gen types typescript --linked` this session — this is what exists **today**, not what the spec described "as of 2026-08-30":

```
recordings (27 cols, no event_id, no bank_id, no workspace_id):
  id, organization_id, owner_user_id, title, audio_url, video_url,
  full_transcript, summary, global_tags, source_app, source_call_id,
  source_metadata, duration, recording_start_time, recording_end_time,
  created_at, synced_at, updated_at, share_token, fathom_provider_id,
  participant_count, ai_generated_title, ai_title_generated_at,
  action_items_cache, coaching_cache, sentiment_cache, transcript_segments

call_participants (8 cols, no event_id/role/has_confirmed_speech yet):
  id, recording_id, organization_id, name, email, participant_type
    (CHECK: 'attendee' | 'speaker' | 'host'), sources (text[]), created_at

workspace_entries (8 cols — the EVT-07 join target):
  id, recording_id, workspace_id, folder_id, local_tags, notes, scores,
  created_at, updated_at

organizations: id, name, slug, type, cross_org_default, logo_url,
  created_at, updated_at   -- no bank_id anywhere, confirms transition landed

events: DOES NOT EXIST YET  -- confirmed via live introspection
```

`[VERIFIED: supabase gen types typescript --linked, this session]`

### EVT-05 — Critical vocabulary collision (must not extend `participant_type`)

`call_participants.participant_type` already exists with `CHECK (participant_type IN ('attendee', 'speaker', 'host'))` (`20260309120000_call_participants.sql`). EVT-05 requires a role value of `organizer/invitee/attendee/speaker` — **two of four values overlap** (`attendee`, `speaker`) but **two diverge** (`host` vs `organizer`/`invitee`). This must be a **new column** (e.g., `role`) with its own `CHECK` constraint, not a widened `participant_type` constraint or a rename. The existing `populate_participants_from_source_metadata` trigger writes `participant_type` on every `recordings` INSERT — it must be left untouched this phase (role/event assignment is Phase 31+ matching logic, explicitly out of scope per CONTEXT.md). Recommend: `role TEXT CHECK (role IS NULL OR role IN ('organizer','invitee','attendee','speaker'))`, nullable, no default (population is a later phase's job) — this reads as more defensible than reusing `participant_type`'s semantics, which already means something else in production.

### EVT-01 — Recommended `events` column set (Claude's Discretion — design proposal, not verified against an external spec)

EVT-01 requirements text is explicit about what's excluded ("no content columns") but not explicit about exact column names/types. Modeled on this repo's own conventions (every table read this session has `id UUID PK DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, and most add `updated_at`):

```sql
CREATE TABLE IF NOT EXISTS events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_start_time  TIMESTAMPTZ,
  canonical_end_time    TIMESTAMPTZ,
  resolution_confidence NUMERIC,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

No `organization_id` (EVT-04, intentional), no `title`/`summary`/`transcript` (EVT-01, explicit "no content columns" — those stay on `recordings` per-capture). `resolution_confidence` left as an unconstrained nullable `NUMERIC` since the matching engine that populates and interprets it (with the spec's 0.70/0.95 confidence bands) doesn't exist until Phase 31+ — adding a `CHECK (0 <= x <= 1)` now is safe and cheap, but locking specific band semantics into a constraint this early is guesswork; **recommend the light `CHECK` only, no band-encoding.** `[ASSUMED — this exact column set is a design recommendation, not a verified requirement]`.

### EVT-04 — RLS pattern: reuse `auth.email()`, not a raw `auth.users` join

Found and read a directly on-point precedent: `20260309100000_fix_invitation_rls_auth_email.sql`. Its own header states the trap explicitly: *"Fix workspace_invitations RLS policy that queried auth.users directly (authenticated role has no SELECT on auth.users, causing 403 on invite creation). Replace with auth.email() which is granted to authenticated role."* This is exactly the mistake a naive `events` participation policy could reintroduce. The working pattern:

```sql
CREATE POLICY "invited_users_select_own_invitations"
  ON workspace_invitations FOR SELECT
  USING (email = auth.email());
```

Applied to `events` (participation via `call_participants.email`, ownership via `recordings.owner_user_id`):

```sql
CREATE POLICY "participants_and_owners_can_view_events"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM call_participants cp
      WHERE cp.event_id = events.id
        AND cp.email = LOWER(auth.email())
    )
    OR EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.event_id = events.id
        AND r.owner_user_id = auth.uid()
    )
  );
```

`LOWER(auth.email())` matters: `call_participants.email` is documented as "stored lowercase" (migration comment), but `auth.email()` reflects whatever case `auth.users.email` holds, which is not guaranteed lowercase for every signup path (e.g., some OAuth providers preserve case). Skipping the `LOWER()` risks a silent false-negative (a real participant seeing "no access") rather than a leak — lower severity than a false-positive, but still worth doing correctly the first time.

**Resist the urge to add an org-admin bypass.** `recordings` has a policy ("Org Admins can view all recordings in org") that `events` must **not** mirror — EVT-04 is explicit that org association confers no event access (this is also stated as a locked decision for a later phase: ORG-04, "org association with an event confers no access to any capture of it," and the spec's Decisions Made #1 frames `events` as deliberately the first non-org-scoped table). A reviewer pattern-matching against `recordings`' existing RLS might add this by habit — flag it as a pitfall, not just an omission.

**Writes:** No `authenticated` INSERT/UPDATE/DELETE policy is needed this phase (spec's Decisions Resolved #5: "No event steward in v1. Canonical event metadata is system-derived and not user-editable until the ownership model is exercised in production"). Follow the exact `call_participants` precedent — RLS enabled + `FORCE ROW LEVEL SECURITY` + a `service_role FOR ALL USING (true) WITH CHECK (true)` policy, and nothing else. This blocks all client-side writes by default (correct — Phase 31+'s matching engine writes via service-role edge functions, not client JWTs).

### EVT-03 — Byte-identical guarantee: the four read paths, verified line-by-line

| Path | Location | Column selection | `event_id`-safety |
|------|----------|-------------------|---------------------|
| `get_workspace_recordings` | `20260618160000_recordings_canonical_ai_title.sql` (current definition) | Explicit `RETURNS TABLE(...)` — 18 named columns | Safe by construction — new column not in the return list |
| `global_search` | `20260309200013_global_search_rpc.sql` | Explicit `jsonb_build_object(...)` per entity type | Safe by construction |
| MCP `search_calls` | `supabase/functions/mcp-server/tools/read/search_calls.ts` | Workspace-scope: calls `global_search` RPC directly. Org-scope: `.select('recordings!inner(id, title, recording_start_time, summary)')` joined through `workspace_entries` | Safe by construction, and already demonstrates the EVT-07 join pattern in production code |
| "Chat" — best-evidence match: MCP `ask_call` | `supabase/functions/mcp-server/tools/ai/ask_call.ts` | `.select('id, title, full_transcript')` on `recordings`, accessed only after a `workspace_entries` membership check | Safe by construction |

No dedicated "chat" edge function or frontend chat UI exists in this repo today (`ls supabase/functions/` — 79 entries, none named `chat*`; broad grep of `src/hooks|services|pages|components` for "chat" surfaces only `useAiGate.ts`'s `'chat_message'` AI-action-type enum value, which has **no call site anywhere in `src/`** — it appears to be a reserved/future type, not a live feature). See Open Questions for how to handle this in the plan.

Broader check: across every file that queries `.from('recordings')` in `src/services/`, `src/hooks/`, and `supabase/functions/` (~55 call sites enumerated this session), the pattern is uniformly explicit column lists — e.g. `recordings.service.ts` defines a shared `RECORDING_DETAIL_COLUMNS` constant rather than using `select('*')`. No `select('*')` on `recordings` was found in the primary read paths checked. **This means the byte-identical requirement is much less about "don't break anything" and much more about "write a test that proves it," since the additive column is structurally invisible to every consumer that doesn't explicitly opt in.**

### SAFE-05 — Why `events` cannot just be added to the `CROSS_ORG_TABLES` array

Read `src/test/rls-regression.test.ts` in full (931 lines). The mechanism:

```typescript
const CROSS_ORG_TABLES: ReadonlyArray<{
  table: string;
  filterColumn:
    | "organization_id" | "org_id" | "user_id" | "recording_id"
    | "workspace_id" | "folder_id" | "reporter_id" | "ticket_id";
}> = [ /* ... */ { table: "call_participants", filterColumn: "recording_id" }, /* ... */ ];
```

The test loop does, for every entry: `clientB.from(table).select("*").eq(filterColumn, filterValue)` and asserts `data.length === 0`. This is a closed union type — there is no "no column, use a participation subquery" option, and `events` has no column that belongs in this union by design (EVT-04 forbids `organization_id`; nothing else in the union applies). **Two concrete findings:**

1. **`call_participants` is already in `CROSS_ORG_TABLES`** (line 61 of the array, `filterColumn: "recording_id"`). Since this test does `select("*")`, it already covers the row shape including any new columns added this phase — no new array entry or test code is needed for `call_participants`'s half of SAFE-05. It is done by virtue of already being registered.
2. **`events` needs new, hand-written test code**, not an array entry — following the file's own precedent for tables that don't fit the generic shape: `CLIENT_DENY_TABLES` (a separate array + separate `for` loop with different assertion logic, for tables with zero permissive policies). `events` needs a third pattern again, because unlike `CLIENT_DENY_TABLES` it **should** be readable by the right user (participant/owner), just never by an unrelated org. A safe test shape, consistent with the existing fixture style (service-role setup, then two signed-in JWT clients):
   - Insert an `events` row (service-role).
   - Link Org A's `recordingA` to it (`UPDATE recordings SET event_id = ... WHERE id = recordingAId`).
   - Insert/update a `call_participants` row for `recordingAId` with `email = userAEmail` and the new `event_id`.
   - Assert `clientB` (Org B, no participation, doesn't own `recordingAId`) reads 0 rows for that event.
   - **Also assert `clientA` (owns `recordingAId`, linked to the event) reads exactly 1 row** — a pure negative/leak test isn't enough here, because a mis-scoped RLS policy that denies everyone would "pass" a leak-only test for the wrong reason. This positive-path assertion is not part of the existing `CROSS_ORG_TABLES`/`CLIENT_DENY_TABLES` patterns and should be added deliberately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is the current user a participant of this event" in RLS | A raw `EXISTS (SELECT ... FROM auth.users WHERE ...)` subquery | `auth.email()` (already granted to `authenticated` role) | This exact mistake was already made and fixed once in this repo (`20260309100000_fix_invitation_rls_auth_email.sql` — 403 error on `auth.users` SELECT). Don't reintroduce it for `events`. |
| Proving `get_workspace_recordings`/`global_search`/MCP outputs are unchanged | Manual eyeballing of the migration diff | A regression test with fixed input, snapshotted expected output, run before and after the migration lands (or against a TEST project with and without the phase's migration applied) | "Proven by test" is the literal requirement text (EVT-03) |
| Schema truth going forward | Trusting `supabase/migrations/` as a replay script | `supabase gen types typescript --linked` against the live/linked project as the introspection source of truth | Demonstrated this session: migrations cannot reconstruct the live schema from empty (banks→organizations gap); the CLI's live introspection can, in one command, with zero ambiguity |

**Key insight:** every "don't hand-roll" item here is really the same insight once: this codebase has already hit and documented the exact failure modes this phase needs to avoid (stale types, `auth.users` RLS 403, migration-folder-as-truth). The fastest, lowest-risk path is finding and reusing those fixes, not rediscovering them.

## Common Pitfalls

### Pitfall 1: `npm run gen:types` silently no-ops
**What goes wrong:** The script is `test -n "$SUPABASE_DB_URL" && supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/types/supabase.ts`. This repo's convention (per root `CLAUDE.md` and `.env.example`) is `DATABASE_URL`, not `SUPABASE_DB_URL`. Running `npm run gen:types` as documented will `test -n ""` → false → the `&&` short-circuits → **the file is silently NOT regenerated**, with no error printed (redirection to `src/types/supabase.ts` never executes since `test` fails before the pipe).
**Why it happens:** Script and repo env-var convention drifted independently.
**How to avoid:** Use `supabase gen types typescript --linked` directly (proven working in this research session, exit 0, uses the CLI's already-linked prod project + its own auth, no env var needed) — or fix the script to read `DATABASE_URL` (`export SUPABASE_DB_URL="$DATABASE_URL"` first, or change the var name in the script). Recommend doing the direct `--linked` invocation for SAFE-07 and, as a small bonus fix within the same phase, correcting the script so this doesn't bite the next engineer.
**Warning signs:** `npm run gen:types` exits 0 with no output changes to `src/types/supabase.ts` and no error message.

### Pitfall 2: Regenerating types can shift the type-check baseline
**What goes wrong:** `npm run type-check` (`scripts/type-check.mjs`) is a baseline-gated diff, keyed on `file|TScode|message-hash` (message hash, not line number). SAFE-07 will add ~2 tables, ~18 columns, and 3 RPCs to the `Database` type. Any code that pattern-matches on the `recordings`/`call_participants`/`sync_jobs`/tickets Row types (discriminated unions, exhaustive switches, strict object-literal checks) could see a **new** error key that isn't in `type-baseline.json` yet, even though nothing is actually broken.
**Why it happens:** TypeScript's structural typing means adding fields to a `Database` type can change inference in downstream generic code (e.g., `Pick<>`/`Omit<>` helpers, exhaustiveness checks) even without touching the consuming file.
**How to avoid:** Run `npm run type-check` immediately after regenerating types, before writing any new migration. If new (legitimate, non-regressive) errors appear purely from the corrected types, that's expected — use `node scripts/type-check.mjs --update-baseline` deliberately, not blindly, and read what shifted first.
**Warning signs:** CI's `lint-typecheck` job fails after a types regeneration with errors unrelated to any code the phase actually touched.

### Pitfall 3: `SELECT *` anywhere would break the byte-identical guarantee — verify, don't assume
**What goes wrong:** This research found zero `SELECT *` calls on `recordings` across ~55 call sites in `src/services/`, `src/hooks/`, and `supabase/functions/` — but this was a targeted grep-and-read pass on the four EVT-03 paths plus the highest-traffic service file, not an exhaustive audit of all ~55 sites.
**Why it happens:** A `select('*')` anywhere that ships raw rows to a client doing deep-equality comparison (or an external MCP client parsing exact JSON shape) would pick up the new `event_id`/`role`/`has_confirmed_speech` columns automatically.
**How to avoid:** Before finalizing EVT-03's test, do one exhaustive `grep -rn "select('\*')" \|"select(\"\*\")"` (or equivalent) across `src/` and `supabase/functions/` scoped to files that also reference `recordings` or `call_participants`, to close out the small remaining uncertainty this research didn't fully exhaust.
**Warning signs:** A byte-identical regression test fails specifically on an added key (not an added row/changed value) in a JSON response.

### Pitfall 4: `events` cross-org isolation cannot reuse `CROSS_ORG_TABLES` as a data-only entry
**What goes wrong:** Adding `{ table: "events", filterColumn: "organization_id" }` (or any existing union member) either fails to type-check (no matching column exists) or, worse, silently tests nothing meaningful if forced through with an unrelated column.
**Why it happens:** The test harness's `filterColumn` union was designed for org-scoped tables; `events` is deliberately not org-scoped (EVT-04).
**How to avoid:** Write a dedicated test block (see Architecture Patterns → SAFE-05 above) that seeds a participant/owner relationship and asserts both the negative (unrelated org can't see it) and positive (the actual participant/owner can) cases.
**Warning signs:** A plan or PR that touches only the `CROSS_ORG_TABLES` array and claims SAFE-05 is done for `events`.

### Pitfall 5: `participant_type` and the new `role` column look similar but are not interchangeable
**What goes wrong:** A CHECK-constraint change to widen `participant_type` to include `organizer`/`invitee` would touch a column three other things already depend on: the `populate_participants_from_source_metadata` trigger (writes `'attendee'`/`'host'`), `get_recordings_for_person`'s priority ordering (`host` > `speaker` > `attendee`), and any frontend code reading `participant_type`.
**Why it happens:** Both are "what role did this person play" columns, tempting to merge.
**How to avoid:** New, separate `role` column (see EVT-05 section above). Do not touch `participant_type` or its trigger this phase.
**Warning signs:** A migration diff that includes `ALTER TABLE call_participants DROP CONSTRAINT ... participant_type_check` or modifies `populate_participants_from_source_metadata`.

### Pitfall 6: "Chat" in EVT-03 may not mean what it sounds like
**What goes wrong:** Assuming a "chat" edge function or component exists to test against, and being unable to find one during implementation, or plans a test against a feature that doesn't exist.
**Why it happens:** No dedicated chat surface exists in this codebase today (see EVT-03 table above). The closest concrete match is the MCP `ask_call` tool.
**How to avoid:** See Open Questions — flag for explicit confirmation before the plan locks in what "chat" refers to for the EVT-03 test.
**Warning signs:** A task in the plan that says "update the chat feature" without a concrete file path.

## Code Examples

### The precedent migration for the byte-identical `COALESCE` pattern (already shipped, read in full)
```sql
-- Source: supabase/migrations/20260618160000_recordings_canonical_ai_title.sql
-- Same signature and return shape as the prior version — only the
-- ai_generated_title expression changes (COALESCE canonical column first,
-- then legacy fallback). CREATE OR REPLACE is safe because neither the
-- argument list nor the OUT columns change.
CREATE OR REPLACE FUNCTION public.get_workspace_recordings(
  p_workspace_id uuid, p_limit integer, p_offset integer,
  p_search text DEFAULT NULL, p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL, p_sources text[] DEFAULT NULL
)
 RETURNS TABLE( /* ... 18 explicit named columns ... */ )
 LANGUAGE sql STABLE
AS $function$
  SELECT
    we.id AS entry_id, we.folder_id AS entry_folder_id, r.id,
    /* ...explicit columns... */
    COALESCE(r.ai_generated_title, frc.ai_generated_title) AS ai_generated_title,
    COUNT(*) OVER() AS total_count
  FROM workspace_entries we
  INNER JOIN recordings r ON r.id = we.recording_id
  LEFT JOIN fathom_raw_calls frc
    ON frc.recording_id = r.fathom_provider_id AND frc.user_id = r.owner_user_id
  WHERE we.workspace_id = p_workspace_id /* ...filters... */
  ORDER BY COALESCE(r.recording_start_time, r.created_at) DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$function$;
```
This is the pattern EVT-03 asks to be followed later (Phase 31+, when `get_workspace_recordings` eventually needs to surface event-aware data) — for **Phase 30 specifically, no change to this function's body is required**, since `event_id` isn't in its `RETURNS TABLE` list.

### The `auth.email()` RLS precedent (already shipped, read in full)
```sql
-- Source: supabase/migrations/20260309100000_fix_invitation_rls_auth_email.sql
-- "authenticated role has no SELECT on auth.users, causing 403 on invite
-- creation. Replace with auth.email() which is granted to authenticated role."
CREATE POLICY "invited_users_select_own_invitations"
  ON workspace_invitations FOR SELECT
  USING (email = auth.email());
```

### The `call_participants` RLS + service-role-only-write shape to mirror for `events`
```sql
-- Source: supabase/migrations/20260309120000_call_participants.sql
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants FORCE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view call participants"
  ON call_participants FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Service role full access"
  ON call_participants FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
```
For `events`, swap the SELECT policy's `USING` clause for the participation/ownership `EXISTS` shown in Architecture Patterns → EVT-04, keep the service-role-full-access policy verbatim (this is exactly the "no event steward in v1" write posture the spec already locked).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Assume `supabase/migrations/` is a faithful, replayable log of the schema | Treat the live database (via `supabase gen types typescript --linked`) as the only source of truth; migration folder is a historical narrative with at least one confirmed undocumented gap (banks→organizations) | Confirmed this session (2026-08-31) | Any future "spin up a fresh test project from migrations" effort needs to account for this gap; SAFE-07 should document it rather than pretend it's fixable retroactively |
| Assume `npm run gen:types` regenerates types correctly | Verify the script's env var actually matches what's set (`DATABASE_URL` vs `SUPABASE_DB_URL`) before trusting a clean exit | Confirmed this session | Prevents silently-stale types after this phase's own migration lands |

**Deprecated/outdated:** None specific to this phase's domain beyond the two items above — this is a young, actively-maintained schema (last migration in the folder before this phase: `20260829231202`, i.e., two days before this research).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The recommended `events` column set (`canonical_start_time`, `canonical_end_time`, `resolution_confidence`, `created_at`, `updated_at`) is sufficient for EVT-01 and nothing else is needed this phase | Architecture Patterns → EVT-01 | Low — additive columns are cheap to add later in Phase 31+ if matching logic needs more; no rework of already-shipped columns implied |
| A2 | "Chat" in EVT-03's requirement text refers to the MCP `ask_call` tool, since no dedicated chat edge function or frontend feature exists and the only other lead (`chat_message` AI-action-type) has no call site in `src/` | EVT-03 table, Pitfall 6 | Medium — if a chat feature is added or exists elsewhere (e.g., a not-yet-connected frontend branch) before this phase executes, the byte-identical test would target the wrong code path and give false confidence |
| A3 | `role` should be a single nullable `TEXT` column with a 4-value CHECK constraint, not an array (multiple simultaneous roles, e.g. organizer+speaker, are not modeled) | Architecture Patterns → EVT-05 | Low-Medium — EVT-05's literal wording is "a role value" (singular); if Phase 31+ discovers a participant needs multiple simultaneous roles, this would need a follow-up migration (additive, low risk) rather than a rework |
| A4 | `has_confirmed_speech` should be nullable with no default (per CONTEXT.md's "every new column nullable" rule) rather than `NOT NULL DEFAULT false` | Architecture Patterns → EVT-05 (implied) | Low — either choice is additive-safe; affects only how Phase 32's alibi-constraint logic reads "unknown" vs "confirmed false" |
| A5 | No CI job currently attempts a fresh-database migration replay, so F16 is a latent (not active) risk | Architecture Patterns → F16 | Low — verified by reading the full `ci.yml`; if a replay job exists elsewhere (e.g., a manual runbook not in CI), the urgency of documenting F16 clearly would be higher |

## Open Questions

1. **What exactly is "chat" in EVT-03?**
   - What we know: No dedicated chat edge function exists (79 edge functions enumerated, none named `chat*`). No frontend chat UI component was found. The `chat_message` AI-action-type exists in `useAiGate.ts` but has zero call sites in `src/`. The MCP `ask_call` tool (tracked as `mcp_ask_call`) is a live, working "ask a question about this call" feature that reads `recordings.full_transcript` through the same `workspace_entries` access-check pattern as the other three EVT-03 paths.
   - What's unclear: Whether "chat" is intentionally referring to `ask_call` under an informal name, or whether it refers to a not-yet-built/not-yet-connected feature that the plan should treat as N/A this phase.
   - Recommendation: Confirm with Andrew/the planner before writing the EVT-03 test scope. If confirmed as `ask_call`, the test is straightforward (see EVT-03 table). If a real "chat" feature is planned but doesn't exist yet, EVT-03's chat clause should be marked N/A for Phase 30 with a note for whichever future phase introduces it.

2. **Is the dedicated Supabase TEST project (for `src/test/rls-regression.test.ts` and the new byte-identical test) currently provisioned and migration-current?**
   - What we know: The test harness requires `VITE_SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_ROLE_KEY` / `VITE_SUPABASE_TEST_ANON_KEY`, distinct from prod, and CI's `rls-regression` job only runs when `vars.SUPABASE_SECRETS_CONFIGURED == 'true'`. This research could not inspect GitHub Actions repo secrets/vars from the local environment.
   - What's unclear: Whether that TEST project has all 288 current migrations applied (if it lags, the new SAFE-05 `events` test and the extended `call_participants` test would fail for reasons unrelated to this phase's code).
   - Recommendation: The plan's Wave 0 should include a step to verify (or apply) migrations against the TEST project before writing tests that depend on it, or explicitly note this as a manual/human-verify checkpoint if credentials aren't available to the executing agent.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Supabase CLI | SAFE-07 type regeneration, any migration apply | Yes | 2.101.0 | — |
| Linked Supabase project (prod ref `vltmrnjsubfzrgrtdqey`) | SAFE-07, all live-DB verification | Yes — already linked | — | — |
| `DATABASE_URL` in `.env` (prod, guarded) | Applying the new migration to prod | Presumed yes per root `CLAUDE.md` (not read directly — Bash tool denied direct `.env` read this session as a security guard) | — | — |
| Dedicated Supabase TEST project + `.env.test` | RLS regression test extension, byte-identical regression test | **Unverified this session** (see Open Questions #2) | — | If unavailable: tests skip cleanly (`describe.skipIf(!integrationDbReachable)`) rather than fail — but SAFE-05/EVT-03 cannot be proven "by test" without it |
| Docker | Not needed — `supabase functions deploy --use-api` bypass documented, and this phase has no edge function deploys | N/A | — | — |
| Node.js / npm | `npm run type-check`, `npm run test`, `npm run gen:types` (or its `--linked` replacement) | Yes (CI-verified, Homebrew-managed locally per root `CLAUDE.md`) | — | — |

**Missing dependencies with no fallback:** None confirmed blocking — the one real unknown (TEST project currency) degrades gracefully to a skip, not a hard failure, but that means SAFE-05/EVT-03's "proven by test" bar cannot be fully met in CI without it being resolved.

**Missing dependencies with fallback:** TEST project unavailability — regression tests skip cleanly rather than error.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.16 (`vitest.config.ts`) |
| Config file | `/Users/admin/dev/brain/main/vitest.config.ts` |
| Quick run command | `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` |
| Full suite command | `npm run test` (unit) / `npm run test:integration` (integration, requires `VITEST_INTEGRATION_OK=true` + TEST project env) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| SAFE-07 | Regenerated types compile and match live schema | build/type-check | `npm run type-check` | Yes — `scripts/type-check.mjs` |
| EVT-01/02/05/07 | New columns/table exist, additive, don't break existing constraints | integration (DDL apply) | Apply migration against TEST project via `supabase db push` (or CLI equivalent), then `supabase gen types typescript --linked` (or TEST-project equivalent) to confirm shape | N/A — DDL-level, no vitest file needed |
| EVT-03 | `get_workspace_recordings`/`global_search`/MCP paths byte-identical when `event_id` IS NULL | integration | New test file, e.g. `src/test/event-schema-noop.integration.test.ts` — call each RPC/tool before-state fixture, assert output unchanged after migration applies | ❌ Wave 0 — needs creation |
| EVT-04 | `events` RLS: participant/owner can read, unrelated org cannot | integration | Extend `src/test/rls-regression.test.ts` with a bespoke block (not `CROSS_ORG_TABLES` array — see Architecture Patterns) | Extend existing file — ❌ new test block needed |
| SAFE-05 | `events` + `call_participants` covered by cross-org isolation gate | integration | Same file as EVT-04 for `events`; `call_participants` already covered by existing array entry | Partially exists — `call_participants` done, `events` ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run type-check` (fast, no DB needed) after the types regeneration task; SQL syntax review for the migration task.
- **Per wave merge:** `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` against the TEST project (requires env — see Environment Availability).
- **Phase gate:** Full RLS regression suite + new byte-identical test green before `/gsd:verify-work`, migration applied to TEST project first, then prod per this repo's guarded process.

### Wave 0 Gaps
- [ ] New integration test file for EVT-03's byte-identical proof (no existing file covers this — it's a new requirement type, not a gap in an existing file).
- [ ] New test block inside `src/test/rls-regression.test.ts` for `events` participation/ownership RLS (SAFE-05 + EVT-04) — cannot reuse `CROSS_ORG_TABLES` mechanically, see Architecture Patterns.
- [ ] Confirm TEST project migration currency before writing integration tests against it (Open Question #2).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | This phase adds no auth surface — relies entirely on existing Supabase Auth JWT/`auth.email()`/`auth.uid()` |
| V3 Session Management | No | Not touched |
| V4 Access Control | **Yes — this is the core of the phase** | Row Level Security policies on `events` (new) and `call_participants` (extended). Pattern: `auth.email()` for participation, `auth.uid()` for ownership. Never rely on client-supplied identifiers without RLS backing them (`supabase/CLAUDE.md` OWASP section, "Insecure Direct Object References"). |
| V5 Input Validation | Minor | No new user-facing input this phase (no edge function endpoints added) — N/A beyond standard migration hygiene |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Cross-org data exposure via a new table lacking RLS, or RLS that's enabled but has no policy (silently permissive by default in some misconfigurations) | Elevation of Privilege / Information Disclosure | `ALTER TABLE events ENABLE ROW LEVEL SECURITY` + explicit SELECT policy + `FORCE ROW LEVEL SECURITY`, mirrored exactly from `call_participants`'s already-audited pattern. Verified via a **new**, bespoke cross-org isolation test (SAFE-05) since the generic `CROSS_ORG_TABLES` mechanism doesn't cover participation-based access out of the box. |
| RLS policy referencing `auth.users` directly, causing either a 403 (permission denied to the table) or — worse, if `authenticated` somehow did have SELECT — an information leak of other users' emails | Information Disclosure | `auth.email()` / `auth.uid()` only — see the `20260309100000_fix_invitation_rls_auth_email.sql` precedent above. |
| An additive nullable column widening the readable audience of an existing row because a policy predicate was written using `OR` in a way that's broader than intended | Elevation of Privilege | This phase adds no new predicates to existing `recordings`/`call_participants` RLS policies — only new columns. Verify via the EVT-03 byte-identical test suite, which is effectively also an RLS-non-regression test for `recordings`. |
| A false assumption that `organization_id`-based RLS patterns are always safe to copy-paste onto `events` | Elevation of Privilege | Explicit anti-pattern flagged in Architecture Patterns → EVT-04 ("resist the urge to add an org-admin bypass"). |

## Sources

### Primary (HIGH confidence — direct tool verification this session)
- `supabase gen types typescript --linked` against prod ref `vltmrnjsubfzrgrtdqey` — full live schema introspection, 6093 lines generated, diffed against committed `src/types/supabase.ts` (238-line diff, fully read and categorized above)
- Direct `Read` of `supabase/migrations/20260618160000_recordings_canonical_ai_title.sql`, `20260309120000_call_participants.sql`, `20260309200013_global_search_rpc.sql`, `20260131000007_create_recordings_tables.sql`, `20260228000001_workspace_redesign_schema.sql`, `20260306000000_personal_organization_and_home.sql`, `20260211100000_add_bank_id_to_content_and_chat.sql`, `20260309100000_fix_invitation_rls_auth_email.sql`, `20260208204500_add_get_user_email.sql`
- Direct `Read` of `src/test/rls-regression.test.ts` (full 931 lines), `supabase/RLS_POLICY_VERIFICATION.md` (full), `.github/workflows/ci.yml` (full), `vitest.config.ts`, `scripts/type-check.mjs`, `package.json`, `supabase/CLAUDE.md`, root `CLAUDE.md`, `src/CLAUDE.md`
- Direct `Read` of edge function code: `supabase/functions/mcp-server/tools/ai/ask_call.ts`, `supabase/functions/mcp-server/tools/read/search_calls.ts`, `src/hooks/useAiGate.ts`, `src/services/recordings.service.ts`
- `git branch --show-current`, `git log`, `git merge-base main HEAD` — confirmed branch state and that no schema work has started

### Secondary (MEDIUM confidence)
- None — every claim in this document that isn't tagged `[ASSUMED]` was verified directly against the live database or the actual committed source this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every tool version reported was directly run this session.
- Architecture: HIGH — every schema claim (F16, F17, current `recordings`/`call_participants`/`workspace_entries`/`organizations` shape, `events` non-existence) was verified via live introspection, not inferred from the spec or training data.
- Pitfalls: HIGH — every pitfall traces to either a specific line of code/config read this session or a specific already-fixed bug in this repo's own migration history.

**Research date:** 2026-08-31
**Valid until:** Live-schema findings (the exact diff, exact column lists) are valid until the next migration lands on `main` or `v2.2-event-resolution` — re-verify with `supabase gen types typescript --linked` immediately before executing SAFE-07's regeneration task if any time has passed. Architectural/pattern findings (RLS precedents, test harness mechanics) are stable for the duration of this milestone (~30 days).
