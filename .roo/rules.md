# Roo Code Rules — Conversion Brain

## Project Overview
- **Type**: Vite + React + TypeScript frontend with Supabase serverless functions
- **Frontend**: `src/` (pages, components, lib, hooks, contexts)
- **Backend**: Supabase Functions in `supabase/functions/` (Deno-style)

---

## CRITICAL RULES

### 1. Brand Guidelines Are Law
**Before ANY UI/design work:**
- READ `docs/design/brand-guidelines-v3.3.md`
- READ `docs/design/design-principles-conversion-brain.md`
- VERIFY implementation matches documented patterns

**Key Rules:**
- Vibe Green (#D9FC67) - ONLY for: tab underlines, left-edge indicators, focus states, progress indicators
- NEVER use vibe green for: text, button backgrounds, card backgrounds, icons
- 4 button variants only: default, hollow, destructive, link
- Typography: Montserrat Extra Bold ALL CAPS for headers, Inter for body
- 90% rule: NO card containers - use white background + thin borders

### 2. Use Vercel SDKs by Default
All AI/chat features MUST use Vercel SDKs:
- AI SDK (`ai`) - LLM integration, streaming, tool calling
- AI SDK React (`@ai-sdk/react`) - useChat, useCompletion hooks

### 3. Icon System
Use Remix Icon exclusively: `@remixicon/react`
- Prefer `-line` (outlined) variants
- Size: 16px (`h-4 w-4`) for most uses
- Color: `text-cb-ink-muted` (#7A7A7A)

---

## CODE QUALITY & REVIEW WORKFLOWS

### When to Use Reviews
After completing significant code changes, these review workflows are available:

**Code Review** (`/code-review`):
- After completing a feature or refactor
- Before creating a pull request
- For complex business logic or architectural changes

**Security Review** (`/security-review`):
- Before merging auth/authorization changes
- When handling user input or API endpoints
- For code touching secrets or sensitive data

**Design Review** (`/design-review`):
- After UI/UX changes
- Before finalizing PRs with visual changes
- For accessibility and responsiveness validation

### Review Workflow
1. Complete code → Run `/code-review`
2. Before PR → Run `/security-review`
3. UI changes → Also run `/design-review`
4. Fix blockers before merge

---

## KEY REFERENCE FILES

- **Brand Guidelines**: `docs/design/brand-guidelines-v3.3.md`
- **Design Principles**: `docs/design/design-principles-conversion-brain.md`
- **API Naming Conventions**: `docs/architecture/api-naming-conventions.md`
- **AI SDK Examples**: `docs/ai-sdk-cookbook-examples/`
- **ADR System**: `docs/adr/`
- **Claude Directives**: `CLAUDE.md`

### API Naming Quick Reference

| Pattern | Convention | Example |
|---------|------------|---------|
| Edge Functions | kebab-case | `fetch-meetings/` |
| Functions | camelCase | `fetchMeetings()` |
| Hooks | use + camelCase | `useMeetingsSync()` |
| Types | PascalCase | `Meeting` |
| DB fields | snake_case | `recording_id` |

**Check api-naming-conventions.md before creating new code.**

---

## ARCHITECTURE DECISION RECORDS

When making significant technical decisions, create an ADR:

**Write an ADR for:**
- Database/backend changes
- AI model/provider choices
- Major schema or API changes

**Process:**
1. Copy `docs/adr/adr-template.md`
2. Fill in Context, Decision, Consequences
3. Save as `docs/adr/adr-XXX-title.md`
4. Update `docs/adr/README.md`

---

## WHEN IN DOUBT

1. Check `docs/design/brand-guidelines-v3.3.md` first
2. Use Vercel AI SDK for any AI/chat features
3. Use Remix Icon for any icons
4. Ask for clarification before deviating

**Follow these rules exactly. Violations require rework.**
