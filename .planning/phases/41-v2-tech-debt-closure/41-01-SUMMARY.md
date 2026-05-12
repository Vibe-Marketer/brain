---
plan: 41-01
phase: 41
status: completed
date: 2026-05-12
commit: c52490f5
files_changed:
  - .env.example
  - docs/operations/mcp-runbook.md (new)
  - docs/README.md (new)
  - CLAUDE.md
---

# Plan 41-01 — Summary

## DEBT-02 status

Closed. MCP operational config is complete:

- **`.env.example`** — new "MCP — Model Context Protocol Server" section
  with 4 documented env vars (all optional, defaults documented inline):
  `MCP_PUBLIC_BASE_URL`, `MCP_RATE_LIMIT_PER_MINUTE`,
  `MCP_ACCESS_TOKEN_TTL_SECONDS`, `MCP_REFRESH_TOKEN_TTL_SECONDS`. Upstream
  shared secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`)
  are referenced rather than redeclared (single source of truth).
- **`docs/operations/mcp-runbook.md`** — new runbook with 9 sections:
  intro, health check, common failure modes (5 distinct failure modes,
  each with symptom/cause/fix), reset/restart procedure, logs and
  observability, OAuth 2.1 dashboard config steps, contacts, env-var
  reference table, related references.
- **`docs/README.md`** — new top-level docs index linking the runbook.
- **`CLAUDE.md`** — KEY REFERENCES table now links the runbook.

## Scope clarification (recorded in plan)

The original DEBT-02 spec referenced "Sentry alerts for MCP errors." Sentry
in this project is the *frontend* error tracker (`VITE_SENTRY_DSN`); the
MCP server runs in Supabase Edge Functions and is monitored via Supabase
function logs + Langfuse traces. The runbook documents the existing
observability stack rather than wiring net-new Sentry-server tooling
(out of scope for tech-debt closure).

## Verification

- `.env.example` has the MCP section (grep confirmed).
- `docs/operations/mcp-runbook.md` exists with all required sections.
- `docs/README.md` links the runbook.
- Root `CLAUDE.md` KEY REFERENCES table has the runbook row.

## Deferred / follow-on

- The runbook documents Supabase OAuth 2.1 dashboard provider config (step-by-step).
  Actual dashboard configuration requires Andrew's owner access — captured as
  item E3 in the DEBT-03 audit (Plan 41-03).
