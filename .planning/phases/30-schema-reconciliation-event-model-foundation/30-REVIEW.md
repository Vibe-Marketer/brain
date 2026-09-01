---
phase: 30-schema-reconciliation-event-model-foundation
reviewed: 2026-09-01T01:57:23Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/types/supabase.ts
  - package.json
  - type-baseline.json
  - supabase/migrations/20260831000001_create_events_and_extend_participants.sql
  - supabase/migrations/20260831010000_fix_global_search_call_tag_assignments_regression.sql
  - src/test/event-schema-noop.integration.test.ts
  - src/test/rls-regression.test.ts
  - vitest.config.ts
  - supabase/SCHEMA_TRUTH.md
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-09-01T01:57:23Z
**Depth:** standard (with targeted deep cross-file/empirical verification on the RLS-correctness ask)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the events-table migration, the global_search regression-fix migration, the two new/extended test suites, the regenerated `supabase.ts` types, and the supporting docs/config for Phase 30.

**The `events` table's RLS policy has a real, empirically-confirmed authorization defect in its "participation" grant.** The policy's `EXISTS` subquery reads `call_participants`, which has its own `FORCE ROW LEVEL SECURITY` policy restricting SELECT to organization members (`is_organization_member(organization_id, auth.uid())`) — not to the participant themselves. Because Postgres applies a referenced table's own RLS to subqueries run under a non-bypassing role, this silently defeats the entire premise of EVT-04 ("the first non-org-scoped table... visibility is granted via participation... never an org-scoping column"): a real participant on a call who is *not* a member of the recording's organization can never see the event, contradicting the migration's own stated design intent. I proved this empirically against the live TEST Supabase project with a self-contained, fully-cleaned-up fixture (see CR-01) rather than relying on static reading alone — the control case (ownership path) returned 1 row as expected, the probe case (participation-only, non-org-member) returned 0 rows when it should return 1, and the root-cause case (participant reading their own `call_participants` row directly) also returned 0, confirming exactly where the block occurs. The database was left in the identical state it was found in (verified with a follow-up sweep).

The new RLS regression coverage for `events` (WR-01) doesn't catch this because its only fixture makes the same user simultaneously the recording owner, an org member, *and* the participant — so the ownership grant alone is sufficient to pass the test, and the participation grant is never exercised in isolation.

On the positive side: the `global_search()` fix migration was diffed byte-for-byte against the live 2026-06-10 function body it replaces, and it changes exactly the two `call_tag_assignments` references described in its header comment — no other behavior changed, no new cross-user data exposure introduced. `npm run type-check` passes cleanly (0 new errors against the 319-error baseline, no baseline entries related to this phase's schema changes), and the regenerated `supabase.ts` correctly reflects the new `events` table, `recordings.event_id`, and `call_participants.event_id`/`role`/`has_confirmed_speech` columns with matching FK relationships. `SCHEMA_TRUTH.md`'s specific, falsifiable claim about the banks→organizations rename migration was spot-checked against the actual file and is accurate.

## Critical Issues

### CR-01: `events` RLS participation grant is unreachable — silently gated behind org membership it was designed to bypass

**File:** `supabase/migrations/20260831000001_create_events_and_extend_participants.sql:95-109`

**Issue:**

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

The migration's own comment claims this "[m]irrors the already-audited call_participants pattern (20260309120000)." It does not. The actual, live `call_participants` SELECT policy (`supabase/migrations/20260309120000_call_participants.sql:77-80`) is:

```sql
CREATE POLICY "Organization members can view call participants"
  ON call_participants FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));
```

`call_participants` also has `FORCE ROW LEVEL SECURITY` (line 75). This is org-membership-gated, not email/participation-gated, and it is the table's *only* non-service-role SELECT policy. When the `events` policy's `EXISTS (... FROM call_participants cp WHERE cp.email = LOWER(auth.email()))` subquery runs, Postgres evaluates it under the querying role (`authenticated`) and therefore applies `call_participants`' own RLS to it. A user whose email matches `cp.email` but who is **not** a member of the organization that owns the underlying recording will have that row filtered out by `call_participants`' RLS before the `events` policy's `EXISTS` even gets to compare the email — the subquery returns zero rows for them regardless of whether a matching `call_participants` row exists. The "ownership" branch does *not* have this problem: `recordings` has an unconditional `"Users can view own recordings" USING (owner_user_id = auth.uid())` policy (`supabase/migrations/20260308000002_tighten_recordings_select_rls.sql:26-28`) that grants self-access independent of org membership, so only the participation branch is broken.

This directly contradicts the migration's own design rationale (EVT-04: "the first non-org-scoped table... visibility is granted via participation... or ownership... never an org-scoping column, and never an org-admin bypass") for exactly the cross-org-participant scenario the `events` table exists to support once Phase 31's matching engine starts linking captures across organizations for the same real-world meeting.

**Empirical proof (live TEST project `swjzxiddcrtaqixsfaac`, not prod; fixtures fully cleaned up and verified afterward):**

Created Org X with an owner user (member of Org X) and a recording owned by them; created an event and linked the recording to it (ownership path); created a *second*, separate user — a participant — who is **not** a member of Org X, and inserted a `call_participants` row on that recording with `email` = that participant's email and `event_id` = the event. Signed in as each user with a real JWT (`signInWithPassword`, matching the existing test files' pattern) and queried `events`:

```
CONTROL (owner reads event via ownership path):                          rows= 1   (correct)
PROBE (participant-only, non-org-member, reads event via participation): rows= 0   (WRONG — should be 1)
ROOT CAUSE (participant reads their own call_participants row directly): rows= 0   (confirms the exact mechanism)
```

The control proves the harness and the ownership grant work correctly; the probe proves the participation grant does not; the root-cause query proves precisely why (the participant cannot see their own `call_participants` row at all, independent of `events`).

**Fix:** Don't query `call_participants` directly from the `events` policy. Use a `SECURITY DEFINER` helper, matching the codebase's own established pattern for this exact class of problem (`is_organization_member`, `supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql:91-101`, used precisely so a policy can check membership in an RLS-protected table without being gated by that table's own policy):

```sql
CREATE OR REPLACE FUNCTION public.user_participates_in_event(p_event_id uuid, p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM call_participants cp
    WHERE cp.event_id = p_event_id AND cp.email = p_email
  )
$function$;

DROP POLICY IF EXISTS "participants_and_owners_can_view_events" ON events;
CREATE POLICY "participants_and_owners_can_view_events"
  ON events FOR SELECT
  USING (
    public.user_participates_in_event(events.id, LOWER(auth.email()))
    OR EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.event_id = events.id
        AND r.owner_user_id = auth.uid()
    )
  );
```

(Alternative: add a dedicated self-visibility SELECT policy directly on `call_participants` — `USING (email = LOWER(auth.email()))` — which Postgres will OR together with the existing org-membership policy. This also fixes it, but broadens `call_participants`' own visibility surface beyond what's needed for the `events` subquery, which is a bigger behavior change than this fix needs to make.) Whichever approach is chosen, extend the RLS regression coverage per WR-01 before Phase 31 starts populating `event_id` across organizations.

## Warnings

### WR-01: New `events` RLS test cannot detect CR-01 — it never isolates the participation-only grant

**File:** `src/test/rls-regression.test.ts:654-691` (fixture), `:1004-1040` (assertions)

**Issue:** The bespoke `events` isolation block's only fixture participant is User A — who is simultaneously the recording's owner, an Org A member, *and* the `call_participants` row's email match (line 660-690). The "Org A (owner + participant) reads exactly the one event" test (line 1023) therefore passes purely on the ownership grant; it provides zero signal about whether the participation grant works on its own, which is precisely the path CR-01 shows is broken. The block's own comment explains it added a positive assertion specifically "so a mis-scoped deny-everyone policy would also pass a leak-only/negative test" — but the same logic applies one level deeper: a mis-scoped-so-that-only-ownership-works policy also passes this exact test, for the same reason.

**Fix:** Add a third user/org to the fixture — a participant with no ownership and no org-membership relationship to Org A's recording (mirroring the empirical probe in CR-01) — and assert they *can* read the event via participation alone:

```ts
// New fixture: participant with NO relationship to Org A other than being
// listed as a call_participants row. Not an Org A member, doesn't own the
// recording.
const participantOnlyEmail = `${SUITE_TAG}-participant-only-${stamp}@callvault.test`;
// ...create the user, insert a call_participants row on recordingAId with
// this email and event_id = eventAId, sign in, then:

it("a participant with no ownership/org-membership relationship still reads the event via participation alone", async () => {
  const { data, error } = await clientParticipantOnly
    .from("events")
    .select("*")
    .eq("id", eventAId);
  if (error) throw new Error(`${SUITE_TAG} setup-error: ${error.message}`);
  expect(data?.length ?? 0, "participation grant is not independently reachable").toBe(1);
});
```

This test would fail today against CR-01 and pass once CR-01's fix ships — exactly the coverage this suite is supposed to provide.

### WR-02: `global_search` fix migration's header comment misstates its own deployment status

**File:** `supabase/migrations/20260831010000_fix_global_search_call_tag_assignments_regression.sql:49-55`

**Issue:** The migration's header states: "Applied to the TEST project only in this session; a production apply is a separate, explicit action for Andrew to authorize (see 30-03-SUMMARY.md)." Per this phase's own deployment record, this migration *was* applied to production during Phase 30 (alongside the events-table migration). A committed migration file is part of the permanent historical record (as `supabase/SCHEMA_TRUTH.md` itself argues for `supabase/migrations/` generally) — a future reader (human or agent) who trusts this file's own words over out-of-band knowledge will conclude the 42703 production error is still live and either waste time re-diagnosing it or attempt a redundant "fix," when it has already shipped.

**Fix:** Amend the header comment (or add a dated follow-up note directly beneath it) to state the actual outcome, e.g.: "Applied to TEST during this session's verification; applied to production on 2026-08-31 as part of this phase's deployment. See 30-03-SUMMARY.md for the production-apply record." Do this before merging/closing the phase so the file doesn't ship in a permanently misleading state.

### WR-03: New `events.updated_at` has no refresh trigger, unlike every comparable table in this schema

**File:** `supabase/migrations/20260831000001_create_events_and_extend_participants.sql:23-30`

**Issue:** `events.updated_at` is declared `NOT NULL DEFAULT NOW()` but the migration adds no `BEFORE UPDATE` trigger to refresh it. Every other timestamped table touched by this codebase's migrations follows a `update_<table>_updated_at()` trigger convention (e.g. `update_organizations_updated_at()`, `update_tickets_updated_at()` via `tickets_updated_at` trigger) — and this convention exists precisely because a prior miss on `ai_models` needed its own dedicated remediation migration (`20260528070500_restore_ai_models_updated_at_trigger.sql`). Today this has zero behavioral impact (no write path exists for `events` besides service-role in Phase 30), but Phase 31's matching engine will start issuing `UPDATE events SET canonical_start_time = ..., resolution_confidence = ...` statements, and without a trigger every one of those call sites must remember to also set `updated_at` manually or the column silently goes stale.

**Fix:** Add the standard trigger now, while `events` has zero rows, rather than retrofitting it once Phase 31 has live data:

```sql
CREATE OR REPLACE FUNCTION public.update_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_events_updated_at();
```

---

_Reviewed: 2026-09-01T01:57:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
