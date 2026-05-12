---
phase: 41
phase_name: v2.0 / v2.1 Tech Debt Closure
gathered: 2026-05-11
status: Ready for planning
mode: Interactive discuss (gsd-autonomous)
---

# Phase 41: v2.0 / v2.1 Tech Debt Closure — Context

<domain>
## Phase Boundary

Resolve the 3 carried-forward tech debt items:

1. **DEBT-01** — 2 remaining ungated AI features → gated through `useAiGate` + `track-ai-usage`
2. **DEBT-02** — MCP operational config complete (env vars, monitoring, runbook)
3. **DEBT-03** — 13 deferred v2.0 human-verification items audited and either fixed or formally accepted

Out of scope: brand-new features, additional security work (Phases 37/38 own that), new bug surfaces (Phase 36 owns ad-hoc bugs).
</domain>

<decisions>
## Implementation Decisions

### DEBT-01 — AI Feature Gating

- Identify the 2 ungated AI features. Likely candidates (plan-phase confirms):
  - AI title generation (some entry points may bypass `useAiGate`)
  - AI chat / Q&A (newly added per v2.1)
- Wrap each ungated entry point with `useAiGate().trackAction(actionType, { orgId })` BEFORE the call.
- If `!gate.allowed`, return early (toast already shown by hook).
- Verify by running each AI action on a Free-tier account → see upgrade prompt.

### DEBT-02 — MCP Operational Config

- **Env vars documented:** every MCP-related env var listed in `.env.example` AND `docs/operations/mcp-runbook.md` with: name, purpose, example value (masked), required-vs-optional.
- **Monitoring configured:** Sentry alerts for MCP-related errors (if applicable), Supabase function logs reviewed for noisy errors, dashboard tile or query that shows MCP health.
- **Runbook written:** `docs/operations/mcp-runbook.md` covers:
  - What is MCP in this project? (1-paragraph plain-language explanation)
  - Health-check command
  - Common failure modes + fixes
  - Reset/restart procedure
  - Who to contact (Andrew)
- **Accessible:** linked from `docs/README.md` and CLAUDE.md.

### DEBT-03 — 13 Deferred v2.0 Human-Verification Items

**Audit approach (Andrew's call): batch by category, fix the cluster.**

**Step 1: Inventory.** Pull the 13 items from `.planning/STATE.md` historical deferred sections OR the v2.0 audit notes. Group them by surface (auth, calls, settings, etc.).

**Step 2: Cluster fix.** For each cluster:
- Open dev-browser to the surface.
- Walk through every item in the cluster systematically.
- Either fix (atomic commit per item) OR document explicit acceptance in `STATE.md` with rationale (e.g., "Accepted: this is intentional behavior — the user wanted X").

**Step 3: Closure.** For every item: either `[x] Fixed (commit hash)` or `[~] Accepted (rationale)`. Both close the item.

### Hard Rule Compliance

Per Andrew's memory:
- "NEVER leave technical debt without a documented plan within GSD" — DEBT-03 IS the plan; complete it.
- "gaps_found blocks transition" — Phase 41 cannot close until all 13 items + DEBT-01 + DEBT-02 are accepted/fixed.

### Test Strategy

- **DEBT-01 verification:** dev-browser on a Free-tier test account, attempt each gated AI action → confirm upgrade prompt.
- **DEBT-02 verification:** runbook reviewed end-to-end by following its instructions on a fresh deploy. Each step works.
- **DEBT-03 verification:** every item has a status mark in STATE.md with link to commit OR rationale.

### Sequencing

1. DEBT-02 first — operational config doesn't depend on anything; gets the runbook in place.
2. DEBT-01 — AI gating; needs Phase 37/38 stable (gates use secure paths).
3. DEBT-03 — the 13-item audit; clean-up sweep at the end.
</decisions>

<code_context>
## Existing Code Insights

**For DEBT-01:**
- `src/hooks/useAiGate.ts` — gate hook (Phase 17 + AI integration phases)
- `supabase/functions/track-ai-usage/` — quota tracking
- Search for AI invocation sites: `generate-ai-titles`, `auto-tag-calls`, `summarize-call`, `chat` (if exists) — confirm every invocation has a gate.

**For DEBT-02:**
- `docs/operations/` (likely exists) — runbook location
- `.env.example` — env var template
- Phase 18 (MCP) artifacts — original MCP design docs

**For DEBT-03:**
- `.planning/STATE.md` — accumulated context, look for "deferred verification" or "human_needed" history
- v2.0 phase summaries in `.planning/milestones/` archive — list of items

## Dependencies

- Phase 38 (security baseline) before AI gating lockdown — per Phase 41 `depends_on`.
- Phases 30-40 must be substantially complete; the 13 deferred items may include some that get fixed automatically by other phase work.
</code_context>

<specifics>
- **DEBT-01** — AI features gated
- **DEBT-02** — MCP config complete
- **DEBT-03** — 13 deferred items closed

## Success Criteria

1. 2 ungated AI features now gated; Free-tier sees upgrade prompt.
2. MCP env vars, monitoring, runbook all complete + accessible.
3. 13 deferred items: each fixed (with commit) or documented acceptance.
</specifics>

<canonical_refs>
- `.planning/ROADMAP.md` — Phase 41
- `.planning/REQUIREMENTS.md` — DEBT-01..03
- `.planning/STATE.md` — accumulated deferred items
- `.planning/milestones/` archive — v2.0 phase summaries with original deferred items
- `src/hooks/useAiGate.ts` — gate hook
- `supabase/functions/track-ai-usage/` — quota tracking
- `docs/operations/` — runbook home
</canonical_refs>

<deferred>
## Deferred Ideas

- **Automated AI-gate audit lint rule** — ESLint rule that flags AI invocation without nearby `trackAction()`. v2.3.
- **Public MCP status page** — visible to users showing MCP health. v2.3+.
- **Deferred-item tracking dashboard** — auto-pull every `[ ]` from STATE.md / REQUIREMENTS.md into a single view. v2.3.
</deferred>
