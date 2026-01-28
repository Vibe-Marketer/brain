# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**AI & LLMs:**
- **OpenRouter** - Primary gateway for LLMs in Edge Functions
  - Auth: `OPENAI_API_KEY` (or specific OpenRouter key)
- **OpenAI** - Used via Vercel AI SDK on client/server
  - SDK: `@ai-sdk/openai`
- **Hugging Face** - Used for semantic search re-ranking
  - Service: Inference API (`cross-encoder/ms-marco-MiniLM-L-12-v2`)
  - Auth: `HUGGINGFACE_API_KEY`

**Communication:**
- **Resend** - Transactional emails (invites, automation notifications)
  - Auth: `RESEND_API_KEY`
  - Usage: `supabase/functions/automation-email`, `send-coach-invite`

**Meeting Providers:**
- **Fathom (AI Notetaker)** - Meeting recording and transcription
  - Auth: OAuth flow (`FATHOM_OAUTH_CLIENT_ID`, `FATHOM_OAUTH_CLIENT_SECRET`)
  - Webhook: `FATHOM_OAUTH_WEBHOOK_SECRET`
- **Zoom** - Meeting synchronization
  - Auth: OAuth flow (`zoom-oauth-*` functions)
- **Google Meet** - Meeting synchronization
  - Auth: OAuth flow (`google-oauth-*` functions)
- **YouTube** - Video content integration
  - Auth: `youtube-api` function

## Data Storage

**Databases:**
- **Supabase (PostgreSQL)**
  - Connection: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - Features: `pgvector` for embeddings, RLS for security
  - Client: `@supabase/supabase-js`

**File Storage:**
- **Supabase Storage**
  - Used for: Call artifacts, transcripts, user content

**Caching:**
- **Supabase Realtime** - Used for tab state sync (`useSyncTabState`)
- **React Query** - Client-side caching

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth**
  - Implementation: JWT based
  - Integration: `supabase/auth`
  - Features: Email/Password, OAuth (Google, Zoom, Fathom implications)

## Monitoring & Observability

**Error Tracking:**
- **Sentry**
  - Package: `@sentry/react`, `@sentry/vite-plugin`
  - Tracing: Distributed tracing enabled in Edge Functions (`sentry-trace` headers)

## CI/CD & Deployment

**Hosting:**
- **Frontend:** Vercel (implied by typical stack, or generic static host)
- **Backend:** Supabase Edge Functions (Deno)

**CI Pipeline:**
- **GitHub Actions**
  - Files: `.github/workflows/deploy-edge-functions.yml`, `claude-code-review.yml`

## Environment Configuration

**Required env vars:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Backend only)
- `OPENAI_API_KEY`
- `HUGGINGFACE_API_KEY`
- `RESEND_API_KEY`
- `FATHOM_OAUTH_CLIENT_ID` / `SECRET`
- `GOOGLE_OAUTH_CLIENT_ID` / `SECRET`

**Secrets location:**
- Local: `.env`
- Production: Supabase Project Secrets (Vault)

## Webhooks & Callbacks

**Incoming:**
- `supabase/functions/webhook` (Generic/Fathom)
- `supabase/functions/zoom-webhook`
- `supabase/functions/automation-webhook`

**Outgoing:**
- **Automation Actions:** Can trigger external webhooks via `automation-webhook` function

---

*Integration audit: 2026-01-26*
