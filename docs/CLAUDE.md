# Documentation Standards

**Last Updated:** 2026-01-14
**Scope:** Standards for creating and maintaining documentation in /docs

---

## Table of Contents

1. [Spec Writing Standards](#spec-writing-standards)
2. [Brand Guidelines Versioning](#brand-guidelines-versioning)
3. [ADR Writing Standards](#adr-writing-standards)
4. [Archive Policy](#archive-policy)

---

## Spec Writing Standards

### File Location

All specification documents live in `/docs/specs/`.

### File Naming

```
SPEC-{feature-name}.md
```

**Examples:**
- `SPEC-user-authentication.md`
- `SPEC-chat-context-library.md`
- `SPEC-content-engine.md`

**Naming Rules:**
- Use lowercase with hyphens (kebab-case)
- Be descriptive but concise
- Start with `SPEC-` prefix

### Required Sections

Every spec document MUST include:

1. **Header** - Status, Priority, and any coordination notes
2. **Executive Summary** - 2-3 sentences on what this spec addresses
3. **What** - Detailed description of the feature/change
4. **Why** - Business or technical rationale
5. **User Experience** - How users will interact with the feature
6. **Scope** - What is included and explicitly excluded
7. **Decisions Made** - Key architectural or design decisions
8. **Acceptance Criteria** - Testable conditions for completion

### Template Reference

See existing specs in `/docs/specs/` for examples. Key patterns:
- Use markdown tables for structured data
- Include code examples where relevant
- Link to related ADRs or specs

### Gap Analysis

When gaps are identified during implementation, create a companion file:
```
SPEC-{feature-name}-GAPS.md
```

This documents missing requirements discovered during development.

---

## Brand Guidelines Versioning

The authoritative design system is `/docs/design/brand-guidelines-v{X.Y}.md`.

### Version Increment Rules

| Change Type | Version Bump | File Rename? | Example |
|-------------|--------------|--------------|---------|
| **Patch** (1-2 sections) | v4.1.1 -> v4.1.2 | NO | Fix typo, clarify wording |
| **Minor** (3+ sections) | v4.1 -> v4.2 | YES | Add new component, update color system |
| **Major** (v4.x -> v5.0) | NEVER by Claude | YES | Only user decides major versions |

### Three Places to Update Version

When editing brand guidelines, update the version in **exactly 3 places**:

1. **Title (line 1)** - `# CallVault Brand Guidelines v4.2`
2. **DOCUMENT VERSION section** - Version number in header metadata
3. **END OF BRAND GUIDELINES (last line)** - `--- END OF BRAND GUIDELINES v4.2 ---`

### Changelog Requirements

After editing, add an entry to `/docs/brand-guidelines-changelog.md`:

```markdown
## v4.2 - January 14, 2026

**Time:** 15:30 UTC
**Git Commit:** (add after commit)

### Changes

#### US-001: [Section Name] Update
- Description of change 1
- Description of change 2
```

### File Renaming Rules

- **Patch versions**: Keep same filename (e.g., `brand-guidelines-v4.1.md`)
- **Minor versions**: Rename file (e.g., `brand-guidelines-v4.1.md` -> `brand-guidelines-v4.2.md`)
- **After renaming**: Update symlink at `/BRAND_GUIDELINES.md`
- **Archive old version**: Move to `/docs/archive/` with original filename

---
