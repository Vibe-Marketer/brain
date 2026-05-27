---
last_mapped_commit: 5e223262c0f2cbc3f24c166d5ea56c793cbb6574
last_mapped_at: 2026-05-27
---

# External Integrations

**Analysis Date:** 2026-05-27

## APIs & External Services

**Recording and Transcript Sources:**
- Fathom - OAuth, sync, reconcile, and webhook import.
  - Frontend registry: `src/components/connectors/registry/adapters/fathom.ts`
  - Source registry: `src/config/source-registry.ts`
  - Edge Functions: `supabase/functions/fathom-oauth-url/`, `supabase/functions/fathom-oauth-callback/`, `supabase/functions/fathom-refresh/`, `supabase/functions/fathom-reconcile/`, `supabase/functions/sync-meetings/`, `supabase/functions/fetch-meetings/`, `supabase/functions/webhook/`, `supabase/functions/create-fathom-webhook/`
  - Shared code: `supabase/functions/_shared/fathom-client.ts`, `supabase/functions/_shared/fathom-transcript-parser.ts`
- Zoom - OAuth, cloud recording sync, and webhook import.
  - Frontend registry: `src/components/connectors/registry/adapters/zoom.ts`
  - Edge Functions: `supabase/functions/zoom-oauth-url/`, `supabase/functions/zoom-oauth-callback/`, `supabase/functions/zoom-oauth-refresh/`, `supabase/functions/zoom-fetch-meetings/`, `supabase/functions/zoom-sync-meetings/`, `supabase/functions/zoom-webhook/`
  - Shared code: `supabase/functions/_shared/zoom-client.ts`, `supabase/functions/_shared/zoom-token-refresh.ts`
- Fireflies - API-key credentials, sync, fetch, and signed webhook import.
  - Frontend registry: `src/components/connectors/registry/adapters/fireflies.ts`
  - Edge Functions: `supabase/functions/fireflies-save-source/`, `supabase/functions/fireflies-connection-details/`, `supabase/functions/fireflies-fetch-meetings/`, `supabase/functions/fireflies-sync-meetings/`, `supabase/functions/fireflies-webhook/`
  - Shared code: `supabase/functions/_shared/fireflies-connector.ts`, `supabase/functions/_shared/fireflies-credentials.ts`
- Read.ai - OAuth/API-key style connector with fetch, sync, webhook settings, and webhook import.
  - Frontend registry: `src/components/connectors/registry/adapters/read-ai.ts`
  - Edge Functions: `supabase/functions/read-ai-oauth-url/`, `supabase/functions/read-ai-oauth-callback/`, `supabase/functions/read-ai-oauth-refresh/`, `supabase/functions/read-ai-connect-token/`, `supabase/functions/read-ai-fetch-meetings/`, `supabase/functions/read-ai-sync-meetings/`, `supabase/functions/read-ai-webhook-settings/`, `supabase/functions/read-ai-webhook/`
  - Shared code: `supabase/functions/_shared/read-ai-client.ts`, `supabase/functions/_shared/read-ai-connector.ts`, `supabase/functions/_shared/read-ai-source.ts`
- Grain - OAuth connector and webhook/sync implementation, currently hidden from UI by `uiVisible: false`.
  - Frontend registry: `src/components/connectors/registry/adapters/grain.ts`
  - Edge Functions: `supabase/functions/grain-oauth-url/`, `supabase/functions/grain-oauth-callback/`, `supabase/functions/grain-oauth-refresh/`, `supabase/functions/grain-fetch-recordings/`, `supabase/functions/grain-sync-recordings/`, `supabase/functions/grain-webhook/`, `supabase/functions/grain-disconnect/`
- Plaud - Browser/web-token connector and recording sync.
  - Frontend registry: `src/components/connectors/registry/adapters/plaud.ts`
  - Edge Functions: `supabase/functions/plaud-oauth-url/`, `supabase/functions/plaud-oauth-callback/`, `supabase/functions/plaud-connect-token/`, `supabase/functions/plaud-sync-recordings/`
- YouTube - Public URL import and YouTube API proxy.
  - Frontend registry: `src/components/connectors/registry/adapters/youtube.ts`
  - Edge Functions: `supabase/functions/youtube-import/`, `supabase/functions/youtube-api/`
- File Upload and Paste Transcript - Internal import paths.
  - Frontend adapter: `src/components/connectors/registry/adapters/file-upload.ts`
  - Edge Functions: `supabase/functions/file-upload-transcribe/`, `supabase/functions/save-pasted-transcript/`

**AI Providers:**
- OpenRouter/Vercel AI SDK - AI text generation, summaries, title generation, MCP AI tools, and usage-gated AI features.
  - Edge Functions: `supabase/functions/generate-text/`, `supabase/functions/summarize-call/`, `supabase/functions/generate-ai-titles/`, `supabase/functions/auto-tag-calls/`, `supabase/functions/mcp-server/`
  - Usage tracking: `supabase/functions/track-ai-usage/`, `supabase/functions/_shared/track-ai-usage-inline.ts`
- OpenAI-compatible client packages are in `package.json`; actual Edge Function imports often come from `esm.sh`.

**Payment Processing:**
- Polar.sh - Checkout, customer state, cancellation, and subscription webhooks.
  - Edge Functions: `supabase/functions/polar-checkout/`, `supabase/functions/polar-create-customer/`, `supabase/functions/polar-customer-state/`, `supabase/functions/polar-cancel/`, `supabase/functions/polar-webhook/`
  - Frontend hook: `src/hooks/useSubscription.ts`
  - Webhook signature validation uses Polar/Svix SDK in `supabase/functions/polar-webhook/index.ts`.
- Stripe - Present as legacy/migration env surface in `.env.example`; active billing code is Polar-centered.

**Email:**
- Resend - Declared in `.env.example` and local env names; current app code has invitation flows that mostly generate links rather than sending email directly.

## Data Storage

**Primary Database:**
- Supabase PostgreSQL.
  - Schema migrations: `supabase/migrations/`
  - Generated client types: `src/integrations/supabase/types.ts`
  - Frontend client: `src/integrations/supabase/client.ts`
  - RLS and security definer functions are a core access-control layer.

**Important Tables and Concepts:**
- `recordings` - Canonical call/transcript library.
- `workspace_entries` - Recording placement inside workspaces and folders.
- `organizations`, `organization_memberships`, `workspaces`, `workspace_memberships` - Tenant and workspace model.
- `import_sources` - Connected provider accounts, tokens, status, metadata, webhook setup.
- `sync_jobs` - Import/sync progress and failed import tracking.
- `mcp_tokens`, `mcp_oauth_org_bindings` - MCP auth and scope binding.
- `personal_folders`, `personal_tags`, `call_participants`, `call_share_links`, `call_notes` - Library organization and sharing surfaces.
- Raw source tables such as `fathom_raw_calls`, `zoom_raw_calls`, `youtube_raw_calls`, and `upload_raw_files` preserve source-specific data.

**File Storage:**
- Supabase Storage is implied for upload/transcription and asset flows, but codebase mapping did not identify a central frontend storage wrapper. Edge Functions and DB metadata are the main import path.

## Authentication & Identity

**App Auth:**
- Supabase Auth with browser session persistence via `localStorage`.
  - Client setup: `src/integrations/supabase/client.ts`
  - Runtime state: `src/contexts/AuthContext.tsx`
  - Protected UI routes: `src/components/ProtectedRoute.tsx`

**Source OAuth:**
- Provider OAuth starts from frontend adapter methods, redirects through `/oauth/callback/*`, then completes in provider-specific Edge Functions.
  - Route UI: `src/pages/OAuthCallback.tsx`
  - Routing helper: `src/lib/oauth-callback-routing.ts`
  - Shared Edge Function helpers: `supabase/functions/_shared/oauth-pkce.ts`, `supabase/functions/_shared/oauth-url-handler.ts`, `supabase/functions/_shared/oauth-callback-handler.ts`

**Token Storage:**
- OAuth tokens are stored in `import_sources` and legacy `user_settings` paths.
- Encryption helpers live in `supabase/functions/_shared/oauth-encrypt.ts`; write paths use RPCs such as `store_encrypted_oauth_tokens`.
- Docs should mention env var names such as `OAUTH_ENCRYPTION_KEY`, never actual token values.

**MCP Auth:**
- `supabase/functions/mcp-server/index.ts` accepts bearer tokens from `mcp_tokens` or Supabase OAuth JWT paths and enforces workspace/organization scope in application code while using service-role database access.
- OAuth metadata/register functions live under `supabase/functions/mcp-oauth-*`.

## Monitoring & Observability

**Error Tracking:**
- Sentry frontend integration in `src/lib/sentry.ts`, `@sentry/react`, and `vite.config.ts`.
- Sentry workflows: `.github/workflows/sentry-autofix.yml`, `.github/workflows/sentry-deploy.yml`.

**Logging:**
- Frontend logger utility: `src/lib/logger.ts`.
- Edge Functions use `console.log`, `console.warn`, and `console.error`.
- Langfuse helper exists at `supabase/functions/_shared/langfuse.ts` for LLM observability.

## CI/CD & Deployment

**Hosting and Runtime:**
- Vercel is documented for frontend deployment.
- Supabase hosts Edge Functions and Postgres.
- Cloudflare proxy/config appears in environment docs for custom API/MCP hostnames.

**GitHub Actions:**
- `.github/workflows/ci.yml` - Lint, typecheck, audit, unit coverage, API smoke, RLS regression.
- `.github/workflows/deploy-edge-functions.yml` - Edge Function deployment.
- `.github/workflows/security.yml` - Security review automation.
- `.github/workflows/uptime.yml` - Uptime checks.

## Environment Configuration

**Development:**
- Use `.env.example` as the reference.
- Root `.env` and `.auto-claude/.env` contain sensitive local values in this working tree; generated docs must not reproduce them.
- `vitest.config.ts` supplies safe test defaults for Supabase env vars.

**Production:**
- Provider secrets, service role keys, AI keys, Polar secrets, Sentry auth, and OAuth credentials must be configured in deployment secret stores.
- Some workflows conditionally run only when GitHub vars/secrets indicate Supabase secrets are configured.

## Webhooks & Callbacks

**Incoming Webhooks:**
- Fathom: `supabase/functions/webhook/`
- Zoom: `supabase/functions/zoom-webhook/`
- Fireflies: `supabase/functions/fireflies-webhook/`
- Read.ai: `supabase/functions/read-ai-webhook/`
- Grain: `supabase/functions/grain-webhook/`
- Polar: `supabase/functions/polar-webhook/`

**Common Patterns:**
- Signature verification where providers support it.
- Idempotency via `processed_webhooks`.
- Service-role DB access inside Edge Functions with explicit request/provider validation.
- Canonical import path converges through `_shared/canonical-recording.ts` and `_shared/connector-pipeline.ts`.

---
*Integration audit: 2026-05-27*
*Update when adding/removing providers, webhooks, external hosts, or secret requirements*
