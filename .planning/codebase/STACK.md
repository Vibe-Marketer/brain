# Technology Stack

**Analysis Date:** 2026-05-27

## Languages

**Primary:**
- TypeScript 5.8 — frontend (`src/`) and Supabase Edge Functions (`supabase/functions/`)
- TypeScript (Deno runtime) — all Edge Functions use Deno-style imports (`https://esm.sh/`, `npm:`, `https://deno.land/`)

**Secondary:**
- CSS (PostCSS + Tailwind) — styling
- SQL — database migrations (`supabase/migrations/*.sql`)

## Runtime

**Frontend:**
- Node.js 26.x (installed via Homebrew — no `.nvmrc`)
- Browser target: ES2020

**Backend (Edge Functions):**
- Deno (Supabase Edge Runtime) — each function in `supabase/functions/<name>/index.ts`
- Deno config: `supabase/functions/deno.json`

**Cloudflare Worker:**
- `cloudflare/api-proxy/worker.ts` — routes `api.callvaultai.com` to Supabase Edge Functions

## Package Manager

- **npm** — frontend only (never pnpm, never bun for this project)
- Lockfile: `package-lock.json` (present, committed)
- Edge Functions: no package manager — imports via `https://esm.sh/`, `npm:`, `https://deno.land/std`

## Frameworks

**Core:**
- React 18.3 — UI framework (`src/`)
- Vite 5.4 — build tool + dev server (port 3001); config: `vite.config.ts`
- react-router-dom 6.30 — client-side routing (`BrowserRouter`, `src/pages/` directory)

**UI Libraries:**
- Tailwind CSS 3.4 — utility-first styling; config: `tailwind.config.ts`
- Radix UI — individual headless component packages (`@radix-ui/react-*`)
- shadcn/ui pattern — Radix primitives + Tailwind CVA wrappers in `src/components/ui/`
- Tremor 3.18 — analytics/chart components
- motion 12 — animations (`import { motion } from 'motion/react'` — NOT framer-motion)
- Sonner 1.7 — toast notifications
- @dnd-kit — drag-and-drop (core, sortable, utilities)

**State Management:**
- Zustand 5.0 — client state (double-invocation syntax: `create<T>()((set) => ({`)
- TanStack Query 5.90 — server state + caching

**AI / LLM (Frontend):**
- `@ai-sdk/openai` 3.0, `@ai-sdk/react` 3.0, `ai` 6.0 — Vercel AI SDK (frontend side, per `AI-02` constraint: zero AI/RAG code in frontend components; SDK wired in `src/lib/api-client.ts` only)

**AI / LLM (Edge Functions):**
- `@openrouter/ai-sdk-provider` 1.2.8 (via esm.sh) — all Edge Function AI calls route through OpenRouter
- `ai` (Vercel AI SDK) 5.0.102 (via esm.sh) — `generateText`, `generateObject`

**Testing:**
- Vitest 4.0 — unit + integration tests; config: `vitest.config.ts`
- @testing-library/react 16.3 — component testing
- Playwright 1.57 — E2E tests; config: `playwright.config.ts`

**Build/Dev:**
- @vitejs/plugin-react-swc 3.11 — SWC-based React transform (faster than Babel)
- @sentry/vite-plugin 5.3 — source map upload during production builds
- rollup-plugin-visualizer — bundle size analysis (opt-in via `ANALYZE=1`)
- tsx 4.20 — TypeScript script execution (used in `scripts/`)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.84 — primary data/auth client; instantiated in `src/integrations/supabase/client.ts`
- `zod` 3.25 — runtime validation (frontend + Edge Functions)
- `react-router-dom` 6.30 — routing; uses `BrowserRouter`, not TanStack Router
- `@remixicon/react` 4.7 — ONLY allowed icon library (hard constraint `AI-02` area)
- `@sentry/react` 10.28 — error monitoring (initialized in `src/main.tsx` via `src/lib/sentry.ts`)

**Infrastructure:**
- `date-fns` 3.6 + `date-fns-tz` 3.2 — date manipulation
- `tailwind-merge` 2.6 + `class-variance-authority` 0.7 — Tailwind class composition
- `next-themes` 0.3 — dark/light mode provider
- `driver.js` 1.4 — product tour/onboarding
- `docx` 9.5, `jspdf` 4.0, `jszip` 3.10, `file-saver` 2.0 — document export
- `react-markdown` 10.1, `shiki` 3.15 — Markdown rendering with syntax highlighting
- `react-day-picker` 9.11 — date picker component

**Dev Only:**
- `@playwright/test` 1.57 + `@axe-core/playwright` 4.11 — E2E + accessibility testing
- `@vitest/coverage-v8` 4.0 — coverage reporting
- `pg` 8.18 — direct Postgres connections in scripts
- `dotenv` 17.3 — env loading in scripts

## Configuration

**Environment:**
- Frontend env: `VITE_*` prefixed variables loaded by Vite; documented in `.env.example`
- Edge Function env: set as Supabase secrets; accessed via `Deno.env.get()`
- `.env.example` — full env documentation with all required/optional vars
- `.env.test.example` — integration test env template

**Key frontend env vars:**
- `VITE_SUPABASE_URL` — Supabase project URL (required)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (required)
- `VITE_SENTRY_DSN` — Sentry DSN (optional, disables tracking if absent)
- `VITE_API_BASE_URL` — Edge Function API base (defaults to `https://api.callvaultai.com`)

**Build:**
- `vite.config.ts` — Vite config with React SWC, Sentry plugin, path aliases (`@/` → `src/`, `@shared/` → `supabase/functions/_shared/`)
- `tsconfig.json` — root tsconfig with path aliases matching Vite
- `tsconfig.app.json` — strict browser target (ES2020, bundler module resolution)
- `tsconfig.node.json` — Node target for Vite config files
- `tailwind.config.ts` — full semantic color system, custom font families (Inter + Montserrat), Tremor theme integration
- `postcss.config.js` — PostCSS with Tailwind + Autoprefixer
- `eslint.config.js` — ESLint 9 flat config with `typescript-eslint` + `eslint-plugin-react-hooks`
- `vercel.json` — deployment config; rewrites SPA routes to `/index.html`, adds security headers

## Platform Requirements

**Development:**
- Node.js via Homebrew (currently v26.0.0)
- Supabase CLI (for `supabase functions serve` and `supabase functions deploy --use-api`)
- Docker NOT required — `supabase functions deploy --use-api` bypasses Docker

**Production:**
- Frontend: Vercel (auto-deploys from `main`); URL: `https://app.callvaultai.com`
- Backend: Supabase Edge Functions; project ID: `vltmrnjsubfzrgrtdqey`
- API proxy: Cloudflare Worker at `api.callvaultai.com` (`cloudflare/api-proxy/worker.ts`)
- Database: Supabase PostgreSQL (project `vltmrnjsubfzrgrtdqey`)

---

*Stack analysis: 2026-05-27*
