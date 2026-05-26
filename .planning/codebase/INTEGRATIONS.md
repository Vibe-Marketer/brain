# External Integrations

**Analysis Date:** 2026-05-26

## 1. OpenAI

### Purpose
- Used for audio transcription of directly uploaded audio files (up to 25MB).
- Historically used for vector embeddings (`text-embedding-3-small` with 1536 dimensions), but the vector embedding pipeline is currently **disabled** in the sync flows (`// [DISABLED] Embedding system disabled — pipeline broken` in `supabase/functions/sync-meetings/index.ts` and `supabase/functions/zoom-sync-meetings/index.ts`).

### Configuration & Credentials
- **Provider Key:** `OPENAI_API_KEY` (Supabase Secrets)
- **Model:** `whisper-1` for transcription.

### Integration Points
- **Transcription Service:** `supabase/functions/file-upload-transcribe/index.ts` fetches `https://api.openai.com/v1/audio/transcriptions` directly.

### Data Flow & Payload
1. Client uploads an audio file via the dashboard to Supabase Storage.
2. Client invokes the `file-upload-transcribe` edge function.
3. The function downloads the audio chunk from Storage and posts it as a `multipart/form-data` request containing the audio file, target language code, and instructions to OpenAI's Whisper endpoint.
4. The transcription response text is forwarded to the `runPipeline` wrapper to insert a new canonical recording.

### Risk & Performance Assessment
- File upload is limited to 25MB by OpenAI's Whisper API limit. Large files are handled via client-side/server-side pre-processing or validation checks.
- If the OpenAI key is invalid, direct file-upload transcriptions will fail immediately.

---

## 2. OpenRouter (LLM Gateway)

### Purpose
- Serves as the primary routing gateway to LLMs for chat services, summarization, title generation, coaching notes, sentiment analysis, custom Q&A, and auto-tagging.

### Configuration & Credentials
- **Provider Key:** `OPENROUTER_API_KEY` (Supabase Secrets)
- **Default Model:** `openai/gpt-5-nano` (or similar specified targets).

### Integration Points
- **MCP Server:** `supabase/functions/mcp-server/index.ts` executes custom prompts for the Model Context Protocol tools.
- **Summarization Pipeline:** `supabase/functions/summarize-call/index.ts` handles structured call summaries.
- **Title Generation:** `supabase/functions/generate-ai-titles/index.ts` renames untitled calls.
- **Auto-Tagging:** `supabase/functions/auto-tag-calls/index.ts` analyzes transcripts and applies relevant labels.
- **Generic Generation:** `supabase/functions/generate-text/index.ts` is a utility endpoint for basic prompts.

### Data Flow & Payload
1. Prompts are constructed inside edge functions (integrating transcripts or user messages).
2. Requests are sent to the OpenRouter gateway.
3. Chat stream uses Vercel AI SDK wrappers with Deno imports of `@openrouter/ai-sdk-provider` and `ai`.
4. Response streams back to the client or is processed to update database rows (e.g. `recordings.summary`, `recordings.title`, or `call_participants`).

---

## 3. Polar.sh (Billing & Subscription Management)

### Purpose
- Manages subscriptions, paid tier access (Pro and Team), payment checkouts, and automatically provisions MCP access tokens.

### Configuration & Credentials
- **Provider Keys:** `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_WEBHOOK_SECRET` (Supabase Secrets)
- **SDK:** `npm:@polar-sh/sdk` imported in edge functions.

### Integration Points
- **Webhook Handler:** `supabase/functions/polar-webhook/index.ts` processes Polar callbacks.
- **Client Helper:** `supabase/functions/_shared/polar-client.ts` initializes the Polar client wrapper.
- **Checkout / Portal URLs:** `supabase/functions/polar-checkout/index.ts`, `supabase/functions/polar-cancel/index.ts`.
- **Customer Entitlement Checks:**
  - Active subscription details are written to the `user_profiles` table.
  - paid tier checks in `supabase/functions/mcp-server/index.ts` are evaluated using hardcoded Polar product IDs:
    - **Pro Tier:** `30020903-fa8f-4534-9cf1-6e9fba26584c`, `9ff62255-446c-41fe-a84d-c04aed23725c`
    - **Team Tier:** `88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7`, `6a1bcf14-86b4-4ec9-bcbe-660bb714b19f`

### Data Flow & Payload
1. Customer purchases or cancels a subscription on Polar.sh.
2. Polar.sh hits the `/polar-webhook` route on the Cloudflare API proxy, which routes to the `polar-webhook` edge function.
3. The webhook verifies the signature using `validateEvent` from `@polar-sh/sdk/webhooks`.
4. The event payload determines the status (e.g. `subscription.created`, `subscription.revoked`).
5. The function inserts the raw payload into the `processed_webhooks` table (for idempotency check).
6. It then updates `user_profiles` subscription properties.
7. An asynchronous background process (`EdgeRuntime.waitUntil`) is triggered to auto-provision or revoke MCP tokens based on the new subscription status.

---

## 4. Langfuse (LLM Observability)

### Purpose
- Captures tracing data for LLM generations to monitor prompt performance, latencies, tokens used, and associated costs.

### Configuration & Credentials
- **Provider Keys:** `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_URL` (defaults to `https://langfuse.pushthefknbutton.com`)
- **SDK:** `https://esm.sh/langfuse@3.34.1`

### Integration Points
- **Shared Module:** `supabase/functions/_shared/langfuse.ts` provides initialization and utility helpers (`startTrace`, `flushLangfuse`).
- **Active Tracing Functions:**
  - `generate-ai-titles/index.ts`
  - `auto-tag-calls/index.ts`
  - `summarize-call/index.ts`

### Data Flow & Payload
1. When an AI processing function is triggered, it calls `startTrace()` with metadata.
2. Tracing spans are created for each sub-step.
3. Completion details, including token counts and model outputs, are logged into the trace.
4. `flushLangfuse()` is called immediately before returning the API response to guarantee delivery.
5. If the credentials are not set, the client logs a warning and fails open, executing LLM logic without blocking.

---

## 5. Resend (Transactional Email)

### Purpose
- Handles transactional email delivery, specifically organization invitations.

### Configuration & Credentials
- **Provider Keys:** `RESEND_API_KEY`, `RESEND_DOMAIN_VERIFIED` (Supabase Secrets)
- **Endpoint:** `https://api.resend.com/emails`

### Integration Points
- **Invitation Service:** `supabase/functions/send-org-invite/index.ts`

### Data Flow & Payload
1. User invites another member to an organization via the frontend dashboard.
2. Frontend triggers the `send-org-invite` edge function.
3. The function checks for active organization membership permissions.
4. It crafts an HTML/Text email template containing invite link tokens.
5. Posts a JSON payload containing sender info, recipient email, subject, and body to Resend.

---

## 6. Sentry (Error Tracking)

### Purpose
- Records exceptions and frontend crashes, mapping them to source files using uploaded sourcemaps.

### Configuration & Credentials
- **Provider Keys:** `SENTRY_ORG`, `SENTRY_PROJECT` (callvault), `SENTRY_AUTH_TOKEN` (development/CI environment variables)
- **Frontend SDK:** `@sentry/react` ^10.28.0

### Integration Points
- **Vite Bundler:** `vite.config.ts` includes `sentryVitePlugin` to compile and upload sourcemaps automatically in production.
- **Frontend Client:** Initialized in `src/main.tsx` and wraps `src/App.tsx`.

---

## 7. Cloudflare Workers (Vanity API Proxy)

### Purpose
- Serves as the public API entry-point, wrapping raw Supabase URL locations with clean domain structures, enforcing CORS, managing client IP headers, and bypassing Perplexity cached domain failures.

### Hostnames Mapped
- `api.callvaultai.com`
- `mcp.callvaultai.com` (Added to bypass caching issues from MCP clients)

### Configuration & File Paths
- **Config:** `cloudflare/api-proxy/wrangler.toml`
- **Code:** `cloudflare/api-proxy/worker.ts`

### Mapped Routing Rules
- `/mcp` -> `mcp-server` edge function
- `/mcp-register` -> `mcp-oauth-register` edge function
- `/.well-known/oauth-protected-resource` -> `mcp-oauth-metadata?doc=protected-resource` edge function
- `/.well-known/oauth-authorization-server` -> `mcp-oauth-metadata?doc=authorization-server` edge function
- `/.well-known/openid-configuration` -> `mcp-oauth-metadata?doc=openid-configuration` edge function
- `/fireflies-webhook` -> `fireflies-webhook` edge function
- `/auth/v1/*` -> Supabase Auth (transparent proxy)
- `/logo.png` -> Mapped directly to hosting bucket asset

---

## 8. Third-Party Meeting Connectors

Meeting integrations are structured under a unified adapter registry model.

### Registry File
- `src/components/connectors/registry/connectorRegistry.ts` (registers adapters located in `src/components/connectors/registry/adapters/`)

### Mapped Connectors
1. **Fathom:**
   - **Type:** OAuth client + webhook integration.
   - **Edge Functions:** `fathom-oauth-url`, `fathom-oauth-callback`, `fathom-oauth-refresh`, `fathom-refresh`, `fathom-reconcile`, `sync-meetings`, `webhook` (webhook callback receiver).
   - **Adapter File:** `src/components/connectors/registry/adapters/fathom.ts`
2. **Zoom:**
   - **Type:** OAuth client + webhook integration.
   - **Edge Functions:** `zoom-oauth-url`, `zoom-oauth-callback`, `zoom-oauth-refresh`, `zoom-sync-meetings`, `zoom-webhook` (webhook callback receiver).
   - **Adapter File:** `src/components/connectors/registry/adapters/zoom.ts`
3. **Fireflies:**
   - **Type:** API key verification + webhook integration.
   - **Edge Functions:** `fireflies-save-source`, `fireflies-connection-details`, `fireflies-fetch-meetings`, `fireflies-sync-meetings`, `fireflies-webhook` (webhook callback receiver).
   - **Adapter File:** `src/components/connectors/registry/adapters/fireflies.ts`
4. **Read.ai:**
   - **Type:** OAuth client + webhook integration.
   - **Edge Functions:** `read-ai-oauth-url`, `read-ai-oauth-callback`, `read-ai-oauth-refresh`, `read-ai-connect-token`, `read-ai-fetch-meetings`, `read-ai-sync-meetings`, `read-ai-webhook-settings`, `read-ai-webhook` (webhook callback receiver).
   - **Adapter File:** `src/components/connectors/registry/adapters/read-ai.ts`
5. **Grain:**
   - **Type:** OAuth client + webhook integration.
   - **Edge Functions:** `grain-oauth-url`, `grain-oauth-callback`, `grain-oauth-refresh`, `grain-connect-token`, `grain-fetch-recordings`, `grain-sync-recordings`, `grain-create-webhooks`, `grain-disconnect`, `grain-webhook` (webhook callback receiver).
   - **Adapter File:** `src/components/connectors/registry/adapters/grain.ts`
6. **Plaud:**
   - **Type:** OAuth client + manual polling integration.
   - **Edge Functions:** `plaud-oauth-url`, `plaud-oauth-callback`, `plaud-sync-recordings`, `plaud-connect-token`.
   - **Adapter File:** `src/components/connectors/registry/adapters/plaud.ts`
7. **YouTube:**
   - **Type:** Public URL importer using raw transcript scraping.
   - **Edge Functions:** `youtube-import`, `youtube-api`.
   - **Adapter File:** `src/components/connectors/registry/adapters/youtube.ts`

---

*Integration mapping analysis: 2026-05-26*
