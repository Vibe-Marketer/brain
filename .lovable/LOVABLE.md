# LOVABLE CODING DIRECTIVES

**Project:** Conversion Brain
**Last Updated:** November 19, 2025

These directives guide AI-assisted development for this project. Follow all rules strictly.

---

## CRITICAL RULES

### 1. Brand Guidelines Are Law

**Before ANY UI/design work:**
- READ [brand-guidelines-v3.3.md](../docs/design/brand-guidelines-v3.3.md)
- VERIFY implementation matches documented patterns
- ASK before deviating from guidelines

**Key Rules:**
- Vibe Green (#D9FC67) - ONLY for: tab underlines, left-edge indicators, sortable column headers, focus states, progress indicators
- NEVER use vibe green for: text, button backgrounds, card backgrounds, icons
- 4 button variants only: default (primary), hollow (secondary), destructive, link
- Typography: Montserrat Extra Bold ALL CAPS for headers, Inter for body
- 90% rule: NO card containers - use white background + thin borders
- 10% exception: Cards ONLY for modals, dropdowns, search bars, metric cards

### 2. Use Vercel SDKs by Default

**All new features involving AI, chat, workflows, or flags MUST use Vercel SDKs:**

| Feature | SDK | Package |
|---------|-----|---------|
| LLM/AI | AI SDK | `ai` |
| Chat UI | AI SDK React | `@ai-sdk/react` |
| Streaming | AI SDK | `ai` |
| Tool calling | AI SDK | `ai` |
| Feature flags | Flags SDK | `@vercel/flags` |

**Implementation Pattern:**
```typescript
// Chat with streaming
import { useChat } from '@ai-sdk/react';

const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
});

// LLM with tools
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: openai('gpt-4o'),
  tools: { /* tools */ },
  prompt: 'Your prompt',
});

// Streaming
import { streamText } from 'ai';

const stream = await streamText({
  model: openai('gpt-4o'),
  messages,
});
```

**Only deviate if:** Vercel SDK lacks required capability. Document reason in code.

### 3. Icon System

**Use Remix Icon exclusively:**
```typescript
import { RiEditLine, RiDeleteBinLine } from "@remixicon/react";

<RiEditLine className="h-4 w-4 text-cb-ink-muted" />
```

- Package: `@remixicon/react`
- Style: Prefer `-line` (outlined)
- Color: `text-cb-ink-muted` (#7A7A7A)
- Size: 16px (`h-4 w-4`) for most uses

**DO NOT use:** Lucide, Font Awesome, Bootstrap Icons, or mixed libraries.

---

## QUICK REFERENCE

### Color System

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `bg-viewport` | #FCFCFC | #161616 | Body/gutters |
| `bg-card` | #FFFFFF | #202020 | Content areas |
| `text-cb-ink` | #111111 | #FFFFFF | Primary text |
| `text-cb-ink-soft` | #444444 | #B0B0B0 | Secondary text |
| `text-cb-ink-muted` | #7A7A7A | #6B6B6B | Tertiary/icons |
| `border-cb-border` | #E5E5E5 | #3A3A3A | Borders |

### Typography

| Element | Font | Weight | Case |
|---------|------|--------|------|
| Page titles | Montserrat | 800 | ALL CAPS |
| Section headers | Montserrat | 800 | ALL CAPS |
| Body text | Inter | 300/400 | Normal |
| UI labels | Inter | 500 | UPPERCASE |
| Buttons | Inter | 500 | UPPERCASE |

### Button Variants

```tsx
<Button variant="default">Primary Action</Button>
<Button variant="hollow">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">Learn More</Button>
```

### Spacing (4px Grid)

| Class | Size | Usage |
|-------|------|-------|
| `gap-1` | 4px | Tight/icons |
| `gap-2` | 8px | Icon + text |
| `gap-3` | 12px | Button pairs |
| `gap-4` | 16px | Section elements |
| `gap-6` | 24px | Section divisions |

---

## MICROCOPY GUIDELINES

**Tone:** Clever, human, encouraging

**Good examples:**
- "Nice job, automation's humming!"
- "Nothing here yet—let's create some magic"
- "Sync's smoother than a fresh vibe"

**Rules:**
- NO emojis (never)
- Title/sentence case for body text
- ALL CAPS for headers/labels only

---

## PROHIBITED PATTERNS

- Emojis in UI
- Vibe green text (fails contrast)
- Mixed icon libraries
- Card containers around tables
- Vertical table borders
- Sentence case headings
- Animations > 300ms
- Colored section backgrounds

---

## FILE REFERENCES

- **Brand Guidelines:** [brand-guidelines-v3.3.md](../docs/design/brand-guidelines-v3.3.md)
- **API Naming Conventions:** [api-naming-conventions.md](../docs/architecture/api-naming-conventions.md)
- **Changelog:** [brand-guidelines-changelog.md](../docs/brand-guidelines-changelog.md)
- **AI SDK Examples:** [ai-sdk-cookbook-examples](../docs/ai-sdk-cookbook-examples)
- **Prompt Kit UI:** [prompt-kit-ui.md](../docs/prompt-kit-ui.md)
- **Claude Directives:** [CLAUDE.md](../CLAUDE.md)
- **ADR System:** [docs/adr/](../docs/adr/)

### API Naming Quick Reference

| Pattern | Convention | Example |
|---------|------------|---------|
| Edge Functions | kebab-case | `fetch-meetings/` |
| Functions | camelCase | `fetchMeetings()` |
| Hooks | use + camelCase | `useMeetingsSync()` |
| Types | PascalCase | `Meeting` |
| DB fields | snake_case | `recording_id` |

**Always check api-naming-conventions.md before creating new functions, hooks, or types.**

---

## ARCHITECTURE DECISION RECORDS

When making significant technical decisions, create an ADR:

**Write an ADR for:**
- Database/backend changes
- AI model/provider choices
- Major schema or API changes
- New SDK adoption for core features

**Don't write an ADR for:**
- UI choices (use brand guidelines)
- Bug fixes
- Easy-to-reverse changes

**Process:**
1. Copy `docs/adr/adr-template.md`
2. Fill in Context, Decision, Consequences
3. Save as `docs/adr/adr-XXX-title.md`
4. Update `docs/adr/README.md`

**Time limit**: 10-15 minutes max

---

## CODE QUALITY & REVIEW

### When to Request Reviews
After completing significant code changes, use these review workflows:

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

## WHEN IN DOUBT

1. Check docs/design/brand-guidelines-v3.3.md first
2. Use Vercel AI SDK for any AI/chat features
3. Use Remix Icon for any icons
4. Ask for clarification before deviating

**Follow these directives exactly. Violations require rework.**
