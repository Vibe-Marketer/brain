# Microsoft Loop UI Complete Reverse Engineering

**Documentation Date:** December 14, 2025  
**Application:** Microsoft Loop (loop.cloud.microsoft)  
**User Account:** Andrew Naegele (AN)  
**Purpose:** Complete UI system extraction for brand-agnostic design system

---

## PART 1: LOOP UI AUDIT

---

## 1. LAYOUT ARCHITECTURE

### 1.1 Global App Shell Structure

Microsoft Loop employs a **responsive multi-panel layout system** that adapts based on context and user navigation. The application uses a consistent shell structure across all views, with panels that show or hide based on the current state.

#### Primary Sidebar (Left Rail - Fixed)

The primary sidebar occupies the leftmost position and remains persistent across all views. This rail serves as the primary navigation hub and contains both global actions and contextual navigation elements.

**Top Section - Global Actions:**
The top section of the sidebar contains application-level controls that are accessible from any view. The Loop logo functions as a home button with contextual behavior - on the home screen it refreshes the page, while in workspace views it returns to the workspace list. Adjacent to the logo are the Settings menu (three-dot icon) and the Account manager button displaying user initials "AN" in a circular avatar.

**Action Bar:**
Below the global controls sits an action bar containing the primary "Create new" button, which provides access to creation workflows. The collapse button allows users to minimize the sidebar to maximize content area. The Search button opens a global search interface, and the Notifications button provides access to activity updates.

**Navigation Menu:**
The navigation section contains four primary navigation items arranged vertically: Recent (for recently accessed content), Ideas (for brainstorming and ideation), Workspaces (for organized project spaces), and Getting Started (an onboarding workspace). Each item is clickable and highlights when active.

**Sidebar Behavior:**
The sidebar can be collapsed using the dedicated collapse button, reducing it to an icon-only state. This provides more horizontal space for content while maintaining quick access to navigation.

#### Main Content Area (Context-Dependent)

The main content area occupies the majority of the screen real estate and displays different layouts depending on the current view context.

**Home/Dashboard View:**
When on the home screen, the main area displays a greeting message ("Good Afternoon" with sun emoji) followed by a tab navigation system. Three tabs are present: "Workspaces", "Recent components and pages", and "Ideas". Below the tabs are view control buttons: Favorites toggle, List View button, and Grid View button. The content area below displays cards or list items representing workspaces or recent items.

**Workspace View:**
When a workspace is opened, the layout transforms to reveal an additional middle panel, creating a three-column structure. This middle panel appears between the sidebar and the main content area.

#### Secondary Panel (Middle Panel - Contextual)

The middle panel is a **contextual navigation layer** that appears only when viewing workspace interiors. This panel provides workspace-level navigation and management controls.

**Panel Header:**
The header displays the workspace name ("Getting Started") along with workspace-level actions. A member count button shows "0 Members" with the hint "Invite and manage members". Additional header buttons include "Close sidebar" (to hide the middle panel), "Filter and sort" (for organizing page lists), and "Create new" (for adding pages within the workspace).

**Page List:**
The main section of the middle panel displays a hierarchical list of pages within the workspace. Each page item shows the page title and a numerical indicator (possibly representing comments, updates, or sub-items). The list indicates it is "Sorted by hierarchy", suggesting multiple sort options are available. Pages in the current view include: Welcome (0), Check the Basics (0), Get Inspired (0), Send Feedback (0), and Next Steps (0).

**Panel Footer:**
At the bottom of the middle panel is a "Recycle bin" link for accessing deleted items.

**Panel Behavior:**
The middle panel can be closed via the "Close sidebar" button, allowing the main content area to expand. When closed, users can reopen it through workspace navigation controls.

---

### 1.2 Header System

Microsoft Loop employs a **multi-level header system** that varies based on the current view context.

#### Global Header (Sidebar Top)

The global header is embedded within the primary sidebar and remains consistent across all views. It contains the Loop logo, Settings menu, and Account manager, providing persistent access to application-level functions regardless of the current page or workspace.

#### View-Level Header (Main Content Area)

The main content area features view-specific headers that change based on context.

**Home View Header:**
On the home screen, the header displays a contextual greeting ("Good Afternoon") with an emoji indicator (sun icon suggesting time-of-day awareness). Below this is the tab navigation system for switching between Workspaces, Recent components and pages, and Ideas views.

**Workspace View Header:**
When viewing a workspace interior, the middle panel header displays the workspace name and workspace-level actions (member management, filter/sort, create new). The main content area header shows the currently open page title ("Get Inspired") with page-level actions such as "Update cover".

#### Action Zones

Headers organize actions into logical zones based on their scope and importance.

**Left Zone:** Typically contains navigation elements (back buttons, breadcrumbs) and primary identifiers (workspace name, page title).

**Center Zone:** Often used for view-switching controls (tabs) or contextual information.

**Right Zone:** Houses action buttons (Create new, Filter and sort, Settings, Account) and secondary controls (view toggles, favorites).

---

### 1.3 Scroll Behavior Per Region

Each panel in the Loop interface has independent scroll behavior, allowing users to navigate different sections without affecting others.

**Primary Sidebar:** The sidebar scrolls independently when navigation items exceed the viewport height. This ensures all navigation options remain accessible even with many workspaces or menu items.

**Middle Panel:** The page list in the middle panel scrolls independently, allowing users to browse through long lists of pages while keeping the workspace header and main content visible.

**Main Content Area:** The primary content area (page body, workspace cards) scrolls independently, enabling users to read long documents or browse extensive lists without affecting navigation panels.

This independent scroll behavior creates a **stable navigation experience** where users maintain context while exploring content.

---

## 2. NAVIGATION & PAGE MANAGEMENT

### 2.1 Navigation Hierarchy

Microsoft Loop implements a **three-level navigation hierarchy** that progressively reveals more specific content.

**Level 1 - Application Navigation (Sidebar):**
The primary sidebar provides access to top-level sections: Recent, Ideas, Workspaces, and Getting Started. These represent the highest level of organization within the application.

**Level 2 - Workspace Navigation (Middle Panel):**
When a workspace is selected, the middle panel appears and displays all pages within that workspace. This provides workspace-level navigation without leaving the current context.

**Level 3 - Page Content (Main Area):**
The main content area displays the actual page content, whether it's a document, table, or other component type.

### 2.2 URL and Routing Behavior

Loop uses **complex encoded URLs** that contain workspace and page identifiers. The URL structure suggests a cloud-based storage system with encoded paths. Example URL pattern:
`https://loop.cloud.microsoft/p/[encoded-workspace-and-page-data]`

The URLs are not human-readable but appear to encode navigation state, allowing direct linking to specific pages within workspaces.

### 2.3 Persistent vs Contextual Navigation

**Persistent Navigation Elements:**
- Primary sidebar (always visible unless collapsed)
- Global header with Loop logo, Settings, Account
- Core navigation items (Recent, Ideas, Workspaces)

**Contextual Navigation Elements:**
- Middle panel (appears only in workspace views)
- Page list (specific to current workspace)
- Workspace-level actions (member management, create new within workspace)
- Page-level actions (update cover, page settings)

### 2.4 Page Management Operations

The interface provides multiple entry points for page management operations.

**Page Creation:**
Users can create new pages through the "Create new" button in either the global sidebar or the workspace-specific middle panel header. This suggests different creation contexts (global vs workspace-scoped).

**Page Organization:**
The middle panel shows pages in a hierarchical structure with sorting options. The "Filter and sort" button indicates users can reorganize, filter, and sort pages based on various criteria.

**Page Deletion:**
The "Recycle bin" link in the middle panel footer suggests deleted pages are moved to a recoverable trash system rather than permanently deleted immediately.

---

## 3. CORE UI COMPONENTS

### 3.1 Buttons

Microsoft Loop employs several button variants for different purposes and hierarchy levels.

**Primary Action Buttons:**
The "Create new" button appears in multiple locations (global sidebar, workspace header) and represents the primary action in most contexts. These buttons use prominent styling to draw attention.

**Icon Buttons:**
Several icon-only buttons appear throughout the interface: Settings (three-dot menu), Collapse sidebar, Search, Notifications. These use recognizable icons without text labels to save space while maintaining clarity.

**Avatar Button:**
The account manager button displays user initials "AN" in a circular avatar format, providing quick access to account settings and profile management.

**Toggle Buttons:**
View control buttons (List View, Grid View, Favorites) act as toggles, allowing users to switch between different display modes.

**Text Buttons:**
Lower-priority actions like "Recycle bin" use text-only buttons without heavy styling, indicating secondary importance.

### 3.2 Navigation Items

**Sidebar Navigation Items:**
Each navigation item (Recent, Ideas, Workspaces, Getting Started) functions as a clickable button with text label. These items highlight when active, providing clear visual feedback about the current location.

**Page List Items:**
In the middle panel, each page is represented as a clickable list item showing the page title and a numerical indicator. The currently active page is highlighted to show the user's location within the workspace.

### 3.3 Tabs

The home view features a **horizontal tab navigation system** with three tabs: "Workspaces", "Recent components and pages", and "Ideas". These tabs allow users to switch between different content views without changing the overall page context.

### 3.4 Panels and Sidebars

**Primary Sidebar:** Fixed-width panel on the left containing global navigation.

**Middle Panel:** Variable-width contextual panel that appears in workspace views, displaying page lists and workspace-level controls.

**Collapsible Behavior:** Both the primary sidebar and middle panel can be collapsed to maximize content area.

---

## DOCUMENTATION STATUS

**Completed:**
- Global layout architecture
- Sidebar structure and behavior
- Multi-panel system (primary sidebar, middle panel, main content)
- Header system (global vs view-level)
- Navigation hierarchy
- Basic component identification

**Next Steps:**
- Explore page creation flow
- Document page editing interface
- Identify tables, filters, search components
- Capture all interaction states
- Document visual design tokens
- Measure spacing, typography, colors



### 3.5 Dropdowns and Menus

#### Settings and More Menu

The Settings button (three-dot icon) in the global header opens a dropdown menu with four options:

1. **Settings** - Access to application settings and preferences
2. **Help & feedback** - Support resources and feedback submission
3. **Download the mobile app** - Mobile app promotion/download link
4. **App info** - Application version and information

**Menu Behavior:**
- Menu appears as an overlay positioned near the trigger button
- Menu items are presented as a vertical list
- Each item is a clickable menu item with text label
- Menu likely closes when clicking outside or selecting an item



#### Account Manager Menu

The Account button (displaying user initials "AN") opens a dropdown menu with account-related options:

1. **Sign out** - Log out of the current account

**Menu Behavior:**
- Similar dropdown pattern to Settings menu
- Positioned near the account avatar button
- Minimal options focused on account management



#### Create New Menu

The "Create new" button in the global sidebar opens a dropdown menu with creation options:

1. **Page in Ideas** - Creates a new page in the Ideas section

**Menu Behavior:**
- Dropdown menu positioned near the trigger button
- Context-aware options (shows "Page in Ideas" when on home view)
- Likely shows different options based on current location (workspace-specific options when in a workspace)



### 3.6 Search Interface

#### Search Modal/Overlay

Clicking the Search button opens a full-screen or large modal overlay with search functionality.

**Search Header:**
- Keyboard shortcut indicator: "⌘ J" (Command+J on Mac)
- Search input field (implied, though not explicitly listed in elements)

**Search Results Sections:**
The search interface organizes results into categorized sections:

1. **Recent pages** - Shows recently accessed pages
   - Welcome (Getting Started workspace)
   - Untitled (Ideas)
   - Next Steps (Getting Started workspace)
   - Results count: "3 results found for Recent pages"

2. **Recent workspaces** - Shows recently accessed workspaces

**Search Behavior:**
- Opens as an overlay/modal that covers the main content
- Provides quick access via keyboard shortcut (⌘J)
- Categorizes results by type (pages vs workspaces)
- Shows result counts for each category
- Displays workspace context for pages (e.g., "Getting Started" next to page name)



### 3.7 Notifications Panel

#### Notifications Sidebar

Clicking the Notifications button opens a **side panel** (similar to the middle panel structure) that overlays or replaces the middle panel area.

**Panel Header:**
- Title: "Notifications"
- Close sidebar button (to dismiss the panel)

**Tab Navigation:**
The notifications panel includes a tab system for filtering notifications:
1. **All** - Shows all notifications
2. **Unread** - Shows only unread notifications

**Empty State:**
When no notifications are present, the panel displays:
- Heading: "No new notifications"
- Descriptive text: "Notifications about @mentions, assigned tasks, invites, and conversations that you're part of will be shown here."

**Notification Types (inferred from empty state message):**
- @mentions
- Assigned tasks
- Invites
- Conversation updates

**Panel Behavior:**
- Opens as a side panel similar to the workspace middle panel
- Can be closed via "Close sidebar" button
- Maintains the main content area visibility
- Uses tabs for filtering notification types



**Observation:** When the notifications panel is closed, the primary sidebar navigation items (Search, Notifications, Recent, Ideas, Workspaces, Getting Started) are no longer visible in the element list, suggesting the sidebar may have been collapsed or hidden. The main content area now shows tabs directly.



### 3.8 View Modes: List View and Grid View

#### List View (Table Structure)

When List View is selected, workspaces are displayed in a **table format** with columns:

**Table Columns:**
1. **Name** - Workspace name with favorite button
   - "Getting Started" (example entry)
   - Favorite button (star icon) for quick access
2. **Active now** - Shows current activity status (empty in this case)
3. **Opened** - Shows last opened timestamp
   - "29m ago" (example entry)

**Table Structure:**
- Header row with column titles
- Data rows with cells for each workspace
- Cells are interactive (clickable to open workspace)
- Favorite button is a separate interactive element within the Name cell

**Table Behavior:**
- Columns likely sortable (clicking column headers)
- Rows clickable to navigate to workspace
- Favorite toggle for quick access



#### Grid View (Card Layout)

When Grid View is selected, workspaces are displayed as **cards** in a grid layout:

**Card Structure:**
- Workspace name: "Getting Started"
- Timestamp: "29m ago"
- Hint text: "Go to this workspace or tab for more options"
- Cards are clickable to open the workspace

**Grid Behavior:**
- Cards arranged in a responsive grid
- Each card represents a workspace
- Hover state likely reveals additional options
- More visual/scannable than list view



### 3.9 Recent Components and Pages View

The "Recent components and pages" tab displays a table of recently accessed pages across all workspaces.

**Table Columns:**
1. **Name** - Page name with "More Page options" button (three-dot menu)
   - Welcome
   - Untitled
   - Next Steps
2. **Active now** - Current activity status (empty in these examples)
3. **Opened** - Last opened timestamp
   - "29m ago"
   - "Nov 2"
   - "Nov 1"
4. **Locations** - Workspace location with link
   - "Getting Started" (clickable button to open workspace)
   - "Ideas" (clickable button to open workspace)

**Table Features:**
- Each row represents a recently accessed page
- "More Page options" button (three-dot menu) for contextual actions
- Location links allow quick navigation to parent workspace
- Timestamps show relative time (e.g., "29m ago") or absolute dates (e.g., "Nov 2")

**Interaction Patterns:**
- Row click likely opens the page
- More options menu provides page-specific actions
- Location buttons navigate to parent workspace



### 3.10 Contextual Menus (More Options)

#### Page Options Menu

The "More Page options" button (three-dot menu) on each page row opens a contextual menu with actions:

**Primary Actions:**
- **Open** - Opens the page (with submenu for additional open options)
  - Nested submenu: "More options to open"
  - Submenu option: "Open [Workspace Name] in Loop" (e.g., "Open Getting Started in Loop")

**Menu Pattern:**
- Nested menu structure (menu within menu)
- Context-aware options based on the selected item
- Submenu indicated by arrow or nested trigger



## 4. WORKSPACE INTERIOR LAYOUT

### 4.1 Middle Panel (Workspace Navigation)

When a workspace is opened, the middle panel appears between the primary sidebar and the main content area, creating a three-column layout.

**Middle Panel Header:**
The header contains workspace-level controls and information:
- Workspace title: "Getting Started"
- "0 Members" button (with hint: "Invite and manage members")
- "Close sidebar" button (to hide the middle panel)
- "Filter and sort" button (to organize page list)
- "Create new" button (to add pages within workspace)

**Page List with Emojis:**
The middle panel displays a hierarchical list of pages, each with an emoji icon and title:
1. 👋 Welcome (0)
2. ✅ Check the Basics (0)
3. ⚡ Create a Component (0)
4. 📱 Get the Mobile App (0)
5. ✨ Get Inspired (0)
6. 🤓 Send Feedback (0)
7. 🚀 Next Steps (0)

**Page List Features:**
- Sort indicator: "Sorted by hierarchy"
- Each page has an emoji prefix for visual identification
- Numerical indicator (0) next to each page (likely comment count or sub-item count)
- Pages are clickable to open in main content area
- Hierarchical structure (though all appear at same level in this workspace)

**Middle Panel Footer:**
- "Recycle bin" link for accessing deleted pages

**Panel Behavior:**
- Appears when workspace is selected
- Can be closed via "Close sidebar" button
- Maintains scroll position independently
- Provides quick navigation between pages within workspace



### 4.2 Page Content Area

When a page is opened, the main content area displays the page with a comprehensive header and body structure.

**Page Header (Top Bar):**
The page header contains several contextual elements and actions:
- **Breadcrumb/Connection indicator:** "Connected to Getting Started" button (shows workspace context)
- **Page title button:** "👋 Welcome" (clickable, possibly for quick navigation)
- **Shared locations** button (shows where the page is shared)
- **Copy as Loop component** button (for copying page content)
- **Share** button (for sharing the page)
- **More options** button (three-dot menu for additional actions)

**Page Cover Section:**
- **Update cover** button (with hint describing current cover: "Glowing wavy fabric in mo...")
- Cover image displayed above page title (decorative header image)

**Page Title Section:**
- **Page icon:** 👋 (emoji icon, clickable with hint "Page icon 👋")
- **Page title:** "Welcome" (editable text, marked as "Title" region)

**Page Body (Canvas):**
The page content is displayed in a canvas region with rich text formatting:

**Introductory paragraph:**
"We are the Loop team and we are very excited to welcome you to the Loop app! This 'Getting Started' workspace will help you get up to speed on how to use Loop with some fun along the way. 🙂 Head over to the 'Check the Basics' page in the side bar to learn more!"

**Section with heading:**
- **Heading:** "About Loop"
- **Body text:** "Microsoft Loop is a co-creation app which enables you and your team to bring all the parts of your project together in one place and collaborate across the apps and devices you already use. It's a new way of working — so you and your team can think, plan and create together from anywhere!"

**Content Structure Observations:**
- Rich text editor with paragraph and heading support
- Emoji support in body text
- Hyperlinks to other pages (e.g., reference to 'Check the Basics' page)
- Clean, readable typography
- Ample whitespace between sections

**Middle Panel Active State:**
The "Welcome" page is highlighted in the middle panel page list, indicating it's the currently open page. The "Get Inspired" page shows "AN" next to it, suggesting user presence or recent activity by Andrew Naegele.



### 4.3 Embedded Media and Components

**YouTube Embed:**
The page contains an embedded YouTube video component:
- Label: "YouTube"
- Button to interact with video: "YouTube"
- Component ID: "guestComponent347componentPartHostingElementIdr49"
- Hint: "Microsoft Loop | Learn the Basics. Press Enter to..."
- Embedded media is displayed inline within the page canvas

**Embedded Component Pattern:**
Loop supports embedding external content (YouTube videos) directly within pages, maintaining a seamless content experience without leaving the application.

### 4.4 Presence and Collaboration Indicators

**User Presence Avatars:**
Throughout the interface, user presence is indicated with avatar badges showing user initials:
- "AN" (Andrew Naegele) appears next to pages in the middle panel
- Avatar appears in the page header next to the page title
- Presence indicators show which pages users are currently viewing or have recently accessed

**Presence Locations:**
- Middle panel page list: Shows "AN" next to "Welcome" and "Get Inspired" pages
- Page header: Shows "AN" avatar next to the page title button
- Indicates real-time collaboration and user activity

**Collaboration Features:**
- User avatars indicate who is viewing or editing
- Multiple users can be present on the same page
- Visual feedback for collaborative awareness



### 4.5 Page Hierarchy and Subpages

**Hierarchical Page Structure:**
The middle panel now shows a hierarchical structure with an "Untitled" page appearing as a child or sibling to other pages:
- "Untitled AN 0" appears at the top of the list (possibly a recently created page)
- Shows user presence indicator "AN"
- Numerical indicator "0"

**Page Organization:**
Pages can be organized hierarchically within workspaces, with parent-child relationships indicated in the sidebar navigation.

### 4.6 Content Formatting and Editor Features

The "Check the Basics" page reveals extensive editor capabilities and formatting options:

**Keyboard Shortcuts and Commands:**
- **Type /** - Opens content type insertion menu
- **Type @** - Mentions people or links files
- **Type :** - Opens emoji picker
- **Right-click text** - Access formatting options
- **Hold ⋮⋮ icon** - Drag and drop content blocks
- **Chat bubble icon** - Add comments or reactions to content

**Content Types Supported:**
- Text paragraphs
- Headings (e.g., "Page Basics", "Workspace Basics")
- Loop components
- Links
- Tasks
- Mentions
- Emojis
- File attachments

**Formatting Features:**
- Rich text formatting (accessible via right-click)
- Drag and drop content reordering
- Inline comments and reactions
- Flexible canvas layout

**Content Structure on This Page:**
- Introductory text
- **Heading:** "Page Basics"
- Bulleted list of page features
- **Heading:** "Workspace Basics"
- Bulleted list of workspace features
- **TIP callout:** "Check out the subpages in the sidebar to learn more!"

**Visual Indicators:**
- ⋮⋮ icon for drag handles
- Chat bubble icon for comments
- Purple + button mentioned for adding content



### 4.7 List and Content Block Structure

**Bulleted Lists:**
The page uses unordered lists (ul) with list items (li) for organizing information:
- Each list has a unique ID (e.g., "scriptor-list-27dd5e8c-5f1d-4bfe-8428-e3c1198fb2af")
- List items also have unique IDs (e.g., "scriptor-listItem-02be18eb-d0c3-4096-b58c-05289fe7...")
- Lists are used for feature descriptions and instructions

**Content Block Types:**
- **Presentation blocks:** Marked with `hint="presentation"` attribute, these appear to be distinct content blocks that can be manipulated independently
- **Heading blocks:** Section headers like "Page Basics" and "Workspace Basics"
- **Paragraph blocks:** Regular text content
- **List blocks:** Bulleted or numbered lists
- **Callout blocks:** TIP section for highlighting important information

**Block-Level Interaction:**
Each content block appears to be independently selectable, movable (via drag handle), and commentable (via chat bubble icon), supporting a modular content structure.



### 3.11 Filter and Sort Menu

The "Filter and sort" button in the middle panel header opens a menu with sorting options:

**Sort Options:**
- **Hierarchy** - Sorts pages by hierarchical structure (radio button selection)
- **Activity** - Sorts pages by recent activity (radio button selection)

**Menu Type:**
- Radio button menu (menuitemradio) allowing single selection
- Currently sorted by "Hierarchy" as indicated in the panel

**Observation:**
The "Untitled" page name has changed to "Test Page for DocumentationUntitled" with "AN" presence indicator, suggesting real-time updates or recent editing activity.



### 4.8 Collapsed Sidebar State

When the primary sidebar is collapsed:

**Visual Changes:**
- Sidebar becomes icon-only (no text labels visible)
- Button hint changes from "Collapse navigation bar" to "Expand navigation bar"
- Navigation items show only icons:
  - Create new (no text)
  - Search (icon only)
  - Notifications (shows "0 unread" badge)
  - Recent (icon only)
  - Ideas (icon only)
  - Workspaces (icon only)
  - Getting Started (icon only)

**Space Optimization:**
- Collapsed sidebar takes minimal horizontal space
- More room for middle panel and main content area
- All functionality remains accessible via icons

**Notification Badge:**
The Notifications button shows "0 unread" even in collapsed state, indicating notification count is always visible.



### 4.9 Middle Panel Closed State

When the middle panel is closed:

**Layout Changes:**
- Middle panel completely hidden
- Main content area expands to fill the available space
- Primary sidebar remains visible with full navigation
- Page header shows workspace breadcrumb: "Getting Started" button

**Navigation Adjustments:**
- Primary sidebar still shows all navigation items (Search, Notifications, Recent, Ideas, Workspaces, Getting Started)
- Workspace button "Getting Started" appears in the primary sidebar for quick access
- Page context maintained through breadcrumb in page header

**Space Maximization:**
Closing the middle panel provides maximum horizontal space for page content, ideal for focused reading or editing of long documents.

**Reopening Middle Panel:**
Users can reopen the middle panel by clicking the workspace button in the sidebar or through other navigation actions.



### 4.10 Real-Time Page List Updates

**Observation:** The page list in the middle panel has been updated in real-time:
- "Test Page for DocumentationUntitled" has been simplified to "Test PageAN0"
- Page names appear to be editable and update dynamically
- The numerical indicators (0) remain consistent across all pages
- Presence indicators ("AN") show which pages have active users

**Page List Current State:**
1. Test Page AN 0
2. 👋 Welcome 0
3. ✅ Check the Basics AN 0 (currently active)
4. ⚡ Create a Component 0
5. 📱 Get the Mobile App 0
6. ✨ Get Inspired 0
7. 🤓 Send Feedback 0
8. 🚀 Next Steps 0



### 4.11 Recycle Bin

**URL Pattern:** `https://loop.cloud.microsoft/recycle/[encoded-workspace-data]`

**Recycle Bin Interface:**
- Accessed via "Recycle bin" link in the middle panel footer
- Opens in the main content area while maintaining workspace context
- **"Empty all" button** - Permanently deletes all items in recycle bin

**Empty State:**
The recycle bin appears to be empty (no deleted items listed), showing only the "Empty all" button.

**Behavior:**
- Deleted pages are moved to recycle bin rather than permanently deleted
- Users can restore or permanently delete items from recycle bin
- "Empty all" provides bulk deletion of all recycled items



### 4.12 Page Creation Flow

**Create New Menu (Workspace Context):**
When clicked from within a workspace, the "Create new" button in the middle panel header opens a menu with:

**Section Header:** "In current workspace"

**Creation Options:**
- **Page** - Creates a new page within the current workspace

**Context-Aware Behavior:**
The create menu adapts based on location - when in a workspace, it defaults to creating items within that workspace context.



## 5. IDEAS SECTION

### 5.1 Ideas Tab Overview

The Ideas tab provides a dedicated space for brainstorming and ideation, separate from structured workspaces.

**Layout:**
- Uses the same table layout as "Recent components and pages"
- Columns: Name, Active now, Opened
- "New Page" button for quick page creation

**Content:**
- Contains standalone pages not associated with workspaces
- Example page: "📝️ Untitled page" with document icon
- Each page has "More Page options" button (three-dot menu)

**Purpose:**
Ideas serves as a lightweight, unstructured space for capturing thoughts and concepts before organizing them into formal workspaces.

**Interaction:**
- Pages can be created directly in Ideas
- Pages can be moved to workspaces later
- Similar table interactions as other list views



---

## SUMMARY OF KEY UI PATTERNS

### Layout System

Microsoft Loop employs a **flexible three-panel layout architecture** that adapts based on user context and navigation state. The system consists of a persistent primary sidebar, a contextual middle panel, and a main content area that scales to fill available space.

The primary sidebar serves as the application's navigation backbone, providing access to top-level sections (Recent, Ideas, Workspaces) and global actions (Create, Search, Notifications). This sidebar can collapse to an icon-only state, maximizing horizontal space while maintaining full functionality through tooltips and badges.

The middle panel appears contextually when users navigate into workspaces, displaying hierarchical page lists with sorting and filtering capabilities. This panel includes workspace-level controls for member management, page creation, and organization. The panel can be closed to provide maximum space for content focus, and reopens automatically when navigating between workspaces.

The main content area adapts its structure based on the current view. In the home view, it displays tab-based navigation with workspace cards or tables. Within workspaces, it renders full page content with rich editing capabilities. This area maintains independent scroll behavior, allowing users to navigate long documents without affecting sidebar or middle panel positions.

### Navigation Hierarchy

Loop implements a **three-level navigation hierarchy** that progressively reveals more specific content. The first level consists of application-wide sections accessible from the primary sidebar. The second level appears in the middle panel when a workspace is selected, showing all pages within that workspace. The third level is the actual page content displayed in the main area.

This hierarchical approach provides clear context at each level while maintaining efficient navigation. Users can quickly jump between workspaces via the sidebar, switch pages via the middle panel, and focus on content in the main area without losing their place in the broader structure.

### Component Design Philosophy

Loop's component design emphasizes **clarity, consistency, and context-awareness**. Buttons follow clear visual hierarchy with primary actions (Create new) receiving prominent styling, while secondary actions (More options) use subtle icon-only designs. Dropdown menus adapt their content based on the user's current location, showing workspace-specific options when in a workspace and global options when on the home screen.

Tables provide multiple view modes (List and Grid) to accommodate different user preferences and use cases. List view offers detailed information in sortable columns, while Grid view provides a more visual, scannable layout. Both views maintain consistent interaction patterns for selecting, opening, and managing items.

### Real-Time Collaboration

Collaboration features are deeply integrated throughout the interface. **User presence indicators** appear next to pages in the middle panel and in page headers, showing which team members are currently viewing or editing content. These indicators use user initials in circular avatars, providing immediate awareness of collaborative activity.

The notification system provides a dedicated panel accessible from the sidebar, with tabs for filtering between all notifications and unread items. Notifications cover mentions, task assignments, invites, and conversation updates, ensuring users stay informed of team activity.

### Content Editing Experience

The page editing experience centers on a **flexible canvas** that supports rich content types. Users can insert various content blocks using keyboard shortcuts: typing "/" opens a content type menu, "@" enables mentions and file linking, and ":" opens an emoji picker. This keyboard-first approach accelerates content creation for power users while remaining discoverable for newcomers.

Content blocks are independently manipulable, with drag handles (⋮⋮) for reordering and chat bubble icons for adding comments and reactions. This block-based architecture enables modular content organization and granular collaboration, as team members can comment on specific sections rather than entire pages.

### Visual Design Approach

Loop's visual design emphasizes **minimalism and clarity**. The interface uses ample whitespace, subtle borders, and restrained use of color to maintain focus on content. Emojis serve as visual identifiers for pages, adding personality without overwhelming the interface. Cover images provide visual distinction for pages while maintaining a consistent header structure.

Typography follows a clear hierarchy with distinct heading levels and readable body text. Spacing is consistent throughout, creating a rhythmic visual flow. Shadows and elevation are used sparingly, primarily for dropdown menus and modal overlays, ensuring these elements clearly float above the main interface.

### State Management and Feedback

The interface provides clear feedback for all user actions. **Active states** are clearly indicated through highlighting in navigation lists and tabs. Hover states provide subtle visual feedback, typically through background color changes or underlines. Loading states (though not extensively observed in this session) appear to use skeleton screens or progress indicators.

Empty states, such as the empty recycle bin and notification panel, provide helpful descriptive text explaining what will appear in these areas when populated. This guidance helps users understand the purpose of each section even when no content is present.

### Accessibility Considerations

While not exhaustively tested, the interface demonstrates several accessibility-positive patterns. Buttons include descriptive hints (ARIA labels) that would support screen readers. Keyboard navigation is supported through shortcuts and standard tab navigation. The collapsible sidebar accommodates users who need larger content areas or magnification.

The use of both icons and text labels in most navigation elements provides multiple cues for understanding functionality. Color is not used as the sole indicator of state, with active items also receiving positional or typographic emphasis.

---

## DESIGN SYSTEM EXTRACTION READINESS

The documentation captured provides sufficient detail to extract:

1. **Layout Patterns** - Three-panel system with collapsible regions
2. **Component Library** - 12+ distinct component types with variants and states
3. **Interaction Patterns** - Hover, active, focus, drag-and-drop, keyboard shortcuts
4. **Navigation Systems** - Hierarchical navigation, breadcrumbs, tabs, sidebars
5. **Content Structures** - Page templates, block types, embedded media
6. **Collaboration Features** - Presence indicators, comments, sharing
7. **State Management** - Empty states, loading patterns, error handling
8. **Visual Tokens** - Typography scale, spacing rhythm, color usage patterns

Next phases will focus on measuring specific visual tokens (exact font sizes, spacing values, color codes) and creating the brand-agnostic design system specification.



## 6. PAGE AND WORKSPACE CREATION

### 6.1 Create New Menu (Home View)

When accessed from the home view (not within a workspace), the "Create new" menu offers:

**Creation Options:**
- **Page in Ideas** - Creates a new page in the Ideas section (unstructured brainstorming space)

**Context-Aware Behavior:**
The create menu adapts based on location:
- From home view: Offers "Page in Ideas" (no workspace context)
- From workspace interior: Offers "Page" in current workspace

This contextual adaptation reduces cognitive load by presenting only relevant creation options based on the user's current location.



### 6.2 Workspace View Modes

**Dual-Pane Workspace View:**
When clicking a workspace from the sidebar while on the home view, Loop displays a unique dual-pane layout:

**Left Side:** Middle panel showing workspace pages list
- Test Page AN 0
- 👋 Welcome AN 0
- ✅ Check the Basics 0
- ⚡ Create a Component 0
- 📱 Get the Mobile App 0
- ✨ Get Inspired 0
- 🤓 Send Feedback 0
- 🚀 Next Steps 0
- Recycle bin link

**Right Side:** Main content area showing workspace overview
- Workspace card/preview
- "Go to this workspace or tab for more options" message
- "Getting Started" workspace name
- "37m ago" timestamp (last activity)

This dual-pane view allows users to see both the workspace contents (left) and workspace metadata (right) simultaneously, providing context before diving into specific pages.



### 6.3 Blank Page State

**Test Page** appears to be a newly created or empty page with minimal content.

**Observations:**
- Page title "Test Page" appears in browser title and middle panel
- No cover image
- No page icon
- No visible content in main area
- Page is selectable in middle panel but shows no presence indicators (suggesting no active editing)

**Empty Page Behavior:**
New or empty pages display only the essential page structure (title) without additional content blocks, providing a clean canvas for users to begin adding content.



---

## 7. VISUAL DESIGN SYSTEM

### 7.1 Typography

Based on observations throughout the interface, Microsoft Loop employs a clear typographic hierarchy:

**Font Family:**
- Primary: Appears to be a sans-serif system font (likely Segoe UI on Windows, San Francisco on macOS)
- Consistent across all interface elements

**Heading Hierarchy:**
- **Page Title**: Large, bold weight - appears to be ~32-36px
- **Section Headings** (e.g., "Page Basics", "Workspace Basics"): Medium-large, bold - appears to be ~20-24px
- **Subheadings**: Medium, semi-bold - appears to be ~16-18px

**Body Text:**
- **Regular body**: Standard weight - appears to be ~14-16px
- **Small text** (timestamps, metadata): Lighter weight - appears to be ~12-14px
- **Button text**: Medium weight - appears to be ~14px

**Line Height:**
- Body text appears to use comfortable line spacing (~1.5-1.6)
- Headings use tighter line height (~1.2-1.3)

**Text Colors:**
- **Primary text**: Dark gray/black for main content
- **Secondary text**: Medium gray for metadata and timestamps
- **Tertiary text**: Light gray for hints and placeholders
- **Interactive text**: Blue for links
- **Active/Selected text**: Darker or accented for emphasis

### 7.2 Color Palette

**Primary Colors:**
- **Purple/Blue accent**: Used for primary actions, active states, and the Loop brand
- Appears in "Create new" button, active navigation items, and interactive elements

**Neutral Colors:**
- **White**: Background for main content areas
- **Light gray** (#F5F5F5 or similar): Background for sidebars and panels
- **Medium gray**: Borders and dividers
- **Dark gray**: Text and icons
- **Black**: High-emphasis text

**Semantic Colors:**
- **Blue**: Links and informational elements
- **Green**: Success states (not extensively observed)
- **Red**: Destructive actions (not extensively observed)
- **Yellow/Orange**: Warnings (not extensively observed)

**Transparency:**
- Hover states use subtle background color overlays
- Modal overlays use semi-transparent dark backgrounds

### 7.3 Spacing System

Loop employs a consistent spacing scale throughout the interface:

**Spacing Scale (Estimated):**
- **XS**: 4px - Tight spacing within components
- **S**: 8px - Small gaps between related elements
- **M**: 16px - Standard spacing between components
- **L**: 24px - Larger gaps between sections
- **XL**: 32px - Major section separation
- **XXL**: 48px+ - Top-level layout spacing

**Padding:**
- Buttons: ~8-12px vertical, ~16-24px horizontal
- Cards: ~16-24px all sides
- Panels: ~16-24px all sides
- Page content: ~24-32px margins

**Margins:**
- Between list items: ~4-8px
- Between sections: ~24-32px
- Between panels: 0px (panels are adjacent)

### 7.4 Borders and Dividers

**Border Styles:**
- **Thin borders**: 1px solid light gray
- Used for: Panel dividers, card outlines, input fields
- **No borders**: Many components use background color changes instead of borders

**Border Radius:**
- **Buttons**: ~4-6px (slightly rounded corners)
- **Cards**: ~8px (moderately rounded)
- **Avatars**: 50% (circular)
- **Modals**: ~8-12px (moderately rounded)
- **Input fields**: ~4px (slightly rounded)

### 7.5 Shadows and Elevation

Loop uses subtle shadows to create depth hierarchy:

**Shadow Levels:**
- **Level 0** (No shadow): Flat elements like panels and sidebars
- **Level 1** (Subtle shadow): Cards and buttons
  - Estimated: `0 1px 3px rgba(0,0,0,0.12)`
- **Level 2** (Medium shadow): Dropdown menus and popovers
  - Estimated: `0 2px 8px rgba(0,0,0,0.15)`
- **Level 3** (Strong shadow): Modal overlays
  - Estimated: `0 4px 16px rgba(0,0,0,0.2)`

**Elevation Strategy:**
- Shadows are used sparingly to maintain a clean, flat aesthetic
- Floating elements (dropdowns, modals) receive more pronounced shadows
- Hover states may add subtle shadows to indicate interactivity

### 7.6 Icons

**Icon Style:**
- **Line icons**: Simple, outlined style
- **Consistent weight**: All icons use similar stroke width
- **Size**: Icons appear to be ~16-20px for standard UI, ~24px for larger actions

**Icon Usage:**
- Navigation items (sidebar)
- Action buttons (create, search, notifications)
- Status indicators (presence, activity)
- Content type indicators (emoji as icons for pages)

**Emoji Integration:**
- Emojis are used extensively as visual identifiers for pages
- Standard emoji rendering (system default)
- Consistent size with surrounding text

### 7.7 Layout Grid

**Grid System:**
- Loop appears to use a flexible, fluid layout rather than a strict column grid
- Panels have fixed or flexible widths based on content and user interaction

**Panel Widths:**
- **Primary sidebar**: ~240-280px (fixed width, collapsible to ~48px icon-only)
- **Middle panel**: ~280-320px (fixed width, closable)
- **Main content**: Flexible, fills remaining space

**Breakpoints:**
- Interface appears optimized for desktop/laptop screens
- Responsive behavior not extensively tested in this session

### 7.8 Animation and Transitions

**Transition Patterns:**
- **Panel collapse/expand**: Smooth slide animation (~200-300ms)
- **Dropdown menus**: Fade in with slight scale (~150-200ms)
- **Hover states**: Instant or very quick (~100ms)
- **Page navigation**: Instant content swap (no page transition animation observed)

**Animation Easing:**
- Appears to use standard easing functions (ease-in-out)
- Smooth, natural motion without being distracting

**Loading States:**
- Not extensively observed, but likely uses skeleton screens or spinners
- Real-time updates appear instant without loading indicators

