# Specification: Global TopBar Search

## Overview

Implement universal search functionality in the TopBar component that allows users to search across transcripts, insights, and quotes from anywhere in the application. The feature includes a keyboard shortcut (Cmd/Ctrl+K) that opens a search modal, providing quick access for power users managing hundreds of transcripts. This directly addresses the pain point of difficult organization and search through meeting archives, competing with Fathom's basic search through universal accessibility.

## Workflow Type

**Type**: feature

**Rationale**: This is a new feature implementation that adds search functionality to the existing TopBar component. While the TopBar already has a search input placeholder (line 89 in TopBar.tsx), it currently has a "TODO: Implement search functionality" comment, indicating this is net-new functionality rather than a refactor or bug fix.

## Task Scope

### Services Involved
- **main** (primary) - Single React/TypeScript frontend application

### This Task Will:
- [ ] Implement keyboard shortcut handler (Cmd/Ctrl+K) to open search modal
- [ ] Create a search modal component using Radix UI Dialog pattern
- [ ] Build search functionality to query transcripts, insights, and quotes
- [ ] Display search results with type indicators and click-to-navigate
- [ ] Optimize for < 500ms query response time
- [ ] Update TopBar component to trigger modal on input focus or keyboard shortcut

### Out of Scope:
- Backend API changes (will use existing Supabase queries)
- Advanced filters (date range, speaker filters) - future enhancement
- Search result highlighting/snippets - future enhancement
- Search history or saved searches
- Mobile-specific search UI optimizations

## Service Context

### main

**Tech Stack:**
- Language: TypeScript
- Framework: React (with Vite build tool)
- UI Library: Radix UI
- Styling: Tailwind CSS
- State Management: Zustand
- Routing: React Router
- Backend: Supabase
- Testing: Vitest (unit), Playwright (E2E)

**Key directories:**
- `src/components/` - React components
- `src/stores/` - Zustand state stores
- `src/types/` - TypeScript type definitions
- `src/lib/` - Utility functions
- `src/hooks/` - Custom React hooks

**Entry Point:** `src/App.tsx`

**How to Run:**
```bash
npm run dev
```

**Port:** 3000

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `src/components/loop/TopBar.tsx` | main | Update search input to open modal on focus, add keyboard shortcut listener (Cmd/Ctrl+K), replace TODO with modal trigger |
| `src/stores/panelStore.ts` (or create new `searchStore.ts`) | main | Add search state management for modal open/close, search query, results, loading state |

## Files to Create

| File | Service | Purpose |
|------|---------|---------|
| `src/components/search/GlobalSearchModal.tsx` | main | Main search modal component with keyboard shortcut handling and result display |
| `src/components/search/SearchResultItem.tsx` | main | Individual search result component showing type, title, snippet, and metadata |
| `src/hooks/useGlobalSearch.ts` | main | Custom hook for search logic, Supabase queries, and debouncing |
| `src/hooks/useKeyboardShortcut.ts` | main | Reusable hook for keyboard shortcut detection (Cmd/Ctrl+K) |
| `src/stores/searchStore.ts` | main | Zustand store for search modal state and results |
| `src/types/search.ts` | main | TypeScript types for search results and queries |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `src/components/ui/dialog.tsx` | Radix UI Dialog wrapper - use for modal structure |
| `src/components/QuickCreateFolderDialog.tsx` | Dialog implementation pattern with keyboard shortcuts (Enter key handling on line 242) |
| `src/stores/panelStore.ts` | Zustand store pattern with actions (openPanel, closePanel) |
| `src/components/loop/TopBar.tsx` | Current TopBar structure and search input location (lines 84-99) |
| `src/types/meetings.ts` | Type definitions for Meeting and TranscriptSegment data models |
| `src/components/loop/InsightCard.tsx` | InsightType definition (pain, success, objection, question) and card display pattern |

## Patterns to Follow

### 1. Radix UI Dialog Pattern

From `src/components/ui/dialog.tsx`:

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Usage in modal component
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Search</DialogTitle>
      <DialogDescription className="sr-only">
        Search across transcripts, insights, and quotes
      </DialogDescription>
    </DialogHeader>
    {/* Search input and results */}
  </DialogContent>
</Dialog>
```

**Key Points:**
- Use DialogDescription with `sr-only` class for accessibility
- Dialog handles backdrop, animations, and close button automatically
- onOpenChange prop manages open state

### 2. Keyboard Shortcut Pattern

From `src/components/QuickCreateFolderDialog.tsx` (line 242):

```typescript
<Input
  onKeyDown={(e) => {
    if (e.key === "Enter" && !saving && query.trim()) {
      handleSearch();
    }
  }}
/>
```

**For Global Shortcut (Cmd/Ctrl+K):**

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(true);
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Key Points:**
- Use metaKey for Mac Cmd, ctrlKey for Windows/Linux Ctrl
- Prevent default browser behavior with e.preventDefault()
- Clean up event listener in useEffect return

### 3. Zustand Store Pattern

From `src/stores/panelStore.ts`:

```typescript
import { create } from 'zustand';

interface SearchState {
  isModalOpen: boolean;
  query: string;
  results: SearchResult[];
  isLoading: boolean;

  // Actions
  openModal: () => void;
  closeModal: () => void;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  isModalOpen: false,
  query: '',
  results: [],
  isLoading: false,

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false, query: '', results: [] }),
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results, isLoading: false }),
}));
```

**Key Points:**
- Separate state and actions clearly
- Reset related state when closing (query, results)
- Keep actions simple and composable

### 4. Data Model Types

From `src/types/meetings.ts` and `src/components/loop/InsightCard.tsx`:

```typescript
// Search result type that unifies different content types
export type SearchResultType = 'transcript' | 'insight' | 'quote';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  timestamp?: string;
  sourceCallId: string;
  sourceCallTitle: string;
  metadata?: {
    insightType?: 'pain' | 'success' | 'objection' | 'question';
    speakerName?: string;
    confidence?: number;
  };
}

// Existing types to reference:
// - Meeting (from meetings.ts)
// - TranscriptSegment (from meetings.ts)
// - InsightType (from InsightCard.tsx)
```

**Key Points:**
- Unify different content types under common SearchResult interface
- Include metadata for type-specific rendering
- Reference sourceCallId for navigation

## Requirements

### Functional Requirements

1. **Keyboard Shortcut Access**
   - Description: Users can press Cmd/Ctrl+K from anywhere in the application to open search modal
   - Acceptance: Keyboard shortcut opens modal with focus on search input, works on all pages

2. **Multi-Type Search**
   - Description: Search across transcripts, insights, and quotes with unified results
   - Acceptance: Results display all three content types with clear type indicators

3. **Search Input in TopBar**
   - Description: Clicking the existing search input in TopBar opens the search modal
   - Acceptance: Search input in TopBar triggers modal (maintains existing UI)

4. **Click-to-Navigate**
   - Description: Clicking a search result navigates to the relevant transcript or insight
   - Acceptance: Results navigate correctly using React Router

5. **Performance Requirement**
   - Description: Search queries return results in < 500ms for most queries
   - Acceptance: Debounced search with loading state, results appear quickly

### Technical Requirements

1. **Debouncing**: Implement 300ms debounce on search input to reduce query load
2. **Empty State**: Show helpful message when no results found
3. **Loading State**: Display loading indicator during search
4. **Accessibility**: Proper ARIA labels, keyboard navigation, focus management
5. **Escape to Close**: Pressing Escape key closes the modal

### Edge Cases

1. **No Results** - Display "No results found for '{query}'" with helpful tips
2. **Very Long Queries** - Truncate queries > 100 characters with warning
3. **Special Characters** - Sanitize input to prevent SQL injection (use Supabase client safely)
4. **Rapid Typing** - Debounce prevents excessive API calls
5. **Modal Already Open** - Cmd/Ctrl+K when modal is open focuses input instead of re-opening

## Implementation Notes

### DO
- Follow the Dialog pattern in `src/components/ui/dialog.tsx` for modal structure
- Use Zustand store pattern from `src/stores/panelStore.ts` for state management
- Implement keyboard shortcut using useEffect with cleanup (see pattern above)
- Debounce search queries using lodash.debounce or custom hook
- Use existing Supabase client from `@/integrations/supabase/client` for queries
- Display InsightType with colors from `InsightCard.tsx` config (pain=red, success=green, etc.)
- Use React Router's `useNavigate()` for navigation to results
- Add loading state with skeleton UI during search
- Focus search input when modal opens
- Clear search query when modal closes

### DON'T
- Create new dialog primitives - use existing Radix UI components
- Make synchronous/uncontrolled API calls - always debounce
- Store sensitive data in Zustand store - keep only UI state
- Bypass existing Supabase client - use provided integration
- Create new navigation patterns - use React Router hooks
- Add complex animations - let Radix UI handle modal transitions
- Forget keyboard accessibility - support Tab, Escape, Enter keys

### Search Query Strategy

**Option 1: Full-text search using Supabase (Recommended)**
```typescript
// Use Supabase's textSearch for performance
const { data: transcripts } = await supabase
  .from('transcript_segments')
  .select('*, call_recordings(*)')
  .textSearch('text', query)
  .limit(20);
```

**Option 2: Client-side filtering (if results already loaded)**
- Only use if transcript data is already in memory from other queries
- Suitable for < 100 items, otherwise use server-side search

**Recommendation**: Start with Supabase full-text search for transcripts, then expand to insights and quotes.

## Development Environment

### Start Services

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

### Service URLs
- Main App: http://localhost:3000

### Required Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL (required)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key (required)

All environment variables are already configured in `.env` file.

## Success Criteria

The task is complete when:

1. [ ] Cmd/Ctrl+K keyboard shortcut opens search modal from any page
2. [ ] Clicking search input in TopBar opens search modal
3. [ ] Search queries return results from transcripts, insights, and quotes
4. [ ] Results display with type indicators (transcript/insight/quote)
5. [ ] Clicking a result navigates to the correct transcript or insight
6. [ ] Search responds in < 500ms for typical queries (measured with debouncing)
7. [ ] Pressing Escape closes the modal
8. [ ] No console errors or warnings
9. [ ] Existing tests still pass (`npm run test`)
10. [ ] Search modal is accessible (keyboard navigation, ARIA labels)

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Search store actions | `src/stores/searchStore.test.ts` | openModal, closeModal, setQuery, setResults work correctly |
| Keyboard shortcut hook | `src/hooks/useKeyboardShortcut.test.ts` | Detects Cmd/Ctrl+K, prevents default, handles cleanup |
| Search hook debouncing | `src/hooks/useGlobalSearch.test.ts` | Debounces queries, handles loading states |
| Result type mapping | `src/components/search/SearchResultItem.test.tsx` | Displays transcript/insight/quote types correctly |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Search query execution | main ↔ Supabase | Queries return correct results for transcripts, insights |
| Navigation from results | main (React Router) | Clicking results navigates to correct routes |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Keyboard shortcut flow | 1. Press Cmd/Ctrl+K 2. Type query 3. Click result | Modal opens, search executes, navigates to transcript |
| TopBar click flow | 1. Click TopBar search input 2. Type query 3. Press Enter on result | Modal opens, search executes, navigates correctly |
| Empty state | 1. Open search 2. Type query with no results | "No results found" message displayed |
| Escape to close | 1. Open search 2. Press Escape | Modal closes, query cleared |

### Browser Verification
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Search Modal | `http://localhost:3000` (any page) | Cmd/Ctrl+K opens modal with focus on input |
| Search Results | `http://localhost:3000` | Results display with correct type indicators and styling |
| TopBar Search | `http://localhost:3000` | Clicking search input opens modal |
| Navigation | `http://localhost:3000` | Clicking results navigates to transcripts/insights |

### Performance Verification
| Check | Tool | Expected |
|-------|------|----------|
| Search response time | Browser DevTools Network tab | < 500ms for most queries |
| Debounce working | Browser DevTools Console | Only one query per 300ms typing interval |
| No memory leaks | React DevTools Profiler | Event listeners cleaned up on unmount |

### Accessibility Verification
| Check | Tool | Expected |
|-------|------|----------|
| Keyboard navigation | Manual testing | Tab cycles through results, Enter selects |
| Screen reader | VoiceOver/NVDA | Modal announces correctly, results are readable |
| ARIA labels | Browser DevTools | Dialog has proper aria-describedby and labels |

### QA Sign-off Requirements
- [ ] All unit tests pass (`npm run test`)
- [ ] All integration tests pass
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Browser verification complete (search works on all major routes)
- [ ] Performance verified (< 500ms response time)
- [ ] Accessibility verified (keyboard nav, ARIA labels)
- [ ] No regressions in existing TopBar functionality
- [ ] Code follows established patterns (Dialog, Zustand, React Router)
- [ ] No console errors or warnings
- [ ] No security vulnerabilities (input sanitization verified)

## Implementation Plan (Suggested Order)

### Phase 1: Foundation
1. Create search types (`src/types/search.ts`)
2. Create Zustand search store (`src/stores/searchStore.ts`)
3. Create keyboard shortcut hook (`src/hooks/useKeyboardShortcut.ts`)

### Phase 2: Search Logic
4. Create search hook with Supabase queries (`src/hooks/useGlobalSearch.ts`)
5. Implement debouncing and loading states

### Phase 3: UI Components
6. Create SearchResultItem component
7. Create GlobalSearchModal component
8. Wire up keyboard shortcuts and modal state

### Phase 4: Integration
9. Update TopBar to trigger modal
10. Test navigation from results
11. Add loading states and empty states

### Phase 5: Polish & Testing
12. Write unit tests
13. Write E2E tests
14. Performance optimization
15. Accessibility audit
