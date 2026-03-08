---
status: resolved
trigger: "workspace-content-chat-isolation: Content pages and AI Chat sessions show data from ALL workspaces instead of being scoped to selected bank"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T17:05:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED - 4 data types lacked bank_id columns and filtering: chat_sessions, content_library, content_items, and templates. All queries now scoped to activeBankId.
test: TypeScript compiles clean, Vite builds successfully, all related tests pass (except 1 pre-existing failure)
expecting: N/A - resolved
next_action: Deploy migration and verify in staging

## Symptoms

expected: When switching to a different bank/workspace, ALL data including content pages and AI chat sessions should be scoped to that bank only.
actual: Content pages and AI chat sessions still show data from ALL banks regardless of which bank is selected.
errors: No explicit errors - data just wasn't filtered by bank/workspace.
reproduction: 1) Log in, view content/chat. 2) Switch to a different bank. 3) Content pages still show content from all workspaces. 4) AI Chat still shows chat sessions from all workspaces.
started: Content and chats have never been workspace-scoped. Prior fix addressed folders and tags only.

## Eliminated

## Evidence

- timestamp: 2026-02-11T00:00:30Z
  checked: useChatSession.ts query (line 91-106)
  found: Sessions query is `.from('chat_sessions').select('*').eq('user_id', userId).eq('is_archived', false)` - NO bank_id filter
  implication: Chat sessions are fetched globally for the user, not scoped to active bank

- timestamp: 2026-02-11T00:00:35Z
  checked: useChatSession.ts createSession mutation (line 129-157)
  found: Insert has user_id, title, filters but NO bank_id field
  implication: New chat sessions are created without bank association

- timestamp: 2026-02-11T00:00:40Z
  checked: chat_sessions table schema (migration 20251125000001)
  found: chat_sessions table has NO bank_id column - only user_id, title, filters, state fields
  implication: DB schema change needed - add bank_id column to chat_sessions table

- timestamp: 2026-02-11T00:00:45Z
  checked: content_library table schema (migration 20260110000005)
  found: content_library has user_id and team_id but NO bank_id column
  implication: DB schema change needed - add bank_id to content_library

- timestamp: 2026-02-11T00:00:50Z
  checked: content_items table schema (migration 20260111000004)
  found: content_items has user_id and hook_id but NO bank_id column
  implication: DB schema change needed - add bank_id to content_items

- timestamp: 2026-02-11T00:00:55Z
  checked: templates table schema (migration 20260110000005)
  found: templates has user_id and team_id but NO bank_id column
  implication: DB schema change needed - add bank_id to templates

- timestamp: 2026-02-11T00:01:00Z
  checked: content-library.ts fetchContentItems (line 55-114)
  found: Query is `.from("content_library").select("*").order(...)` with no bank_id filter
  implication: Content library items fetched globally

- timestamp: 2026-02-11T00:01:05Z
  checked: content-items.ts fetchContentItems (line 57-113)
  found: Query is `.from("content_items").select("*").order(...)` with no bank_id filter
  implication: Content items (posts/emails) fetched globally

- timestamp: 2026-02-11T00:01:10Z
  checked: templates.ts fetchTemplates (line 57-125)
  found: Query is `.from("templates").select("*").order(...)` with no bank_id filter
  implication: Templates fetched globally

- timestamp: 2026-02-11T00:01:15Z
  checked: Chat.tsx bank context usage (line 143, 207-211, 243-254)
  found: Chat.tsx already imports useBankContext and passes bank_id to sessionFilters in the transport body for search scoping. But chat SESSION listing in useChatSession.ts is NOT bank-scoped.
  implication: Chat search is bank-scoped via edge function but session listing isn't - sessions from all banks still show in sidebar

- timestamp: 2026-02-11T00:01:20Z
  checked: Prior fix pattern (workspace-scope-isolation.md)
  found: Pattern is: 1) Add bank_id column via migration + backfill to personal bank, 2) Update types, 3) Update hooks/queries to filter by activeBankId, 4) Include bank_id in query keys
  implication: Same pattern applies here for chat_sessions, content_library, content_items, templates

- timestamp: 2026-02-11T17:05:00Z
  checked: Retry/refresh button callsites across all consumer components
  found: PostsLibrary.tsx (line 167), EmailsLibrary.tsx (line 179), TemplatesPage.tsx (line 409) had bare function calls without bankId
  implication: Fixed all three to pass activeBankId; also fixed fetchPersonalTemplates to pass bankId through

## Resolution

root_cause: Four tables (chat_sessions, content_library, content_items, templates) have no bank_id column. Their corresponding frontend queries (useChatSession.ts, content-library.ts, content-items.ts, templates.ts) fetch data globally by user_id only, without scoping to the active bank. This means switching banks has no effect on content or chat session visibility.

fix: |
  1. Database migration (20260211100000): Added bank_id column to all 4 tables, backfilled to personal bank, added indexes, made NOT NULL
  2. Updated all lib functions (content-library.ts, content-items.ts, templates.ts) to accept bankId and filter by it
  3. Updated content-persistence.ts to include bank_id on content_items inserts
  4. Updated useChatSession hook to accept activeBankId and scope queries + creation
  5. Updated all Zustand stores (contentLibraryStore, contentItemsStore, contentWizardStore) to thread bankId through
  6. Updated all consumer components/pages to pass activeBankId from useBankContext()
  7. Fixed 3 missed bare calls: PostsLibrary Retry, EmailsLibrary Retry, TemplatesPage handleTemplateSaved
  8. Fixed fetchPersonalTemplates to pass bankId through to fetchTemplates
  9. Updated unit tests to pass bankId and accommodate new .eq('bank_id') mock chains

verification: |
  - TypeScript compiles with zero errors (npx tsc --noEmit)
  - Vite build succeeds
  - All related unit tests pass:
    - content-library.test.ts: all pass
    - templates.test.ts: all pass
    - contentLibraryStore.test.ts: all pass except 1 pre-existing failure (typical workflow usage_count test - verified failing before our changes too)
    - useChatSession.test.ts: all 8 tests pass
  - Manual staging verification still needed after migration deployment

files_changed:
  - supabase/migrations/20260211100000_add_bank_id_to_content_and_chat.sql (created)
  - src/hooks/useChatSession.ts
  - src/lib/content-library.ts
  - src/lib/content-items.ts
  - src/lib/templates.ts
  - src/lib/content-persistence.ts
  - src/stores/contentLibraryStore.ts
  - src/stores/contentItemsStore.ts
  - src/stores/contentWizardStore.ts
  - src/pages/Chat.tsx
  - src/pages/ContentHub.tsx
  - src/pages/PostsLibrary.tsx
  - src/pages/EmailsLibrary.tsx
  - src/components/content-library/ContentLibraryPage.tsx
  - src/components/content-library/ContentFilterBar.tsx
  - src/components/content-library/SaveContentButton.tsx
  - src/components/content-library/TemplatesPage.tsx
  - src/components/content-library/TemplateEditorDialog.tsx
  - src/components/content-hub/CallContentWizard.tsx
  - src/lib/__tests__/content-library.test.ts
  - src/lib/__tests__/templates.test.ts
  - src/stores/__tests__/contentLibraryStore.test.ts
