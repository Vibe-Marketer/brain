# CallVault — Agent Operating Manifest

For non-Claude AI runtimes (Google Antigravity, Gemini CLI, OpenAI Codex, OpenCode, any other CLI/IDE agent reading this file).

For Claude Code, `CLAUDE.md` is the canonical source. This file mirrors the binding rules in a runtime-agnostic form and adds the GSD operating manifest.

---

## What This Repo Is

**CallVault** — B2B SaaS for call recording, transcript storage, and AI-powered call intelligence. Unifies recordings from every meeting-recorder source (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube, plus paste-imported transcripts) into org-and-workspace-scoped vaults. Exposes an MCP server so AI clients (Claude Desktop, Cursor, custom agents) can read AND write into the vaults.

**Production:** https://app.callvaultai.com (Vercel, auto-deploys from `main`)
**API:** https://api.callvaultai.com (Cloudflare Worker → Supabase Edge Functions)
**Current milestone:** Self-Serve Public Launch (see `.planning/ROADMAP.md` for the active phase list and sequencing)

---

## Read These Files Before Doing Anything

In order. Each layer narrows the scope:

1. `.planning/PROJECT.md` — project context, 4 workstreams, Key Decisions, Out of Scope
2. `.planning/REQUIREMENTS.md` — v1 requirements (ONB/CON/MAN/MCP/HRD prefixes) traced to roadmap phases
3. `.planning/ROADMAP.md` — active phases with hard sequencing + "Decisions Needed"
4. `.planning/STATE.md` — current position, accumulated context, next action
5. `.planning/research/SUMMARY.md` — cross-workstream sequencing + binding constraints
6. `.planning/codebase/{ARCHITECTURE,STACK,STRUCTURE,CONVENTIONS,INTEGRATIONS,CONCERNS,TESTING}.md` — current codebase map
7. `CLAUDE.md` — Claude-specific but its binding rules (One-Click Promise, KISS-UX, hard constraints, git workflow) apply universally
8. `src/CLAUDE.md`, `supabase/CLAUDE.md`, `docs/CLAUDE.md` — folder-scoped binding rules

---

## How To Operate Here — GSD

This repo uses **GSD (Get Shit Done)** — a structured workflow system that runs the project phase-by-phase with explicit research, planning, execution, and verification gates.

### Code Navigation — CodeGraph First

CodeGraph is installed for Codex and Claude as a local MCP server. Use it before broad `grep`/`rg`/file-read exploration when the task is about code structure, impact, or relationships:

- Start with `codegraph_status` when available; if the index is missing or stale, run `codegraph status` or `codegraph index` from the repo.
- Prefer CodeGraph for "where is this implemented?", "who calls this?", "what does this call?", "what changes if I touch this?", routes/entry points, and architecture mapping.
- Use `codegraph_search`, `codegraph_context`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, and `codegraph_node` before reading many files.
- Fall back to `rg`/`grep` for exact literal matches, verification gates, secret scans, TODO scans, git-history checks, or when CodeGraph tools are unavailable.
- CodeGraph accelerates discovery only. Final claims still require direct file reads, tests, builds, browser checks, deploy checks, or production probes as appropriate.

### CodeGraph vs GSD Graphify

Treat the two graph tools as complementary, not competing:

- **CodeGraph = live coding navigation.** Use it during implementation/debugging for tactical code intelligence: symbol search, focused context, callers, callees, impact analysis, affected tests, routes, and entry points.
- **GSD Graphify = phase planning graph.** Use `$gsd-graphify` around GSD phase boundaries, roadmap/architecture review, and planning/research workflows. It writes durable planning artifacts to `.planning/graphs/` and `graphify-out/`.
- **Default flow:** refresh Graphify before substantial GSD planning; use CodeGraph while editing; use tests/builds/browser/deploy probes for proof.
- **Do not cite either graph as behavioral proof.** They are discovery/planning aids; source reads and verification commands remain authoritative.

### Available to you (verified install at `.agent/`)

- **`.agent/agents/`** — 33 GSD subagents (gsd-planner, gsd-executor, gsd-verifier, gsd-roadmapper, gsd-plan-checker, gsd-code-reviewer, gsd-debugger, gsd-pattern-mapper, gsd-nyquist-auditor, etc.). Frontmatter declares Gemini-family tool names (`read_file`, `write_file`, `run_shell_command`, `glob`, `search_file_content`, `web_fetch`).
- **`.agent/skills/`** — 67 GSD skills covering every phase command (`gsd-autonomous`, `gsd-plan-phase`, `gsd-execute-phase`, `gsd-verify-work`, `gsd-ship`, `gsd-discuss-phase`, `gsd-secure-phase`, `gsd-ui-phase`, `gsd-code-review`, `gsd-debug`, etc.)
- **`.agent/get-shit-done/workflows/`** — local copy of all workflow markdown (`autonomous.md`, `plan-phase.md`, `execute-phase.md`, `verify-phase.md`, `ship.md`, `transition.md`, `complete-milestone.md`, etc.)
- **`.agent/hooks/`** — 16 hooks wired via `.agent/settings.json` (read-guard, prompt-guard, workflow-guard, validate-commit, context-monitor, phase-boundary, read-injection-scanner, graphify-update, session-state, check-update). Use Claude Code's stdin-JSON protocol with PascalCase tool names (`Write`, `Edit`, `Bash`) — your runtime may or may not invoke these; verify by attempting an edit and checking whether hook stderr appears.
- **`gsd-sdk` CLI on PATH** — handles all config queries, commits, traceability updates, state operations

### Run the autonomous milestone

Your default task is to execute `/gsd-autonomous` faithfully:

1. **Read `.agent/get-shit-done/workflows/autonomous.md`** first — it's the canonical procedure.
2. **Resolve current phase from `.planning/STATE.md`** — currently Phase 09: Lint, Brand, and Documentation Hygiene.
3. **For each phase, the standard chain runs:** discuss → plan → execute → verify → ship → transition.
   - Each step has a workflow markdown file at `.agent/get-shit-done/workflows/<step>-phase.md` or `<step>.md`
   - Each workflow tells you whether to (a) write a file, (b) commit, (c) ask the user, (d) proceed
4. **Subagent spawns work natively** — the workflows have `Agent(prompt="...", subagent_type="gsd-planner")` blocks. Your runtime should be able to dispatch to the agent files in `.agent/agents/`. If it can't, inline-execute the agent prompt yourself.
5. **State operations via `gsd-sdk`** — `gsd-sdk query state.load`, `gsd-sdk query commit "msg" --files ...`, `gsd-sdk query config-set <key> <value>`, `gsd-sdk query agent-skills <agent-name>`, etc.
6. **If your runtime lacks `AskUserQuestion`**, set `workflow.text_mode: true` in `.planning/config.json` via `gsd-sdk query config-set workflow.text_mode true`. The workflows all have explicit TEXT_MODE branches that render prompts as plain-text numbered lists.

---

## Hard Rules (DO NOT VIOLATE)

These come from `CLAUDE.md` and the codebase map. Every commit must respect them.

### Operational
- **Direct-main workflow.** Commit and push to `origin/main`. No feature branches, no PRs unless explicitly asked.
- **Run `npm run build` against the committed tree** (not the working tree) before push when touching `src/config/source-registry.ts` or `supabase/functions/mcp-server/index.ts` — production has crashed on missing `oauthCallbackFunctionName` entries before (commit `9b6e3338` precedent).
- **Integration tests MUST NOT mock Supabase.** Real-DB only. CONCERNS Phase 30 / BUG-01 precedent: a mocked test passed the exact UUID/BIGINT bug that broke prod.
- **Verify before you claim done.** "Build succeeded" requires a zero-exit `npm run build` in this session. "Deployed" requires hitting the actual endpoint, not just a successful upload. "Tested" requires the test run output, not memory.

### Tech stack (locked)
- **Frontend:** React 18 + Vite 5 + react-router-dom v6 + TanStack Query + Zustand v5 + Tailwind + shadcn/ui + Remix Icons + `motion/react`
- **Banned:** Lucide, FontAwesome, `framer-motion`, pnpm, bun, yarn
- **Package manager:** npm only
- **Backend:** Supabase (Postgres + Auth + Storage + Deno Edge Functions)
- **No Docker** — Edge Functions deploy via `supabase functions deploy <name> --use-api`
- **All AI/LLM/embedding in Edge Functions only** (constraint AI-02 bans frontend AI)

### Code constraints
- **Service + Hook separation is the locked data-access pattern.** Services = pure async TS, no React. Hooks = TanStack Query wrappers. Components never call services directly.
- **Recording IDs cross UUID/BIGINT via `toRecordingUuid()` / `toRecordingUuidBatch()` only.** Never `parseInt()`, `Number()`, or string coercion. `src/lib/recording-ids.ts` is the boundary.
- **`recordings.share_url` is not a top-level column.** Always use `resolveShareUrl()` from `src/lib/recording-source-url.ts`.
- **`authenticateRequest(req, supabase, corsHeaders)`** from `_shared/auth.ts` for all Edge Function auth. Never inline auth boilerplate.
- **`invalidateCallListCaches(queryClient)`** in every mutation `onSettled`. Partial invalidation = stale UI.
- **MCP tool result shape: `content[].text` markdown.** NEVER structured JSON. Runbook records this; refactor must not regress.
- **One Edge Function for `mcp-server`.** Refactor is INTERNAL (`tools/{read,write,ai}/*.ts` modules) — NOT a split into multiple Edge Functions.
- **`tools/list` filtered by `token.enabled_categories`.** Information disclosure otherwise.
- **MCP server CORS is intentionally wildcard.** RFC 9728/7591 require world-readable discovery. Don't add session-cookie data to wildcard-CORS endpoints.

### Brand
- **"AI-ready, not AI-powered"** — never use "AI-powered" positively in UI copy.
- **One-Click Promise** — every feature completes the user's job in the fewest possible actions, ideally one click. KISS-UX: complex code that produces simple UX is right; simple code that produces complex UX is wrong.

### Conventions
- Commits: `feat(N): …`, `fix(N): …`, `chore(N): …`, `docs(N): …` where N is the phase number when applicable.
- ESM modules with `.js` extensions in imports (e.g., `import { foo } from "./bar.js"`)
- `node:` prefix for built-in modules
- TypeScript strict mode, `const` over `let`, never `var`, no `any` — use `unknown` with type guards
- Imports: type-only via `import type { Foo }`
- Frontend imports use `@/` alias (maps to `src/`), never relative paths
- Edge Function imports: `_shared/` for cross-function utilities

---

## Verification (your responsibility, not the user's)

- **Backend changes:** Run the relevant `*.integration.test.ts` and paste output. RLS regression test gates CI.
- **UI changes:** Screenshot with whichever browser-automation tool your runtime exposes. Don't ask the user to test what you can test yourself.
- **Deploys:** Hit the actual production URL (`app.callvaultai.com`) or MCP endpoint (`https://mcp.callvaultai.com`) and confirm a real response.
- **When you can't verify something, say so plainly.** "Wired this up but haven't tested the full flow" is correct. "It works" without evidence is a lie.

---

## When You're Done With A Phase

Run `.agent/get-shit-done/workflows/transition.md` to:
- Mark requirements complete in `REQUIREMENTS.md` Traceability table
- Update `PROJECT.md` (move validated items, log decisions)
- Update `STATE.md` (next phase trigger)
- Commit as `chore(N): transition to phase N+1`

When all active roadmap phases are done: `.agent/get-shit-done/workflows/complete-milestone.md`.

---

## Out of Scope (do not pull in)

Tracked in detail in `.planning/REQUIREMENTS.md` § Out of Scope. Highlights for non-Claude agents:

- **File upload + async transcription pipeline** (MAN-01, MAN-03) — deferred to v2 (scope change 2026-05-27). CallVault is not becoming a transcription service in this milestone. `file-upload-transcribe` Edge Function stays deployed but the UI no longer surfaces it (MAN-06 removes `FileUploadDropzone`).
- **Multi-vendor MCP gateway** (CallVault proxying Linear/Slack/Notion) — different product story; explicitly out.
- **Onboarding drop-off telemetry** — ship launch first, instrument second.
- **`personal_folders` feature implementation** — service stubbed; separate feature decision.
- **CSP hardening, Sentry release tagging, TranscriptsTab refactor, Stripe legacy cleanup, dead-code deletions** — defer to post-launch hardening milestone.

---

*This file exists so any AI runtime (not just Claude Code) can pick up the project mid-flight and operate within the same constraints. Mirror updates here when CLAUDE.md changes.*
