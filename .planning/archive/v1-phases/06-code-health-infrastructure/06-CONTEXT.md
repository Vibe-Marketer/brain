# Phase 6: Code Health & Infrastructure - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Technical debt cleanup, component refactoring, type safety improvements, and infrastructure hardening. This is internal quality work — no user-facing features added. The goal is a cleaner, more maintainable codebase with proper infrastructure.

**Explicitly out of scope for refactoring:** Teams, coaches, and collaboration code — these are getting a complete overhaul separately.

</domain>

<decisions>
## Implementation Decisions

### Deletion vs Stubbing
- **Case-by-case evaluation** — Claude decides per piece: delete obvious dead code, stub uncertain cases
- **ADR for significant removals** — Write brief Architecture Decision Record explaining what was removed and why
- **Requirements + obvious cleanup** — Address the 3 listed items (legacy ai-agent.ts, Coach stub, orphaned TeamManagement.tsx) plus anything clearly unused encountered during refactoring
- **Keep chat-stream-legacy** — Preserve as rollback option until after launch
- **No sentimental keeps** — If it's dead, it goes
- **Full cleanup for Edge Functions** — Delete code, clean up Supabase dashboard, document in ADR
- **Trace references first** — Map all references before deletion (careful approach)
- **CHANGELOG entries** — Add significant removals to CHANGELOG for release visibility

### Refactor Depth
- **Thorough separation of concerns** for Chat.tsx — Full extraction: hooks, components, types in dedicated files, not just 3-4 pieces
- **Comprehensive tests** for extracted hooks/components — Full test coverage, not just smoke tests
- **File organization** — Claude decides based on existing codebase conventions
- **SKIP useTeamHierarchy refactoring** — Getting complete overhaul elsewhere
- **SKIP all teams/coaches/collaboration code** — Out of scope for this phase

### Missing Functionality
- **Actually implement** missing automation functions (summarize-call, extract-action-items)
- **Research first** for missing tables (tasks, clients, client_health_history) — Trace why references exist, check if renamed, resolve appropriately. Ask user if unclear.
- **AI infrastructure** — Claude decides (Vercel AI SDK + OpenRouter vs simpler approach) based on complexity

### Infrastructure Scope
- **Production-hardened rate limiting** — Sliding windows, per-user limits, configurable thresholds (not just minimal DB persistence)
- **Full cost tracking** — Per-request logging + real-time dashboard with alerts (build now, can integrate with Langfuse later)
- **Complete cron fix** — Fix parsing to work correctly AND add validation UI showing next run times before saving

### Claude's Discretion
- AI infrastructure choice for automation functions (Vercel AI SDK vs direct OpenRouter)
- File organization pattern for extracted components
- Evaluation of each dead code piece (delete vs stub)
- Resolution approach for missing table references (after research)

</decisions>

<specifics>
## Specific Ideas

- Chat.tsx refactor should result in testable, isolated hooks (mentioned as success criteria)
- Cron validation should show "This will run at: [next 3 scheduled times]" style preview
- Rate limiting should survive cold starts and support admin configuration
- Cost tracking dashboard should show breakdown by feature/user with alerts

</specifics>

<deferred>
## Deferred Ideas

- **Project Hygiene Audit** — Full audit of codebase folders, config files (.serena, .vercel, autoclaude, ralph, etc.), documentation, and planning artifacts. Captured as todo: `.planning/todos/pending/2026-01-31-project-hygiene-audit.md`. This goes beyond code health to include system folders, abandoned tools, and docs validation against GSD framework.

- **Langfuse Integration** — User has another project with promptfoo/Langfuse for prompt tracking. Cost tracking built now can integrate with Langfuse later.

</deferred>

---

*Phase: 06-code-health-infrastructure*
*Context gathered: 2026-01-31*
