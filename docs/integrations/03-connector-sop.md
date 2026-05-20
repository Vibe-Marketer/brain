# UNIVERSAL CONNECTOR SOP — EXACT BUILD PROCEDURE

This is NOT a "general framework." It is an **exact, step-by-step procedure** to add any new call/transcript source to CallVault. Follow the steps in order. Skip a step → explain why in your commit message.

**Audience:** Engineer building a new connector after Fathom + Zoom.
**Prerequisites:** Pipeline fixes F-01 through F-05 from `01-connector-pipeline-vet.md` applied. Without those this SOP creates the same bugs across every new connector.

---

## SOP-0: BEFORE YOU START

Answer in writing (paste into your design doc / PR description):

1. **Does the platform have an official, documented API?** YES/NO.
2. **Auth model:** OAuth2 / OAuth2+PKCE / API key (Bearer) / API key (custom header) / OTP→JWT / None.
3. **Sync model:** Webhook only / Webhook+poll / Poll only / Manual upload.
4. **Tier required by the customer's platform plan** (e.g., GHL Unlimited, Fireflies Business). Surface this in CallVault connect UI.
5. **Rate limit ceiling.** Numeric.
6. **Media file delivery:** Direct stream / Signed URL with TTL (specify hours) / Auth-gated permanent URL.
7. **Transcript availability:** Sync / Async / Optional add-on / None (we transcribe).
8. **Webhook signature scheme:** HMAC-SHA256 / Ed25519 / RSA / Unknown.
9. **External ID stability:** Is `external_id` stable across edits? (Most are; some platforms regenerate IDs on edit.)
10. **Multi-tenant model:** One token per user / One token per "location/sub-account" / One token per org.

If 9 of 10 answers aren't crisp, you haven't researched enough. Stop and finish §2 of the per-platform spec before writing code.

---

## SOP-1: REGISTER + STORE CREDENTIALS

### For OAuth platforms

```
1. Register an app at <platform>'s developer portal.
   - Redirect URI: https://app.callvaultai.com/auth/<platform>/callback
   - Sandbox redirect: https://localhost:3001/auth/<platform>/callback (and add your local dev domain)
2. Capture CLIENT_ID + CLIENT_SECRET.
3. Add Supabase secrets:
   supabase secrets set <PLATFORM>_CLIENT_ID=...
   supabase secrets set <PLATFORM>_CLIENT_SECRET=...
4. Document required scopes in 02-platform-specs.md.
```

### For API-key platforms

```
1. Document where the user generates their key in the platform's UI.
2. Build a "Connect <platform>" UI: single key input + "Test connection" button.
3. Validate the key with a cheap read API call before storing.
4. Store via store_encrypted_oauth_tokens RPC (oauth_access_token=key, oauth_refresh_token=NULL, oauth_token_expires=NULL).
```

### For "no API" platforms (Mojo today)

```
1. Build a manual import UI (multipart CSV+ZIP).
2. Validate file shape with Zod before parsing.
3. Skip steps SOP-2, SOP-3, SOP-5, SOP-6 below — jump to SOP-7.
```

---

## SOP-2: BUILD THE PLATFORM HTTP CLIENT

Path: `supabase/functions/_shared/<platform>-client.ts`

Copy the structure of `_shared/zoom-client.ts`. Required static methods:

```ts
export class <Platform>Client {
  static readonly BASE_URL = '...';
  static readonly OAUTH_URL = '...';
  static readonly OAUTH_SCOPES = '... ... ...';   // OAuth platforms

  static async fetchWithRetry(url: string, options): Promise<Response> {
    // Exponential backoff on 429 + 5xx. Copy zoom-client.ts shape.
  }

  static async apiRequest(path: string, accessToken: string, options): Promise<Response> {
    // Set Bearer header (or platform-specific auth header). Set platform-specific
    // version header if required (e.g., Grain's Public-Api-Version).
  }

  // OAuth platforms only:
  static async exchangeCodeForTokens(code, clientId, clientSecret, redirectUri): Promise<Response>;
  static async refreshAccessToken(refreshToken, clientId, clientSecret): Promise<Response>;
  static generateAuthorizationUrl(clientId, redirectUri, state, extraParams?): string;
}
```

**Hard rules:**
- All retries go through `fetchWithRetry`, not direct `fetch`.
- All API calls go through `apiRequest`, never call `fetch` directly from sync code.
- Platform-specific mandatory headers (e.g., Grain's `Public-Api-Version: 2025-10-31`) MUST be set inside `apiRequest`, not at the call site.

---

## SOP-3: BUILD THE OAUTH FUNCTIONS (OAUTH PLATFORMS ONLY)

Create 3 Edge Functions in order:

### `<platform>-oauth-url/index.ts`
- Generate `state` (cryptographic random 32 chars)
- For PKCE platforms: generate `code_verifier` + `code_challenge` (S256)
- Store `state` + `code_verifier` in `oauth_states` table (TTL 10 min)
- Return `{ url: <Platform>Client.generateAuthorizationUrl(...) }`

### `<platform>-oauth-callback/index.ts`
- Receive `code` + `state` from redirect
- Validate state, fetch `code_verifier` from `oauth_states`, delete state row
- Call `<Platform>Client.exchangeCodeForTokens(...)`
- Call `store_encrypted_oauth_tokens` RPC with `(source_id, user_id, access_token, refresh_token, expires_at, encryption_key)`
- Upsert `import_sources` row: `(user_id, source_app, account_email, is_active=true)`

### `<platform>-oauth-refresh/index.ts`
- Read encrypted tokens via `getDecryptedOAuthTokens(supabase, sourceId, userId)`
- Call `<Platform>Client.refreshAccessToken(refresh_token, ...)`
- Re-store via `store_encrypted_oauth_tokens`

**Schedule:** `<platform>-oauth-refresh` runs as a Supabase scheduled function at the right cadence (Fathom every 30d, Zoom every 1h, GHL every 22h, Teams every 50min, etc).

---

## SOP-4: BUILD THE WEBHOOK RECEIVER (IF SUPPORTED)

Path: `supabase/functions/<platform>-webhook/index.ts`

```ts
import { runPipeline } from '../_shared/connector-pipeline.ts';
import { verifyHmacSha256, verifyEd25519 } from '../_shared/webhook-verify.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // 1. Read raw body BEFORE parsing (signature is over raw bytes)
  const rawBody = await req.text();

  // 2. Verify signature — fail closed on missing/invalid sig
  const sigOk = await verifyHmacSha256({ /* or verifyEd25519 */
    payload: rawBody,
    signatureHeader: req.headers.get('x-platform-signature') ?? '',
    secret: Deno.env.get('<PLATFORM>_WEBHOOK_SECRET') ?? '',
  });
  if (!sigOk) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 3. Parse event
  const event = JSON.parse(rawBody);

  // 4. Validate event type — early return for events we don't care about (still 200)
  if (event.type !== 'recording_added' && event.type !== 'InboundMessage') {
    return new Response('OK', { status: 200 });
  }

  // 5. Identify user (find import_sources row matching webhook context)
  const userId = await resolveUserFromWebhook(supabase, event);
  if (!userId) {
    console.warn(`[<platform>-webhook] No user matched for event`, event);
    return new Response('OK', { status: 200 }); // 200 prevents platform retries
  }

  // 6. Fetch missing data (transcript / media) if not in webhook payload
  const fullRecording = await fetchAdditionalContext(event, accessToken);

  // 7. Build ConnectorRecord
  const record: ConnectorRecord = { /* per-platform mapping from §02 spec */ };

  // 8. Run pipeline
  const result = await runPipeline(supabase, userId, record);

  // 9. Persist audit row
  await supabase.from('sync_job_items').insert({
    sync_job_id: null,
    external_id: record.external_id,
    outcome: result.success ? 'synced' : (result.skipped ? 'skipped' : 'failed'),
    error_message: result.error,
    recording_id: result.recordingId,
  });

  return new Response('OK', { status: 200 });
});
```

**Hard rules:**
- **Read raw body BEFORE parsing.** Signature is over raw bytes, not pretty-printed JSON.
- **Always return 200** unless signature failed — platform retries on non-2xx will hammer your endpoint.
- **Webhook timeout typically ≤ 3 seconds (RingCentral, Microsoft).** Do the minimum work synchronously; queue heavy work (media download, transcription).

---

## SOP-5: BUILD THE SYNC FUNCTION (FOR BACKFILL + RECONCILIATION)

Path: `supabase/functions/<platform>-sync-meetings/index.ts`

```ts
Deno.serve(async (req) => {
  const { userId } = await authenticateRequest(req);
  const { backfill_until, cursor } = await req.json();

  // 1. Get token (refresh if near expiry)
  const tokens = await getDecryptedOAuthTokens(supabase, sourceId, userId);
  // ... refresh if needed

  // 2. Create sync_jobs row
  const syncJob = await supabase.from('sync_jobs').insert({
    user_id: userId, source_app: '<platform>', status: 'running'
  }).select().single();

  let pageCursor = cursor;
  let synced = 0, skipped = 0, failed = 0;

  // 3. Loop with cursor / page / offset
  while (true) {
    const page = await <Platform>Client.listRecordings(tokens.access_token, {
      cursor: pageCursor,
      since: backfill_until,
      limit: 50,
    });

    for (const item of page.items) {
      // 4. Fetch what the list endpoint didn't include (transcript, etc.)
      const full = await <Platform>Client.getRecording(tokens.access_token, item.id);

      // 5. Map to ConnectorRecord (per-platform §02 spec)
      const record = mapToConnectorRecord(full);

      // 6. Run pipeline
      const result = await runPipeline(supabase, userId, record);

      // 7. Audit row
      await supabase.from('sync_job_items').insert({
        sync_job_id: syncJob.id,
        external_id: record.external_id,
        outcome: outcomeFromResult(result),
        recording_id: result.recordingId,
      });

      if (result.success) synced++;
      else if (result.skipped) skipped++;
      else failed++;

      // 8. Rate-limit yield (per-platform value)
      await sleep(1000 / RATE_LIMIT_RPS);
    }

    // 9. Cursor advance
    if (!page.next_cursor) break;
    pageCursor = page.next_cursor;
  }

  // 10. Mark sync_jobs complete
  await supabase.from('sync_jobs').update({
    status: 'complete', synced_count: synced, skipped_count: skipped, failed_count: failed,
    completed_at: new Date().toISOString(),
  }).eq('id', syncJob.id);

  return new Response(JSON.stringify({ syncJob }), { headers: corsHeaders });
});
```

**Hard rules:**
- Always create a `sync_jobs` row, even for one-recording syncs. Forensics matter.
- Update `import_sources.last_sync_at` on completion.
- Pass `backfill_until` from caller — never hardcode.

---

## SOP-6: WEBHOOK REGISTRATION (POST-CONNECT)

Some platforms (Grain, Teams, RingCentral) require API-driven webhook/subscription registration. Some (Fireflies, GHL) use UI-driven registration with a static URL.

For API-driven: build a `<platform>-create-subscription` Edge Function called immediately after `<platform>-oauth-callback` succeeds.

For UI-driven: provide a copy-paste URL in CallVault's connect screen + instructions.

**Schedule renewal for time-limited subscriptions:**
- Teams: scheduled function at 80% of expirationDateTime
- RingCentral: same pattern

---

## SOP-7: FRONTEND CONNECT FLOW

Path: `src/components/import-hub/<Platform>Connector.tsx`

Required UI surfaces:
1. **Connect button** — OAuth: redirect to `/api/<platform>-oauth-url`. API-key: open modal.
2. **Connection status** — pulled from `import_sources` row (`is_active`, `account_email`, `last_sync_at`, `error_message`).
3. **Sync now button** — POST to `/api/<platform>-sync-meetings` with optional `backfill_until`.
4. **Disconnect button** — sets `is_active=false`, clears tokens.
5. **Error banner** — shows `error_message` from `import_sources` (e.g., "Token expired — reconnect").
6. **Tier badge** — surfaces the required plan ("Requires GHL Unlimited or higher").

Hook layer: `src/hooks/use<Platform>Source.ts` using TanStack Query + service in `src/services/<platform>Service.ts` per the locked-in service/hook split (root `CLAUDE.md`).

---

## SOP-8: TESTING — MANDATORY GATES

Before merging to main, must pass:

### Unit tests
- `<platform>-client.test.ts` — fetchWithRetry handles 429, network error, exponential backoff
- `<platform>-webhook.test.ts` — signature verify happy path + 5 tamper cases
- ConnectorRecord mapping — fixture-based, all required fields populated

### Integration tests
- `<platform>-sync.integration.test.ts` (real platform account, gated on env var):
  - Connect → list 5 recordings → verify they appear in `recordings` table with correct fields
  - Duplicate run → verify 0 new, 5 skipped
  - Disconnect → reconnect → verify token refresh works

### RLS regression
- Run `npx vitest run src/test/rls-regression.test.ts` to confirm cross-org isolation still holds.

### Manual QA
- Connect from frontend, run sync, verify in UI that recording appears with transcript + media.
- Use **Interceptor skill** to verify the connect-flow UX (mandatory per global rules).

---

## SOP-9: DEPLOY

```bash
# Single function deploy
supabase functions deploy <platform>-oauth-url --use-api
supabase functions deploy <platform>-oauth-callback --use-api
supabase functions deploy <platform>-oauth-refresh --use-api
supabase functions deploy <platform>-sync-meetings --use-api
supabase functions deploy <platform>-webhook --use-api
supabase functions deploy <platform>-create-subscription --use-api  # if applicable

# Or all at once
supabase functions deploy --use-api
```

**Verify** by hitting each function's URL with curl + reading logs in Supabase dashboard. Don't claim "deployed" until you see a successful test invocation.

---

## SOP-10: DOCUMENTATION

Every new connector ships with:

1. Updated `02-platform-specs.md` section if anything diverged from the original spec.
2. New entry in `docs/operations/connector-runbook-<platform>.md` covering:
   - How to rotate credentials
   - Common error states (expired token, rate limited, missing scope) and fixes
   - Customer-facing error messages and resolution steps
3. Updated frontend connect-screen copy with tier requirements + estimated setup time.

---

## SOP-11: POST-LAUNCH MONITORING

For the first 14 days after a new connector ships:

1. **Daily check:** `sync_job_items` table — count `outcome='failed'` per source_app per day. >1% failure rate triggers investigation.
2. **Daily check:** `import_sources.error_message IS NOT NULL` per source_app — count of broken connections.
3. **Weekly check:** Rate-limit headers logged via Langfuse — alert if remaining < 20% of limit for any 5-min window.
4. **Cost check:** New connector should not increase Supabase Storage spend by more than expected — verify media-download volume against expectations.

---

# THE 4-LAYER MENTAL MODEL

Every connector reduces to 4 layers. If your design doesn't fit, you're inventing complexity:

```
┌────────────────────────────────────────────────────────────────────┐
│  Layer 4 — Pipeline (UNIVERSAL, FIXED)                             │
│  ConnectorRecord → checkDuplicate → routing → insertRecording      │
│  Lives in _shared/connector-pipeline.ts                            │
│  Same for ALL connectors — never per-platform.                     │
└────────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌────────────────────────────────────────────────────────────────────┐
│  Layer 3 — Mapping (PER-PLATFORM, PURE FUNCTION)                   │
│  Takes raw platform payload → returns ConnectorRecord              │
│  Lives in <platform>-sync-meetings / <platform>-webhook            │
│  No I/O, no DB calls, no async — just data transformation.         │
└────────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌────────────────────────────────────────────────────────────────────┐
│  Layer 2 — Client (PER-PLATFORM, STATIC METHODS)                   │
│  Auth headers, rate limit, retry, version pinning                  │
│  Lives in _shared/<platform>-client.ts                             │
│  No business logic — pure HTTP transport.                          │
└────────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌────────────────────────────────────────────────────────────────────┐
│  Layer 1 — Auth (PER-PLATFORM)                                     │
│  OAuth dance / API-key validation / OTP / manual upload            │
│  Lives in <platform>-oauth-* / save-<platform>-key                 │
│  One-time per user. Stores via store_encrypted_oauth_tokens.       │
└────────────────────────────────────────────────────────────────────┘
```

**Anti-patterns to refuse in code review:**
- Layer 2 (client) doing DB calls → reject.
- Layer 3 (mapping) making API calls → reject.
- Layer 4 (pipeline) knowing about a specific source → reject (this is what F-04 fixes).
- Custom dedup logic in a connector → reject. Always use `runPipeline`.

---

## CHECKLIST — SHIP CRITERIA PER CONNECTOR

Copy this into your PR description. Every box must be checked.

```
[ ] §02 platform spec section written and reviewed
[ ] OAuth app registered (or API-key flow built)
[ ] _shared/<platform>-client.ts implemented + unit tests pass
[ ] OAuth functions deployed and connect flow works end-to-end (or API-key alternative)
[ ] Webhook receiver implemented with signature verification (when applicable)
[ ] Sync function implements cursor-based pagination
[ ] ConnectorRecord mapping covers all fields in the §02 spec
[ ] runPipeline integration verified — new + duplicate + re-import cases
[ ] sync_job_items audit rows written for every recording
[ ] Frontend connect UI built, tier badge present, error states handled
[ ] Integration test with real account passes
[ ] RLS regression test still passes
[ ] Runbook entry added in docs/operations/
[ ] Sentry/Langfuse alerts configured for >1% failure rate
[ ] Customer support team briefed on the new connector
[ ] Tier requirement surfaced in CallVault marketing / pricing pages
```

If you check all 16 boxes the connector is genuinely ready for customers. If you skip even one, expect to ship a hotfix in the first 48 hours.
