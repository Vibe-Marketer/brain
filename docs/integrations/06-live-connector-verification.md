# Live Connector Verification

Use this runbook after deploying connector changes. It intentionally stores no
provider credentials in the repo.

## Local Contract Gate

```bash
npm run type-check
npm test -- src/lib/__tests__/connector-lifecycle-readiness.test.ts src/components/connectors/registry/__tests__/connectorRegistry.test.ts
```

This proves the registry, adapters, edge-function metadata, webhook receivers,
selective import, and the Plaud exception are internally consistent.

## Deployed Edge Function Reachability

```bash
npm run verify:connectors:live
```

The script reads `SUPABASE_URL` or `VITE_SUPABASE_URL`, then checks every edge
function declared by `SOURCE_REGISTRY` with a safe `OPTIONS` request. It also
checks the public Read.ai and Grain webhook receiver health endpoints.

## Authenticated Read.ai and Grain Smoke

Read-only account state can be checked with service-role access. This does not
call provider APIs, but it verifies the real user has active source rows,
webhook routing state, source errors, and imported recordings:

```bash
CALLVAULT_USER_EMAIL='andrew@aisimple.co' npm run verify:connectors:live
```

After signing in as the test user, provide a short-lived user JWT from the
browser session:

```bash
CALLVAULT_USER_JWT='eyJ...' npm run verify:connectors:live
```

Optional source IDs make the checks exact when more than one account row exists:

```bash
CALLVAULT_USER_JWT='eyJ...' \
REDAI_SOURCE_ID='import_sources uuid' \
GRAIN_SOURCE_ID='import_sources uuid' \
npm run verify:connectors:live
```

This invokes:

- `read-ai-fetch-meetings`
- `grain-fetch-recordings`
- `read-ai-webhook-settings` when `REDAI_SOURCE_ID` is set

If the user has not connected a provider yet, the script reports that check as
`SKIP` with the provider's real response.

## Mutating Grain Webhook Registration

Grain hook registration creates or reuses provider-side hooks. Run it only when
you are ready to verify the real Grain account:

```bash
CALLVAULT_USER_JWT='eyJ...' \
GRAIN_SOURCE_ID='import_sources uuid' \
LIVE_CONNECTOR_MUTATE=1 \
npm run verify:connectors:live
```

Then trigger or wait for a Grain `recording_added` / `recording_updated` event
and confirm the recording appears in CallVault.

## Manual Provider Checks

Read.ai:

- Confirm OAuth connect opens Read.ai and returns to `/oauth/callback/read-ai`.
- Search a recent date range in the import wizard.
- Save the Read.ai webhook URL/signing key in the shared setup panel.
- Send a Read.ai test webhook and confirm the setup panel marks it received.
- Confirm the imported call has `source_app = read-ai`.

Grain:

- Confirm OAuth connect opens Grain and returns to `/oauth/callback/grain`.
- Search a recent date range in the import wizard.
- Import one selected recording into a workspace.
- Run the mutating verifier above to register hooks.
- Trigger or wait for a Grain hook and confirm `source_app = grain`.
- Disconnect Grain and verify provider hooks are cleaned up or cleanup errors
  are recorded in `import_sources.connection_metadata`.

Protected regression after live checks:

```bash
npm test -- \
  src/components/connectors/registry/adapters/__tests__/zoom.test.ts \
  src/components/connectors/registry/adapters/__tests__/plaud.test.ts \
  src/components/connectors/registry/adapters/__tests__/fathom.test.ts \
  src/lib/__tests__/fireflies-import.test.ts \
  supabase/functions/fireflies-webhook/__tests__/signature.test.ts \
  supabase/functions/_shared/__tests__/fireflies-connector.test.ts \
  supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts \
  supabase/functions/fathom-refresh/__tests__/fathom-refresh.test.ts \
  supabase/functions/fathom-reconcile/__tests__/fathom-reconcile.test.ts \
  supabase/functions/fathom-oauth-callback/__tests__/oauth-callback-backfill.test.ts
```
