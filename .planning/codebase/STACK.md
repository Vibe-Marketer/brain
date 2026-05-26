# Technology Stack

**Analysis Date:** 2026-05-26

## Languages

**Primary:**
- TypeScript 5.8 - All application code (React frontend, Supabase Edge Functions, Cloudflare Workers)

**Secondary:**
- SQL (PostgreSQL) - Database schema, migrations, and RPC functions in `supabase/`
- HTML/CSS - Markup (JSX) and styling via Tailwind CSS

## Runtime

**Environment:**
- Node.js v20+ - Local development, build tooling, and test execution
- Deno - Supabase Edge Functions runtime in `supabase/functions/`
- Cloudflare Workers - Public API reverse-proxy routing layer in `cloudflare/api-proxy/`

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React ^18.3.1 - UI component library
- React Router DOM ^6.30.1 - Client-side SPA routing

**Testing:**
- Vitest ^4.0.16 - Unit and integration testing
- Playwright ^1.57.0 - End-to-end testing
- Axe-Core Playwright ^4.11.1 - Accessibility testing
- Testing Library (@testing-library/react ^16.3.0) - React component rendering tests

**Build/Dev:**
- Vite ^5.4.19 - Build tool and development server bundling
- TypeScript compiler (tsc ^5.8.3) - Static type checking

## Key Dependencies

**Critical:**
- Vercel AI SDK (`ai` ^6.0.66, `@ai-sdk/openai` ^3.0.24, `@ai-sdk/react` ^3.0.68) - AI streaming and tool orchestration
- `@supabase/supabase-js` ^2.84.0 - Database client and authentication interface
- `@polar-sh/sdk` (latest) - Polar.sh subscription and billing webhook handling
- `zod` ^3.25.76 - Schema validation

**Infrastructure:**
- Tailwind CSS ^3.4.19 (with `@tailwindcss/vite` ^4.2.1 bridge) - Utility-first styling framework
- Zustand ^5.0.11 - Client-side global state management
- `@tanstack/react-query` ^5.90.10 - Server state management and caching
- Sentry (`@sentry/react` ^10.28.0, `@sentry/vite-plugin` ^5.3.0) - Error tracking and crash reporting

## Configuration

**Environment:**
- Configured via `.env` files (local development) and Supabase Secrets (edge functions)
- Key variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_WEBHOOK_SECRET`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `SENTRY_ORG`, `SENTRY_AUTH_TOKEN`

**Build:**
- `vite.config.ts` - Main Vite and build configuration
- `tsconfig.json` (along with `tsconfig.app.json`, `tsconfig.node.json`) - TypeScript compilation rules
- `tailwind.config.ts` - Tailwind theme configuration
- `postcss.config.js` - CSS post-processing configuration
- `eslint.config.js` - Code quality and styling rules

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js)
- Supabase CLI - For migrations, local database, and function testing/deployments
- Cloudflare Wrangler CLI - For proxy worker development and deployments

**Production:**
- Supabase Platform - Database, Auth, Storage, Edge Functions
- Vercel - Static Web Frontend (SPA) hosting
- Cloudflare Workers - Public reverse-proxy routing layer for `api.callvaultai.com` and `mcp.callvaultai.com`
- Polar.sh - Billing & subscription management gateway
- Resend.com - Transactional email delivery
- Langfuse - LLM observability platform

---

*Stack analysis: 2026-05-26*
*Update after major dependency changes*
