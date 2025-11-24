# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Conversion Brain** (TruBrain) is a Vite + React + TypeScript frontend application with Supabase serverless Edge Functions. It's designed to sync, process, and analyze Fathom meeting recordings with AI-powered insights.

## Essential Commands

### Development

```bash
# Install dependencies
npm i

# Start development server (runs on http://localhost:8080)
npm run dev

# Build for production
npm run build

# Build for development (with dev mode optimizations)
npm run build:dev

# Lint code
npm run lint

# Type checking (no emit)
npm run type-check

# Preview production build
npm run preview
```

### Testing

```bash
# Run tests (using vitest)
npx vitest

# Run a single test file
npx vitest src/lib/__tests__/filter-utils.test.ts

# Run tests in watch mode
npx vitest --watch
```

### Supabase Functions

Supabase Edge Functions are Deno-based and located in `supabase/functions/`. They cannot be run directly with npm commands.

```bash
# Run function locally with Deno (example)
deno run --allow-env --allow-net supabase/functions/webhook/index.ts

# Note: Functions expect SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
```

## Architecture Overview

### Frontend Structure

The application follows a standard React architecture with clear separation of concerns:

- **`src/pages/`** - Top-level route components (TranscriptsNew, Settings, Login, OAuthCallback)
- **`src/components/`** - Reusable UI components
  - `src/components/ui/` - shadcn-ui components (Button, Dialog, Table, etc.)
  - Other components follow feature-based organization
- **`src/lib/`** - Utility functions and shared logic
  - `api-client.ts` - Centralized API client for Edge Function calls
  - `fathom.ts` - Fathom API utilities
  - `logger.ts` - Logging utilities
- **`src/hooks/`** - Custom React hooks (useMeetingsSync, useCallAnalytics, etc.)
- **`src/contexts/`** - React Context providers (ThemeContext, AuthContext)
- **`src/integrations/supabase/`** - Supabase client configuration

### Backend (Supabase Edge Functions)

Functions are organized by purpose in `supabase/functions/`:

**Core Meeting Operations:**
- `fetch-meetings/` - Fetch meetings from Fathom
- `fetch-single-meeting/` - Fetch single meeting details
- `sync-meetings/` - Sync meetings to database
- `webhook/` - Handle Fathom webhooks

**OAuth/Authentication:**
- `fathom-oauth-url/` - Get OAuth URL
- `fathom-oauth-callback/` - Handle OAuth callback
- `fathom-oauth-refresh/` - Refresh OAuth tokens

**Configuration:**
- `get-config-status/` - Get configuration status
- `save-fathom-key/`, `save-host-email/`, `save-webhook-secret/` - Save settings

**Testing:**
- `test-fathom-connection/`, `test-env-vars/` - Verify connections and config

All Edge Functions follow Deno's `Deno.serve()` pattern with CORS handling.

### Key Architectural Patterns

#### API Communication Pattern

Frontend → API Client (`src/lib/api-client.ts`) → Edge Function → Supabase Database

The `api-client.ts` provides:
- Automatic retry logic with exponential backoff
- Consistent error handling
- Type-safe responses via `ApiResponse<T>` interface

#### Authentication Flow

- Supabase Auth with email/password or OAuth (Fathom)
- `AuthContext` manages auth state
- `ProtectedRoute` component guards authenticated routes
- Auth persistence via browser `localStorage`

#### State Management

- **React Query** (`@tanstack/react-query`) for server state
- Custom hooks encapsulate query logic (e.g., `useCallAnalytics`)
- React Context for global UI state (theme, auth)
- Optimized QueryClient configuration with smart caching (1min stale time, 5min gc time)

#### Webhook Processing

The `webhook/` Edge Function implements:
- Signature verification for security
- Idempotency checks via `processed_webhooks` table
- Background processing (returns early, processes async)
- Upsert pattern for `fathom_calls` with `onConflict: 'recording_id'`

## Critical Development Guidelines

### Brand Guidelines Enforcement

**ALWAYS read `docs/design/brand-guidelines-v3.3.md` before any UI work.**

Key rules:
- **Vibe Green (#D9FC67)** - ONLY for tab underlines, left-edge indicators, focus states, progress indicators
  - NEVER for text, button backgrounds, card backgrounds, or icons
- **4 Button Variants:** default (slate gradient), hollow (white/bordered), destructive (red gradient), link (text-only)
- **Typography:** Montserrat Extra Bold ALL CAPS for headings, Inter for body text
- **Layout:** 90% rule - NO card containers around content, use white background + thin borders
- **Icons:** Remix Icon exclusively (`@remixicon/react`), prefer `-line` variants, size 16px

Before deviating from guidelines, ASK the user for approval.

### API Naming Conventions

Follow `docs/architecture/api-naming-conventions.md`:

| Pattern | Convention | Example |
|---------|------------|---------|
| Edge Function folders | kebab-case | `fetch-meetings/` |
| Frontend functions | camelCase | `fetchMeetings()` |
| Hooks | use + camelCase | `useMeetingsSync()` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |
| Database fields | snake_case | `recording_id` |
| Query keys | kebab-case arrays | `["call-analytics", id]` |

### Vercel AI SDK Default

For any AI/chat features, use Vercel AI SDK:
- `ai` - LLM integration, streaming, tool calling
- `@ai-sdk/react` - `useChat`, `useCompletion` hooks
- Reference: `docs/reference/ai-sdk-cookbook-examples/`

### Security Best Practices

- Validate input at system boundaries (user input, external APIs)
- Watch for OWASP Top 10 vulnerabilities (XSS, SQL injection, command injection)
- Never expose secrets in code - use environment variables
- Webhook handlers must verify signatures before processing

### Architecture Decision Records (ADRs)

For significant technical decisions (database changes, AI provider choices, major schema changes):
1. Copy `docs/adr/adr-template.md`
2. Fill in Context, Decision, Consequences
3. Save as `docs/adr/adr-XXX-short-title.md`
4. Update `docs/adr/README.md`

Time limit: 10-15 minutes max.

## Code Quality & Review

Available review commands (via Claude):
- `/code-review` - Comprehensive code review before PRs
- `/security-review` - Security-focused analysis for auth, input handling, secrets
- `/design-review` - UI/UX validation with Playwright

Workflow:
1. After completing code → `/code-review`
2. Before PR → `/security-review`
3. UI changes → `/design-review`

## Key Reference Documentation

- **Brand Guidelines:** `docs/design/brand-guidelines-v3.3.md` - Design system (MUST READ for UI work)
- **Design Principles:** `docs/design/design-principles-conversion-brain.md` - World-class SaaS design standards
- **API Naming:** `docs/architecture/api-naming-conventions.md` - Function/hook/type naming standards
- **AI SDK Examples:** `docs/reference/ai-sdk-cookbook-examples/` - Vercel AI SDK patterns
- **ADR System:** `docs/adr/` - Architectural decisions
- **Claude Instructions:** `CLAUDE.md` - Comprehensive development guide (810 lines)
- **Copilot Instructions:** `.github/copilot-instructions.md` - Quick reference
- **Roo Rules:** `.roo/rules.md` - Critical rules summary

## Database & Migrations

- **Migrations:** `supabase/migrations/*.sql` - SQL migration files
- **Schema:** Uses PostgreSQL via Supabase
- When modifying schema, add new SQL migration and reference in PR description

## Path Aliases

TypeScript path aliases configured in `tsconfig.json`:
- `@/*` maps to `./src/*`

Example: `import { Button } from "@/components/ui/button"`

## Environment Variables

**Frontend** (Vite env vars):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key

**Edge Functions** (Deno env vars):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (privileged)
- `SUPABASE_DB_URL` - Direct PostgreSQL connection string

## Technology Stack

- **Frontend:** Vite, React 18, TypeScript, React Router v6
- **UI Components:** shadcn-ui (Radix UI + Tailwind CSS)
- **Styling:** Tailwind CSS with custom configuration
- **State Management:** React Query (@tanstack/react-query), React Context
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **Runtime:** Deno (Edge Functions)
- **Charts:** Recharts, Tremor React
- **Icons:** Remix Icon (@remixicon/react)
- **Animations:** Framer Motion
- **Document Export:** jsPDF, docx, jszip

## Common Gotchas

1. **Port:** Dev server runs on port 8080, not default 5173
2. **Edge Functions:** Use `Deno.serve()`, not Express/Node patterns
3. **TypeScript:** Strict mode is partially disabled (`noImplicitAny: false`, `strictNullChecks: false`)
4. **shadcn-ui:** Components are in `src/components/ui/` - prefer using existing over creating new
5. **Webhook Idempotency:** Always check `processed_webhooks` before processing
6. **Database Upserts:** Use `onConflict` parameter carefully to avoid data loss

## Notes on Lovable Integration

This project was initially created with Lovable (https://lovable.dev). Changes pushed to this repo are reflected in Lovable and vice versa. The project can be edited via Lovable UI or locally.
