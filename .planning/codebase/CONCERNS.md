# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Chat Component Complexity:**
- Issue: Excessive file size and complexity in main chat interface.
- Files: `src/pages/Chat.tsx` (1900+ lines)
- Impact: Hard to maintain, test, and debug. Contains heavy logic for streaming, transport, and UI state mixed together.
- Fix approach: Refactor into smaller sub-components (e.g., MessageList, InputArea, ConnectionHandler) and custom hooks.

**God Hooks:**
- Issue: Extremely large hooks handling too much responsibility.
- Files: `src/hooks/useTeamHierarchy.ts` (1200+ lines)
- Impact: Complex state management logic that is difficult to reuse or test.
- Fix approach: Break down into smaller, focused hooks (e.g., `useTeamPermissions`, `useTeamData`).

**Loose Typing in Stores:**
- Issue: Usage of `any` for core data structures.
- Files: `src/stores/panelStore.ts`, `src/stores/__tests__/contentLibraryStore.test.ts`
- Impact: Bypasses TypeScript safety, leading to potential runtime errors and hard-to-refactor code.
- Fix approach: Define proper interfaces for `PanelData` and strictly type store actions.

**Database Schema Normalization:**
- Issue: Duplicated or temporary tracking of user login data.
- Files: `src/components/settings/UsersTab.tsx`, `src/components/panels/UserDetailPanel.tsx`
- Impact: `last_login_at` is hardcoded to null with a TODO to "Track in separate table".
- Fix approach: Implement the separate tracking table and update the frontend to consume it.

## Known Bugs (or Potential Issues)

**Silent Store Failures:**
- Symptoms: Stores return `null` or empty arrays/objects when errors occur, swallowing the error details.
- Files: `src/stores/contentLibraryStore.ts`, `src/stores/contentItemsStore.ts`, `src/stores/businessProfileStore.ts`
- Trigger: Network failure or API error during fetch/save.
- Workaround: UI often checks for null, but the root cause (error) is lost.

**Incomplete Features:**
- Symptoms: Missing implementation for template updates and vector embeddings.
- Files: `src/components/content-library/TemplateEditorDialog.tsx`, `src/lib/ai-agent.ts`
- Trigger: Attempting to update certain templates or using advanced AI features.
- Workaround: None (features marked as TODO).

## Security Considerations

**Sensitive Logging:**
- Risk: exposure of session data, auth tokens, or message content in console logs.
- Files: `src/contexts/AuthContext.tsx`, `src/pages/Chat.tsx`, `src/hooks/useChatSession.ts`
- Current mitigation: None (logs appear active).
- Recommendations: Remove `console.log` statements in production builds or use a proper logging service that scrubs sensitive data. Specifically `JSON.stringify(messagesToInsert)` could leak PII.

**Type Safety Bypasses in Exports:**
- Risk: forcing types to `any` before export processing could hide data shape mismatches.
- Files: `src/components/transcript-library/BulkActionToolbarEnhanced.tsx`
- Current mitigation: None.
- Recommendations: Define proper interfaces for exportable data and validate before casting.

## Performance Bottlenecks

**Chat Rendering:**
- Problem: Large component size and heavy internal state management likely cause unnecessary re-renders.
- Files: `src/pages/Chat.tsx`
- Cause: Monolithic component structure.
- Improvement path: Memoize sub-components and optimize context usage.

**Client-Side Hierarchy Processing:**
- Problem: `useTeamHierarchy` performs heavy calculation on the client.
- Files: `src/hooks/useTeamHierarchy.ts`
- Cause: Processing large datasets (teams, users) in the browser.
- Improvement path: Move hierarchy calculation logic to a backend Edge Function or database view.

## Fragile Areas

**Chat Streaming Stability:**
- Files: `src/pages/Chat.tsx`
- Why fragile: Contains complex custom logic for retry, reconnection, and error handling (`attempting retry`, `Streaming interrupted`).
- Safe modification: Any change to the streaming logic requires extensive testing against network interruption scenarios.
- Test coverage: Logic is deeply embedded in the component, making it hard to unit test isolatedly.

**Content Library Tests:**
- Files: `src/stores/__tests__/contentLibraryStore.test.ts`
- Why fragile: Heavy reliance on `any` casting for mocks (`mockReturnValue(pendingPromise as any)`).
- Safe modification: Update tests to use proper type mocks to ensure interface changes break tests correctly.

## Missing Critical Features

**Vector Embeddings:**
- Problem: AI agent missing vector search capability.
- Blocks: Semantic search and context-aware AI responses.
- Files: `src/lib/ai-agent.ts`

**Template Updates:**
- Problem: Cannot update existing templates via store action.
- Blocks: Editing saved templates.
- Files: `src/components/content-library/TemplateEditorDialog.tsx`

---

*Concerns audit: 2026-01-26*
