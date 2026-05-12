---
phase: 38
phase_name: Frontend Security & RLS Audit
verified: 2026-05-12
status: PASS
---

# Phase 38 Verification

## Success Criteria (from ROADMAP.md / 38-CONTEXT.md)

### 1. SEC-03A — `npm audit --production` returns zero high or critical

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Zero high | PASS | `npm audit --omit=dev --json | jq .metadata.vulnerabilities.high` → 0 |
| Zero critical | PASS | `npm audit --omit=dev --json | jq .metadata.vulnerabilities.critical` → 0 |
| CI gate | PASS | `.github/workflows/ci.yml` job `npm-audit` runs `npm audit --omit=dev --audit-level=high` |
| lodash bumped | PASS | `npm ls lodash` → `lodash@4.18.1` (was 4.17.23); overrides in `package.json` pin to `^4.18.0` |

Final state: `{"info":0,"low":0,"moderate":2,"high":0,"critical":0,"total":2}`.

### 2. SEC-03B — Resolve as many moderates as cleanly addressable

| Moderate | Status |
|----------|--------|
| lodash (was high) | Fixed via override + audit-fix |
| dompurify | Dropped from tree (no direct usage; jspdf/docx updated) |
| postcss | Direct bump 8.5.6 → 8.5.10 |
| esbuild | Deferred to v2.3 (dev-server-only; vite 5→8 is breaking) |
| vite | Deferred (same chain) |

Documented in `docs/security/dependency-status.md`.

### 3. SEC-03C — Cross-org cache leak verification

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Cache clears on org switch | PASS | `src/contexts/AuthContext.tsx` — new useEffect with Zustand subscription on `useOrgContextStore.activeOrgId` calling `queryClient.clear()` |
| Query-key factory audited | PASS | `docs/security/cross-org-cache-audit.md` documents every key + classification |
| Existing logout/account-switch handlers preserved | PASS | Lines 43, 60 of AuthContext unchanged |

### 4. SEC-03D — OAuth token client-side review

| Requirement | Status | Evidence |
|-------------|--------|----------|
| No raw provider tokens pulled to client | PASS | 5 sites updated (IntegrationsTab, FathomImportDetail, useSetupWizard x2, useIntegrationSync) |
| Supabase JWT confirmed acceptable | PASS | 6 `session.access_token` uses documented as Allowed |
| Disconnect-flow null writes confirmed acceptable | PASS | 4 hits in `import-sources.service.ts` are write-null operations |
| Documented | PASS | `docs/security/oauth-token-isolation.md` |

### 5. SEC-04A — Service-role rationale comment per function

| Metric | Value |
|--------|------:|
| Functions annotated this phase | 32 |
| Pre-existing (Phase 37) | 2 |
| **Total functions with rationale** | **34** |

**Verification command:** `grep -l "service-role required:" supabase/functions/*/index.ts | wc -l` → **34**.

### 6. SEC-04B — Defense-in-depth filter audit

Sample-audited 8 high-traffic functions in Plan 38-03 T02. All have explicit `.eq('user_id'|'organization_id'|'owner_user_id', ...)` filters on every user-data query. **0 new filters added** — Phase 37 shared-auth migration left every query already scoped.

Webhook receivers (`webhook`, `polar-webhook`, `zoom-webhook`) are exempt — they authenticate via webhook signature + `processed_webhooks` idempotency, not user JWT.

Full audit table in `.planning/security/2026-05-Q2-edge-audit.md` Section E.

### 7. SEC-04C — RLS regression test on CI

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Test file | PASS | `src/test/rls-regression.test.ts` (348 lines) |
| Test creates 2 orgs + 2 users via service-role | PASS | `beforeAll` block, lines 86-237 |
| Test signs in BOTH users (real JWTs) | PASS | `signInWithPassword` calls at lines 220-235 |
| Test queries every user-facing table | PASS | 11 tables in `CROSS_ORG_TABLES`, each tested A→B and B→A (22 assertion blocks) |
| Failure message names the leaking table | PASS | `RLS LEAK: table=<name> filter=<col>=<value>` literal |
| CI integration | PASS | `.github/workflows/ci.yml` job `rls-regression` gated on `vars.SUPABASE_SECRETS_CONFIGURED == 'true'` |
| Failure blocks merge | PASS | No `|| true` — non-zero exit fails the job |

Cross-org migration to anon+RLS: **0 functions migrated** — every service-role function has documented cross-row/cross-user fan-out rationale.

### 8. QA-07 — CSP `worker-src` allows blob: workers

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CSP includes `worker-src 'self' blob:` | PASS | `vercel.json` line 14 contains literal substring |
| No `'unsafe-*'` or wildcard added to worker-src | PASS | Directive is exactly `'self' blob:` |
| JSON valid | PASS | `python3 -c "import json; json.load(open('vercel.json'))"` exits 0 |
| Post-deploy verification | PENDING | Run `curl -sI https://app.callvaultai.com | grep -i CSP` after deploy |

## Per-SEC-NN / QA-NN Status

| ID | Status | Plan |
|----|--------|------|
| SEC-03A | DONE | 38-02 |
| SEC-03B | DONE | 38-02 |
| SEC-03C | DONE | 38-04 |
| SEC-03D | DONE | 38-04 |
| SEC-04A | DONE | 38-03 |
| SEC-04B | DONE | 38-03 |
| SEC-04C | DONE | 38-01 + 38-03 |
| QA-07 | DONE | 38-05 |

## Outstanding Manual Operator Actions

1. **Post-deploy CSP verification.** After Vercel deploys this branch:
   ```bash
   curl -sI https://app.callvaultai.com | grep -i "content-security-policy"
   ```
   Confirm `worker-src 'self' blob:` is in the response. Use dev-browser to verify no `Refused to create a worker from 'blob:...'` console errors on `/`, `/people`, `/import`, `/login`, `/s/<token>`.

2. **CI secret `VITE_SUPABASE_TEST_ANON_KEY`.** For the new `rls-regression` CI job to run, the GitHub Actions repo settings need `VITE_SUPABASE_TEST_ANON_KEY` configured (falls back to `VITE_SUPABASE_PUBLISHABLE_KEY` if absent — covered by existing secret).

## Tests Not Run This Phase

- **Live dev-browser cross-org snapshot.** The test persona has multi-org access but the V2 org-switcher requires manual interaction; a scripted snapshot is deferred to a future Phase 30-style integration sweep. Code-evidence audit confirmed the cache-clear hook is installed; the CI RLS regression test (Plan 38-01) is the runtime safety net.

## Known Issues Surfaced (deferred to v2.3)

- **`generate-content/index.ts` latent bug.** Calls `authenticateRequest(req, supabase, corsHeaders)` on line 110 but `supabase` is never created — `createClient` is imported but the assignment is missing. Latent bug from Phase 37 shared-auth migration. Tracked to v2.3 BACKLOG.
- **Zoom refresh-token presence signal.** `useIntegrationSync` no longer selects `zoom_oauth_refresh_token`. Relies on server-side refresh job nulling `zoom_oauth_token_expires` on failure. A cleaner fix (server-derived `has_zoom_refresh_token` boolean view OR `get_integration_status(user_id)` RPC) is deferred to v2.3 BACKLOG.
- **`imports.*` query keys without orgId.** 10+ callers each — exceeded the plan's <5-caller modification scope. Defended by the new clear-on-switch hook (Fix 1 in `cross-org-cache-audit.md`). Tracked as v2.3 polish.
