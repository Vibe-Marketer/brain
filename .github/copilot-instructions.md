<!--
  Purpose: Provide short, actionable guidance for AI coding agents working on this repo.
  Keep this file concise (20-50 lines) and reference key files and commands developers will need.
-->
# Copilot / AI agent instructions — TruBrain

Short, focused guidance for code edits and feature work in this repository.

- Project type: Vite + React + TypeScript frontend with Supabase serverless functions.
- Where to look:
  - Frontend app: `src/` (pages in `src/pages/`, reusable UI in `src/components/`, utilities in `src/lib/`).
  - Supabase client used by the app: `src/integrations/supabase/client.ts` (reads VITE_* env vars).
  - Server-side: Supabase Functions in `supabase/functions/` — these are Deno-style functions (use `Deno.serve`).
  - Database migrations: `supabase/migrations/` (SQL files).

Core workflows & commands (from `package.json`):

- Install deps: `npm i`
- Run dev frontend: `npm run dev` (Vite)
- Build frontend: `npm run build` (Vite)
- Lint: `npm run lint` (ESLint)

Notes about serverless functions and environment variables:
- Functions under `supabase/functions/*` are written for Deno (they use `Deno.serve` and `Deno.env`). Treat them as separate run/debug targets.
  - Example: `supabase/functions/webhook/index.ts` verifies `webhook-signature`, checks `processed_webhooks` for idempotency, and upserts into `fathom_calls` and `fathom_transcripts`.
  - Functions expect Supabase service role keys and URL via environment (eg. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`).
  - To execute a function locally for debugging, run with Deno allowing env/net: e.g. `deno run --allow-env --allow-net supabase/functions/webhook/index.ts` (adjust flags and entry if embedding in a small runner).

Key code patterns to follow / be aware of:
- Supabase client (frontend): `src/integrations/supabase/client.ts` uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. It relies on browser `localStorage` for auth persistence.
- Database writes: functions use `upsert` on `fathom_calls` with `onConflict: 'recording_id'` and delete-then-insert for transcript segments (so edits often require careful idempotency reasoning).
- Security: webhook code verifies signatures (header `webhook-signature`) and early-returns on invalid signatures.
- Background processing: webhook handler returns early (ack) and processes in background — be careful when changing to synchronous logic.

Conventions:
- UI components follow shadcn-style structure in `src/components/ui/` — prefer using existing components rather than duplicating styles.
- Pages live in `src/pages/` and are wired via `react-router-dom`.
- Small helper hooks are in `src/hooks/` and context providers in `src/contexts/`.

When making changes:
- Update `README.md` or add short notes to `supabase/` when you change runtime expectations (env vars, Deno flags, required DB migrations).
- If you modify DB schema, add a SQL migration under `supabase/migrations/` and reference it in your PR description.

Architecture Decision Records (ADRs):
- When making significant technical decisions (database changes, AI provider choices, major schema changes), create an ADR in `docs/adr/`.
- Copy `docs/adr/adr-template.md`, fill in Context/Decision/Consequences, save as `adr-XXX-title.md`.
- Update `docs/adr/README.md` with the new entry.
- Time limit: 10-15 minutes max per ADR.

Key reference files:
- Brand guidelines: `docs/design/brand-guidelines-v4.1.md` (UI/design rules)
- Design principles: `docs/design/design-principles-conversion-brain.md` (world-class SaaS design)
- **API naming conventions: `docs/architecture/api-naming-conventions.md` (function/hook/type naming)**
- AI SDK examples: `docs/ai-sdk-cookbook-examples/` (Vercel AI SDK patterns)
- ADR system: `docs/adr/` (architectural decisions)

API naming quick reference:
- Edge Functions: kebab-case folders (`fetch-meetings/`)
- Frontend functions: camelCase (`fetchMeetings()`)
- Hooks: use + camelCase (`useMeetingsSync()`)
- Types/Interfaces: PascalCase (`Meeting`, `ApiResponse`)
- Database fields: snake_case (`recording_id`)

Code quality workflows (available via Claude Code):
- `/code-review` - Comprehensive code review before PRs
- `/security-review` - Security-focused analysis for auth, input handling, secrets
- `/design-review` - UI/UX validation with Playwright screenshots

Review workflow:
1. After completing code → `/code-review`
2. Before PR → `/security-review`
3. UI changes → `/design-review`

If anything is ambiguous, ask which environment you want to run (frontend dev server vs Deno function). Give snippets that reference exact file paths above.

— End of guidance —
