# CALLVAULT - CLAUDE INSTRUCTIONS

**Last Updated:** 2026-02-28
**Status:** Root Guide (v3.0) — Two-Repo Workflow

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

### Product Ethos (from [Design Principles](./docs/design/design-principles-callvault.md))

These principles guide every decision — design, architecture, and workflow:

**Users First, Always.**
- Build for the job the user is trying to accomplish, not personas or demographics
- Empathy as foundation — understand the user's perspective before building
- Customer-obsessed: anticipate needs, don't wait to be asked

**Speed Is a Feature.**
- Sub-50ms response times. Zero perceived latency.
- Snappy = extension of fingertips. If it feels slow, it's broken.
- Performance is a core product differentiator, not an afterthought.

**Meticulous Craft.**
- Every detail matters — precision in the smallest interactions creates trust
- Mona Lisa Principle: everything shipped should be something you're proud to put your name on
- Utility + Usability + Beauty — all three must be right, don't compromise any

**Simplicity First.**
- No manual required — users should never read docs to understand how things work
- Low floor, high ceiling: approachable for beginners, infinite depth for power users
- Less but better — products unburdened by non-essentials

**Be Proactive, Not Reactive.**
- Do the obvious thing without being asked. If it's clear what should happen next, do it.
- Never present a problem without a solution (or at minimum, options)
- Research, recommend, and act — only pause for risky or irreversible decisions

### How Claude Should Operate

- **Do the work first.** Don't ask the user to test, verify, or check something Claude can do itself.
- **Explain technical concepts in plain terms.** The user is a non-dev vibe coder who makes strategic decisions — translate jargon into impact.
- **Be decisive.** Research the options, make a recommendation, and execute unless it's risky. Don't present 5 options when 1 is clearly best.
- **Catch problems before the user sees them.** Test UI, fix bugs, verify deployments — then present clean results.
- **Never ask something obvious.** If the answer is implied by context, proceed.

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
| [Brand Guidelines v4.2](./docs/design/brand-guidelines-v4.2.md) | Authoritative design system - colors, typography, components |
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
| **Vibe orange** | 9 approved uses ONLY — see design system section in `src/CLAUDE.md` |

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

1. **Never propose changes to code you haven't read** — research existing patterns first
2. **Use GSD workflow for multi-step tasks** — phases, plans, executor agents
3. **Fetch documentation before using external libraries** — don't assume APIs from memory
4. **Ask before deviating from brand guidelines** — never assume deviations are acceptable
5. **Vercel AI SDK first** — all AI/LLM features must use Vercel SDK + OpenRouter
6. **Security first** — watch for OWASP top 10, validate at system boundaries
7. **Keep it simple** — don't over-engineer; three similar lines beats a premature abstraction
8. **Read callvault/CLAUDE.md before touching frontend code** — hard constraints live there

---

## VERIFICATION & TESTING

### HARD RULE: Never Ask User to Verify What Dev-Browser Can Do

**Use the dev-browser skill for ALL verification** — this includes:
- GSD phase checkpoints (human-verify tasks)
- UI testing after changes
- Confirming buttons, toggles, tabs, forms, empty states work
- Visual regression checks

**Only escalate to the user when:**
- Something genuinely requires their judgment (design preference, business decision)
- Authentication credentials that dev-browser can't access
- You've already tested everything dev-browser can reach and fixed what's broken

**Before presenting any checkpoint:** Navigate every page, click all buttons, toggle all switches, fill all forms, test all interactions, screenshot results, and fix broken things FIRST.

### Testing Details

**Test credentials** are in .env.local:
- CALLVAULTAI_LOGIN — test account email
- CALLVAULTAI_LOGIN_PASSWORD — test account password

**Production testing:** https://callvault.vercel.app
- Localhost OAuth redirects to app.callvaultai.com (known issue)
- Always test on production URL via dev-browser when auth is involved

**Visual verification:** After any UI change, use the **dev-browser skill** to navigate and screenshot. Do NOT reference `mcp__playwright__*` tools — they don't exist.

---

## GIT WORKFLOW

### Commits

Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

Scope with phase number when applicable: `feat(17-04):`, `fix(16):`, `docs(18):`

### Pull Requests

Before PR: Run `/code-review` and `/security-review`. For UI changes, also run `/design-review`.

---

## REVIEW COMMANDS

| Command | When to Use |
|---------|-------------|
| /code-review | After completing features, before PRs |
| /security-review | For auth, user input, sensitive data |
| /design-review | For UI/UX changes |

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
