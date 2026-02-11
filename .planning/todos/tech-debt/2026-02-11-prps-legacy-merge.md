---
created: 2026-02-11T11:10
title: PRPs migration (legacy `PRPs/`)
area: tech-debt
source:
  - PRPs/ai-chat-agent-system-implementation.md
  - PRPs/chat-history-persistence-and-rate-limit-prp.md
  - PRPs/story_folder-dialog-consolidation-and-folder-rules.md
  - PRPs/ui-consistency-fixes-components-ui.md
  - PRPs/move-sidebar-outside-card.md
  - PRPs/hybrid-rag-implementation-plan.md
  - PRPs/rag-pipeline-repair-prp.md
---

## Why this exists

Legacy PRP workflow docs are being retired. Keep-worthy implementation gaps and epics are captured here for future GSD planning.

## Consolidated backlog themes

1. Chat fidelity + reliability hardening (message parts persistence, filter rehydration, rate-limit resilience).
2. Folder/rules UX consolidation under current Vault-first information architecture.
3. UI consistency debt pass against current brand/pane standards (modernized scope).
4. RAG optimization and streaming protocol hardening where still applicable to current architecture.
5. Long-horizon AI agent system epic (re-plan from scratch under current roadmap assumptions).

## Historical/mostly-complete PRPs

Completed or mostly-complete PRPs remain archived for traceability; they should not drive active implementation directly.
