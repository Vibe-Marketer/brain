---
phase: 38
phase_name: Frontend Security & RLS Audit
gathered: 2026-05-11
status: Ready for planning
mode: Auto-generated (well-specified — minor decisions only)
---

# Phase 38: Frontend Security & RLS Audit — Context

<domain>
## Phase Boundary

Audit and harden the frontend codebase + DB RLS policies. Five deliverables:

1. **SEC-03A..D** — Zero high/critical npm vulnerabilities; cross-org cache leak audit; OAuth-token-not-in-client confirmation
2. **SEC-04A..C** — Service-role rationale documented per function; defense-in-depth `.eq()` filters
3. **QA-07** — Close CSP `worker-src` missing (blob: workers blocked globally)
4. **RLS regression test on CI** — smoke test creates 2 orgs, attempts cross-org queries, asserts 0 rows
5. **Frontend security posture** — verified clean before Phase 41 tech debt lockdown

Out of scope: edge function security (Phase 37, prerequisite), AI gating (Phase 41).
</domain>

<decisions>
## Implementation Decisions

### npm Audit Strategy

- `npm audit --production` must return 0 critical AND 0 high. Current state: 1 transitive lodash high + several moderates (dompurify, esbuild, postcss, vite).
- **Resolution path:**
  - lodash high → use `overrides` in package.json to force a patched version, OR bump the direct dep that pulls in lodash.
  - dompurify / esbuild / postcss / vite moderates → fix where cleanly possible (bump direct deps); document deferred ones with PRs upstream.
- Each fix is its own commit with `chore(deps): bump X to Y for CVE-NNNN-NNNN`.
- Final state: `npm audit --production` returns clean for high/critical; moderate findings have explicit accept/defer notes in `docs/security/dependency-status.md`.

### Cross-Org Cache Leak Audit

- **Test method:** dev-browser scripted flow — sign in, load Org A, capture React Query cache state (`queryClient.getQueryCache()`), switch to Org B, capture again. Compare for any Org A residue (call IDs, folder IDs, contact IDs).
- **Fix pattern:** every TanStack Query key must include `orgId` (or `workspaceId`) as part of the key. Audit `src/lib/query-config.ts` to confirm. Any query that doesn't get `clear()` on org switch is suspect.
- **Acceptance:** zero Org-A keys remain in cache after switching to Org B.

### OAuth Token Client-Side Audit

- Grep for any client-side reference to `access_token`, `refresh_token`, or provider-specific token names in `src/` outside of Supabase auth (which uses its own JWT, not provider tokens).
- All Google/Fathom/Zoom raw tokens MUST be server-side only (in `import_sources`, `user_settings`, or similar, encrypted per Phase 37 SEC-09).
- Document the finding in `docs/security/oauth-token-isolation.md`.

### Service-Role Rationale (SEC-04A..C)

- Audit every edge function that creates a service-role client (`createClient(url, SERVICE_ROLE_KEY)`).
- Add top-of-file comment: `// service-role required: <reason>` (e.g., "service-role required: needs to write to processed_webhooks regardless of user context", "service-role required: cross-user query for org membership").
- If a function can't justify service-role, migrate to anon + RLS.
- **Defense-in-depth:** every service-role function that touches user data adds explicit `.eq('organization_id', orgId)` or `.eq('user_id', userId)` filter alongside RLS. Even though RLS protects, the explicit filter catches RLS misconfiguration.

### RLS Regression Test (CI-Enforced)

- Vitest integration test (`src/test/rls-regression.test.ts` — real DB):
  - Create 2 orgs via service-role.
  - Use Org A's user JWT to query every user-facing table (`recordings`, `folders`, `tag_preferences`, `workspaces`, etc.).
  - Use Org B's user JWT to attempt to fetch Org A's data.
  - Assert: 0 rows returned from cross-org queries.
- Test runs on every CI build via `package.json:scripts:test:integration` (already exists post-Phase-30).
- Failure mode: CI blocks merge with clear error message naming the table that leaked.

### QA-07 CSP `worker-src` Fix

- Audit current CSP header config (likely in `vite.config.ts` or Vercel `vercel.json` headers).
- Add `worker-src 'self' blob:` to allow blob: workers (used by audio/video processing if applicable).
- Verify the change doesn't widen attack surface beyond worker scripts (no `unsafe-inline`, no `unsafe-eval`).

### Test Strategy

- Each fix has an automated test where feasible:
  - npm audit gate (CI step)
  - RLS regression test (CI step)
  - Cross-org cache leak (Vitest UI test with dev-browser)
  - Service-role comment lint rule (custom ESLint rule or grep-based CI check)
- Live verification via dev-browser on prod after deploy.

### Sequencing

1. RLS regression test first — it's the safety net for everything else.
2. npm audit cleanup — independent.
3. Service-role rationale documentation + defense-in-depth filters.
4. Cross-org cache leak audit.
5. OAuth token isolation audit.
6. QA-07 CSP fix.
</decisions>

<code_context>
## Existing Code Insights

**Likely target files:**
- `package.json` + `package-lock.json` — npm audit
- `src/lib/query-config.ts` — query key factory
- `src/contexts/AuthContext.tsx` — token handling
- Every `supabase/functions/*/index.ts` with `SERVICE_ROLE_KEY` — annotation needed
- `vite.config.ts` or `vercel.json` — CSP headers
- New: `src/test/rls-regression.test.ts`

**Dependencies on prior phases:**
- Phase 30 added integration test infra (`src/test/integration-setup.ts`) — reuse.
- Phase 37 ships `_shared/auth.ts` and encryption — verify these don't introduce new vulnerabilities.
</code_context>

<specifics>
- **SEC-03A..D** — npm audit clean, no cross-org cache, no client-side OAuth tokens
- **SEC-04A..C** — service-role rationale + defense-in-depth filters
- **QA-07** — CSP worker-src
- RLS CI regression test

## Success Criteria

1. `npm audit --production` clean.
2. Cross-org switch leaves no Org-A cache residue.
3. No raw OAuth provider tokens in client.
4. Every service-role function has rationale comment + redundant org/user filter.
5. RLS regression test on CI passes; tampering with RLS breaks CI.
6. CSP worker-src allows blob: workers.

## Verification Strategy

- CI gates: npm audit + RLS regression.
- Dev-browser cross-org leak test.
- grep audit + documented findings.
- Live production verification.
</specifics>

<canonical_refs>
- `.planning/ROADMAP.md` — Phase 38
- `.planning/REQUIREMENTS.md` — SEC-03A..04C, QA-07
- `.planning/phases/37-edge-function-security-hardening/37-CONTEXT.md` — prerequisite
- `supabase/CLAUDE.md` — RLS conventions, service-role rules
- `src/lib/query-config.ts` — query key factory
- OWASP Top 10 — frontend security baseline
- `src/test/integration-setup.ts` (Phase 30) — test infra to reuse
</canonical_refs>

<deferred>
## Deferred Ideas

- **Renovate / Dependabot automation** — automatic dependency PRs. v2.3.
- **CSP report-uri / report-to** — collect violations from production. v2.3.
- **SRI (Subresource Integrity)** on external CDN imports — defer if no external CDN deps.
- **Per-org JWT scopes** — finer-grained tokens. Deferred to enterprise tier.
</deferred>
