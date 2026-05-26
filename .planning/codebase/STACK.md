# Technology Stack

**Analysis Date:** 2026-05-26

## Languages

**Primary:**
- TypeScript 5.8 - Used across frontend (React) and backend (Supabase Edge Functions, Cloudflare Workers)

**Secondary:**
- SQL (PostgreSQL) - Database schema, migrations, and RPC functions in `supabase/`
- HTML/CSS - Markup and styling via Tailwind CSS v3 / v4 integration

## Runtime

**Environment:**
- Node.js (v20+ recommended) - Local development and frontend build tooling
- Deno - Supabase Edge Functions runtime in `supabase/functions/`
- Cloudflare Workers - Public API reverse-proxy routing layer in `cloudflare/api-proxy/`

**Package Manager:**
- npm
- Lockfile: `package-lock.json`

## Frameworks

**Core:**
- React ^18.3.1 - UI Component library
- Vite ^5.4.19 - Build tool and development server
- React Router DOM ^6.30.1 - Client-side routing

**UI & Styling:**
- Tailwind CSS ^3.4.19 (with `@tailwindcss/vite` ^4.2.1 support) - Styling utility
- Radix UI primitives (various packages) - Accessible UI component primitives
- Headless UI (`@headlessui/tailwindcss` ^0.2.2) - Unstyled accessible UI components
- Tremor ^3.18.7 - Dashboard components and charts
- Remix Icon (`@remixicon/react` ^4.7.0) - Brand iconography
- Motion ^12.34.3 - Animations (Framer Motion replacement)
- Sonner ^1.7.4 - Notification system (toasts)

**State Management:**
- Zustand ^5.0.11 - Client-side global state management
- TanStack React Query (React Query) ^5.90.10 - Server state management and caching

**Testing:**
- Vitest ^4.0.16 - Unit and integration testing
- Playwright ^1.57.0 - End-to-end testing
- Axe-Core Playwright (`@axe-core/playwright` ^4.11.1) - Accessibility testing
- Testing Library (`@testing-library/react` ^16.3.0) - React component rendering tests

## Key Dependencies

**AI & Machine Learning:**
- Vercel AI SDK (`ai` ^6.0.66, `@ai-sdk/openai` ^3.0.24, `@ai-sdk/react` ^3.0.68) - AI streaming and tool orchestration
- OpenRouter - Access to LLM models (`openai/gpt-5-nano` default) in edge functions and MCP server
- OpenAI Whisper - Audio transcription service API endpoint (`whisper-1`)

**Infrastructure:**
- `@supabase/supabase-js` ^2.84.0 - Database client and authentication interface
- `@polar-sh/sdk` - Polar.sh subscription and billing webhook handling
- `date-fns` ^3.6.0 & `date-fns-tz` ^3.2.0 - Date manipulation and time zone helpers
- `zod` ^3.25.76 - Schema validation

**Observability & Monitoring:**
- Langfuse - LLM tracing and observability for Edge Functions in `supabase/functions/_shared/langfuse.ts`
- Sentry (`@sentry/react` ^10.28.0, `@sentry/vite-plugin` ^5.3.0) - Error tracking and crash reporting

**Document & File Utils:**
- `docx` ^9.5.1 - Word document generation
- `file-saver` ^2.0.5 - Frontend file downloads
- `html2canvas-pro` ^1.5.13 - HTML to canvas rendering
- `jspdf` ^4.0.0 - PDF generation
- `jszip` ^3.10.1 - ZIP archive extraction/creation
- `shiki` ^3.15.0 - Syntax highlighting
- `driver.js` ^1.4.0 - Interactive onboarding tours

## Configuration

**Environment:**
- Local development: `.env` files
- Production/Staging: Supabase Secrets for edge functions
- Key configuration variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_WEBHOOK_SECRET`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `SENTRY_ORG`, `SENTRY_AUTH_TOKEN`

**Build:**
- `vite.config.ts` - Main Vite and build bundler configuration
- `tsconfig.json` (plus `tsconfig.app.json`, `tsconfig.node.json`) - TypeScript rules
- `tailwind.config.ts` - Tailwind layout and theme configuration
- `postcss.config.js` - CSS post-processing configuration
- `eslint.config.js` - Code quality and style rules

## Platform Requirements

**Development:**
- Node.js LTS
- Supabase CLI (for migrations, local database, and function deployments)
- Cloudflare Wrangler CLI (for proxy worker deployment)

**Production:**
- Supabase Platform (Database, Auth, Storage, Edge Functions)
- Vercel (Static Web Frontend hosting)
- Cloudflare Workers (Public reverse-proxy routing layer for `api.callvaultai.com` and `mcp.callvaultai.com`)
- Polar.sh (Billing & Subscription management gateway)
- Resend.com (Transactional email delivery)
- Langfuse (Observability platform)

---

*Stack analysis: 2026-05-26*
