# PRP: Move Sidebar Outside Card - Page-Level Positioning

## Goal

**Feature Goal**: Move the FolderSidebar to sit at the page level (same plane as page header), completely outside any card containers. The result is ONE card only (the main content card), with the sidebar living on the same visual plane as the page header.

**Deliverable**: Updated `TranscriptsTab.tsx` with sidebar at page level, no card wrappers around it.

**Success Definition**:
- Only ONE card exists (ChatInnerCard for main content)
- Sidebar is on the SAME visual plane as the page header (no elevation, no card styling)
- Collapsed sidebar width aligns with header elements (flush, seamless)
- Expanded sidebar pushes the main card to the right (card shrinks)
- NO `bg-cb-card`, NO borders, NO shadows on the sidebar container itself

## Why

- Current implementation has sidebar INSIDE a card, creating unwanted visual nesting
- The sidebar should be a page-level navigation element, not a card component
- Header and sidebar should exist on the same plane (z-index, visual weight)
- Only the main content area should be a "card"

## What

Remove the sidebar from inside any card containers. Position it at page level so it sits alongside the page header on the same visual plane. The main content card becomes the ONLY card.

### Success Criteria

- [ ] Only ONE card visible (main content area)
- [ ] Sidebar has NO card styling (no bg-cb-card, no border-r, no shadow)
- [ ] Sidebar sits on same visual plane as page header
- [ ] Collapsed sidebar appears flush/seamless with header area
- [ ] Expanded sidebar pushes main card to the right
- [ ] Main card shrinks to accommodate expanded sidebar
- [ ] All existing functionality preserved

## All Needed Context

### Key Insight: Remove ChatOuterCard Entirely

The `ChatOuterCard` component creates the outer card wrapper. To achieve ONE card only, we need to:
1. **REMOVE** `ChatOuterCard` completely
2. Keep only `ChatInnerCard` (the main content card)
3. Sidebar sits at page level with NO card styling

### Current Layout (Wrong - Multiple Cards)

```jsx
<DndContext>
  <ChatOuterCard>           // ❌ Creates outer card wrapper
    <Sidebar />             // ❌ Sidebar inside card
    <ChatInnerCard>         // Main content card
      ...
    </ChatInnerCard>
  </ChatOuterCard>
</DndContext>
```

### Desired Layout (Correct - One Card Only)

```jsx
<DndContext>
  <div className="flex h-[calc(100vh-120px)]">
    {/* Sidebar - NO card styling, page-level element */}
    <div className={collapsed ? 'w-[44px]' : 'w-[280px]'}>
      <FolderSidebar />     // ✅ No card wrapper
    </div>

    {/* ONLY card - main content */}
    <ChatInnerCard className="flex-1">
      ...
    </ChatInnerCard>        // ✅ Only one card
  </div>
</DndContext>
```

### Documentation & References

```yaml
- file: src/components/transcripts/TranscriptsTab.tsx
  why: Main file to modify
  changes:
    - REMOVE ChatOuterCard import usage
    - Keep ChatInnerCard only
    - Sidebar container gets NO card styling
    - Add flex wrapper at page level

- file: src/components/chat/chat-main-card.tsx
  why: Understanding what to remove
  note: ChatOuterCard adds the outer card styling - we're removing this entirely

- file: src/components/transcript-library/FolderSidebar.tsx
  why: Sidebar component
  note: The sidebar itself has bg-cb-card in collapsed mode (line 461) - this may need adjustment or the page background will show through
```

### Critical Styling Decision

The sidebar currently has `bg-cb-card` in its collapsed view (FolderSidebar.tsx line 461). Options:

**Option A**: Keep sidebar with `bg-cb-card` (matches page background, appears seamless)
- Sidebar has subtle background matching page
- Visually integrated with header area

**Option B**: Remove `bg-cb-card` from sidebar, make it truly transparent
- Requires modifying FolderSidebar.tsx
- Sidebar inherits page background directly

**Recommended**: Option A - the `bg-cb-card` in FolderSidebar matches the page, creating the seamless look without needing to modify the sidebar component.

## Implementation Blueprint

### Implementation Tasks

```yaml
Task 1: MODIFY src/components/transcripts/TranscriptsTab.tsx

  Step 1.1: Update imports (line ~38-40)
    - CHANGE: Import only ChatInnerCard (remove ChatOuterCard from import)

  Step 1.2: Restructure JSX (lines ~609-771)
    - REMOVE: <ChatOuterCard className="h-[calc(100vh-120px)]">
    - ADD: <div className="flex h-[calc(100vh-120px)]"> as wrapper
    - KEEP: Sidebar div (but remove any card-like styling if present)
    - CHANGE: ChatInnerCard gets className="flex-1 min-w-0"
    - REMOVE: Closing </ChatOuterCard>
    - ADD: Closing </div> for new wrapper

Task 2: VERIFY visual appearance
  - Confirm only ONE card visible
  - Confirm sidebar is flush with page header area
  - Confirm card shrinks when sidebar expands
```

### Before/After Code

```tsx
// ========== BEFORE (lines 37-40, imports) ==========
import {
  ChatOuterCard,
  ChatInnerCard,
} from "@/components/chat/chat-main-card";

// ========== AFTER (imports) ==========
import { ChatInnerCard } from "@/components/chat/chat-main-card";


// ========== BEFORE (lines 609-771, JSX structure) ==========
{/* BG-CARD-MAIN: Browser window container */}
<ChatOuterCard className="h-[calc(100vh-120px)]">
  {/* SIDEBAR */}
  <div className={`
    ${sidebarState === 'expanded' ? 'fixed inset-y-0 left-0 z-50 shadow-2xl md:relative md:shadow-none w-[280px]' : 'w-[44px]'}
    flex-shrink-0 transition-all duration-200
  `}>
    <FolderSidebar ... />
  </div>

  {/* BG-CARD-INNER: Main content */}
  <ChatInnerCard>
    ...
  </ChatInnerCard>
</ChatOuterCard>


// ========== AFTER (JSX structure) ==========
{/* Page-level flex wrapper - NO CARD */}
<div className="flex h-[calc(100vh-120px)]">
  {/* SIDEBAR - Page level, NO card styling */}
  <div className={`
    ${sidebarState === 'expanded' ? 'fixed inset-y-0 left-0 z-50 shadow-2xl md:relative md:shadow-none w-[280px]' : 'w-[44px]'}
    flex-shrink-0 transition-all duration-200
  `}>
    <FolderSidebar ... />
  </div>

  {/* ONLY CARD - Main content */}
  <ChatInnerCard className="flex-1 min-w-0">
    ...
  </ChatInnerCard>
</div>
```

### Key Differences from Previous PRP

| Aspect | Previous PRP (Wrong) | This PRP (Correct) |
|--------|---------------------|-------------------|
| ChatOuterCard | Keep, change className | **REMOVE entirely** |
| Number of cards | Two (outer + inner) | **ONE (inner only)** |
| Sidebar styling | Add `bg-cb-card border-r` | **NO card styling** |
| Visual result | Two nested cards | **One card + page-level sidebar** |

## Validation Loop

### Level 1: Syntax & Style

```bash
npm run type-check
npm run lint
```

### Level 2: Visual Verification

**Navigate to:** http://localhost:8080/transcripts

**Visual Checks:**
1. [ ] Only ONE card visible (the main content area)
2. [ ] Sidebar appears on same plane as page header (no elevation)
3. [ ] NO visible border between sidebar and page background
4. [ ] Collapsed sidebar is flush with header area
5. [ ] Expanded sidebar pushes card to the right
6. [ ] Card shrinks horizontally when sidebar expands

### Level 3: Functional Testing

- [ ] Toggle sidebar - expands/collapses correctly
- [ ] Folder selection works
- [ ] Drag-drop works
- [ ] Mobile responsive overlay works

## Final Checklist

- [ ] ChatOuterCard removed from imports
- [ ] ChatOuterCard removed from JSX
- [ ] Only ChatInnerCard remains as the single card
- [ ] Sidebar has no card-like wrapper styling
- [ ] Flex wrapper positioned at page level
- [ ] Visual: One card only
- [ ] Visual: Sidebar flush with header

---

## Anti-Patterns to Avoid

- ❌ Don't add `bg-cb-card` or `border` to the sidebar wrapper
- ❌ Don't keep ChatOuterCard
- ❌ Don't create any new card wrappers
- ❌ Don't add shadows or elevation to sidebar

---

## Confidence Score: 9/10

**Rationale:**
- Simple removal of ChatOuterCard wrapper
- Clear before/after structure
- Single file modification
- No new dependencies

**Risk:**
- Minor: May need to verify FolderSidebar's internal bg-cb-card works correctly on page background
