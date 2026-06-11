# Phase 12 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed — not caused by this phase's changes).

## Pre-existing integration-suite failures (NOT phase 12)

Discovered while running `npm run test:integration` for 12-03. Two integration suites fail at their own `beforeAll` donor-recording setup, independent of any phase-12 change:

- `supabase/functions/share-call/__tests__/share-call.integration.test.ts` — `Integration setup failed — no donor recording found: undefined` (share-call.integration.test.ts:72)
- `supabase/functions/auto-tag-calls/__tests__/auto-tag-calls.integration.test.ts` — same donor-recording setup error (auto-tag-calls.integration.test.ts:41)

Root cause (likely): the TEST project (`swjzxiddcrtaqixsfaac`) has no seeded donor recording row that these suites expect. Phase-12 tests do not depend on donor recordings (they seed their own temp rows). These failures predate and are orthogonal to Sentry ingestion. Owner: whoever maintains the share-call / auto-tag-calls integration fixtures.

`sentry-webhook.integration.test.ts` passes 3/3 both in isolation and within the full parallel run.
