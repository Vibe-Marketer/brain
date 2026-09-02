# Phase 32 — Deferred Items

Out-of-scope discoveries logged per the executor's scope-boundary rule (fix only what the
current task's changes directly caused; log everything else here instead of fixing it).

## Pre-existing full-suite test failures, unrelated to Plan 01's changes

**Found during:** Plan 32-01, plan-level verification step (`npx vitest run` full suite,
required by the plan's own `<verification>` block: "Full unit suite `npx vitest run` shows
no new failures").

**What happened:** The full suite shows 13 failing tests across 5 files. None of the 5 files
import, reference, or transitively depend on `supabase/functions/_shared/dedup-fingerprint.ts`
or `supabase/functions/_shared/event-resolver.ts` (the only two source files this plan
modified), and Plan 01's other changes were a single scoped `resolve.alias` entry in
`vitest.config.ts` (exact-string-matched to one esm.sh URL) and one devDependency addition
(`fastest-levenshtein`) — neither plausibly affects unrelated admin-UI/RPC-type-smoke/JWT-auth
test files. These are pre-existing failures on the `v2.2-event-resolution` branch, not
introduced by this plan.

**The 5 failing files / 13 failing tests:**

| File | Failing tests | Domain |
|------|---------------|--------|
| `src/components/support/__tests__/SupportTicketDialog.test.tsx` | 2 (pre-dialog screenshot capture timing, D-01) | Support popover UI |
| `src/pages/admin/__tests__/AuditSection.test.tsx` | 4 (human source badges, error state, plain-English rendering, empty state) | Admin audit log UI |
| `src/pages/admin/__tests__/DashboardSection.recurrence.test.tsx` | 5 (autopilot ticket recurrence-class UI states) | Admin dashboard UI (autopilot ticket recurrence -- unrelated to meeting-recurrence/F5) |
| `src/test/rpc-type-smoke.test.ts` | 1 (`verify_rpc_type_signatures()` returns zero rows) | DB RPC type-signature drift |
| `supabase/functions/mcp-server/__tests__/sec-jwt-fix.test.ts` | 1 (`atob()` absent from `auth.ts`, ISC-8-12) | MCP JWT auth security regression |

**Why not fixed:** Plan 01's declared `<files>` are `dedup-fingerprint.ts`,
`dedup-fingerprint.test.ts`, `event-resolver.ts`, `event-resolver.test.ts`. Fixing any of the
5 files above would mean editing admin UI components, an RPC signature (DB migration), or the
MCP server's `auth.ts` -- all unrelated subsystems, out of scope per the executor's scope
boundary. Not baselined (no `type-check`-style baseline mechanism exists for test failures in
this repo) -- simply logged here for a future phase/plan to triage and fix.

**Follow-up:** A future plan (or a dedicated hardening pass) should investigate each of these
5 files independently. `rpc-type-smoke.test.ts` and `sec-jwt-fix.test.ts` in particular sound
security/correctness-relevant (RPC type drift, JWT pivot prevention) and may warrant priority
over the two UI-only files.
