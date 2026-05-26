# External Integrations

**Analysis Date:** 2026-05-26

## APIs & External Services

**Payment Processing:**
- Polar.sh - Subscription billing, checkout sessions, customer portal URLs, and entitlement management.
  - SDK/Client: `npm:@polar-sh/sdk` imported in edge functions.
  - Auth: API token in `POLAR_ACCESS_TOKEN`, webhook validation secret in `POLAR_WEBHOOK_SECRET` environment variables (Supabase Secrets).
  - Endpoints used: Checkouts, Customers, Subscriptions, Webhooks. Hardcoded product IDs are used for tier checks in `mcp-server/index.ts`.

**Email/SMS:**
- Resend - Transactional email delivery for organization invitation links.
  - SDK/Client: REST API via `https://api.resend.com/emails` fetch request.
  - Auth: API key in `RESEND_API_KEY` (Supabase Secrets).
  - Templates: Custom HTML/Text templates generated inside `send-org-invite` edge function.

**External APIs:**
- OpenRouter (LLM Gateway) - Primary gateway to large language models for chat services, summarization, title generation, and auto-tagging.
  - Integration method: Vercel AI SDK wrappers with `@openrouter/ai-sdk-provider` and `ai` packages.
  - Auth: API key in `OPENROUTER_API_KEY` (Supabase Secrets).
  - Default Model: `openai/gpt-5-nano` (or specified targets).
- OpenAI (Whisper) - Audio transcription API for uploaded call files.
  - Integration method: REST API via `https://api.openai.com/v1/audio/transcriptions` multipart/form-data fetch request.
  - Auth: API key in `OPENAI_API_KEY` (Supabase Secrets).
  - Model used: `whisper-1` (up to 25MB file upload size).
- Third-Party Meeting Connectors - Unified adapter registry mapping external APIs to sync pipelines.
  - Mapped Connectors:
    - **Fathom:** OAuth 2.0 + Webhooks (using fathom client and transcript parser).
    - **Zoom:** OAuth 2.0 + Webhooks (using zoom client).
    - **Read.ai:** OAuth 2.0 + Webhooks (using read-ai client).
    - **Fireflies.ai:** API Key + GraphQL + Webhooks (using fireflies client).
    - **Grain:** OAuth 2.0 + Webhooks (using grain client).
    - **Plaud:** OAuth 2.0 + manual polling integration (using plaud client).
    - **YouTube:** API-based public video import using transcript scraping.

## Data Storage

**Databases:**
- PostgreSQL on Supabase - Primary database hosting application schemas, RLS policies, and RPC functions.
  - Connection: Connection pooler via `DATABASE_URL`/`SESSION_POOLER_URL` environment variables.
  - Client: `@supabase/supabase-js` v2.84.0 client SDK on frontend and edge functions.
  - Migrations: 209 SQL migration files under `supabase/migrations/` plus baseline `00000000000000_consolidated_schema.sql`.

**File Storage:**
- Supabase Storage - Hosting uploaded audio files and attachments.
  - SDK/Client: `@supabase/supabase-js` Storage API.
  - Auth: Supabase client credentials with RLS-protected storage buckets.
  - Buckets: `recordings` bucket.

**Caching:**
- None - Database-level queries only. No Redis or external cache, but client-side TanStack React Query handles UI-level caching.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Direct email/password registration, login, and OAuth provider orchestration.
  - Implementation: Supabase Auth JS Client SDK.
  - Token storage: Client-side storage (session token and local storage).
  - Session management: Managed via Supabase token refresh.

**OAuth Integrations:**
- Fathom, Zoom, Read.ai, Grain, Plaud, YouTube - Integration OAuth flows to bind user credentials.
  - Implementation: Custom callback edge functions (e.g., `zoom-oauth-callback`, `fathom-oauth-callback`) handling client credential exchanges and saving encrypted tokens to `user_settings`.
  - Credentials: Env vars `FATHOM_OAUTH_CLIENT_ID`, `ZOOM_OAUTH_CLIENT_ID`, etc., matching the respective provider.

## Monitoring & Observability

**Error Tracking:**
- Sentry - Real-time error monitoring and exception tracking for React frontend.
  - DSN: Public Sentry DSN in `VITE_SENTRY_DSN` environment variable.
  - Release tracking: Automated source map uploads at build time using `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`.

**Analytics:**
- Langfuse - LLM tracing, prompt monitoring, token usage tracking, and observability for AI functions.
  - Token: Public and secret keys in `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` env vars.
  - Events tracked: Generation steps, prompt inputs, completion outputs, and latency metrics in `generate-ai-titles`, `auto-tag-calls`, and `summarize-call` functions.

**Logs:**
- Supabase Edge Function Logs - Deno runtime stderr/stdout logging.
- Cloudflare Workers Logs - Cloudflare dashboard runtime logs.

## CI/CD & Deployment

**Hosting:**
- Vercel - Static Web SPA frontend hosting.
  - Deployment: Automatic deployments triggered by GitHub repository integrations.
  - Environment vars: Managed via Vercel Project Dashboard.
- Supabase Platform - Serverless Database, Auth, Storage, and Edge Functions runtime environment.
- Cloudflare Workers - Vanity reverse-proxy layer on custom domains (`api.callvaultai.com`, `mcp.callvaultai.com`) to bypass browser and routing limits.

**CI Pipeline:**
- GitHub Actions - Automated testing (Vitest, Playwright, type-checks).
  - Workflows: `.github/workflows/` directory configuration files.

## Environment Configuration

**Development:**
- Required env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`.
- Secrets location: Local `.env` files (gitignored).
- Mock/stub services: Local Supabase local dev environment support via Supabase CLI.

**Staging:**
- Configured via staging variables in Vercel/Supabase, routing to separate staging databases or staging provider accounts.

**Production:**
- Secrets management: Supabase Edge Secrets (`supabase secrets set`) and Vercel environment variables dashboard.

## Webhooks & Callbacks

**Incoming:**
- Fathom Webhooks - Handles Fathom push notifications (endpoint: `/functions/v1/webhook`).
  - Verification: Signature verification via webhook validation helper.
- Zoom Webhooks - Processes Zoom events (endpoint: `/functions/v1/zoom-webhook`).
  - Verification: Validation token verification with `ZOOM_WEBHOOK_SECRET_TOKEN`.
- Fireflies Webhooks - Integrates Fireflies events (endpoint: `/fireflies-webhook` on proxy worker).
  - Verification: Path token validation checking against database config.
- Read.ai Webhooks - Receives Read.ai sync triggers (endpoint: `/functions/v1/read-ai-webhook`).
- Grain Webhooks - Receives Grain push events (endpoint: `/functions/v1/grain-webhook`).
- Polar Webhooks - Processes checkout and subscription updates (endpoint: `/functions/v1/polar-webhook`).
  - Verification: Signature validation via `@polar-sh/sdk/webhooks`.

**Outgoing:**
- None.

---

*Integration audit: 2026-05-26*
*Update when adding/removing external services*
