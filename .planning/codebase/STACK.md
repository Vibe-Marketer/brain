---
last_mapped_commit: 5e223262c0f2cbc3f24c166d5ea56c793cbb6574
last_mapped_at: 2026-05-27
---

# Technology Stack

**Analysis Date:** 2026-05-27

## Languages

**Primary:**
- TypeScript 5.8 - Frontend application code under `src/`, tests, config, and utility scripts.
- SQL/PostgreSQL - Supabase schema and migrations under `supabase/migrations/`.
- Deno TypeScript - Supabase Edge Functions under `supabase/functions/`.

**Secondary:**
- JavaScript - Tooling config such as `eslint.config.js` and `postcss.config.js`.
- Shell - Local setup helpers such as `scripts/setup-secrets.sh` and `scripts/test-environment.sh`.

## Runtime

**Environment:**
- Node.js 20 in CI via `.github/workflows/ci.yml`; README says Node.js 18+ for local development.
- Browser runtime for the Vite React app.
- Deno Deploy/Supabase Edge Functions for serverless backend functions.
- PostgreSQL on Supabase as the primary persistence layer.

**Package Manager:**
- npm with `package-lock.json`.
- Root scripts live in `package.json`.

## Frameworks

**Frontend:**
- React 18.3 - Route-level UI and component tree.
- Vite 5.4 - Development server and production bundle.
- React Router 6.30 - Client-side routes in `src/App.tsx`.
- TanStack Query 5.90 - Server-state cache and invalidation.
- Zustand 5 - UI and persisted client state stores.
- Tailwind CSS 3.4, Radix UI, shadcn-style local components, Remix Icon - UI primitives and styling.

**Backend:**
- Supabase Auth, Postgres, RLS, RPCs, and Edge Functions.
- Supabase JS 2.84 in the browser and Supabase JS from `esm.sh` in Edge Functions.
- Vercel AI SDK / OpenRouter in Edge Functions for AI actions and MCP AI tools.

**Testing:**
- Vitest 4 with jsdom for unit and integration-style tests.
- Testing Library React and jest-dom matchers for component tests.
- Playwright 1.57 for E2E and API smoke tests.
- k6 load test script in `load-tests/callvault.k6.js`.

**Build/Dev:**
- TypeScript compiler via `npm run type-check`.
- ESLint 9 flat config via `eslint.config.js`.
- Sentry Vite plugin in `vite.config.ts` uploads hidden sourcemaps when `SENTRY_AUTH_TOKEN` is set.
- Rollup visualizer enabled when `ANALYZE` is set.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` - Auth, database, and Edge Function invocation.
- `@tanstack/react-query` - Query cache, mutation flow, and invalidation contracts.
- `react-router-dom` - Protected route and OAuth callback routing.
- `@dnd-kit/core` / `@dnd-kit/sortable` - Drag/drop for workspaces, folders, and call assignment.
- `zod` - Runtime schemas in AI/MCP and validation code.
- `ai`, `@ai-sdk/openai`, OpenRouter provider imports in Edge Functions - LLM calls.
- `@sentry/react` and `@sentry/vite-plugin` - Frontend error tracking and sourcemaps.

**Infrastructure:**
- Supabase CLI-generated types in `src/integrations/supabase/types.ts`.
- `pg` and `tsx` for Node-side scripts and live verification utilities.
- `dotenv` for local and Playwright config loading.

## Configuration

**Environment:**
- Browser build requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; `src/integrations/supabase/client.ts` throws if either is missing.
- Edge Functions require service variables such as `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, provider credentials, webhook secrets, AI keys, and payment keys.
- `.env.example` is the safe reference for required variable names. Do not copy secret values from local `.env` files into docs or commits.

**Build:**
- `vite.config.ts` sets dev server host `::`, port `3001`, `@` alias to `src`, `@shared` alias to `supabase/functions/_shared`, hidden sourcemaps, Sentry upload, and optional bundle analysis.
- `tsconfig.json` uses project references, aliases, `allowJs`, `noUnusedLocals`, `noUnusedParameters`, `skipLibCheck`, and non-strict null checks.
- `vitest.config.ts` stubs Supabase env vars for tests and includes both `src/**/*.test.{ts,tsx}` and Edge Function `__tests__`.
- `playwright.config.ts` starts `npm run dev` for browser projects and defines an API-only project for MCP tests.

## Platform Requirements

**Development:**
- Node/npm installed.
- A Supabase project or test environment for live/integration tests.
- Docker is only needed for a local Supabase stack; `supabase/CLAUDE.md` notes local Docker may be unavailable on the maintainer machine.
- Source/provider credentials are needed for live connector verification.

**Production:**
- Vercel is the documented frontend hosting target.
- Supabase hosts Postgres, Auth, and Edge Functions.
- GitHub Actions runs CI, security, deployment, and uptime workflows.
- Cloudflare appears in docs/env as an API/MCP proxy layer for `api.callvaultai.com` and `mcp.callvaultai.com`.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run type-check
npm run test
npm run test:coverage
npm run test:e2e
npm run verify:connectors:live
```

---
*Stack analysis: 2026-05-27*
*Update after major dependency, runtime, deployment, or provider changes*
