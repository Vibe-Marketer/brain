---
phase: 38-access-policy-share-link-key-migration-request-flow
plan: "15"
verified_at: 2026-09-19T23:25:47Z
branch: v2.2-event-resolution
target: dedicated-test-supabase
target_ref: swjzxiddcrtaqixsfaac
production_ref_rejected: vltmrnjsubfzrgrtdqey
status: pass
---

# Phase 38 Preproduction Verification

Phase 38 was verified from the clean committed feature-branch tree against the dedicated TEST Supabase project. No production database command, linked database query, frontend deployment, merge to `main`, or production mutation was performed.

Verified application source commit: 345b8fef0d1324281a5d5203bd7665da2f898e77
Verified application source fingerprint: 3e006ebf4857978ab3553c3209b5bf88f95be190

## Target and Source Guards

| Guard | Evidence | Result |
|---|---|---|
| Branch | `git branch --show-current` returned `v2.2-event-resolution` | PASS |
| Non-planning tree | Tracked, staged, and untracked non-planning paths were clean before the final gates | PASS |
| TEST project | Guarded database URL and browser configuration resolved to `swjzxiddcrtaqixsfaac` | PASS |
| Production rejection | Guards rejected `vltmrnjsubfzrgrtdqey`; no `supabase db query --linked` was used | PASS |
| Source fingerprint | `git ls-tree -r --full-tree HEAD \| sed '/\t\.planning\//d' \| git hash-object --stdin` returned the fingerprint above before and after verification | PASS |
| Lockfile | No dependency install occurred; test-run-only `deno.lock` noise was inspected and restored before final verification | PASS |

## Automated Gate Results

All commands below exited zero unless explicitly described as an accepted existing skip.

| Gate | Command | Result |
|---|---|---|
| Focused Phase 38 | `npm test -- src/test/migrations/phase38-access-migrations.test.ts src/types/__tests__/access-policy.test.ts src/types/__tests__/recording-access.test.ts src/services/__tests__/access-policy.service.test.ts src/services/__tests__/recording-access.service.test.ts src/services/__tests__/sharing.service.test.ts src/hooks/__tests__/useRecordingAccess.test.ts src/components/settings/__tests__/PrivacyAccessSettings.test.tsx src/components/sharing/__tests__/RecordingAccessPanel.test.tsx src/components/sharing/__tests__/ShareCallDialog.test.tsx src/components/call-detail/__tests__/CallDetailHeader.access.test.tsx src/components/call-detail/__tests__/OtherRecordingCopies.test.tsx src/components/notifications/__tests__/NotificationBell.test.tsx src/pages/__tests__/CallDetailPage.access.test.tsx src/pages/__tests__/PublicRecordingView.test.tsx supabase/functions/mcp-server/__tests__/sharing-uuid-bridge.test.ts supabase/functions/recording-access/__tests__/recording-access.integration.test.ts src/test/access-policy.integration.test.ts` | 16 files passed; 98 tests passed; 0 failed; exit 0 |
| Complete real-database integration | `SUPABASE_TEST_DB_URL=<guarded TEST URL> npm run test:integration` | 33 files passed, 1 file skipped; 250 tests passed, 15 skipped; exit 0; 166.52s |
| Complete unit suite | `npm test` | 280 files passed, 1 file skipped; 2,471 tests passed, 45 skipped; exit 0; 23.33s |
| Type check | `npm run type-check` | 0 new errors; recorded baseline remains 299/299; exit 0 |
| Lint | `npm run lint` | 0 errors; 129 existing warnings; no warning originates in either Plan 15 browser file; exit 0 |
| Production build | `npm run build` | 4,839 modules transformed; built in 7.61s; exit 0 |
| Chromium browser | `npx playwright test e2e/phase38-access.spec.ts --project=chromium --workers=1 --reporter=line,html --timeout=90000 --retries=0` | 18 Phase 38 tests passed; 0 failed; 0 skipped; exit 0 |

The integration runner executed Phase 38 fixture lifecycle, access-policy, RLS, data-movement, share-call, recording-access, and public-recording tests against real TEST Supabase. The only integration skip was the pre-existing 15-test `save-pasted-transcript` environment guard. The complete unit suite's skipped file was the pre-existing `useBulkApplyRules.test.ts`; no Phase 38 gate was skipped.

The provider matrix covered Zoom values 1 through 9, 99, null, malformed, oversized, and unknown future values; non-Zoom/internal sources; webinar-positive aggregation; neutral unknown combinations; verified participation; and independent 49/50 confirmed-participant boundaries. Authorization coverage included owner, organization admin, workspace/team member, coach, verified participant, invitee-only, active/revoked grant, UUID and legacy token, unrelated authenticated user, and anonymous access.

## Browser, Accessibility, and Privacy Evidence

The deterministic TEST-only fixture helper created isolated owner, confirmed-participant, unrelated-user, logged-out, provider, and 49/50 boundary data. Cleanup completed after the serial run. Vite was explicitly bound to TEST environment values, and the browser guard rejected the production ref.

The browser run exercised:

- all six account defaults and all six per-recording choices, including Public confirmation;
- inherited/custom state, reset to the current default, request/review/approve/deny/revoke/cooldown, and focused notification deep links;
- legacy and UUID share behavior, anonymous discovery, privacy-safe copy ordinals, and public allowlisted output;
- unknown and explicit non-webinar passage at 49, suppression at 50, and explicit webinar suppression;
- desktop Popover and narrow-mobile Dialog behavior, touch targets, reduced motion, focus, overflow assertions, and axe scans;
- response and DOM forbidden-field checks for owner, provider, protected title, transcript, summary, source identifiers, and analytics identifiers.

Named evidence captured and visually inspected:

- `test-results/phase38-evidence/settings-defaults.png`
- `test-results/phase38-evidence/access-desktop.png`
- `test-results/phase38-evidence/owner-review.png`
- `test-results/phase38-evidence/anonymous-copies.png`
- `test-results/phase38-evidence/access-mobile.png`
- `test-results/phase38-evidence/public-page.png`

The Settings, desktop Access, owner review, anonymous-copy, mobile Access, and Public page states match the Phase 38 UI contract. Axe found no serious or critical violations in the scanned Phase 38 surfaces. The public and discovery responses contained only their endpoint allowlists; `event_id` and `recording_id` remained permitted opaque endpoint identifiers, while protected owner/provider/content fields remained absent.

## TEST Database and Migration Evidence

`supabase migration list --db-url "$SUPABASE_TEST_DB_URL"` was run only after checking the URL for TEST ref `swjzxiddcrtaqixsfaac` and rejecting production ref `vltmrnjsubfzrgrtdqey`. TEST contains the exact Phase 38 sequence:

1. `20260919000001`
2. `20260919000002`
3. `20260919000003`
4. `20260919000004`
5. `20260919000005`
6. `20260919000006`
7. `20260919000007`
8. `20260919000008`

Read-only catalog transactions proved:

- `call_share_links.call_recording_id` is nullable BIGINT, `recording_id` is nullable UUID, `share_token` is non-null, and `call_share_links_has_recording_key` is validated;
- `recordings.access_level` is non-null with default `private`, `access_policy_origin` is non-null with default `default`, and `event_id` is nullable UUID;
- `user_settings.default_recording_access_level` is non-null with default `private`;
- all four required access/share check constraints exist;
- request, grant, audit, and email-outbox tables have RLS enabled and forced, with six lifecycle policies present;
- raw `recordings` has zero anonymous policies;
- all 27 required Phase 38 public function names and all three required triggers exist;
- corrected authorization, legacy share management, evidence recomputation, notification normalization/outbox contracts, and execution grants are present;
- all three preserved copy/routing implementations contain `event_id` handling and the integration suite proves exact preservation with independent destination policy.

### Integrity Counts

| Probe | Count |
|---|---:|
| Share rows with neither legacy nor UUID key | 0 |
| Orphan UUID share rows | 0 |
| Orphan access request rows | 0 |
| Orphan access grant rows | 0 |
| Duplicate pending request keys | 0 |
| Duplicate active grant keys | 0 |
| Unresolved owner-scoped backfills | 0 |
| Orphan recording `event_id` values | 0 |
| Orphan participant `event_id` values | 0 |

The UUID bridge inventory also returned zero unresolved and zero ambiguous rows. Event preservation was evaluated through orphan checks, catalog/function inspection, and real copy/routing integration assertions; a count of all historical recordings with null `event_id` is not an event-loss signal and was not used as one.

## Static Security and Review Reconciliation

| Check | Result |
|---|---|
| `parseInt` / `Number(` in Phase 38 sharing and recording-access identity paths | 0 hits |
| Direct `supabase.from`, `supabase.rpc`, or `supabase.functions` calls in changed UI surfaces | 0 hits |
| Anonymous raw-recording SELECT policy | 0 policies |
| MCP share result markdown `content[].text` contract | Present and tested |
| Phase 38 `it.fails` / `test.fails` | 0 hits |
| Phase 38 unconditional skips | 0; guarded integration suites ran with TEST DB available |
| Interim findings BL-01 through LO-02 | All fixed in `38-INTERIM-REVIEW-FIXES.md` and covered by the passing real-database, endpoint, component, static, and browser gates |

## Disposition

The committed non-planning tree, dedicated TEST schema, real-database behavior, browser flows, accessibility checks, privacy boundaries, source scans, and build are green. Plan 16 may use this evidence only while the recomputed non-planning fingerprint remains `3e006ebf4857978ab3553c3209b5bf88f95be190`. Any non-planning drift, target mismatch, or failed recheck changes this disposition to STOP.

PRODUCTION-GATE: PASS
