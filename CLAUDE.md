# CALLVAULT - CLAUDE INSTRUCTIONS

**Last Updated:** 2025-12-05
**Status:** Complete Development Guide

---

## TABLE OF CONTENTS

1. [Task Management & Planning](#task-management--planning)
2. [Research-Driven Development](#research-driven-development)
3. [Brand Guidelines Enforcement](#brand-guidelines-enforcement)
4. [API Naming Conventions](#api-naming-conventions)
5. [Development Standards](#development-standards)
6. [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)
7. [Code Quality & Review Workflows](#code-quality--review-workflows)
8. [Visual Development Protocol](#visual-development-protocol)

---

# TASK MANAGEMENT & PLANNING

## Core Principle: Plan Before You Code

**CRITICAL:** For ANY non-trivial task (3+ steps or >30 minutes), you MUST use TodoWrite to plan and track progress.

### When to Use TodoWrite

**✅ ALWAYS use for:**

- Complex multi-step tasks (3+ distinct steps)
- Features requiring research or exploration
- Tasks with multiple file changes
- Refactoring across multiple components
- Any task >30 minutes estimated time
- When user provides multiple requirements
- After receiving new instructions

**❌ DON'T use for:**

- Single, straightforward edits
- Trivial tasks (<3 steps)
- Pure informational queries
- Simple file reads

### Task-Driven Development Workflow

**1. PLAN (before any code)**

```
User Request → Analyze Scope → Break Down Steps → Create Todos
```

**2. RESEARCH (gather context)**

```
Read existing code → Search patterns → Check docs → Understand architecture
```

**3. IMPLEMENT (execute systematically)**

```
Mark task in_progress → Write code → Test → Mark completed → Next task
```

**4. VERIFY (ensure quality)**

```
Run tests → Check design compliance → Review code → Validate against requirements
```

### Task Breakdown Best Practices

**Good Task Structure:**

```typescript
[
  {
    content: "Research existing authentication patterns",
    activeForm: "Researching existing authentication patterns",
    status: "in_progress"
  },
  {
    content: "Design JWT token structure and claims",
    activeForm: "Designing JWT token structure and claims",
    status: "pending"
  },
  {
    content: "Implement token generation in Edge Function",
    activeForm: "Implementing token generation in Edge Function",
    status: "pending"
  },
  {
    content: "Add token validation middleware",
    activeForm: "Adding token validation middleware",
    status: "pending"
  },
  {
    content: "Write tests for auth flow",
    activeForm: "Writing tests for auth flow",
    status: "pending"
  }
]
```

**Task Granularity Rules:**

- Each task = 30 min - 4 hours of work
- Break large tasks into smaller sub-tasks
- Keep tasks focused and specific
- Use action verbs (implement, refactor, test)

### Todo Status Management

**Status Flow:**

```
pending → in_progress → completed
```

**CRITICAL RULES:**

1. **ONE task in_progress at a time** (not less, not more)
2. Mark completed **IMMEDIATELY** after finishing (don't batch)
3. Update status in **real-time** as you work
4. Create new tasks if you discover additional work
5. Remove tasks that are no longer relevant

**Task Completion Requirements:**

**ONLY mark completed when:**

- ✅ All code written and tested
- ✅ No unresolved errors
- ✅ Tests passing (if applicable)
- ✅ Design compliance verified (for UI)
- ✅ User requirements fully met

**Keep in_progress if:**

- ❌ Tests are failing
- ❌ Implementation is partial
- ❌ Encountered blockers
- ❌ Waiting on user input
- ❌ Need to resolve errors first

### Example: Multi-Step Feature Implementation

```typescript
// User: "Add dark mode toggle to settings page"

// Step 1: Create todo list
TodoWrite({
  todos: [
    {
      content: "Research existing theme implementation",
      activeForm: "Researching existing theme implementation",
      status: "in_progress"
    },
    {
      content: "Read brand guidelines for dark mode rules",
      activeForm: "Reading brand guidelines for dark mode rules",
      status: "pending"
    },
    {
      content: "Design toggle component following brand system",
      activeForm: "Designing toggle component following brand system",
      status: "pending"
    },
    {
      content: "Implement toggle in Settings page",
      activeForm: "Implementing toggle in Settings page",
      status: "pending"
    },
    {
      content: "Test theme switching in all views",
      activeForm: "Testing theme switching in all views",
      status: "pending"
    },
    {
      content: "Verify dark mode color compliance",
      activeForm: "Verifying dark mode color compliance",
      status: "pending"
    }
  ]
});

// Step 2: Execute systematically
// - Complete research task, mark completed
// - Move to next task, mark in_progress
// - Implement, mark completed
// - Continue until all done
```

---

# RESEARCH-DRIVEN DEVELOPMENT

## Core Principle: Understand Before You Build

**NEVER propose changes to code you haven't read.**

### ⚠️ CRITICAL: Documentation-First Implementation

**When implementing features using external libraries, SDKs, or APIs:**

1. **STOP** - Do NOT start coding based on memory or assumptions
2. **FETCH** - Use WebFetch/FirecrawlScrape to get official documentation
3. **READ** - Carefully review the exact API patterns, parameters, and examples
4. **VERIFY** - Confirm your implementation matches the docs exactly
5. **CITE** - Reference the doc URL when implementing

**Why this matters:**

- APIs change between versions
- Memory of past implementations may be outdated
- Guessing leads to broken code and wasted time
- Official docs are the source of truth

**Examples of when to fetch docs FIRST:**

- Implementing Vercel AI SDK features → Fetch ai-sdk.dev docs
- Using Supabase features → Fetch supabase.com docs
- Adding Stripe integration → Fetch stripe.com docs
- Any npm package you haven't used recently → Fetch its docs

**DO NOT:**

- ❌ Assume you know the current API from past experience
- ❌ Copy patterns from old code without verifying they're still valid
- ❌ Start implementing based on partial knowledge
- ❌ Guess parameter names or function signatures

**ALWAYS:**

- ✅ Fetch and read the official documentation first
- ✅ Verify the exact import paths and function signatures
- ✅ Check for version-specific changes
- ✅ Follow the documented patterns exactly

### Research Workflow

**Before implementing ANY feature:**

1. **Use Task/Explore agents for codebase exploration**

   ```
   GOOD: Use Task tool with subagent_type=Explore to find patterns
   BAD:  Running Grep/Glob commands directly for exploration
   ```

2. **Read existing implementations**

   ```typescript
   // Find similar features first
   Read existing components → Understand patterns → Follow conventions
   ```

3. **Check documentation**

   ```
   Brand guidelines → API conventions → Design principles → ADRs
   ```

4. **Search for patterns**

   ```typescript
   // Use specialized agents for pattern discovery
   Task(subagent_type="Explore", thoroughness="medium")
   Task(subagent_type="codebase-analyst")
   ```

### When to Use Specialized Agents

**Exploration Tasks (use Task tool with Explore):**

- "Where are errors from the client handled?"
- "What is the codebase structure?"
- "How does authentication work?"
- "Find all uses of vibe orange color"

**Library Research (use library-researcher):**

- External library documentation needed
- Implementation-critical info from docs
- API reference lookup

**Codebase Analysis (use codebase-analyst):**

- Find patterns across codebase
- Discover coding conventions
- Identify architectural patterns

### Research Checklist

Before writing code, answer:

- [ ] Have I read similar existing implementations?
- [ ] Do I understand the current patterns?
- [ ] Have I checked brand guidelines (for UI)?
- [ ] Have I verified API naming conventions?
- [ ] Do I know what files need to change?
- [ ] Have I identified potential conflicts?

---

# BRAND GUIDELINES ENFORCEMENT

**CRITICAL: The authoritative design system is [brand-guidelines-v3.4.md](./docs/design/brand-guidelines-v3.4.md).**

## Mandatory UI Change Protocol

**Before ANY UI/design work, you MUST:**

1. **READ** the relevant section of docs/design/brand-guidelines-v3.4.md
2. **VERIFY** your planned implementation aligns with documented patterns
3. **ASK USER** before proceeding if:
   - The requested change conflicts with brand guidelines
   - You're unsure if a pattern is documented
   - You need to deviate from documented patterns for any reason

### Deviation Requires Explicit Approval

- ❌ NEVER assume a deviation is acceptable
- ❌ NEVER implement UI that conflicts with guidelines without asking
- ✅ ALWAYS ask: "This deviates from brand guidelines because [reason]. Should I proceed?"
- ✅ ALWAYS suggest the guideline-compliant alternative first

### Examples of When to Ask

- User requests rounded corners on tab underlines (guidelines say angular)
- User requests vibe orange button background (guidelines prohibit this)
- User requests centered tabs (guidelines enforce left-justified)
- Any color, spacing, or typography not in the documented system

## Quick Reference - MUST FOLLOW

### Color Usage Rules

**Vibe Orange (#FF8800)** - ONLY for 9 specific uses:

1. Active tab underlines (6px angular)
2. Left-edge indicators on metric cards (6px × 56px angular)
3. Individual table column headers (3px underline on sortable columns only)
4. Focus states (3px left border on inputs, 2px outline on buttons)
5. Circular progress indicators (filled portion only)
6. Progress trackers (linear/circular for onboarding)
7. Wayfinding step indicators
8. Section dividers (onboarding/instructional only)
9. Contextual info banners (as subtle accent only)

**NEVER use vibe orange for:**

- Text (fails WCAG contrast)
- Button backgrounds
- Card backgrounds
- Icons
- Large filled areas

**Background hierarchy:**

- Always use `bg-viewport` for body (#FCFCFC light, #161616 dark)
- Always use `bg-card` for content cards (#FFFFFF light, #202020 dark)

### Button System (4 Variants Only)

1. **Primary** (`variant="default"`) - Slate gradient for main actions
2. **Plain** (`variant="hollow"`) - White/bordered for secondary actions
3. **Destructive** (`variant="destructive"`) - Red gradient for dangerous actions
4. **Link** (`variant="link"`) - Text-only for tertiary actions

**Dark mode:** Primary/destructive buttons NEVER change colors, only hollow buttons adapt

### Typography Rules

- **Headings:** ALWAYS Montserrat Extra Bold, ALL CAPS
- **Body text:** ALWAYS Inter Light (300) or Regular (400)
- **Interactive elements:** ALWAYS Inter Medium (500)
- **Table headers:** 12px uppercase, Inter Medium
- **Numbers:** Always use `tabular-nums` class
- **NEVER mix** Montserrat and Inter in same element

### Icon System

**Library:** Remix Icon (`@remixicon/react`)

- 3,100+ icons, neutral professional style
- Use `-line` (outlined) for consistency
- Color: `text-cb-ink-muted` (#7A7A7A light / #6B6B6B dark)
- Size: 16px (`h-4 w-4`) for inline/buttons

**DO NOT:**

- Mix icon libraries (no Lucide, Font Awesome, etc.)
- Change icon colors to vibe orange
- Use custom SVGs when Remix Icon equivalent exists

### Table Design

- Header background: White (#FFFFFF light, #202020 dark)
- 3px vibe orange underline ONLY on individual sortable columns (not entire header)
- 1px horizontal borders only (no vertical borders)
- Row heights: 30px (single-line) or 52-56px (two-line)
- Numbers: Right-aligned with tabular figures
- Hover: Entire row background changes

### Layout Rules

- **90% rule:** NO card containers around content (use white background + thin borders)
- **10% exception:** Cards ONLY for modals, dropdowns, search bars, metric cards, onboarding tips, banners
- **Gutters:** 8px right/bottom/left (via `inset-2`), top flush at 52px
- **Card padding:** See guidelines - varies by page type (scrollable vs static)
- **Spacing:** Always use 4px grid (Tailwind defaults)

### Tab Navigation

- Active underline: 6px height, vibe orange (#FF8800)
- Shape: Angular/parallelogram using clip-path (NOT rounded)
- Position: Bottom of tab, full width
- Full-width black underline on TabsList wrapper
- Left-justified alignment with 24px gap (enforced, cannot override)

## Pre-Code Checklist

Before implementing ANY UI component or making design changes:

- [ ] Read relevant section of docs/design/brand-guidelines-v3.4.md
- [ ] Verify color usage matches approved patterns
- [ ] Confirm button variant is correct for use case
- [ ] Check typography follows Montserrat/Inter rules
- [ ] Ensure spacing uses 4px grid
- [ ] Validate dark mode behavior
- [ ] Test accessibility (WCAG AA, focus states, touch targets)

## Versioning Requirement

**When editing brand-guidelines-v3.4.md, you MUST:**

1. Increment version in **3 places:**
   - Title (line 1)
   - DOCUMENT VERSION section
   - END OF BRAND GUIDELINES (last line)
2. Add entry to **docs/brand-guidelines-changelog.md** with:

   - Date and TIME
   - Git commit hash (add after commit)
   - Summary of changes
3. Update "Last Updated" date/time in header

**Version Types:**

- **Patch** (v3.3.1 → v3.3.2): Claude does automatically for 1-2 section updates (do NOT rename file)
- **Minor** (v3.3 → v3.4): Flag to user if updating 3+ sections (RENAME file)
- **Major** (v3.x → v4.0): **NEVER** - only user decides

## When in Doubt

1. **Check docs/design/brand-guidelines-v3.4.md first**
2. Search for similar existing components
3. Ask user for clarification if guidelines unclear
4. NEVER guess or improvise design patterns

**Violation of brand guidelines will require rework. Always verify before implementing.**

---

# API NAMING CONVENTIONS

**CRITICAL: Follow [api-naming-conventions.md](./docs/architecture/api-naming-conventions.md) for all code naming.**

## Quick Reference

| Pattern | Convention | Example |
|---------|------------|---------|
| Edge Function folders | kebab-case | `fetch-meetings/` |
| Frontend functions | camelCase | `fetchMeetings()` |
| Hooks | use + camelCase | `useMeetingsSync()` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |
| Database fields | snake_case | `recording_id` |
| Query keys | kebab-case arrays | `["call-transcripts", id]` |

## Function Prefix Standards

- `fetch*` - Retrieve data from API
- `sync*` - Synchronize data
- `save*` - Persist settings
- `get*` - Retrieve config/status
- `test*` - Verify connections
- `create*` - Create resources
- `delete*` - Remove data
- `load*` - Load internal data
- `check*` - Verify status

**Before writing any function, hook, or type, check the naming conventions document.**

---

# DEVELOPMENT STANDARDS

## AI/SDK Implementation Defaults

### ⚠️ CRITICAL: VERCEL SDK FIRST - ALWAYS

**This is the #1 rule for all AI/ML/LLM implementations in this project.**

Before writing ANY code involving AI, chat, streaming, model selection, or similar features:

1. **STOP** - Do not implement from scratch
2. **CHECK** - Does Vercel have an SDK/tool for this?
3. **USE IT** - If yes, use the Vercel solution exclusively
4. **ASK** - If unsure, ask before implementing alternatives

**MANDATORY: Vercel SDK Ecosystem**

You **MUST** use Vercel SDKs and related tools for **ALL** applicable features. This is a strict mandate.

**Core Required Stack:**

- **AI SDK** (`ai`) - **MANDATORY** for all LLM integration, streaming, and tool calling.
- **AI SDK React** (`@ai-sdk/react`) - **MANDATORY** for all frontend chat/completion hooks.
- **OpenRouter** - **MANDATORY** for all LLM model routing. **ALL models route through OpenRouter.**
- **Workflow DevKit** - **MANDATORY** for all orchestration, triggers, and multi-step agent flows.
- **Flags SDK** - **MANDATORY** for all feature flagging and toggles.
- **Streamdown AI** - **MANDATORY** pattern for streaming markdown content (maximize streaming capabilities).
- **Prompt-Kit UI** - **MANDATORY** for all chat-related UI components (as per ADR-005).

**Why?** We prioritize deep integration with the Vercel AI SDK ecosystem for streaming/tools and OpenRouter for unified model access to 300+ models.

### OpenRouter Configuration

**ALL AI models are routed through OpenRouter** - this provides unified access to models from OpenAI, Anthropic, Google, xAI, Meta, Mistral, DeepSeek, and 300+ more.

**Default Model:** `z-ai/glm-4.6` (Z.AI GLM-4.6)

**Environment Variables:**

```bash
# Primary - OpenRouter (REQUIRED for LLM calls)
OPENROUTER_API_KEY=sk-or-v1-xxx...    # Your OpenRouter API key

# OpenAI Direct (REQUIRED for embeddings only - OpenRouter doesn't support embeddings)
OPENAI_API_KEY=sk-xxx...              # For text-embedding-3-small
```

**Model Format:** `provider/model-name` (e.g., `z-ai/glm-4.6`, `openai/gpt-4o`, `anthropic/claude-sonnet-4`)

**Supported Providers via OpenRouter:**

- **Z.AI**: glm-4.6 (default)
- **OpenAI**: gpt-4o, gpt-4o-mini, o1, o3-mini
- **Anthropic**: claude-opus-4, claude-sonnet-4, claude-3.5-sonnet, claude-3.5-haiku
- **Google**: gemini-2.0-flash, gemini-2.5-pro, gemini-1.5-pro
- **xAI**: grok-3-beta, grok-2
- **Meta**: llama-3.3-70b, llama-3.1-405b
- **DeepSeek**: deepseek-chat-v3, deepseek-r1
- **Mistral**: mistral-large, codestral
- **And 300+ more models**

**Reference Documentation:**

- [AI SDK Cookbook Examples](./docs/reference/ai-sdk-cookbook-examples) - Implementation patterns and use cases
- [OpenRouter Docs](https://openrouter.ai/docs)
- [OpenRouter Models](https://openrouter.ai/models)

### Implementation Examples

```typescript
// Frontend: Chat with streaming - AI SDK v5
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const transport = new DefaultChatTransport({
  api: '/api/chat',
});

const { messages, sendMessage, status } = useChat({ transport });

// Backend: Multi-provider support via OpenRouter (OpenAI-compatible)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter is OpenAI-compatible - use createOpenAI with custom baseURL
function createOpenRouterProvider(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      'HTTP-Referer': 'https://callvaultai.com',
      'X-Title': 'CallVault',
    },
  });
}

const openrouter = createOpenRouterProvider(process.env.OPENROUTER_API_KEY);

const result = await streamText({
  model: openrouter('z-ai/glm-4.6'),  // Default model
  messages,
});

// For embeddings - use OpenAI directly (OpenRouter doesn't support embeddings)
const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: text,
  }),
});
```

### Deviations

**Deviations are generally NOT permitted.**
If a Vercel AI SDK solution exists for streaming/tools, it **must** be used.
All LLM model routing **must** go through OpenRouter.
Only if a feature is *completely impossible* with the current stack may you consider alternatives, and this requires an **Explicit ADR** approval first.

## Code Quality Standards

### Security First

- Be careful not to introduce security vulnerabilities
- Watch for: command injection, XSS, SQL injection, OWASP top 10
- If you notice insecure code, immediately fix it
- Validate at system boundaries (user input, external APIs)
- Don't add unnecessary error handling for impossible scenarios

### Avoid Over-Engineering

**Keep solutions simple and focused:**

- Only make changes directly requested or clearly necessary
- Don't add features, refactor code, or make "improvements" beyond what was asked
- Don't add docstrings, comments, or type annotations to code you didn't change
- Don't add error handling for scenarios that can't happen
- Don't create helpers or abstractions for one-time operations
- Don't design for hypothetical future requirements
- Three similar lines of code is better than a premature abstraction

### No Backwards-Compatibility Hacks

- Avoid hacks like renaming unused `_vars`, re-exporting types
- Don't add `// removed` comments for removed code
- If something is unused, delete it completely
- Make direct changes instead of compatibility layers

---

# ARCHITECTURE DECISION RECORDS (ADRs)

**Location**: [docs/adr/](./docs/adr/)

## When to Create an ADR

**Create an ADR when making decisions about:**

- Database/backend selection or changes
- AI model/provider choices
- Integration platform decisions (n8n, Zapier, etc.)
- Major schema or API changes
- Technical constraints or limitations
- Deployment/infrastructure changes
- New SDK or library adoption for core features

**Do NOT create an ADR for:**

- UI component choices (covered by brand guidelines)
- Bug fixes or refactoring
- Reversible implementation details
- Anything taking <4 hours to change later

## How to Create an ADR

1. Copy `docs/adr/adr-template.md`
2. Number sequentially (check `docs/adr/README.md` for latest)
3. Fill in: Context, Decision, Consequences
4. Save as `docs/adr/adr-XXX-short-title.md`
5. Update `docs/adr/README.md` with new entry
6. Commit with message: `docs: add ADR-XXX for [decision]`

**Time limit**: 10-15 minutes max

## ADR Trigger Checklist

Before implementing a significant technical choice, ask:

- [ ] Will this affect how we build 3+ future features?
- [ ] Would a new developer ask "why did we do this?"
- [ ] Is this hard to reverse (>4 hours of work)?

If YES to 2+ questions → write an ADR

## Example Decisions Requiring ADRs

- "We will use Vercel AI SDK for all chat features" → ADR
- "We will use Supabase Edge Functions for serverless" → ADR
- "We will use Remix Icon instead of Lucide" → ADR
- "We will limit API calls to 100/minute" → ADR

**Reference**: See [docs/adr/README.md](./docs/adr/README.md) for full SOP and examples

---

# CODE QUALITY & REVIEW WORKFLOWS

## Code Review

**Use `/code-review` or Task(subagent_type="pragmatic-code-review")** for comprehensive code analysis:

- After completing a significant feature or refactor
- Before creating a pull request
- When reviewing complex business logic or architectural changes

The pragmatic code review agent evaluates:

- Architectural design and integrity
- Functionality and correctness
- Security (OWASP top 10)
- Maintainability and readability
- Testing strategy
- Performance and scalability

## Security Review

**Use `/security-review`** for security-focused analysis:

- Before merging PRs with authentication/authorization changes
- When handling user input, API endpoints, or data processing
- For any code touching secrets, credentials, or sensitive data
- Before deploying security-critical features

The security review focuses on:

- Input validation vulnerabilities (SQL injection, XSS, command injection)
- Authentication and authorization issues
- Crypto and secrets management
- Data exposure risks

## Design Review

**Use `/design-review` or Task(subagent_type="design-review")** for UI validation:

- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing

Requires access to live preview environment, uses Playwright for automated testing.

## Review Workflow Integration

1. **During development**: Use `/code-review` after completing logical chunks of code
2. **Before PR**: Run both `/code-review` and `/security-review`
3. **UI changes**: Also run `/design-review` for visual validation
4. **Address findings**: Fix blockers and high-priority issues before merge

---

# VISUAL DEVELOPMENT PROTOCOL

## Design Principles

- Comprehensive design checklist in `/docs/design/design-principles-callvault.md`
- Brand style guide in `/docs/design/brand-guidelines-v3.4.md`
- When making visual (front-end, UI/UX) changes, always refer to these files for guidance

## Quick Visual Check

**IMMEDIATELY after implementing any front-end change:**

1. **Identify what changed** - Review the modified components/pages
2. **Check dev server URL** - Read `vite.config.ts` for the server port (default: <http://localhost:8080>)
3. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view at the correct URL
4. **Verify design compliance** - Compare against `/docs/design/design-principles-callvault.md` and `/docs/design/brand-guidelines-v3.4.md`
5. **Validate feature implementation** - Ensure the change fulfills the user's specific request
6. **Check acceptance criteria** - Review any provided context files or requirements
7. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
8. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

## Comprehensive Design Review

Invoke the `/design-review` command or Task(subagent_type="design-review") for thorough design validation when:

- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing

---

# BEST PRACTICES SUMMARY

## Planning & Execution

1. **Plan before code** - Use TodoWrite for non-trivial tasks (3+ steps)
2. **Research first** - Use Explore/codebase-analyst agents, read existing code
3. **Break down complexity** - Tasks should be 30 min - 4 hours each
4. **Track in real-time** - Mark in_progress/completed immediately
5. **One task at a time** - Exactly one in_progress task

## Design & UI

1. **Read guidelines first** - Always check brand-guidelines-v3.4.md before UI work
2. **Ask before deviating** - Never assume deviations are acceptable
3. **Follow conventions** - Use established patterns for colors, typography, components
4. **Verify immediately** - Visual check after every front-end change
5. **Use Playwright** - Navigate and screenshot to validate changes

## Code Quality

1. **Security first** - Watch for OWASP top 10 vulnerabilities
2. **Keep it simple** - Avoid over-engineering, unnecessary abstractions
3. **Follow naming** - Check api-naming-conventions.md before naming anything
4. **Use correct SDK** - Default to Vercel AI SDK for AI features
5. **Review before merge** - Run code-review, security-review, design-review

## Documentation

1. **ADRs for big decisions** - Document architectural choices
2. **Version brand guidelines** - Always increment version on edit
3. **Update changelog** - Track all guideline changes
4. **Document deviations** - Explain why in code comments

---

# WORKFLOW EXAMPLES

## Example 1: New UI Component

```typescript
// User: "Add a metrics card to the Analytics page"

// 1. Create todo list
TodoWrite({
  todos: [
    { content: "Read brand guidelines metric card section", activeForm: "Reading brand guidelines metric card section", status: "in_progress" },
    { content: "Find existing metric card implementations", activeForm: "Finding existing metric card implementations", status: "pending" },
    { content: "Design new metric card following brand system", activeForm: "Designing new metric card following brand system", status: "pending" },
    { content: "Implement metric card component", activeForm: "Implementing metric card component", status: "pending" },
    { content: "Add to Analytics page", activeForm: "Adding to Analytics page", status: "pending" },
    { content: "Verify design compliance with Playwright", activeForm: "Verifying design compliance with Playwright", status: "pending" }
  ]
});

// 2. Execute research
Read("docs/design/brand-guidelines-v3.4.md") // Find metric card section
Grep("metric", "**/*.tsx") // Find existing implementations
// Mark first task completed, mark second in_progress

// 3. Implement following patterns
// Mark second completed, mark third in_progress
// ... continue systematically

// 4. Visual verification
// Navigate to page, take screenshot, verify against guidelines
// Mark last task completed
```

## Example 2: API Endpoint

```typescript
// User: "Create an endpoint to fetch user analytics"

// 1. Plan
TodoWrite({
  todos: [
    { content: "Check API naming conventions for endpoint names", activeForm: "Checking API naming conventions for endpoint names", status: "in_progress" },
    { content: "Find similar analytics endpoints", activeForm: "Finding similar analytics endpoints", status: "pending" },
    { content: "Create Edge Function with kebab-case name", activeForm: "Creating Edge Function with kebab-case name", status: "pending" },
    { content: "Add camelCase function to api-client.ts", activeForm: "Adding camelCase function to api-client.ts", status: "pending" },
    { content: "Write tests for analytics endpoint", activeForm: "Writing tests for analytics endpoint", status: "pending" },
    { content: "Run security review", activeForm: "Running security review", status: "pending" }
  ]
});

// 2. Research
Read("docs/architecture/api-naming-conventions.md")
Grep("analytics", "supabase/functions/**/index.ts")
// Follow established patterns

// 3. Implement
// Create supabase/functions/fetch-user-analytics/index.ts (kebab-case)
// Add fetchUserAnalytics() to api-client.ts (camelCase)
// Mark tasks completed as you go

// 4. Review
// Run /security-review before finishing
```

## Example 3: Feature with Unknown Scope

```typescript
// User: "Improve error handling in the sync flow"

// 1. Discovery phase first
TodoWrite({
  todos: [
    { content: "Explore sync flow implementation", activeForm: "Exploring sync flow implementation", status: "in_progress" },
    { content: "Identify all error points", activeForm: "Identifying all error points", status: "pending" },
    { content: "Create improvement plan", activeForm: "Creating improvement plan", status: "pending" }
  ]
});

// 2. Use Explore agent for discovery
Task({
  subagent_type: "Explore",
  description: "Find sync flow errors",
  prompt: "Explore the sync flow implementation and identify all error handling patterns. Report back on current state and improvement opportunities.",
  thoroughness: "medium"
});

// 3. After discovery, expand todo list with specific tasks
// Update todos with concrete implementation steps
// Then execute systematically
```

---

# FINAL REMINDERS

## Always Do

- ✅ Use TodoWrite for multi-step tasks
- ✅ Read brand guidelines before UI work
- ✅ Check API naming conventions before naming
- ✅ Research existing patterns first
- ✅ Break complex tasks into small steps
- ✅ Mark tasks completed immediately
- ✅ Verify UI changes with Playwright
- ✅ Run appropriate reviews before merge
- ✅ Ask user before deviating from guidelines

## Never Do

- ❌ Code without planning multi-step tasks
- ❌ Implement UI without reading guidelines
- ❌ Assume deviations are acceptable
- ❌ Skip research phase
- ❌ Batch multiple task completions
- ❌ Mix icon libraries or naming conventions
- ❌ Over-engineer solutions
- ❌ Add backwards-compatibility hacks
- ❌ Ignore security best practices

---

**END OF CLAUDE INSTRUCTIONS**

This document represents the complete development guide for CallVault. All implementations must follow these standards exactly.
