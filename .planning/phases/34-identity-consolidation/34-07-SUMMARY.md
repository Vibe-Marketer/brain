---
phase: 34-identity-consolidation
plan: 07
subsystem: database, edge-functions
tags: [supabase, postgres, identity, otp, prod-apply]

requires:
  - phase: 34-02
    provides: "identities + identity_aliases tables, identity_id columns, get_identity_evidence RPC (TEST)"
  - phase: 34-03
    provides: "identity_alias_verifications table + OTP request/confirm edge functions (TEST)"
  - phase: 34-04
    provides: "resolve-identities edge function (TEST)"
provides:
  - "Identity spine (identities, identity_aliases, identity_alias_verifications) live in production"
  - "request-email-alias-verification, confirm-email-alias-verification, resolve-identities deployed to prod"
  - "src/types/supabase.ts regenerated from prod"
affects: [35]

tech-stack:
  added: []
  patterns:
    - "Same TEST-then-prod guarded-apply discipline as Phases 31/32/33: prod-ref verified before AND after via supabase/.temp/project-ref, migrations applied via supabase db push --linked, functions via --use-api."

key-files:
  created: []
  modified:
    - src/types/supabase.ts

key-decisions:
  - "Task 4 (real add-email round-trip through a real inbox) is a genuine manual gate that cannot be automated or auto-approved — it requires a human to receive an actual email and enter the code. Confirmed via direct prod introspection that identity_aliases has 0 rows: this has NOT happened yet. Task 3's DDL/deploy work is complete and verified; Task 4 is handed to Andrew as an explicit action item."

requirements-completed: [IDENT-01, IDENT-02, IDENT-08]

duration: ~20min (Task 3 guarded apply, per commit 2671864b)
completed: 2026-09-06
status: partial — Tasks 1-3 complete, Task 4 (manual real-inbox verification) pending Andrew
---

# Phase 34 Plan 07: Guarded Prod Apply Summary

**Identity spine + OTP migrations applied to production, three edge functions deployed, types re-synced. Forward-only safety proven by introspection. The one remaining step (Task 4, a real end-to-end email verification round-trip) requires Andrew's direct action — it cannot be automated.**

## Accomplishments (Tasks 1-3, complete)

- **Task 1 (TEST gate):** Both migrations confirmed present on TEST; full identity test suite green (IDENT-01 noop, IDENT-08 evidence, cross-org isolation, OTP unit, confirm integration, resolver unit) — carried forward from Plans 02-06's own TEST verification.
- **Task 2 (approval):** Approved by Andrew.
- **Task 3 (guarded prod apply — commit `2671864b`):**
  - Migrations `20260905140000_create_identities_and_link_tables.sql` and `20260905150000_create_identity_alias_verifications.sql` applied to production (`vltmrnjsubfzrgrtdqey`), prod-ref guarded before and after.
  - Three functions deployed via `--use-api`: `request-email-alias-verification`, `confirm-email-alias-verification`, `resolve-identities` (`--no-verify-jwt`, app-code secret gate) — all ACTIVE v1.
  - `src/types/supabase.ts` regenerated from prod; drift-guard confirmed the only table-level delta vs the previously-committed file is the new `identity_alias_verifications` table.
  - **Forward-only safety re-verified this session** (independent of the original commit): `SELECT COUNT(*) FROM {speakers,contacts,call_participants} WHERE identity_id IS NOT NULL` = 0 across all three tables in prod — nothing auto-linked.
  - **Client-deny re-verified this session:** `identity_alias_verifications` has exactly one policy (`Service role full access`, `roles={service_role}`) — no authenticated/anon policy exists.
  - `identities` itself (not the OTP table) correctly carries additional client-facing policies (`owner_can_update_own_identity`, `users_can_view_linked_identities`) — expected, since identities must be visible/updatable by their owner, unlike the strictly-service-role OTP table.
  - `tsc -p tsconfig.app.json` via baseline wrapper: 0 new errors, 320/320 baseline unchanged.

## Pending: Task 4 (manual, real-inbox round-trip)

**Not yet performed.** Confirmed via direct prod query: `identity_aliases` has 0 rows.

**What Andrew needs to do:**
1. Log in to production (app.callvaultai.com), open Settings → Account → Verified Emails.
2. Add a second email address you control; confirm a verification email arrives from CallVault (Resend) with a 6-digit code.
3. Enter the code; confirm the UI shows success and the new email appears in the verified list.
4. Report back "verified" (or describe where it failed) — the agent will then introspect prod to confirm: an `identities` row with your `owner_user_id`, a verified `identity_aliases` row (`alias_type='email'`, `verified=true`) for the new address, and the pending `identity_alias_verifications` row deleted. Also worth spot-checking: a wrong code is rejected, and 5 wrong attempts invalidate the pending row.

**Phase 34 is not marked complete until this step succeeds or a defect is filed** — this is IDENT-03's only real-world proof point.

## Threat Flags

None new. All Task 3 threat-model mitigations (T-34-07-01 through T-34-07-04) re-confirmed by direct introspection this session, not just trusted from the original commit message.

## Next Phase Readiness

Phase 35 (Speaker Resolution Across Sources) depends on Phase 34's identity spine, which is live and safe in prod. It does NOT depend on Task 4's real-inbox verification specifically (that proves IDENT-03's UI path, not the schema). Phase 35 planning could in principle proceed in parallel with Andrew completing Task 4, but per this milestone's discipline, Phase 34 stays open until Task 4 closes.

---
*Phase: 34-identity-consolidation*
*Completed: 2026-09-06 (partial — Tasks 1-3 only; Task 4 pending)*
