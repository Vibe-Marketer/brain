# Forensic Report: Phase 2 MCP Refactor Safety

**Generated:** 2026-05-27T22:16:22Z
**Problem:** Determine whether the prior Phase 2 MCP monolith refactor was valid, whether it broke MCP behavior, and whether it should be reverted before restarting Phase 2.

---

## Evidence Summary

### Git Activity

- **Suspect commit:** `83693443 feat(2): Phase 2 MCP monolith refactor reconciliation`
- **Author/committer:** `Soren Vale`
- **Commit time:** 2026-05-27 13:58:04 -0400
- **Change size:** 58 files, 4,526 insertions, 3,886 deletions.
- **MCP code change:** `supabase/functions/mcp-server/index.ts` reduced from 3,921 LOC to 133 LOC and added `supabase/functions/mcp-server/tools/{read,write,ai}/`.
- **Push status:** Local `main` is ahead of `origin/main`; `origin/main` remains at `2982f67`. The suspect refactor is not on remote production main.
- **Uncommitted unrelated files at investigation time:** `deno.lock`, two `.planning/forensics/*` handoff/report files, and two `e2e/screenshots/phase1-prod-paste-modal-*` files.

### Production State

- `origin/main:supabase/functions/mcp-server/index.ts` is still 3,921 LOC and contains inline OpenRouter / AI SDK imports.
- Production `https://api.callvaultai.com/mcp` responds correctly to unauthenticated and invalid-token probes with HTTP 401 and `WWW-Authenticate`.
- A real redacted stored MCP token from Supabase production successfully called production `initialize` and `tools/list`; `tools/list` returned 41 tools.
- This production success likely reflects the undeployed `origin/main` monolith, not the local refactor.

### Local Verification

- `deno check supabase/functions/mcp-server/index.ts`: passed.
- `npm run build`: passed.
- Targeted MCP tests:
  - `ai-tools-invariants.test.ts`: passed 63 tests.
  - `write-tools-boundary.test.ts`: passed 48 tests.
  - `category-gating.test.ts`: failed 5 tests.
  - Total: 125 passed, 5 failed.

### Planning Artifacts

- Prior Phase 2 context was auto-generated with discussion skipped: `e6e32bd1 docs(2): auto-generated context (discuss skipped)`.
- Archived prior Phase 2 verification stated `status: partial`, `score: 3/5 local, live/cold-start pending`.
- Archived verification explicitly said:
  - No captured replay fixture diff existed.
  - Deployed cold-start measurement was pending.
  - Live MCP response-shape check was pending.

---

## Anomalies Detected

### Unsafe Auth Extraction — Confidence HIGH

**Evidence:**

- Pre-refactor monolith created a service-role Supabase client and used it for `mcp_tokens` lookup.
- Current local `index.ts` creates both service and anon clients, then passes the anon client into `authenticateMcpRequest`.
- Current local `auth.ts` uses that passed client for `.from('mcp_tokens').select(...).eq('token', rawToken).maybeSingle()`.
- `mcp_tokens` RLS policy is `USING (user_id = auth.uid())`.
- A one-off check with the anon client against a real stored token returned status 200, `has_data: false`, no error.

**Interpretation:** If the local refactor were deployed as-is, valid legacy hex MCP tokens would likely fail lookup as `Invalid MCP token` because anon RLS cannot see token rows without an authenticated Supabase user.

### Targeted Test Regression — Confidence HIGH

**Evidence:**

- `npm test -- --run supabase/functions/mcp-server/__tests__/category-gating.test.ts ...` failed 5 tests.
- Failing checks include expected `enabled_categories` wiring, OAuth synthetic token category default, and category-gating block order.

**Interpretation:** The refactor changed file boundaries without preserving or updating category-gating verification. Some failures are static-test location drift, but they correctly expose that MCP auth/gating behavior is no longer covered at the extracted boundary.

### Unproven Behavior Parity — Confidence HIGH

**Evidence:**

- Phase 2 roadmap requires byte-identical response replay across existing MCP tools.
- Archived prior verification says no captured replay fixture diff exists.
- No current fixture replay artifacts exist in the active Phase 2 directory.

**Interpretation:** The refactor may be structurally close, but it was never proven behavior-equivalent to the monolith.

### Unproven Cold-Start Claim — Confidence MEDIUM

**Evidence:**

- Local registry dynamically imports tool modules.
- Archived prior verification says deployed cold-start measurement was still pending.

**Interpretation:** Dynamic imports appear structurally present, but the required >=30% deployed cold-start improvement was not measured.

### Planning Process Violation — Confidence HIGH

**Evidence:**

- Phase 2 `CONTEXT.md` was auto-generated with discussion skipped.
- User explicitly objected to prior agents not following GSD discuss/plan process.
- Active Phase 2 artifacts were later archived as stale.

**Interpretation:** Even if some code was usable, the Phase 2 implementation did not satisfy the required decision-gathering and verification workflow.

---

## Root Cause Hypothesis

The prior agent performed a broad mechanical extraction of the MCP monolith into generated modules and locally repaired enough syntax/static checks for partial confidence, but did not preserve the service-role authentication boundary, did not complete behavior-parity fixture replay, and did not complete deployed verification. The work should be treated as unsafe local implementation, not as completed Phase 2.

---

## Recommended Actions

1. Revert the local MCP refactor commit `83693443` before it is pushed.
2. Keep the archived Phase 2 artifacts as forensic evidence, not active planning inputs.
3. Restart Phase 2 with a fresh discuss/context pass that explicitly covers:
   - service-role MCP token lookup vs anon JWT validation,
   - replay fixture design,
   - `tools/list` category filtering,
   - `content[].text` response shape,
   - wildcard CORS and `WWW-Authenticate`,
   - dynamic AI dependency loading and real cold-start measurement.
4. Do not push any MCP refactor until targeted tests pass and a real valid token can call `initialize`, `tools/list`, and at least one read tool against the deployed candidate.

---

## Recovery Action Taken

- Reverted the local MCP refactor commit `83693443` before push.
- Kept archived stale Phase 2 planning artifacts under `.planning/forensics/stale-prior-run-2026-05-27/phase-02/`.
- Restored `supabase/functions/mcp-server/index.ts` to the 3,921-line monolith matching `origin/main`.
- Re-ran targeted MCP tests after revert: 3 files passed, 130 tests passed.
- `deno check supabase/functions/mcp-server/index.ts` still fails on the restored monolith with existing type-level Deno issues, so Deno check is not usable as a clean gate until Phase 2 deliberately fixes those. This does not contradict production behavior because `origin/main` has the same monolith shape.

---

*Report generated by `$gsd-forensics`. Secrets and token values redacted.*
