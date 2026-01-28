# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**
- TypeScript 5.x - Used across frontend (React) and backend (Supabase Edge Functions)

**Secondary:**
- SQL (PostgreSQL) - Database schema and RPC functions
- HTML/CSS - Markup and styling via Tailwind

## Runtime

**Environment:**
- Node.js - Development tooling
- Deno - Supabase Edge Functions runtime

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (implied, typical for npm)

## Frameworks

**Core:**
- React ^18.3.1 - UI Component library
- Vite ^5.4.19 - Build tool and development server
- React Router ^6.30.1 - Client-side routing

**UI & Styling:**
- Tailwind CSS ^3.4.18 - Utility-first styling
- Radix UI - Accessible UI primitives (extensive usage)
- Headless UI - Accessible UI components
- Tremor ^3.18.7 - Dashboard and chart components
- Lucide React / Remix Icon - Iconography

**State Management:**
- Zustand ^5.0.9 - Client-side global state
- TanStack Query (React Query) ^5.90.10 - Server state management

**Testing:**
- Vitest ^4.0.16 - Unit and integration testing
- Playwright ^1.57.0 - End-to-end testing

## Key Dependencies

**AI & Machine Learning:**
- Vercel AI SDK (`ai`, `@ai-sdk/openai`) - AI streaming and orchestration
- OpenRouter - Access to LLM models in Edge Functions
- Hugging Face Inference API - Reranking search results (`cross-encoder/ms-marco-MiniLM-L-12-v2`)

**Infrastructure:**
- `@supabase/supabase-js` ^2.84.0 - Supabase client
- `date-fns` - Date manipulation
- `zod` - Schema validation

## Configuration

**Environment:**
- `.env` files for local development
- Supabase Secrets for production/edge functions
- Key configs: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`

**Build:**
- `vite.config.ts` - Main build configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Styling configuration

## Platform Requirements

**Development:**
- Node.js (Latest LTS recommended)
- Supabase CLI (for local dev and function deployment)

**Production:**
- Supabase Platform (Database, Auth, Edge Functions, Storage)
- Vercel / Netlify / Similar (Static Frontend Hosting)

---

*Stack analysis: 2026-01-26*
