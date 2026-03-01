# CALLVAULT - CLAUDE INSTRUCTIONS

**Last Updated:** 2026-03-01
**Status:** Root Guide (v3.1) — Two-Repo Workflow

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
- **Do the work first.** Don't ask the user to test, verify, or check something Claude can do itself.
- **Explain in plain terms.** The user is a non-dev vibe coder — translate jargon into impact. Don't present technical choices he can't evaluate.
- **Be decisive.** Research, recommend, and execute unless it's risky.
- **Catch problems before the user sees them.** Test UI, fix bugs, verify deployments — then present clean results.

---

## TWO-REPO WORKFLOW

CallVault development spans two repositories:

| Repo | Path | Purpose | Dev Server |
|------|------|---------|------------|
| **brain** | `/Users/Naegele/dev/brain` | Backend (Supabase edge functions, migrations), GSD planning (`.planning/`), docs | `supabase functions serve` |
| **callvault** | `/Users/Naegele/dev/callvault` | v2 frontend (Vite 7 + React 19 + TanStack Router) | `pnpm dev` → http://localhost:8080 |

**Claude's working directory is brain/.** The callvault repo's CLAUDE.md is NOT auto-loaded.

**Before touching callvault code:** Read `/Users/Naegele/dev/callvault/CLAUDE.md` for hard constraints (Tailwind v4 CSS-only, Remix Icons only, motion/react not framer-motion, etc.).

**Production:** https://callvault.vercel.app (auto-deploys from callvault repo pushes)

**GSD planning:** All phases, roadmap, and state tracking live in `brain/.planning/`

---

## FOLDER-SPECIFIC INSTRUCTIONS

| Location | Purpose |
|----------|---------|
| `brain/src/CLAUDE.md` | Design system rules, visual standards (to be migrated to callvault after transfer) |
| `brain/supabase/CLAUDE.md` | Backend: Edge Functions, database schema, RLS policies |
| `brain/docs/CLAUDE.md` | Documentation standards, brand guidelines versioning |
| `callvault/CLAUDE.md` | v2 frontend: tech stack, hard constraints, project structure |

**Always check the relevant folder's CLAUDE.md before implementing in that area.**

---

## KEY REFERENCES

| Document | Purpose |
|----------|---------|
| [Brand Guidelines v4.3](./docs/design/brand-guidelines-v4.3.md) | Authoritative design system - colors, typography, components |
| [API Naming Conventions](./docs/architecture/api-naming-conventions.md) | Function, hook, and type naming standards |
| [ADRs](./docs/adr/README.md) | Architecture Decision Records for major technical choices |
| [Design Principles](./docs/design/design-principles-callvault.md) | Visual development checklist |

---

## HARD CONSTRAINTS (applies to BOTH repos)

| Constraint | Rule |
|------------|------|
| **AI-02** | Zero AI/RAG/embedding code in the frontend — ever |
| **FOUND-09** | Zero Google Meet references — removed from v2 entirely |
| **Icons** | Remix Icons ONLY (`@remixicon/react`) — no Lucide, FontAwesome, or others |
| **No AI label** | Never use "AI-powered" positively in UI copy — brand is "AI-ready not AI-powered" |
| **Vibe orange** | Structural accent only — see design system skill for approved uses |

---

## ARCHITECTURE PRINCIPLES

### v2 = Lambo Engine in Lambo Body

v2 has the correct modern architecture (spring physics, Zustand stores, service layer, TanStack Router). The user experience must match v1's visual feel exactly:

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

1. **Use GSD workflow for multi-step tasks** — phases, plans, executor agents
2. **Ask before deviating from brand guidelines** — never assume deviations are acceptable
3. **Vercel AI SDK first** — all AI/LLM features must use Vercel SDK + OpenRouter
4. **Read callvault/CLAUDE.md before touching frontend code** — hard constraints live there
5. **Design rules come from reality** — verify against actual code/production before enforcing doc rules

---

## VERIFICATION & TESTING

**HARD RULE:** Use dev-browser for ALL verification. Never ask the user to test what dev-browser can do. Fix broken things before presenting results.

- Test credentials in `.env.local` (CALLVAULTAI_LOGIN, CALLVAULTAI_LOGIN_PASSWORD)
- V1 production (visual source of truth): https://app.callvaultai.com
- V2 production: https://callvault.vercel.app (use this when localhost has OAuth issues)
- After UI changes: screenshot with dev-browser, don't ask user to check

---

## GIT WORKFLOW

### Commits

Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

Scope with phase number when applicable: `feat(17-04):`, `fix(16):`, `docs(18):`

### Pull Requests

Before PR: Run `/code-review` and `/security-review`. For UI changes, also run `/design-review`.

---

## ENVIRONMENT

### Node.js

Node is managed via **Homebrew** (not nvm). No `.nvmrc` files needed.

```bash
node --version    # Should resolve from /opt/homebrew/bin/node
brew upgrade node # To update
```

### Package Managers

- **brain:** `npm`
- **callvault:** `pnpm`

---

**END OF ROOT CLAUDE INSTRUCTIONS**

For detailed frontend implementation guidance, see:
- `brain/src/CLAUDE.md` — Design system, visual standards
- `callvault/CLAUDE.md` — v2 tech stack, hard constraints, project structure

After migration is complete, move `brain/src/CLAUDE.md` design rules into `callvault/src/CLAUDE.md`.
