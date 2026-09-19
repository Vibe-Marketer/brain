---
phase: 38-access-policy-share-link-key-migration-request-flow
reviewed: 2026-09-19T00:00:00-04:00
depth: deep
diff: b9587fa6..32542291067f62952ed40df5c716d7345d3b3212
files_reviewed: 58
files_reviewed_list:
  - e2e/phase38-access.spec.ts
  - src/App.tsx
  - src/components/access/AccessLevelPicker.tsx
  - src/components/call-detail/CallDetailHeader.tsx
  - src/components/call-detail/__tests__/OtherRecordingCopies.test.tsx
  - src/components/notifications/__tests__/NotificationBell.test.tsx
  - src/components/panes/SettingsCategoryPane.tsx
  - src/components/panes/SettingsDetailPane.tsx
  - src/components/settings/PrivacyAccessSettings.tsx
  - src/components/settings/__tests__/PrivacyAccessSettings.test.tsx
  - src/components/sharing/ShareCallDialog.tsx
  - src/components/sharing/__tests__/RecordingAccessPanel.test.tsx
  - src/components/transcripts/TranscriptsTab.tsx
  - src/components/transcripts/__tests__/shared-with-me-mapping.test.ts
  - src/hooks/__tests__/useAccessPolicy.test.ts
  - src/hooks/__tests__/useSharing.test.ts
  - src/hooks/useAccessPolicy.ts
  - src/hooks/usePublicRecording.ts
  - src/hooks/useSharing.ts
  - src/lib/query-config.ts
  - src/pages/PublicRecordingView.tsx
  - src/pages/Settings.tsx
  - src/pages/__tests__/PublicRecordingView.test.tsx
  - src/services/__tests__/access-policy.service.test.ts
  - src/services/__tests__/data-movement.dedup.integration.test.ts
  - src/services/__tests__/sharing.service.test.ts
  - src/services/access-policy.service.ts
  - src/services/public-recording.service.ts
  - src/services/recordings.service.ts
  - src/services/sharing.service.ts
  - src/test/access-policy.integration.test.ts
  - src/test/fixtures/phase38-provider-event-kind.ts
  - src/test/integration-setup.test.ts
  - src/test/integration-setup.ts
  - src/test/migrations/phase38-access-migrations.test.ts
  - src/test/phase38-fixtures.integration.test.ts
  - src/test/phase38-fixtures.ts
  - src/test/rls-regression.test.ts
  - src/types/__tests__/access-policy.test.ts
  - src/types/access-policy.ts
  - src/types/public-recording.ts
  - src/types/sharing.ts
  - src/types/supabase.ts
  - supabase/config.toml
  - supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts
  - supabase/functions/mcp-server/tools/read/list_shared_calls.ts
  - supabase/functions/mcp-server/tools/write/create_share_link.ts
  - supabase/functions/mcp-server/tools/write/revoke_share_link.ts
  - supabase/functions/public-recording/__tests__/public-recording.integration.test.ts
  - supabase/functions/public-recording/index.ts
  - supabase/functions/recording-access/__tests__/recording-access.integration.test.ts
  - supabase/functions/share-call/__tests__/share-call.integration.test.ts
  - supabase/functions/share-call/index.ts
  - supabase/migrations/20260919000001_phase38_access_policy_schema.sql
  - supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql
  - supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql
  - supabase/migrations/20260919000004_phase38_copy_event_preservation.sql
  - type-baseline.json
plans_reviewed:
  - 38-01
  - 38-02
  - 38-03
  - 38-04
  - 38-05
  - 38-06
  - 38-07
  - 38-08
  - 38-09
  - 38-10
  - 38-12
plans_excluded:
  - 38-11
findings:
  blocker: 2
  high: 3
  medium: 5
  low: 2
  total: 12
status: issues_found
---

# Phase 38 Interim Code Review

**Branch:** `v2.2-event-resolution`  
**Range:** `b9587fa6..32542291067f62952ed40df5c716d7345d3b3212`  
**Scope:** Completed Plans 38-01 through 38-10 and 38-12. Plan 38-11 was excluded because it is still being implemented in an isolated worktree.

## Summary

The reviewed implementation has two release blockers: expired share tokens continue to authorize transcript content, and authenticated source-organization members can use the two `SECURITY DEFINER` copy RPCs to copy recordings they cannot read. Three additional high-severity integration defects affect UUID-native shares, anonymous discovery semantics, and cross-organization routing.

## Blockers

### BL-01: Expired share tokens continue to authorize protected recording content

**Files:**

- `supabase/functions/share-call/index.ts:338-353`
- `supabase/functions/share-call/index.ts:356-384`
- `supabase/functions/share-call/index.ts:457-518`

**Issue:** The token resolver checks only whether the share row exists and whether its status is `revoked`. It never compares `expires_at` with the current time. A recipient or sender holding an expired token can therefore continue through `resolveShareContent()` and receive the full transcript and recording fields. The `signup-prefill` route also returns the recipient email for an expired token.

The integration coverage checks that expired links are omitted from the Shared With Me listing, but it does not call the token endpoint with an expired link. Listing behavior does not protect the token credential itself.

**Fix:** Select `expires_at` in both token paths and reject the token before returning prefill, teaser, metadata, or content when `expires_at <= now()`. Use the same non-enumerating denial shape as an unavailable link. Add real endpoint tests for expired anonymous, recipient, sender, and signup-prefill requests.

### BL-02: Authenticated organization members can copy private recordings they cannot read

**Files:**

- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:77-87`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:104-120`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:162-205`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:224-263`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:301-304`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:310-318`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:334-347`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:378-462`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:482-485`
- `supabase/migrations/20260308000002_tighten_recordings_select_rls.sql:17-42`

**Issue:** Both user-callable copy RPCs are `SECURITY DEFINER`, fetch the source recording outside RLS, and authorize the caller using source-organization membership alone. Existing recording RLS intentionally limits ordinary members to recordings they own or recordings in workspaces they belong to. A member who knows a private recording UUID can call either RPC directly, copy its transcript and chunks into another organization they belong to, and become owner of the copied content.

**Fix:** Before reading or copying source content, require the caller to pass the same complete read-authorization check as a direct `recordings` SELECT. Do not use organization membership as a substitute for recording access. Preserve the stronger target organization/workspace checks and add negative real-database tests for a source-org member without owner, admin, workspace, grant, policy, or share access.

## High Severity

### HI-01: UUID-native share recipients are missing from the central recording access check

**Files:**

- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:222-263`
- `supabase/functions/share-call/index.ts:262-272`
- `supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql:137-184`
- `src/components/transcripts/TranscriptsTab.tsx:89-116`

**Issue:** `phase38_user_can_access_recording()` recognizes share recipients only when the legacy `call_recording_id` matches `recordings.fathom_provider_id`. New share rows are UUID-native and may have only `call_share_links.recording_id`. Shared With Me correctly resolves those rows and maps them to canonical recording UUIDs, but direct recording RLS does not authorize the recipient. The recipient can see a row in Shared With Me while being unable to load its protected recording content through the normal recording surface.

**Fix:** Make the share predicate UUID-first and retain owner-scoped legacy fallback only for rows without a canonical key:

```sql
WHERE (
    csl.recording_id = r.id
    OR (
      csl.recording_id IS NULL
      AND csl.call_recording_id = r.fathom_provider_id
    )
  )
  AND csl.user_id = r.owner_user_id
  AND csl.status = 'active'
  AND ...
```

Add a real-database test that creates a UUID-only share link and reads the canonical recording as the recipient.

### HI-02: Discovery and request eligibility misclassify callers who already have legacy RLS access

**Files:**

- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:229-263`
- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:424-439`
- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:457-482`
- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:528-539`
- `supabase/migrations/20260308000002_tighten_recordings_select_rls.sql:17-42`
- `src/test/access-policy.integration.test.ts:350-360`

**Issue:** The new helper includes owner, grants, a legacy share predicate, and Phase 38 access levels, but omits existing org-admin and workspace-membership SELECT policies. Discovery and request RPCs treat this incomplete helper as the definitive answer to whether the caller can access a recording. A confirmed participant who is also an org admin or workspace member can therefore see an anonymous “inaccessible copy” and create a request for content they can already read. This violates the D-07/D-09 privacy contract and creates unnecessary owner notifications and audit records.

The current test uses separate `teamMember` and `confirmedParticipant` actors, so it does not cover a confirmed participant who also has admin or workspace access.

**Fix:** Centralize all effective read paths in one helper: owner, org admin/owner, workspace membership, canonical and legacy recipient shares, active grants, and Phase 38 policy access. Use that helper for RLS, discovery, and request rejection. Add combined-role tests for confirmed participant plus admin, workspace member, and active share recipient.

### HI-03: Cross-organization routing trusts an arbitrary target workspace UUID

**Files:**

- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:491-526`
- `supabase/migrations/20260919000004_phase38_copy_event_preservation.sql:635-652`
- `supabase/functions/apply-routing-rules/index.ts:223-240`
- `supabase/functions/_shared/connector-pipeline.ts:759-770`

**Issue:** `route_recording_cross_org()` validates only that `p_user_id` belongs to the source and target organizations. When a target workspace is supplied, the definer function inserts the copied recording into that workspace without checking that the workspace belongs to `p_target_org_id` or that the user belongs to it. The service-role callers pass workspace IDs sourced from routing configuration. A stale or tampered destination can therefore place a copied recording into an unrelated workspace and expose it to that workspace's members.

**Fix:** Resolve the workspace organization inside the RPC, require it to equal `p_target_org_id`, and require `is_workspace_member(p_target_workspace_id, p_user_id)` before inserting or removing workspace entries. Add negative tests for a workspace in another org and a target-org workspace the user cannot access.

## Medium Severity

### ME-01: Participant evidence remains affirmative after its supporting source is removed

**File:** `supabase/migrations/20260919000001_phase38_access_policy_schema.sql:88-116`

**Issue:** The normalization trigger sets `role` and `has_confirmed_speech` for positive evidence, but it has no branch that clears values when an update removes transcript, host, or calendar evidence. A row that was once a speaker can remain `has_confirmed_speech = true` after its speaker evidence is corrected or removed. Discovery and access checks then continue trusting stale evidence.

**Fix:** Recompute the derived fields deterministically on every relevant insert or update, including a safe neutral state. If callers may provide manual evidence, store evidence provenance separately so the trigger clears only values it derived. Add an update test that removes transcript evidence and proves confirmed-participant access disappears.

### ME-02: Revoked access returns to discovery with an `approved` request status

**Files:**

- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:457-482`
- `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:898-913`

**Issue:** Revocation marks only the grant as revoked. The discovery RPC returns the latest request status without checking whether its corresponding grant remains active. After revocation, the caller loses access and the anonymous copy reappears, but its status remains `approved` rather than returning to a requestable state. The backend permits a new request, so the API response and lifecycle semantics disagree.

**Fix:** Return `approved` only while an active grant exists. Otherwise normalize the discovery state to requestable, or return an explicit active-grant state that the UI can interpret. Add a request -> approve -> revoke -> rediscover -> request-again integration test.

### ME-03: Initial settings query failures render an endless loading skeleton

**Files:**

- `src/components/settings/PrivacyAccessSettings.tsx:132-147`
- `src/components/settings/__tests__/PrivacyAccessSettings.test.tsx:109-115`

**Issue:** The component checks `selectedLevel === null` before `accountDefault.isError`. On an initial query failure, data is absent and `selectedLevel` remains null, so the loading skeleton wins and the error/retry UI is unreachable. The current error test retains mocked data and does not represent a first-load failure.

**Fix:** Render the error state before the null/loading branch, or show the skeleton only while `isLoading` is true. Test `{ data: undefined, isLoading: false, isError: true }` and assert that Retry is visible and functional.

### ME-04: Owners cannot manage surviving legacy-only share links from the Share dialog

**Files:**

- `src/services/sharing.service.ts:83-95`
- `supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql:22-46`
- `supabase/migrations/20260919000003_phase38_share_link_uuid_bridge.sql:137-184`

**Issue:** The migration deliberately preserves unresolved or ambiguous legacy-only share rows with `recording_id IS NULL`. The owner-facing list query filters only on the canonical `recording_id`, so those still-valid tokens disappear from the Share dialog and cannot be revoked there. Recipient resolution retains a safe owner-scoped legacy fallback, making this an asymmetric compatibility gap.

**Fix:** Add an owner-scoped bridge-aware list RPC or Edge route that returns canonical rows plus uniquely resolved legacy rows. Provide a separate safe management path for unresolved or ambiguous tokens rather than attaching them to an arbitrary recording. Add owner list/revoke coverage for a legacy-only token.

### ME-05: The claimed six-level access matrix is not exercised by the real-database suite

**File:** `src/test/access-policy.integration.test.ts:226-240`

**Issue:** The loop described as six-level coverage proves only that the setter accepts each enum string and returns it. It does not verify which actors can read content under each policy. The only multi-actor content matrix is for `private` at lines 639-682. This gap allowed the UUID-share and combined-role authorization defects above to pass.

**Fix:** Add a parameterized real-database matrix covering owner, admin, workspace member, confirmed speaker, invitee-only participant, active grant recipient, UUID share recipient, and unrelated user across all six levels, with both positive and negative assertions.

## Low Severity

### LO-01: Anonymous copy ordinals can contain gaps and expose hidden ordering

**File:** `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:457-482`

**Issue:** `row_number()` is calculated across every event copy before accessible copies are filtered. If a caller can read the first copy but not the second, discovery returns only “Recording 2.” This conflicts with the anonymous sequential-row UI and reveals ordering/count information about filtered copies.

**Fix:** Filter to inaccessible copies in the inner query, then calculate `row_number()` over the remaining anonymous rows.

### LO-02: Oversized Zoom type metadata raises instead of failing closed to `unknown`

**File:** `supabase/migrations/20260919000002_phase38_access_policy_rls_rpcs.sql:93-100`

**Issue:** The regex accepts an arbitrarily long digit string, then casts it to `INTEGER`. A syntactically numeric but out-of-range JSON value raises an exception and aborts discovery/request RPCs instead of producing the documented neutral `unknown` classification.

**Fix:** Compare the JSON text to an allowlist without an integer cast, cast to `NUMERIC`, or add a safe range/length guard. Add malformed and out-of-range provider fixtures.

## Verified Areas

- All Phase 38 `SECURITY DEFINER` functions reviewed pin `search_path = ''`, schema-qualify referenced objects, revoke broad execution, and grant only intended roles. The defects above concern authorization semantics inside otherwise hardened functions.
- The public-recording endpoint returns only the five allowlisted fields and does not widen raw table RLS. Missing, malformed, and non-public identifiers use a generic denial response.
- MCP share create/list/revoke tools preserve markdown in `content[].text`; no structured JSON result regression was found.
- The migrated frontend sharing and access-policy code follows service + TanStack Query hook separation. No new UUID/BIGINT numeric coercion was found in the reviewed paths.
- Recording policy mutations call `invalidateCallListCaches()` in `onSettled`.
- Account defaults are snapshotted for future recordings only; changing the setting does not rewrite existing rows.
- `event_id` is preserved in all three copy paths, while the destination recording receives its own default access policy.
- The integration setup includes a hard-coded production project-ref refusal and rejects production/test key equality.
- Webinar and 50-or-more-participant suppression has positive, negative, malformed, and 49/50 boundary coverage. The oversized numeric cast is the remaining provider-classification defect.
- Expected-failure markers found for the request panel, other-copy UI, notification UI, and request-flow suite belong to unfinished Plans 38-11/38-13. No completed-plan expected-failure marker was treated as passing coverage.

---

_Reviewer: gsd-code-reviewer interim review_  
_No application source was modified._
