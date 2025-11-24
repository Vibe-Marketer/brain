# Architecture Decision Records

A log of architectural decisions for Conversion Brain.

## What is an ADR?

Short docs explaining important technical choices, written when we make them. Each ADR captures the context, decision, and consequences of significant architectural choices.

**Time to write**: 10-15 minutes max

## When to Write an ADR

**YES - Write an ADR for:**
- Database/backend selection
- AI model/provider choices
- Integration platform decisions
- Major schema changes
- Technical constraints or limitations
- Deployment/infrastructure changes

**NO - Don't write an ADR for:**
- UI component choices (covered by brand guidelines)
- Bug fixes or refactoring
- Reversible implementation details
- Anything taking <4 hours to change later

## Active Decisions

- [ADR-001: Vercel AI SDK for Chat Features](adr-001-vercel-ai-sdk.md) - 2025-11-19
- [ADR-002: Remix Icon for Icon System](adr-002-remix-icon.md) - 2025-11-19
- [ADR-003: ReactFlow for Visual Agent Builder](adr-003-reactflow-agent-builder.md) - 2025-01-23
- [ADR-004: pgvector + RRF Hybrid Search for Knowledge Base](adr-004-pgvector-hybrid-search.md) - 2025-01-23
- [ADR-005: Prompt-Kit for Chat UI Components](adr-005-prompt-kit-chat-ui.md) - 2025-01-23

## Superseded Decisions

*None yet*

---

## How to Create an ADR

1. Copy `adr-template.md`
2. Number sequentially (check latest number above)
3. Fill in Context, Decision, Consequences
4. Save as `adr-XXX-short-title.md`
5. Update this README with new entry
6. Commit with message: `docs: add ADR-XXX for [decision]`

See [adr-quickref.md](adr-quickref.md) for the quick reference card.
