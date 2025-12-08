---
name: chat-history-persistence-and-rate-limit-prp.md
description: "PRP to fix chat history fidelity, session filter rehydration, and shared Fathom rate limiting"
---

## Goal

**Feature Goal**: Ensure chat history persistence matches on-screen UX (messages + tool parts + session filters) and Fathom sync respects global rate limits across concurrent requests.

**Deliverable**: Frontend chat persistence changes (React) and backend rate limiting changes (Supabase Edge Function) that preserve message integrity and prevent API throttling.

**Success Definition**: Reloaded chat sessions render complete messages (including tool parts/citations), session filters are restored and applied, legitimate duplicate turns persist, and Fathom fetches remain under 60 req/min even with concurrent users.

## User Persona (if applicable)

**Target User**: End users reviewing prior chats and syncing meetings.

**Use Case**: Returning to a chat session with filtered context and seeing the exact conversation plus sources; running syncs without hitting Fathom 429s during multi-user activity.

**User Journey**: User opens an existing chat session → messages + citations render as before → filters auto-restore and scope searches → sync jobs run without API errors.

**Pain Points Addressed**: Lost tool-call context, missing filters on reload causing off-topic answers, dropped duplicate messages, and sync failures from rate-limit bursts.

## Why

- Prevent data loss and drift between live chat and persisted history.
- Maintain filter scoping for consistent answers across sessions.
- Avoid external API throttling that breaks sync reliability.
- Align with AI-chat product quality expectations (reproducibility and source visibility).

## What

Restore full chat fidelity, preserve intentional duplicate turns, hydrate session filters, and enforce a shared rate-limit guard in the Fathom fetch edge function.

### Success Criteria

- [ ] Saved chat messages include `parts` (tool calls/citations) and render identically after reload.
- [ ] Session filters reload with the session and are applied to transport requests.
- [ ] Legitimate duplicate messages are not dropped by role+content de-duplication.
- [ ] Fathom fetches stay below 60 req/min across concurrent requests; 429s are mitigated with shared throttling/backoff.

## All Needed Context

### Documentation & References

```yaml
- file: src/pages/Chat.tsx
  why: Message save flow and session hydration; transport construction for filters
  pattern: Update save payload to include parts; load filters when session changes

- file: src/hooks/useChatSession.ts
  why: Session/message persistence logic; current de-duplication and serialization
  pattern: Adjust idempotency key; persist parts; avoid dropping duplicates

- file: supabase/functions/fetch-meetings/index.ts
  why: Fathom rate limiting is currently per-request; needs shared limiter/backoff
  pattern: Introduce shared counter/store (KV/table) and jittered backoff

- file: supabase/functions/chat-stream/index.ts
  why: Uses session filters on backend; ensure frontend passes sessionId/filters consistently
  pattern: Confirm filter application after hydration
```

### Current Codebase tree (focused)

```
src/pages/Chat.tsx
src/hooks/useChatSession.ts
supabase/functions/fetch-meetings/index.ts
supabase/functions/chat-stream/index.ts
```

### Desired Codebase tree with files to be added and responsibility of file

```
src/pages/Chat.tsx                  # Save/load parts, hydrate filters
src/hooks/useChatSession.ts         # Safer persistence + no over-aggressive de-dupe
supabase/functions/fetch-meetings/  # Shared rate limiter + jitter
```

### Known Gotchas of our codebase & Library Quirks

```text
- AI SDK v5 uses short random message IDs; cannot rely on them as stable UUIDs.
- Supabase insert requires serializable JSON; sanitize message parts.
- Fathom limit is 60 req/min; current limiter is per-request instance (no cross-request state).
- QueryClient caching relies on stable keys; sessionId changes must invalidate or update state correctly.
```

## Implementation Blueprint

### Data models and structure

- Chat message persistence: include `parts` (sanitized), `role`, `content`, stable `id`/timestamp; avoid discarding identical role+content pairs when timestamps differ.
- Filters: store on session (already present) and rehydrate into component state/transport config.
- Rate limiter: shared counter keyed by user/token or global, stored in durable medium (KV/table) with jittered backoff.

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: Fix chat message persistence fidelity
  - Update Chat.tsx save payload to pass parts (sanitized) to saveMessages.
  - Adjust useChatSession.saveMessages to persist parts column and include createdAt ordering.

Task 2: Relax destructive de-duplication
  - Replace role+content de-dupe with safer key (e.g., createdAt+role hash) or remove de-dupe and rely on UUID inserts.
  - Ensure UUID generation happens client-side when missing; keep existing DB triggers intact.

Task 3: Rehydrate session filters on load
  - When loading a session in Chat.tsx, fetch filters from chat_sessions (via existing hook or new fetch) and set filters state.
  - Ensure transport uses sessionId so backend filters apply; keep UI badges in sync.

Task 4: Add shared rate limiter for Fathom fetch-meetings
  - Introduce shared counter storage (e.g., Supabase table or KV) with TTL window and atomic increments.
  - Apply jittered backoff and respect per-user and global ceilings; surface retry-after info in logs.

Task 5: Verification
  - Unit/integration: mock saveMessages to confirm parts are stored; reload path renders citations.
  - Edge function: simulate concurrent fetch-meetings calls to confirm limiter blocks >60/min and returns graceful waits instead of 429.
  - Manual: reload chat session with filters; confirm restored scopes and sources.
```

### Implementation Patterns & Key Details

```text
- Message parts: sanitize via JSON stringify/parse before insert to avoid circular refs.
- Idempotency: prefer server-generated UUIDs or include createdAt to differentiate repeated prompts.
- Filters: load once per session change; guard against missing data; keep default when absent.
- Rate limit: use atomic upsert/increment with window start timestamp; add jitter (e.g., 100–300ms) between batches.
```

### Integration Points

```yaml
DATABASE:
  - Option: Add supabase table (e.g., rate_limit_counters) with (scope, window_start, count) for shared limiter.

CONFIG:
  - Define rate-limit constants (max_per_window, window_ms, jitter_ms) in fetch-meetings function.
```

## Validation Loop

### Level 1: Syntax & Type Safety

```bash
npm run lint
npm run type-check
```

### Level 2: Targeted Tests

```bash
npx vitest src/hooks/useChatSession.test.ts --runInBand   # add/adjust tests as needed
```

### Level 3: Manual Verification

- Reload chat session → messages + tool calls + sources match pre-reload view.
- Session filters auto-apply and are visible in badges.
- Trigger concurrent fetch-meetings calls; observe throttling without 429s.
