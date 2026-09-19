# Phase 38 Test Public Recording Evidence

**Recorded:** 2026-09-19  
**Deployment target:** `swjzxiddcrtaqixsfaac` (`callvault-test`)  
**Production target:** `vltmrnjsubfzrgrtdqey` (`callvault-ai`) — verified undeployed

## Target guard

Before deployment, the local CLI ref was `vltmrnjsubfzrgrtdqey`. The deploy command ran only after both checks identified the dedicated test project:

- `supabase/.temp/project-ref = swjzxiddcrtaqixsfaac`
- `supabase projects list` marked `swjzxiddcrtaqixsfaac` as the linked project
- the shell guard rejected any ref equal to `vltmrnjsubfzrgrtdqey`

The guarded deployment command was:

```text
supabase functions deploy public-recording --use-api --no-verify-jwt
```

Deployment output:

```text
Uploading asset (public-recording): supabase/functions/public-recording/index.ts
Uploading asset (public-recording): supabase/functions/_shared/cors.ts
Deployed Functions on project swjzxiddcrtaqixsfaac: public-recording
```

## Deployed artifact

| Field | Value |
|---|---|
| Function | `public-recording` |
| Function ID | `03345fdc-c686-48e9-bec9-6b440214e171` |
| Version | `1` |
| Status | `ACTIVE` |
| `verify_jwt` | `false` (anonymous gateway request is intentional; policy is enforced inside the function) |
| Source SHA-256 | `31c44ac9fe33eeba9895d14a72f9c5ca7228ddf79994159cf649c4a78487c2b4` |
| Bundled artifact SHA-256 | `525fd16de788f73e455420579e37a816d454ac57a4aa210679e65a7d1dd70310` |

## Live anonymous policy matrix

A disposable, isolated Phase 38 fixture was created in the dedicated test project, probed without an Authorization token, and fully cleaned afterward.

| Policy/case | HTTP | Response keys |
|---|---:|---|
| Private | 404 | `code`, `error` |
| Attendees | 404 | `code`, `error` |
| Invitees | 404 | `code`, `error` |
| Organization | 404 | `code`, `error` |
| Anyone with link | 404 | `code`, `error` |
| Public | 200 | `call_name`, `duration`, `full_transcript`, `recording_id`, `recording_start_time` |
| Missing UUID | 404 | `code`, `error` |

Every non-Public and missing case returned the same body:

```json
{
  "code": "RECORDING_NOT_AVAILABLE",
  "error": "This recording is not available."
}
```

The Public response contained exactly the five documented fields. It did not contain access policy, owner, organization, workspace, event, provider, source, summary, media, share, or participant fields.

A direct anonymous `recordings` table query for the fixture returned zero rows. No anonymous raw-table SELECT permission was added.

## Automated verification

Focused real-database suite:

```text
supabase/functions/public-recording/__tests__/public-recording.integration.test.ts
Test Files  1 passed (1)
Tests       7 passed (7)
```

Frontend and build gates:

```text
PublicRecordingView.test.tsx: 5 passed
TYPE CHECK PASSED: 0 new errors (319/321 baseline errors remain)
Focused ESLint: 0 errors
vite build: 4,828 modules transformed; build completed successfully
```

The first complete integration command was also executed while linked to TEST. The new public-recording suite passed all seven cases inside that run. The repository-wide command reported unrelated shared-fixture collisions while parallel Phase 38 executors were using the same dedicated project: foreign-key failures caused by another cleanup removing in-flight synthetic users/share rows, plus a Supabase auth request-rate limit. This is a parallel test-environment collision, not a failure of the public endpoint; the orchestrator should make one final serial full-suite run after the parallel wave is merged.

## Production non-deployment and final relink

A read-only `supabase functions list --project-ref vltmrnjsubfzrgrtdqey` check confirmed that `public-recording` is absent from production.

The CLI was then relinked without deploying:

```text
FINAL_LINKED_PROJECT=vltmrnjsubfzrgrtdqey
PRODUCTION_PUBLIC_RECORDING=ABSENT
```

No production function, migration, frontend, or data mutation was performed by Plan 38-08.
