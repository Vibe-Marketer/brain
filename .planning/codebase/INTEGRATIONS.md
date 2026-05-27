# External Integrations

**Analysis Date:** 2026-05-27

## Meeting Recorder / Transcript Sources

All 7 external sources share a unified connector pipeline (`supabase/functions/_shared/connector-pipeline.ts`). Each has a corresponding set of Edge Functions (OAuth URL, callback, refresh, sync, webhook) and a client in `supabase/functions/_shared/`.

### Fathom
- **What it does:** Primary meeting recorder — OAuth sync of recordings, transcripts, and summaries
- **Auth:** OAuth 2.0 (PKCE flow)
- **OAuth credentials:** `FATHOM_OAUTH_CLIENT_ID`, `FATHOM_OAUTH_CLIENT_SECRET`
- **Webhook secret:** `FATHOM_OAUTH_WEBHOOK_SECRET`
- **API endpoints:**
  - OAuth token: `https://fathom.video/external/v1/oauth2/token`
  - Meetings: `https://api.fathom.ai/external/v1/meetings`
  - Recordings: `https://api.fathom.ai/external/v1/recordings/:id/transcript`
- **Client:** `supabase/functions/_shared/fathom-client.ts`
- **Edge Functions:** `fathom-oauth-url`, `fathom-oauth-callback`, `fathom-oauth-refresh`, `fathom-reconcile`, `fathom-refresh`, `create-fathom-webhook`
- **Webhook receiver:** `supabase/functions/webhook/index.ts` (HMAC-SHA256 `x-signature` verification)
- **Frontend client:** `src/lib/api-client.ts` (calls Edge Functions)

### Zoom
- **What it does:** Zoom Cloud Recordings sync via OAuth
- **Auth:** OAuth 2.0
- **OAuth credentials:** `ZOOM_OAUTH_CLIENT_ID`, `ZOOM_OAUTH_CLIENT_SECRET`
- **Webhook secret:** `ZOOM_WEBHOOK_SECRET_TOKEN`
- **API:** `https://api.zoom.us/v2`, OAuth at `https://zoom.us/oauth`
- **Client:** `supabase/functions/_shared/zoom-client.ts`
- **Edge Functions:** `zoom-oauth-url`, `zoom-oauth-callback`, `zoom-oauth-refresh`, `zoom-fetch-meetings`, `zoom-sync-meetings`, `zoom-webhook`
- **Vercel rewrite:** `/api/zoom-webhook` → Supabase Edge Function (see `vercel.json`)

### Fireflies
- **What it does:** Fireflies transcript import via API key (no OAuth)
- **Auth:** API key (stored encrypted in DB via `20260524000000_encrypt_fireflies_credentials.sql`)
- **API:** GraphQL at `https://api.fireflies.ai/graphql`
- **Connector:** `supabase/functions/_shared/fireflies-connector.ts`
- **Credentials helper:** `supabase/functions/_shared/fireflies-credentials.ts`
- **Edge Functions:** `fireflies-save-source`, `fireflies-connection-details`, `fireflies-fetch-meetings`, `fireflies-sync-meetings`, `fireflies-webhook`
- **Webhook endpoint:** `supabase/functions/fireflies-webhook/index.ts` (routed via Cloudflare Worker at `api.callvaultai.com/fireflies-webhook`)

### Read.ai
- **What it does:** Read.ai meeting reports and transcripts import via OAuth
- **Auth:** OAuth 2.0 (open beta)
- **OAuth credentials:** `READAI_OAUTH_CLIENT_ID`, `READAI_OAUTH_CLIENT_SECRET`
- **API:** `https://api.read.ai`, auth at `https://authn.read.ai/oauth2/`
- **Client:** `supabase/functions/_shared/read-ai-client.ts`
- **Connector:** `supabase/functions/_shared/read-ai-connector.ts`
- **Edge Functions:** `read-ai-oauth-url`, `read-ai-oauth-callback`, `read-ai-oauth-refresh`, `read-ai-connect-token`, `read-ai-fetch-meetings`, `read-ai-sync-meetings`, `read-ai-webhook`, `read-ai-webhook-settings`

### Grain
- **What it does:** Grain recordings and transcripts via OAuth
- **Auth:** OAuth 2.0
- **OAuth credentials:** `GRAIN_OAUTH_CLIENT_ID`, `GRAIN_OAUTH_CLIENT_SECRET`
- **API:** `https://api.grain.com`, OAuth at `https://grain.com/_/public-api/oauth2/`
- **API version header:** `2025-10-31`
- **Client:** `supabase/functions/_shared/grain-client.ts`
- **Connector:** `supabase/functions/_shared/grain-connector.ts`
- **Edge Functions:** `grain-oauth-url`, `grain-oauth-callback`, `grain-oauth-refresh`, `grain-connect-token`, `grain-fetch-recordings`, `grain-sync-recordings`, `grain-webhook`, `grain-create-webhooks`, `grain-disconnect`

### Plaud
- **What it does:** Plaud hardware recorder sync via web access token
- **Auth:** OAuth 2.0 (token-paste flow for connecting)
- **Client:** `supabase/functions/_shared/plaud-client.ts`
- **Connector:** `supabase/functions/_shared/plaud-connector.ts`
- **Edge Functions:** `plaud-oauth-url`, `plaud-oauth-callback`, `plaud-connect-token`, `plaud-sync-recordings`

### YouTube
- **What it does:** Import calls from public YouTube URLs
- **Auth:** API key
- **API key:** `YOUTUBE_DATA_API_KEY`
- **API:** `https://www.googleapis.com/youtube/v3`
- **Transcript API:** `https://transcriptapi.com/api/v2/youtube/transcript` (via `TRANSCRIPT_API_KEY`)
- **Edge Functions:** `youtube-api`, `youtube-import`

---

## Data Storage

**Primary Database:**
- Supabase PostgreSQL (project `vltmrnjsubfzrgrtdqey`)
- Connection: `VITE_SUPABASE_URL` (frontend), `SUPABASE_URL` (Edge Functions)
- ORM/Client: `@supabase/supabase-js` 2.84 — `src/integrations/supabase/client.ts` (frontend), direct `createClient` in Edge Functions
- All tables have RLS enabled; RLS regression test: `src/test/rls-regression.test.ts`
- Types generated via: `npm run gen:types` → `src/integrations/supabase/types.ts`
- Migrations: `supabase/migrations/*.sql` (naming: `YYYYMMDDHHMMSS_descriptive_name.sql`)

**File Storage:**
- Supabase Storage — audio/video file uploads (25MB limit; processed by `supabase/functions/file-upload-transcribe/`)

**Caching:**
- TanStack Query in-memory cache (5-minute stale time, 10-minute GC time)
- No external cache (no Redis, no Memcached)

---

## Authentication & Identity

**Auth Provider:**
- Supabase Auth — primary auth system
- Session persistence: localStorage (`src/integrations/supabase/client.ts`)
- Auto-refresh: enabled

**Social Login:**
- Google OAuth — `supabase.auth.signInWithOAuth({ provider: 'google' })` in `src/pages/Login.tsx`
- Credentials: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (used by Edge Functions for calendar features)

**Email/Password:**
- Standard Supabase email+password auth
- Password reset flow: `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`

**JWT Handling (Edge Functions):**
- Gateway `verify_jwt = false` for all functions (Supabase ES256 JWT compatibility issue)
- Auth enforced in function code via shared helper: `supabase/functions/_shared/auth.ts` (`authenticateRequest`)
- Three webhook functions are legitimately no-JWT: `webhook`, `zoom-webhook`, `polar-webhook`

---

## AI / LLM

**Primary AI routing:**
- OpenRouter — all Edge Function AI calls route through OpenRouter
- API key: `OPENROUTER_API_KEY`
- SDK: `@openrouter/ai-sdk-provider` 1.2.8 + Vercel AI SDK `ai` 5.0.102 (Deno/esm.sh)
- Default model: `openai/gpt-5-nano`
- Functions using OpenRouter: `generate-text`, `generate-ai-titles`, `summarize-call`, `auto-tag-calls`, `mcp-server`, `apply-routing-rules`, `global-search`

**Audio Transcription:**
- OpenAI Whisper API (`whisper-1` model)
- Endpoint: `https://api.openai.com/v1/audio/transcriptions`
- API key: `OPENAI_API_KEY`
- Used by: `supabase/functions/file-upload-transcribe/index.ts`
- File size limit: 25MB

**Additional AI providers (optional/available):**
- Anthropic: `ANTHROPIC_API_KEY`
- Google Gemini: `GEMINI_API_KEY`
- Hugging Face: `HUGGINGFACE_API_KEY`

**Frontend AI (constraint AI-02):**
- Vercel AI SDK (`@ai-sdk/openai`, `@ai-sdk/react`, `ai`) present as frontend deps
- Hard constraint: zero AI/RAG/embedding code in frontend components — SDK wired only in `src/lib/api-client.ts`

---

## Payments & Billing

**Provider:**
- Polar.sh — subscription management and checkout
- SDK: `@polar-sh/sdk` (via `npm:@polar-sh/sdk` in Deno)
- Access token: `POLAR_ACCESS_TOKEN`
- Org ID: `POLAR_ORGANIZATION_ID`
- Webhook secret: `POLAR_WEBHOOK_SECRET`
- Client: `supabase/functions/_shared/polar-client.ts`

**Plan definitions (`src/hooks/useSubscription.ts`):**
- Free: no active subscription
- Pro Monthly: product ID `30020903-fa8f-4534-9cf1-6e9fba26584c`
- Pro Annual: product ID `9ff62255-446c-41fe-a84d-c04aed23725c`
- Team Monthly: product ID `88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7`
- Team Annual: product ID `6a1bcf14-86b4-4ec9-bcbe-660bb714b19f`
- Team seat cap: 10

**Edge Functions:** `polar-checkout`, `polar-cancel`, `polar-create-customer`, `polar-customer-state`
**Webhook receiver:** `supabase/functions/polar-webhook/index.ts`

**Legacy:**
- Stripe keys (`STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) present in `.env.example` as migration remnants — not actively used

---

## Email

**Provider:**
- Resend (resend.com)
- API key: `RESEND_API_KEY`
- Domain verification flag: `RESEND_DOMAIN_VERIFIED`
- Default sender: `CallVault AI <onboarding@resend.dev>` (switches to verified domain when `RESEND_DOMAIN_VERIFIED=true`)
- Used by: `supabase/functions/send-org-invite/index.ts` — organization invitation emails

---

## Observability

**Frontend Error Tracking:**
- Sentry — `@sentry/react` 10.28
- Initialized: `src/lib/sentry.ts`, called from `src/main.tsx`
- DSN: `VITE_SENTRY_DSN` (public, browser-safe)
- Source maps: uploaded during production builds via `@sentry/vite-plugin` (requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
- Features: browser tracing (10% sample rate), session replay (text/media masked)
- Error boundary: `<Sentry.ErrorBoundary>` wraps entire app in `src/main.tsx`

**LLM Tracing:**
- Langfuse — LLM observability and call tracing
- SDK: `langfuse` 3.34.1 (via esm.sh)
- Shared client: `supabase/functions/_shared/langfuse.ts`
- Config: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_URL` (defaults to `https://langfuse.pushthefknbutton.com` — self-hosted instance)
- Used by AI Edge Functions (e.g., `summarize-call`) to trace prompts/completions

**AI Usage Tracking:**
- Internal usage tracking via `supabase/functions/_shared/track-ai-usage-inline.ts`
- MCP rate limiting: `MCP_RATE_LIMIT_PER_MINUTE` (default 60)
- Stored in DB; exposed via `track-ai-usage` Edge Function

**Logs:**
- `console.log` / `console.error` in Edge Functions (surfaced in Supabase dashboard logs)
- Frontend logger: `src/lib/logger.ts`

---

## MCP Server (Model Context Protocol)

**What it is:** CallVault exposes an MCP server so AI clients (Claude Desktop, Cursor, custom agents) can query calls, folders, and run AI actions.

**Location:** `supabase/functions/mcp-server/index.ts`
**Public endpoint:** `api.callvaultai.com/mcp` (via Cloudflare Worker proxy)
**Auth:** OAuth 2.1 with PKCE; tokens stored in `mcp_tokens` table
**Token TTLs:** `MCP_ACCESS_TOKEN_TTL_SECONDS` (default 3600s), `MCP_REFRESH_TOKEN_TTL_SECONDS` (default 2592000s)
**Tools exposed:** 36 total (17 read + 19 write)
**Edge Functions:** `mcp-server`, `mcp-oauth-metadata`, `mcp-oauth-register`
**Runbook:** `docs/operations/mcp-runbook.md`

---

## CI/CD & Deployment

**Frontend Hosting:**
- Vercel — auto-deploys from `main` branch
- Build command: `npm run build`
- Output: `dist/`
- Config: `vercel.json`
- Production URL: `https://app.callvaultai.com`

**Edge Functions Deployment:**
- `supabase functions deploy --use-api` (Docker-free; required — Docker not available)
- CI workflow: `.github/workflows/deploy-edge-functions.yml`

**CI Pipeline:**
- GitHub Actions
- RLS regression test: `.github/workflows/ci.yml` job `rls-regression` (runs when `vars.SUPABASE_SECRETS_CONFIGURED == 'true'`)

---

## Domain Infrastructure

**Cloudflare Worker:**
- Routes `api.callvaultai.com` to Supabase Edge Functions
- Location: `cloudflare/api-proxy/worker.ts`
- Routes: `/mcp`, `/mcp-register`, `/.well-known/*`, `/fireflies-webhook`, `/auth/v1/*`, `/logo.png`
- Strips Cloudflare internal headers; forwards real client IP

**Domain Management:**
- Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_BASE_DOMAIN`
- Dynadot registrar: `DYNADOT_API_KEY`, `DYNADOT_SECRET_KEY`

---

## Webhooks & Callbacks

**Incoming webhooks:**
| Source | Endpoint | Function |
|--------|----------|----------|
| Fathom | `/functions/v1/webhook` | `supabase/functions/webhook/index.ts` |
| Zoom | `/api/zoom-webhook` (Vercel rewrite) | `supabase/functions/zoom-webhook/index.ts` |
| Polar | `/functions/v1/polar-webhook` | `supabase/functions/polar-webhook/index.ts` |
| Fireflies | `api.callvaultai.com/fireflies-webhook` | `supabase/functions/fireflies-webhook/index.ts` |
| Grain | `/functions/v1/grain-webhook` | `supabase/functions/grain-webhook/index.ts` |
| Read.ai | `/functions/v1/read-ai-webhook` | `supabase/functions/read-ai-webhook/index.ts` |

Webhook signatures verified via HMAC-SHA256; shared helper: `supabase/functions/_shared/webhook-signing.ts`

**OAuth callbacks (frontend):**
- Route: `/oauth/callback/:source` → `src/pages/OAuthCallback.tsx`
- Handles: `fathom`, `zoom`, `plaud`, `read-ai`, `grain`

---

## Environment Configuration Summary

**Required for basic operation:**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — frontend DB/auth
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — Edge Functions
- `OPENROUTER_API_KEY` — all AI features
- `OPENAI_API_KEY` — file upload transcription (Whisper)

**Required per integration:**
- Fathom: `FATHOM_OAUTH_CLIENT_ID`, `FATHOM_OAUTH_CLIENT_SECRET`
- Zoom: `ZOOM_OAUTH_CLIENT_ID`, `ZOOM_OAUTH_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`
- Read.ai: `READAI_OAUTH_CLIENT_ID`, `READAI_OAUTH_CLIENT_SECRET`
- Grain: `GRAIN_OAUTH_CLIENT_ID`, `GRAIN_OAUTH_CLIENT_SECRET`
- Polar: `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_WEBHOOK_SECRET`
- Resend: `RESEND_API_KEY`
- Sentry: `VITE_SENTRY_DSN` (frontend), `SENTRY_AUTH_TOKEN` (build)
- YouTube: `YOUTUBE_DATA_API_KEY`, `TRANSCRIPT_API_KEY`

**Secrets location:**
- Frontend: `.env` (gitignored); `.env.example` documents all vars
- Edge Functions: Supabase project secrets (set via Supabase dashboard or CLI)

---

*Integration audit: 2026-05-27*
