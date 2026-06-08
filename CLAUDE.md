# CALLVAULT - CLAUDE INSTRUCTIONS

**Last Updated:** 2026-05-23
**Status:** Root Guide (v3.2) — Single-Repo

---

## CORE PHILOSOPHY

### The One-Click Promise

> Every feature should complete the user's job in the **fewest possible actions** - ideally a single click.

This philosophy supersedes technical elegance and implementation convenience. When in doubt, reduce user effort.

**Before building:** Ask "How many actions?" then "Can it be fewer?"

**During implementation:** Combine steps, eliminate unnecessary decisions, automate the obvious.

### KISS-UX Principle

**Keep It Simple for the User** (not just for the code)

- Complex code that creates simple UX = Right
- Simple code that creates complex UX = Wrong

> **Complexity is easy. Simplicity is hard. We choose hard.**

### Product Ethos

See [Design Principles](./docs/design/design-principles-callvault.md) for the full philosophy. In short: Users first. Speed is a feature. Meticulous craft. Simplicity first. Be proactive, not reactive.

### How Claude Should Operate

- **Reality over documentation.** When design rules conflict with what's actually built and working, the codebase wins. Update the docs, don't "fix" working code to match stale docs. Always verify rules against actual code/production before enforcing them.
- **Use CodeGraph for code navigation first.** CodeGraph is installed as a local MCP server. For structural questions, impact analysis, callers/callees, route discovery, and architecture mapping, start with `codegraph_status` plus the relevant `codegraph_*` tools before broad Grep/Glob/Read exploration. Use grep for exact literal verification, secret/TODO scans, and required static checks. CodeGraph accelerates discovery; tests, builds, browser checks, deploy checks, and direct file reads still prove final claims.
- **Use Graphify for GSD planning context.** CodeGraph is the live coding map; GSD Graphify is the phase-planning graph. Refresh or query Graphify around roadmap, architecture, and `$gsd-*` planning work, then use CodeGraph during implementation. Neither graph is behavioral proof.
- **Do the work first.** Don't ask the user to test, verify, or check something Claude can do itself.
- **Explain in plain terms.** The user is a non-dev vibe coder — translate jargon into impact. Don't present technical choices he can't evaluate.
- **Be decisive.** Research, recommend, and execute unless it's risky.
- **Catch problems before the user sees them.** Test UI, fix bugs, verify deployments — then present clean results.

---

## PROJECT LAYOUT

Everything lives in **one repo**: `/Users/Naegele/dev/brain`

| Area | Path | Dev Server |
|------|------|------------|
| Frontend | `src/` (Vite 5 + React 18 + react-router-dom v6) | `npm run dev` → http://localhost:3001 |
| Backend | `supabase/` (Edge Functions, migrations) | `supabase functions serve` |
| Planning | `.planning/` (GSD phases, roadmap, state) | — |
| Docs | `docs/` (design, architecture, ADRs) | — |

**Package manager:** `npm` (not pnpm, not bun)

**Production:** https://app.callvaultai.com (auto-deploys from pushes to main)

**The `callvault/` repo is ABANDONED. Do NOT read from, reference, or work inside `/Users/Naegele/dev/callvault/`.**

---

## FOLDER-SPECIFIC INSTRUCTIONS

| Location | Purpose |
|----------|---------|
| `src/CLAUDE.md` | Frontend: design system, visual standards, tech stack, hard constraints |
| `supabase/CLAUDE.md` | Backend: Edge Functions, database schema, RLS policies |
| `docs/CLAUDE.md` | Documentation standards, brand guidelines versioning |

**Always check the relevant folder's CLAUDE.md before implementing in that area.**

---

## KEY REFERENCES

| Document | Purpose |
|----------|---------|
| [Brand Guidelines v4.4](./docs/design/brand-guidelines-v4.4.md) | Authoritative design system - colors, typography, components |
| [API Naming Conventions](./docs/architecture/api-naming-conventions.md) | Function, hook, and type naming standards |
| [ADRs](./docs/adr/README.md) | Architecture Decision Records for major technical choices |
| [Design Principles](./docs/design/design-principles-callvault.md) | Visual development checklist |
| [MCP Runbook](./docs/operations/mcp-runbook.md) | Health checks, failure modes, and reset procedure for the MCP server |

---

## HARD CONSTRAINTS

| Constraint | Rule |
|------------|------|
| **AI-02** | Zero AI/RAG/embedding code in the frontend — ever |
| **FOUND-09** | Zero Google Meet references — removed from v2 entirely |
| **Icons** | Remix Icons ONLY (`@remixicon/react`) — no Lucide, FontAwesome, or others |
| **No AI label** | Never use "AI-powered" positively in UI copy — brand is "AI-ready not AI-powered" |
| **Vibe orange** | Structural accent only — see design system skill for approved uses |

---

## ARCHITECTURE PRINCIPLES

### Architecture

The app uses Zustand stores, service layer, react-router-dom v6, and TanStack Query. The user experience must match v1's visual feel exactly:

- **AppShell:** Same 4-pane layout. Pane 4 slides in and Pane 3 **shrinks** to make room. All panes operate on the **same plane/z-index** — no drawer overlays, no covering content.
- **Transitions:** 500ms ease-in-out feel (spring physics in v2 achieve this)
- **Pane widths:** Sidebar 220/72px, Secondary 280px, Main flex-1, Detail 360/320px

### Service + Hook Separation (Official Pattern)

Data access is separated into two layers:

```
src/services/        ← Pure async functions (database queries, no React)
src/hooks/           ← React hooks wrapping services with TanStack Query
```

**Service file** = "how to get/mutate data" (plain TypeScript, testable, reusable)
**Hook file** = "how React consumes that data" (caching, loading states, optimistic updates)

This is the locked-in pattern for all data access in v2.

---

## QUICK RULES

1. **Default to direct main workflow** — work in `/Users/admin/dev/brain` on `main`, commit, and push to `origin/main` unless Andrew explicitly asks for an experiment/PR branch.
2. **Ask before deviating from brand guidelines** — never assume deviations are acceptable
3. **Vercel AI SDK first** — all AI/LLM features must use Vercel SDK + OpenRouter
4. **Read `src/CLAUDE.md` before touching frontend code** — design system and hard constraints live there
5. **Design rules come from reality** — verify against actual code/production before enforcing doc rules

---

## VERIFICATION & TESTING

**HARD RULE:** Use dev-browser for ALL verification. Never ask the user to test what dev-browser can do. Fix broken things before presenting results.

- Test credentials in `.env.local` (CALLVAULTAI_LOGIN, CALLVAULTAI_LOGIN_PASSWORD)
- V1 production (visual source of truth): https://app.callvaultai.com
- Production: https://app.callvaultai.com (use this when localhost has OAuth issues)
- After UI changes: screenshot with dev-browser, don't ask user to check

---

## GIT WORKFLOW

### Single-Operator Default

Andrew is operating this repo as a single owner. The default workflow is:

1. Stay in `/Users/admin/dev/brain` on local `main`.
2. Pull/fast-forward `origin/main` before starting when needed.
3. Make the fix directly on `main`.
4. Commit the finished change.
5. Push directly to `origin/main`.
6. Confirm `HEAD`, `main`, and `origin/main` point to the same commit.

Do **not** create feature branches, detached worktrees, PR branches, or stash-based handoffs unless Andrew explicitly asks to hold work separately for testing, a spike, or a PR. If temporary isolation is truly needed, say so in plain language before creating it and clean it up afterward.

### Commits

Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

Scope with phase number when applicable: `feat(17-04):`, `fix(16):`, `docs(18):`

### Pull Requests

Pull requests are opt-in only. Do not open a PR or route work through PR branches unless Andrew explicitly asks for a PR, review branch, or longer-running experiment.

Before an explicitly requested PR: Run `/code-review` and `/security-review`. For UI changes, also run `/design-review`.

---

## ENVIRONMENT

### Node.js

Node is managed via **Homebrew** (not nvm). No `.nvmrc` files needed.

```bash
node --version    # Should resolve from /opt/homebrew/bin/node
brew upgrade node # To update
```

### Package Manager

`npm` — no pnpm, no bun, no yarn.

---

**END OF ROOT CLAUDE INSTRUCTIONS**

For detailed frontend implementation guidance, see `src/CLAUDE.md`.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->