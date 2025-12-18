# CallVault Implementation Plan: The Loop Aesthetic

## **Overview**
This plan outlines the transformation of CallVault's user interface to align with the **Microsoft Loop** design system, heavily emphasized by a "Biosites/1-Click" aesthetic. The goal is to create a fluid, brand-agnostic workspace that feels premium, responsive, and deeply integrated.

**Core Philosophy:**
-   **Structure:** Three-Panel Layout (Sidebar -> Context/List -> Main Content).
-   **Visuals:** Clean, rounded UI, subtle gradients, glassmorphism, and "1-Click" simplicity.
-   **Interaction:** Fast, optimistic UI updates, drag-and-drop, and rich keyboard support.

---

## **Phase 1: Foundation & Layout (Week 1)**

### **1.1 Global App Shell (The "Three-Panel" System)**
Refactor the main application layout to support the dynamic 3-panel structure found in Loop.

-   **Primary Sidebar (Fixed Left)**:
    -   **Navigation**: Icons for "Home", "Recent", "Teams" (Workspaces), "Search", "Notifications".
    -   **Behavior**: Collapsible to icon-only state.
    -   **Global Actions**: User avatar (settings), "New" button (context-aware).
    -   *Implementation*: Create `AppShell.tsx`, `PrimarySidebar.tsx`.

-   **Secondary Panel (Contextual Middle)**:
    -   **Purpose**: Displays lists (Folders, Transcripts) based on Primary Sidebar selection.
    -   **Features**: Filter/Sort bar, "Create New" (scoped), folder hierarchy tree.
    -   **Behavior**: Resizable, collapsible.
    -   *Implementation*: Create `SecondaryPanel.tsx`, `ResourceList.tsx` (generic list component).

-   **Main Content Area (Right)**:
    -   **Purpose**: The actual workspace (Transcript View, Dashboard, Settings).
    -   **Features**: Dynamic header (breadcrumbs, page actions), independent scroll.
    -   *Implementation*: Create `MainLayout.tsx`, `PageHeader.tsx`.

### **1.2 Design System Implementation**
Establish the "Loop" look and feel using our existing Tailwind setup.

-   **Typography**: Adopt a system font stack (Inter/San Francisco) with specific weight hierarchy (Bold Headers, Medium Navigation, Regular Body).
-   **Color Palette**: Define semantic tokens for "Neutral", "Surface", "Surface-Hover", "Border-Subtle", "Brand-Accent".
-   **Shape**: Standardize `rounded-xl` and `rounded-2xl` for cards and panels.
-   **Components**:
    -   `Button` (Primary, Ghost, Icon-only variants).
    -   `Avatar` (User presence).
    -   `Badge` (Status indicators).
    -   `Card` (Content containers).

---

## **Phase 2: Core Components & Navigation (Week 1-2)**

### **2.1 The "Calls" Workspace (Loop "Workspaces" Equivalent)**
Map CallVault's "Teams/Folders" to Loop's "Workspaces".

-   **Folder System (Sidebar/Middle Panel)**:
    -   Implement the **Folder Tree** in the Secondary Panel.
    -   **Features**: Nesting, Drag & Drop (calls into folders), "smart" folders (All, Recent, Favorites).
    -   *Reference*: `folder-mvp-implementation-plan.md` (Integrate this logic here).

-   **Transcript List (Middle Panel List View)**:
    -   **Card Style**: Each call is a card (Title, Date, Duration, Status Badge).
    -   **Interactions**: Click to open in Main Content, Right-click for context menu (Move, Rename, Delete).
    -   *Visuals*: Hover effects (`bg-surface-hover`), active state (`bg-surface-active` + border).

### **2.2 The "Transcript" Page (Loop "Page" Equivalent)**
The main interaction surface.

-   **Header**:
    -   Breadcrumb: "Team > Folder > Call Title".
    -   Actions: Share, Export, "Copy Link", User Avatars (Presence).
-   **Content**:
    -   **Transcript Block**: Text blocks with speaker labels.
    -   **Audio Player**: Floating or fixed bottom player, synced with text.
    -   **Insights**: "Loop Component" style blocks for Summary, Action Items, Sentiment.

---

## **Phase 3: Polish & Interaction (Week 2)**

### **3.1 "1-Click" Interactions**
-   **Quick Actions**: Hover over a transcript in the list shows quick actions (Play, Star, More).
-   **Optimistic Updates**: Renaming a folder or moving a call updates UI instantly while saving in background.

### **3.2 Visual Polish**
-   **Glassmorphism**: Subtle usage in the Sidebar and Headers.
-   **Transitions**: Smooth layout transitions (Panel expanding/collapsing).
-   **Empty States**: Beautiful, illustrated empty states for new folders/teams.

---

## **Execution Strategy**

1.  **Setup**: Create the new Layout components in `src/components/layout/loop`.
2.  **Migration**: Wrap the existing `TranscriptsTab` logic into the new `SecondaryPanel` + `MainContent` structure.
3.  **Refinement**: Apply the new Design System tokens to existing components (`TranscriptTable` -> `TranscriptListCard`).
4.  **Folder Integration**: Finish the `FolderSidebar` logic from the MVP plan but place it inside the new `SecondaryPanel`.

## **Immediate Next Steps**
1.  **Scaffold**: Create `PrimarySidebar.tsx` and `AppShell.tsx` to visualize the 3-panel layout.
2.  **Style**: define the `design-tokens.json` values in `tailwind.config.ts`.
3.  **Port**: Move specific `Folder` logic into the new sidebar structure.
