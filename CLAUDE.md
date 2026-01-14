# CALLVAULT - CLAUDE INSTRUCTIONS

**Last Updated:** 2025-01-14
**Status:** Slim Root Guide (v2.0)

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

---

## FOLDER-SPECIFIC INSTRUCTIONS

Detailed implementation guidance lives in folder-specific CLAUDE.md files:

| Location | Purpose |
|----------|---------|
| `/src/CLAUDE.md` | Frontend development: React patterns, component guidelines, hooks |
| `/supabase/CLAUDE.md` | Backend: Edge Functions, database schema, RLS policies |
| `/docs/CLAUDE.md` | Documentation standards, brand guidelines versioning |

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

## QUICK RULES

1. **Never propose changes to code you haven't read** - Research existing patterns first
2. **Use TodoWrite for multi-step tasks** - 3+ steps or >30 minutes = plan first
3. **Fetch documentation before using external libraries** - Don't assume APIs from memory
4. **Ask before deviating from brand guidelines** - Never assume deviations are acceptable
5. **Vercel AI SDK first** - All AI/LLM features must use Vercel SDK + OpenRouter
6. **Security first** - Watch for OWASP top 10, validate at system boundaries
7. **Keep it simple** - Don't over-engineer; three similar lines beats a premature abstraction

---

## GIT WORKFLOW

### Commits

Use conventional commits: feat:, fix:, docs:, refactor:, test:

### Pull Requests

Before PR: Run /code-review and /security-review. For UI changes, also run /design-review.

---

## TESTING

**Test credentials** are in .env.local:
- CALLVAULTAI_LOGIN - Test account email
- CALLVAULTAI_LOGIN_PASSWORD - Test account password

**Local dev server:** http://localhost:8080

**Visual verification:** After any UI change, use Playwright to navigate and screenshot.

---

## REVIEW COMMANDS

| Command | When to Use |
|---------|-------------|
| /code-review | After completing features, before PRs |
| /security-review | For auth, user input, sensitive data |
| /design-review | For UI/UX changes |

---

**END OF ROOT CLAUDE INSTRUCTIONS**

For detailed implementation guidance, see folder-specific CLAUDE.md files.
