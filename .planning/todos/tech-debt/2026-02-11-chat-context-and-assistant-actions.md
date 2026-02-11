---
created: 2026-02-11T10:45
title: Chat context library and assistant message actions
area: tech-debt
source:
  - docs/specs/SPEC-chat-context-library.md
  - docs/specs/SPEC-assistant-message-actions-toolbar.md
  - docs/specs/SPEC-assistant-message-actions-toolbar-GAPS.md
---

## Why this exists

Legacy specs define valuable chat UX capabilities that were never fully delivered and are still relevant to product quality.

## Backlog items

1. Add assistant message action toolbar (copy, save, feedback, context pairing) with clear persistence model.
2. Add context library support for non-call context assets (documents/images) and retrieval in chat flow.
3. Define migration-safe schema + API contracts for message feedback and context pairings.
4. Add E2E coverage for new chat actions and context attachment UX.

## Notes

- Treat this as post-Phase-11 work unless explicitly reprioritized.
- Re-scope to current Bank/Vault model before implementation.
