# Phase 14: Foundation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

New Vite+React repo with auth working, AppShell rendered, all non-AI routes wired — the first thing users see when v2 goes live. Same Supabase backend, zero AI code. Users can log in with their existing account and navigate the full app shell.

</domain>

<decisions>
## Implementation Decisions

### AppShell layout
- Replicate v1's 4-pane model exactly — this is proven and the user likes it
- Pane 1: NavRail sidebar (220px expanded / 72px collapsed), collapsible via toggle
- Pane 2: Secondary panel (280px, collapsible to 0) — e.g., folder sidebar, can be closed entirely
- Pane 3: Main content area (flex-1) — call list and primary content lives here
- Pane 4: Detail panel (360px desktop / 320px tablet), slides in from right when needed
- Fixed proportions — no user-resizable dividers
- 4th pane hidden when nothing is selected — main content pane expands to fill
- All transitions 500ms ease-in-out, rounded-2xl panes, 12px gaps between panes
- Reference: current v1 app + Microsoft Loop (newest iteration)

### Responsive behavior
- Mobile: stack and navigate — panes become full-screen views with back button navigation (like a native mobile app)
- Tablet: auto-collapse sidebar to 72px icon rail
- Foundation must ship with mobile responsive layout, not desktop-only

### Navigation structure
- Workspace-first sidebar: org switcher at top, workspace switcher below, then "All Calls" + folder tree, then imports/settings at bottom
- Org and workspace switching via dropdown menus (not overlay panels)
- Keep v1's nav item order and grouping — just apply new naming (Organization/Workspace/Folder)

### Visual direction
- Visual evolution of v1 — cleaner, more polished, no emojis anywhere
- Base the visual identity on the ACTUAL current app appearance, not the brand-guidelines-v4.2 document (which may be stale/inaccurate)
- Both light mode and dark mode ship from day 1 — both polished. User primarily uses light mode.
- Match v1's compact density — the current density IS compact and the user likes it
- Keep all existing visual elements (rounded panes, shadows, spring animations, current color palette) — just execute them with more polish

### First-run experience
- Existing v1 users: guided tour (5-7 steps) covering layout, naming changes (Bank->Org, Vault->Workspace, Hub->Folder), and key new features
- Tour is skippable but encouraged — skip option exists but is subtle, not prominently displayed
- Brand-new users (never used v1): separate onboarding flow focused on getting started — create workspace, connect first import source
- Two distinct paths: "returning user" tour vs "new user" onboarding

### Claude's Discretion
- Exact spring animation stiffness/damping values (roadmap suggests 200-300/25-30 range)
- Specific sidebar icon set and styling
- Tour/onboarding implementation approach (library vs custom)
- Exact pane shadow depths and border treatments during polish
- Loading states and skeleton screens during route transitions

</decisions>

<specifics>
## Specific Ideas

- "I really like where the app's visually at right now. Just polish it up a bit."
- Reference the LIVE v1 app for visual decisions, not documentation — the user experiences it in light mode
- Microsoft Loop (newest iteration) is a layout reference for the pane model
- No emojis in any UI surface — this was called out specifically
- The brand guidelines doc (v4.2) may be outdated — treat the actual running app as the source of truth for visual direction

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-foundation*
*Context gathered: 2026-02-27*
