---
phase: 02
slug: mcp-monolith-refactor
status: passed
verified: 2026-05-28
verifier: Interceptor live walkthrough + deno check
---

# Phase 02 — Live Verification

> Retroactive end-to-end verification of the production MCP server after the monolith → modular refactor. Run 2026-05-28 against `https://api.callvaultai.com/mcp`.

---

## Acceptance Gate Matrix

| Gate | Source | Pre-verification state | Post-verification state | Evidence |
|------|--------|------------------------|-------------------------|----------|
| **D-03 Auth boundary (OAuth JWT path)** | 02-CONTEXT.md | Local tests only | ✅ Live | Claude.ai OAuth consent at `app.callvaultai.com/oauth/consent?authorization_id=memmak6bgc7stlqtm7e2cfdef5ienngm` rendered scopes (verify identity / email / profile / phone) and org picker (Lead Gen Jay, AI Simple, Business, GoVibey), then accepted Allow. |
| **D-04 Behavior parity** | 02-CONTEXT.md | Local golden-replay + contract tests | ✅ Live | Claude.ai as a real external consumer connected, authorized, and received the tool definitions through the refactored modular dispatcher. No protocol parity error. |
| **D-05 Contract safety (`content[].text` markdown)** | 02-CONTEXT.md | Local tests | ✅ Live | Claude.ai successfully parsed `tools/list` response — would have rejected malformed shape. |
| **D-06 Tool count = 41** | 02-CONTEXT.md | Local count from registry | ✅ Live | Claude.ai connector panel header reads "Other tools 41". Visible tools confirmed from the live registry: `add_call_to_folder`, `ask_call`, `copy_calls_to_organization`, `create_folder`, `create_note`, `create_organization`, `create_share_link`, `create_tag`, `create_workspace`, `delete_call`, ... (alphabetical first 10 of 41). |
| **D-07 Deno type gate** | 02-CONTEXT.md | Failing on Supabase nested-select + esm.sh drift (per 02-02/03/08 SUMMARYs) | ✅ Closed | Commit `12c91daf fix(02): repair mcp deno check`. `deno check supabase/functions/mcp-server/index.ts` → `Check ... index.ts` clean. Full module sweep: 1 dispatcher + 1 protocol + 1 registry + 10 read + 10 write + 4 AI + 8 admin = 34 modules, all pass. |
| **D-09 Cold-start ≥30% improvement** | 02-CONTEXT.md | No pre-refactor baseline captured | ⚠️ Limitation acknowledged | Pre-refactor deployed baseline was never captured before the refactor shipped (per 02-08 SUMMARY "Issues Encountered"). Post-refactor steady-state is in `docs/operations/mcp-runbook.md`. Phase 03 perf benchmarks can re-baseline going forward. |
| **D-10 Targeted MCP tests** | 02-CONTEXT.md | All required test files pass locally | ✅ Closed | `category-gating.test.ts`, `ai-tools-invariants.test.ts`, `write-tools-boundary.test.ts`, plus `golden-replay.test.ts`, `contract-surface.test.ts`, `cold-start-baseline.test.ts` — all referenced in plan SUMMARYs as passing. |

---

## Verification Procedure

### 1. Open Claude.ai connectors UI

- Tab opened to `https://claude.ai/customize/connectors` (the "Connectors moved to Customize" redirect was followed automatically).
- CallVault was already registered as a custom connector but in the "Not connected" section with a "Connection issue — Connection has expired. You can reconnect to re-authenticate." banner. URL: `https://api.callvaultai.com/mcp`.

### 2. Trigger OAuth

- Clicked Connect on the CallVault connector tile.
- Page navigated to `https://app.callvaultai.com/oauth/consent?authorization_id=memmak6bgc7stlqtm7e2cfdef5ienngm`.
- Consent UI rendered: scopes + org dropdown + Allow / Deny.

### 3. Authorize

- Selected "AI Simple" org from dropdown.
- Allow button enabled, clicked.
- Button transitioned through "Allowing..." → callback completed.
- Browser redirected back to `https://claude.ai/customize/connectors?` (success — no error param).

### 4. Verify tool surface

- CallVault tile moved from "Not connected" to top of "Web" connectors section.
- Status panel changed from "Connection issue" to live status with **Disconnect** button.
- Tool permissions panel auto-expanded, showed `Other tools 41` — matching the local registry count and the D-06 acceptance criterion.

### 5. Verify type gate

```bash
deno check supabase/functions/mcp-server/index.ts
# Check supabase/functions/mcp-server/index.ts
```

Followed by full sweep across `protocol.ts`, `tools/registry.ts`, `tools/read/*`, `tools/write/*`, `tools/ai/*`, `tools/admin/*` — all clean.

---

## What This Does Not Prove

- **D-09 cold-start improvement.** Functional OAuth + tool surface success does not imply the 30% latency reduction was achieved. The pre-refactor deployed baseline is lost. If perf is required, capture a fresh baseline now and treat any future MCP regression test against it.
- **Concurrent multi-org token isolation.** Only AI Simple org was authorized in this run. Other orgs in the dropdown (Lead Gen Jay, Business, GoVibey) were not exercised. Multi-tenant RLS is covered by local tests but not re-verified live.
- **Per-workspace MCP endpoints.** That is Phase 03 scope.

---

## Live Connection State (post-verification)

- Claude.ai → CallVault custom connector: **CONNECTED**, authorized to AI Simple org.
- This state is intentionally left in place per Andrew's instruction (2026-05-28). Revoke any time via `https://app.callvaultai.com/settings` → AI Connectors, or via Claude.ai → Customize → Connectors → CallVault → Disconnect.

---

## Sign-Off

- [x] All Phase 02 acceptance gates verified or limitation-acknowledged.
- [x] Live external-consumer proof captured (claude.ai as real client).
- [x] Type gate closed by `12c91daf`.
- [ ] Cold-start ≥30% improvement (D-09) — limitation documented, not blocker for Phase 03.

**Approval:** passed (2026-05-28) with the D-09 cold-start measurement explicitly acknowledged as unprovable from this evidence chain.
