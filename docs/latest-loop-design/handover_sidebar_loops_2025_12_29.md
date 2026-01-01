# Handover Document: Three-Pane Architecture & Sidebar Interaction
**Date:** December 29, 2025
**Project:** CallVault (Brain) - Loop Page UI
**Context:** This document outlines the recently implemented "Three-Pane Architecture" (Navigation Rail | Library | Content), the supporting design decisions, and the interaction details.

---

## 1. Design Philosophy & Architecture

The `/loop` page has been restructured into a modern, three-pane layout inspired by macOS applications, prioritizing content focus while maintaining quick access to organization tools.

### A. The Three Panes
1.  **Navigation Rail (Left)**
    *   **Role:** Global navigation.
    *   **Behavior:** Collapsible (72px <-> 220px).
    *   **Subtlety:** Always visible. Smooth 500ms transition.
2.  **Library Panel (Middle)**
    *   **Role:** Transcripts folder list.
    *   **Behavior:** Collapsible via toggle button.
    *   **Visuals:** `bg-card/80 backdrop-blur-md` for distinct layering.
3.  **Content Pane (Right)**
    *   **Role:** Primary workspace (Transcripts Table).
    *   **Behavior:** Fluid width.

---

## 2. Implementation Details

### Sidebar Visuals & Interaction (`src/components/ui/sidebar-nav.tsx`)
*   **Iconography:** High-fidelity Emojis (🏠, ✨, 🏷️, ⚙️) replace generic outlines.
*   **Interaction:**
    *   **Centered Toggle:** Sidebar toggle circular button is vertically centered.
    *   **Click-to-Toggle:** Clicking the rail background toggles expansion.
    *   **Library Toggle:** Dedicated button to show/hide the secondary pane.

![Loop Layout Final](./loop_layout_final.png)
*Figure 1: Full Three-Pane Layout (Expanded)*

### Layout Logic (`src/pages/LoopLayoutDemo.tsx`)
*   **State:** `isSidebarExpanded` and `isLibraryOpen` control pane widths.
*   **Transitions:** All widths animate with `duration-500` for a "heavy", premium feel.

![Loop Layout Collapsed](./loop_layout_collapsed.png)
*Figure 2: Collapsed Rail (Focus Mode)*

### Resolved Bug: Folder Depth (`src/components/EditFolderDialog.tsx`)
*   **Context:** The app was crashing with `Error loading folders column folders.depth does not exist`.
*   **Fix:** Removed the `depth` database query and restored **Client-Side Depth Calculation**. The dialog now recursively computes nesting level in memory.

---

## 3. Technical Status

### Environment & Authentication
*   **Verified:** The `.env` file is loaded and contains valid Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`).

### Known Issue: Transcripts Loading
*   **Status:** The Transcripts Table shows skeleton loaders indefinitely.
*   **Action:** This handover includes the codebase in a state where the "Folder Depth" bug is fixed. The persistent loading requires a full restart of the dev server (to clear HMR state) and checking the `useQuery` dependencies in `TranscriptsTab`.

---
**End of Handover.**
