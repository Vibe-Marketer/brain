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
