# SPEC: Documentation Restructure and Prefix Standardization

**Status:** Ready for Implementation
**Priority:** High - Blocks efficient development
**Coordination:** Works in parallel with PRP-PANE-001 (Unified Pane Architecture)

---

## Executive Summary

This spec addresses the root cause of recurring implementation inconsistencies: documentation that's too monolithic, disconnected from code reality, and missing architectural guardrails.

**Key Changes:**
1. Split 1052-line CLAUDE.md into folder-specific files (src/, supabase/, docs/)
2. Remove legacy `cb-` prefix, standardize on semantic naming without prefix
3. Update brand guidelines to v4.2 with correct CSS classes
4. Establish "anti-pattern" documentation to prevent future drift

**Outcome:** When Claude works in `/src/pages`, it reads `/src/CLAUDE.md` which says "use AppShell, don't copy pane code, edge-mounted toggle NOT hamburger" - preventing the exact issues found in Chat.tsx and CollaborationPage.tsx.

---

## What

Restructure CallVault's documentation system by:
1. Splitting the 1052-line monolithic `/CLAUDE.md` into focused, folder-specific instruction files
2. Standardizing the Tailwind CSS prefix from `cb-` (legacy "Conversion Brain") to no prefix (using semantic token names directly)
3. Aligning brand guidelines documentation with actual code implementation
4. Creating a slim root `CLAUDE.md` that focuses on core philosophy and pointers

**Files affected:**
- `/CLAUDE.md` (restructure to slim version)
- `/src/CLAUDE.md` (new - frontend-specific instructions)
- `/supabase/CLAUDE.md` (new - edge functions instructions)
- `/docs/CLAUDE.md` (new - documentation standards)
- `/docs/design/brand-guidelines-v4.1.md` (update CSS variable section)
- `/src/index.css` (remove legacy aliases, standardize naming)
- `/tailwind.config.ts` (rename `cb` color group)

## Why

The current documentation has three core problems:
1. **Monolithic CLAUDE.md** - 1052 lines mixing frontend patterns, backend conventions, AI SDK usage, design rules, and workflow instructions - hard to navigate and maintain
2. **Prefix inconsistency** - Brand guidelines document `cv-` (CallVault), code uses `cb-` (legacy Conversion Brain), CSS has both via aliases. This creates confusion and technical debt.
3. **Documentation drift** - Brand guidelines reference `cv-` classes that don't exist in Tailwind config, while actual code uses `cb-` exclusively

### Case Study: Unified Pane Architecture (PRP-PANE-001)

The `PRPs/unified-pane-architecture.md` demonstrates exactly what happens when documentation and code diverge:

**The Problem:**
- ~200 lines of identical pane/sidebar code duplicated across 5+ page files
- Chat.tsx uses old hamburger toggle while other pages use edge-mounted toggle
- CollaborationPage has extra card wrappers that violate the "no nested containers" rule
- Brand guidelines say "500ms transitions" but some pages use 300ms
- Any sidebar change requires updating multiple files

**Root Cause:**
- No single source of truth for layout patterns
- Documentation describes "what should be" not "how to implement it"
- Missing architectural guardrails in folder-specific context

**What This Teaches Us:**
1. Documentation must include **implementation patterns**, not just rules
2. Folder-specific instructions prevent copy-paste drift
3. Reference implementations need explicit "this is the gold standard" callouts
4. Anti-patterns must be documented alongside correct patterns

## User Experience

After restructuring:
- Developers working in `/src` see only frontend-relevant instructions
- Developers working in `/supabase/functions` see only Edge Function conventions
- Root `CLAUDE.md` provides philosophical guardrails and quick navigation
- All prefix references are consistent throughout docs and code
- Brand guidelines accurately reflect what classes to use

## Scope

**Applies to:**
- `/CLAUDE.md` - root instructions
- `/src/` - frontend folder
- `/supabase/functions/` - Edge Functions folder
- `/docs/` - documentation folder
- `/docs/design/brand-guidelines-v4.1.md` - brand guidelines
- `/tailwind.config.ts` - Tailwind configuration
- `/src/index.css` - CSS variable definitions

**Does NOT apply to:**
- `/e2e/` - minimal instructions, mostly self-evident from file structure
- `/scripts/` - utility scripts, no Claude instructions needed
- `/PRPs/` - planning documents, not code instructions
- `.github/` - GitHub workflows, not development instructions

## Decisions Made

### Decision 1: Remove prefix entirely instead of migrating to `cv-`

**Rationale:**
- The `cb-` prefix (Conversion Brain) is legacy naming that no longer reflects the product
- Migrating 536 occurrences across 93 files from `cb-` to `cv-` would be a massive find/replace
- Modern semantic naming (`text-ink-muted`, `bg-hover`, `border-soft`) is clearer than prefixed naming
- Tailwind already has a semantic token system - adding prefixes is redundant
- The colors are CallVault-specific anyway; no collision risk with standard Tailwind colors

**Action:**
- In `/tailwind.config.ts`: Rename the `cb:` color group to semantic names without prefix
- Update `/src/index.css`: Remove legacy `--cb-*` CSS variable aliases
- Update brand guidelines: Document semantic names (`text-ink-muted` not `text-cv-ink-muted`)
- Code migration: Search/replace `text-cb-` to `text-`, `bg-cb-` to `bg-`, etc.

### Decision 2: Three folder-specific CLAUDE.md files

**Rationale:**
- Top-level domains with distinct concerns: `src/` (frontend), `supabase/` (backend), `docs/` (documentation)
- `/e2e/` and `/scripts/` are small, self-documenting directories
- Claude's context window benefits from focused, relevant instructions per directory

**New files:**
1. `/src/CLAUDE.md` - Component patterns, UI conventions, hooks, Tanstack Query, state management
2. `/supabase/CLAUDE.md` - Edge Function conventions, database patterns, API naming
3. `/docs/CLAUDE.md` - Documentation standards, versioning, spec writing

### Decision 3: Keep vibe-orange naming as-is

**Rationale:**
- `vibe-orange` is brand-specific and intentional
- Already consistently named across CSS and Tailwind config
- Clear, memorable naming that reflects brand identity

### Decision 4: Brand guidelines v4.2 for prefix changes

**Rationale:**
- Updating CSS variable references affects 3+ sections
- Per versioning rules: 3+ sections = minor version bump
- Will rename file from `brand-guidelines-v4.1.md` to `brand-guidelines-v4.2.md`

## Prefix Analysis Summary

### Current State

| Location | Prefix Used | Example |
|----------|-------------|---------|
| Tailwind config | `cb` | `colors: { cb: { ink: "...", border: "..." } }` |
| CSS variables | Both `cv-` and `cb-` | `--cv-ink`, `--cb-ink` (aliases) |
| Brand guidelines | `cv-` | Documents `text-cv-ink-muted` |
| Actual code (536 occurrences) | `cb-` | `text-cb-ink-muted`, `bg-cb-hover` |

### Recommended State

| Location | Naming | Example |
|----------|--------|---------|
| Tailwind config | No prefix | `colors: { ink: "...", border: "..." }` |
| CSS variables | No prefix | `--ink`, `--ink-soft`, `--ink-muted` |
| Brand guidelines | No prefix | Documents `text-ink-muted` |
| Code | No prefix | `text-ink-muted`, `bg-hover` |

### Migration Path

The color groups that need renaming:

**From (current `cb-` prefix):**
```typescript
cb: {
  black: "...",
  white: "...",
  "gray-light": "...",
  "gray-medium": "...",
  "gray-dark": "...",
  ink: "...",
  "ink-soft": "...",
  "ink-muted": "...",
  border: "...",
  "border-soft": "...",
  hover: "...",
  "bg-gray": "...",
  // ... status colors
}
```

**To (semantic naming, merge into existing groups):**
```typescript
// Merge ink colors into existing structure
ink: {
  DEFAULT: "hsl(var(--ink))",
  soft: "hsl(var(--ink-soft))",
  muted: "hsl(var(--ink-muted))",
},
// border already exists, just add soft variant
border: "hsl(var(--border))",
"border-soft": "hsl(var(--border-soft))",
// hover already exists
hover: "hsl(var(--hover))",
```

## Folder-Specific CLAUDE.md Outlines

### 1. Root `/CLAUDE.md` (Slim Version)

**Target length:** 150-200 lines

**Contents:**
```markdown
# CallVault - Claude Instructions

## Core Philosophy
- One-Click Promise (summarized)
- KISS-UX Principle (summarized)

## Folder-Specific Instructions
- `/src/CLAUDE.md` - Frontend development
- `/supabase/CLAUDE.md` - Edge Functions and database
- `/docs/CLAUDE.md` - Documentation standards

## Key References
- Brand Guidelines: `/docs/design/brand-guidelines-v4.2.md`
- API Naming: `/docs/architecture/api-naming-conventions.md`
- ADRs: `/docs/adr/README.md`

## Quick Rules
- Never propose changes to code you haven't read
- Use TodoWrite for multi-step tasks
- Fetch documentation before using external libraries
- Ask before deviating from brand guidelines

## Git Workflow
[Condensed git commit/PR creation instructions]

## Test Credentials
[.env.local reference for testing]
```

### 2. `/src/CLAUDE.md` (Frontend Instructions)

**Target length:** 300-400 lines

**Contents:**
```markdown
# Frontend Development Instructions

## Layout Architecture (CRITICAL)
- **ALL pages MUST use AppShell** - never duplicate pane/sidebar code
- Reference implementation: `src/pages/SortingTagging.tsx`
- Sidebar toggle: ALWAYS edge-mounted circular button (NOT hamburger)
- Transitions: ALWAYS 500ms ease-in-out (NOT 300ms)
- Pane widths: NavRail 220/72px, Secondary 280px, Detail 360px

### Anti-Patterns to AVOID
- ❌ Copy-pasting pane layout code between pages
- ❌ Using hamburger menu for sidebar toggle
- ❌ Nesting card containers (one bg-card per pane max)
- ❌ Using 300ms transitions for sidebar
- ❌ Hardcoding widths in pages (use AppShell config)

## Component Architecture
- Component file organization: `/src/components/{domain}/{ComponentName}.tsx`
- Naming conventions (PascalCase components, camelCase hooks)
- Import patterns
- Layout components live in `/src/components/layout/`

## UI/UX Standards
- Brand guidelines reference: `/docs/design/brand-guidelines-v4.2.md`
- Button system (4 variants: default, hollow, destructive, link)
- Icon system (Remix Icon ONLY, no Lucide/FontAwesome)
- Color usage (vibe orange - 9 approved uses only)
- Typography (Montserrat CAPS headings, Inter body)

## State Management
- Tanstack Query patterns
- Zustand store conventions (panelStore for detail panels)
- React Query key naming: kebab-case arrays

## Visual Development Protocol
- ALWAYS verify with browser after UI changes
- Screenshot at desktop viewport (1440px)
- Design review for significant UI changes

## Common Patterns
- Form handling with react-hook-form
- Error boundaries
- Loading states (skeleton patterns)
- Dark mode: Primary buttons NEVER change color
```

### 3. `/supabase/CLAUDE.md` (Backend Instructions)

**Target length:** 200-300 lines

**Contents:**
```markdown
# Supabase Edge Functions Instructions

## Function Organization
- Folder naming (kebab-case)
- Shared utilities in `_shared/`
- Index.ts structure

## API Conventions
- Function prefix standards (fetch*, sync*, save*, etc.)
- Response format
- Error handling patterns
- CORS configuration

## Database Patterns
- RLS policy requirements
- Query patterns
- Migration conventions

## AI/LLM Integration
- OpenRouter configuration
- Vercel AI SDK usage
- Model selection

## Security
- Environment variable handling
- Authentication verification
- Input validation
```

### 4. `/docs/CLAUDE.md` (Documentation Standards)

**Target length:** 100-150 lines

**Contents:**
```markdown
# Documentation Standards

## Spec Writing
- File location: `/docs/specs/SPEC-{feature-name}.md`
- Required sections
- Naming conventions

## Brand Guidelines
- Versioning requirements
- Changelog updates
- When to bump versions

## ADR Writing
- When to create ADRs
- Template location
- README updates

## Archive Policy
- When to archive docs
- Archive location
- Naming conventions
```

## Brand Guidelines Update Plan

### Section Updates Required

1. **CSS Variable Reference** (Section 23)
   - Remove all `cv-` and `cb-` prefixes from examples
   - Update Tailwind config mapping to show unprefixed names
   - Update code examples throughout

2. **Color System** (Section 3)
   - Update Tailwind Usage examples to use unprefixed classes
   - Remove mentions of `cv-` prefix

3. **Button System** (Section 5)
   - Update Icon Button Implementation code examples
   - Remove `cv-` prefixed class names

4. **Tab Navigation** (Section 7)
   - Update TabsTrigger examples

5. **Multiple component sections**
   - Find/replace `cv-` with semantic names in code examples

### Version Impact

- Updates span 5+ sections
- **New version:** v4.2
- **File rename:** `brand-guidelines-v4.1.md` to `brand-guidelines-v4.2.md`
- **Changelog entry required**

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Existing `cb-` classes in code | Code migration happens AFTER docs update; existing code continues working via CSS aliases until migration complete |
| Third-party component using `cb-` | CSS aliases remain until full migration; no breaking changes |
| Dark mode classes with prefix | Same migration pattern; `dark:text-cb-ink` becomes `dark:text-ink` |
| Status colors (success, warning, etc.) | Already use `cb-` prefix in CSS vars; migrate to unprefixed `success-bg`, `warning-text`, etc. |

## Preventing Future Documentation Drift

### Principles Established by This Restructure

1. **Single Source of Truth for Patterns**
   - Layout patterns: AppShell is THE way to build pages
   - Color system: Brand guidelines v4.2 with unprefixed names
   - Component patterns: `/src/CLAUDE.md` references

2. **Anti-Patterns Documented Alongside Patterns**
   - Every "do this" should have a "don't do this"
   - Makes it harder to accidentally deviate

3. **Reference Implementations Explicitly Called Out**
   - `SortingTagging.tsx` is the gold standard for pane layout
   - When creating new patterns, designate a reference file

4. **Folder-Level Context Reduces Cognitive Load**
   - Developer working in `/src/pages` only needs `/src/CLAUDE.md`
   - No hunting through 1000+ line root file

### Maintenance Requirements

When adding NEW architectural patterns:
1. Update relevant folder-specific CLAUDE.md
2. Designate a reference implementation
3. Document anti-patterns
4. If it affects 3+ sections of brand guidelines, bump minor version

When a pattern is BROKEN across multiple files:
1. Fix the reference implementation FIRST
2. Create a PRP if migration is needed
3. Update CLAUDE.md with clear "migrate to X" instructions
4. Do NOT update brand guidelines until code is fixed

## Open Questions

None - all decisions made based on codebase analysis.

## Priority

### Must Have

1. **Phase 1: Brand Guidelines Update** (do first)
   - Update brand-guidelines to v4.2 with unprefixed naming
   - Update CSS Variable Reference section
   - Update code examples throughout
   - Add changelog entry

2. **Phase 2: Create Folder-Specific CLAUDE.md Files**
   - Create `/src/CLAUDE.md`
   - Create `/supabase/CLAUDE.md`
   - Create `/docs/CLAUDE.md`
   - Slim down root `/CLAUDE.md`

3. **Phase 3: CSS/Tailwind Migration**
   - Update `/tailwind.config.ts` color naming
   - Remove legacy aliases from `/src/index.css`
   - Keep aliases temporarily for backwards compatibility

4. **Phase 4: Code Migration** (can be incremental)
   - Search/replace `text-cb-` to `text-` across codebase
   - Search/replace `bg-cb-` to `bg-` across codebase
   - Search/replace `border-cb-` to `border-` across codebase
   - Remove CSS variable aliases after code is migrated

### Nice to Have

- Add JSDoc comments to Tailwind config explaining color system
- Create visual color reference in docs
- Add automated lint rule to prevent `cb-` prefix usage after migration

## Implementation Order

```
Phase 1: Brand Guidelines v4.2
    |
    v
Phase 2: Create Folder-Specific CLAUDE.md Files
    |
    v
Phase 3: Tailwind/CSS Config Updates
    |
    v
Phase 4: CSS Class Migration (incremental)
    |
    v
[PARALLEL] PRP-PANE-001: Unified Pane Architecture
           - AppShell implementation
           - Page migrations
           - Uses new CLAUDE.md for guidance
```

### Coordination with PRP-PANE-001

The documentation restructure and unified-pane-architecture PRP should be coordinated:

1. **Do docs restructure FIRST** (this spec)
   - Brand guidelines v4.2 establishes the authoritative design patterns
   - `/src/CLAUDE.md` documents the AppShell requirement
   - This provides the "target state" documentation

2. **Then implement PRP-PANE-001**
   - Creates the AppShell components
   - Migrates pages to use AppShell
   - The new CLAUDE.md files guide correct implementation

3. **Update docs AFTER implementation**
   - Brand guidelines gets AppShell component examples
   - `/src/CLAUDE.md` updates with "AppShell is complete" status
   - Reference implementation callouts updated

**Note:** Phases 1-3 are documentation/config only. Phase 4 touches production code but is backwards-compatible due to CSS aliases.

---

**Spec Version:** 1.1
**Created:** 2026-01-12
**Updated:** 2026-01-12
**Author:** Claude (Spec Builder Agent)
**Related:** PRP-PANE-001 (Unified Pane Architecture)
