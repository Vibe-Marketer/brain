# Phase 38 Dedicated Test Recording-Access Evidence

## Execution identity

- **Captured:** 2026-09-19
- **Worktree branch:** `worktree-agent-phase38-11`
- **Source commit before deployment:** `222f558c967b3018bf0f5a3881ea650360b6f5db`
- **Function source SHA-256:** `b54b53e93602f41f34e20ddf6f8c5f3046111618cc586bd4237292c75e44f4cb`
- **Supabase CLI:** `2.101.0`
- **Dedicated test ref:** `swjzxiddcrtaqixsfaac`
- **Production ref rejected by every write guard:** `vltmrnjsubfzrgrtdqey`

## Target guard and deployment

The local CLI started and finished linked to production. A normal `supabase link`
attempt for the test project could list the project but lacked permission to reveal
its API keys, so no linked command was used as a fallback. The deploy and test-secret
writes instead supplied the dedicated test ref explicitly inside fail-closed commands.

Two independent checks ran before deployment:

1. The shell constant was exactly `swjzxiddcrtaqixsfaac` and was asserted unequal
   to `vltmrnjsubfzrgrtdqey`.
2. `supabase projects list --output json` contained the exact
   `swjzxiddcrtaqixsfaac` project row.

Deployment used the required API bundler and function-level JWT verification:

```text
DEPLOY_TARGET_CHECK_1=swjzxiddcrtaqixsfaac
DEPLOY_TARGET_CHECK_2=swjzxiddcrtaqixsfaac
Uploading asset (recording-access): supabase/functions/recording-access/index.ts
Uploading asset (recording-access): supabase/functions/_shared/html-escape.ts
Uploading asset (recording-access): supabase/functions/_shared/cors.ts
Uploading asset (recording-access): supabase/functions/_shared/auth.ts
Deployed Functions on project swjzxiddcrtaqixsfaac: recording-access
```

Final test metadata:

```json
{"name":"recording-access","version":3,"status":"ACTIVE","verify_jwt":false,"updated_at":1789847184439}
```

The function was deployed with `--use-api --no-verify-jwt`. Authentication remains
mandatory inside the function through
`authenticateRequest(req, authClient, corsHeaders)`.

## Safe email-provider modes

The dedicated test project used `RECORDING_ACCESS_EMAIL_TEST_MODE`. The function
honors this switch only when `SUPABASE_URL` has the exact dedicated-test hostname.
It is ignored by production and cannot weaken production email delivery.

- `success` proves one successful outbox claim and retry idempotency without sending
  to an external recipient.
- `failure` proves provider-failure durability without making an external provider
  call.
- Every synthetic fixture address uses the reserved `.invalid` top-level domain.
- The final dedicated-test setting was restored to `success`.

## Focused real-function proof

With success mode active, all six live function tests passed:

```text
Test Files  1 passed (1)
Tests       6 passed (6)
```

The cases proved:

- no JWT returns 401;
- an invalid JWT returns the same generic 401 without request/owner/recording/email
  disclosure;
- an authenticated non-party receives the generic
  `REQUEST_NOT_AVAILABLE` response;
- any browser-supplied owner email, requester name, meeting title, or evidence makes
  the strict request schema return `INVALID_REQUEST`;
- the function loads the requester's verified identity, owner recipient, meeting
  title/date, and participant evidence only from database state;
- HTML metacharacters in the trusted requester snapshot and recording title are
  escaped in the persisted provider payload;
- two valid invocations leave exactly one outbox row with
  `status=sent` and `attempt_count=1`.

With failure mode active, the dedicated failure test passed and asserted:

```text
HTTP status:       202
response status:   delivery_pending
outbox status:     failed
attempt_count:     1
last_error:        EMAIL_PROVIDER_UNAVAILABLE
next_attempt_at:   populated
request row:       preserved
owner notification: preserved
requested audit:   preserved
```

The outbox stores only a bounded generic error. Function logs contain neither email,
meeting evidence, nor content. Provider sends use the durable database idempotency key
as the Resend `Idempotency-Key` header.

## Complete serial integration gate

`npm run test:integration` ran after the final success-mode restoration:

```text
Test Files  33 passed | 1 skipped (34)
Tests       236 passed | 15 skipped (251)
Duration    160.08s
Exit        0
```

The 15 skips are the existing save-pasted-transcript live-deployment group. All
recording-access tests, Phase 38 database lifecycle tests, RLS tests, share tests, and
copy/event-preservation tests ran in the serial suite.

## Production isolation and final state

Production function inventory was captured before and after the test deployment:

```text
PROD_RECORDING_ACCESS_BEFORE=absent
PROD_RECORDING_ACCESS_AFTER=absent
FINAL_LINK=vltmrnjsubfzrgrtdqey
```

No production function, migration, secret, frontend, or data was changed. The deploy
temporarily rewrote `deno.lock` and a generated Supabase temp version file during
server-side bundling; both were restored exactly, leaving no package or lockfile diff.
