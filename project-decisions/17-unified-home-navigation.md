# Unified Home Navigation — Kill the Workspaces Tab

**Date:** 2026-03-02
**Status:** Decision — ready for implementation
**Scope:** callvault repo (v2 frontend)

---

## The Problem

Workspaces are scattered across THREE places:
1. The **TopBar org dropdown** — currently shows BOTH organizations AND workspaces (wrong — should be orgs only)
2. The **Workspaces sidebar tab** (`/workspaces`) — shows a grid of workspace cards + member management
3. The **Pane 2 tree** on the Home tab — shows all workspaces with folders underneath

The TopBar dropdown got polluted with workspace switching at some point — it was supposed to be org-only. This plus the duplicate sidebar tab and Pane 2 tree creates confusion: "Where do I manage workspaces?" has three answers. The app feels disconnected because these features were added at different times and never unified.

## The Decision

**Remove the dedicated Workspaces sidebar tab.** The Pane 2 workspace/folder tree becomes the single place for all workspace navigation and management.

This matches how Linear, Notion, Slack, and Apple Mail handle it — none of them have a "Workspaces page." Workspace switching is always contextual (in the sidebar tree), not a separate destination.

## Why

- Users come to CallVault to **find and review calls** — organization supports that job, it's not a separate job
- With 2-5 workspaces typical, showing them all in the Pane 2 tree is the right pattern (Apple Mail model)
- Workspace admin (members, sharing) happens rarely — it doesn't deserve prime sidebar real estate
- One path to one concept = zero confusion

---

## What Changes

### Sidebar: 4 tabs → 3 tabs

```
BEFORE:                    AFTER:
[All Calls]                [Home]
[Workspaces]               [Import]
[Import]                   [Settings]
[Settings]
```

### Fix TopBar Dropdown — Orgs Only (CRITICAL)

The TopBar org switcher dropdown currently shows both organizations AND workspaces. This is wrong.

**Remove ALL workspace references from the TopBar dropdown.** The dropdown must show ONLY organizations:
- List of orgs the user belongs to (personal org, business orgs)
- Active org with checkmark
- "Create Organization" action at the bottom
- **NOTHING about workspaces** — no workspace list, no workspace switcher, no workspace labels

The rule: **TopBar = org context. Pane 2 = workspace/folder context.** These are separate concerns at separate levels of the hierarchy. Never mix them.

### Remove

- **All workspace UI from the TopBar dropdown** — strip any workspace listing, switching, or selection from `TopBar.tsx`
- **Workspaces sidebar tab** from `SidebarNav.tsx`
- **`/workspaces` route** (`routes/_authenticated/workspaces/index.tsx`)
- **`/workspaces/$workspaceId` route** (`routes/_authenticated/workspaces/$workspaceId.tsx`)
- The `OrgSidebar` inline component (was Pane 2 on the workspaces page — org list is already in TopBar)

### Rename

- "All Calls" sidebar label → **"Home"**

### Enhance WorkspaceSidebarPane

Add **context menus** (right-click or three-dot icon) to workspace and folder items:

**Workspace context menu:**
- Manage Members → opens `'workspace-detail'` panel in Pane 4
- Create Folder
- Workspace Settings
- Set as Default

**Folder context menu:**
- Rename
- Move to Workspace
- Archive

### Build Workspace Detail Panel (Pane 4)

The `'workspace-detail'` panel type already exists in `panelStore.ts`. Build the actual panel component:
- Member list with roles
- Invite member flow
- Workspace name editing
- Default workspace toggle

Move the member management UI from the current `WorkspaceDetailPage` into this Pane 4 panel. This way users can manage workspace members **without leaving their call-browsing context**.

### Activate Workspace Settings Category

The Settings page already has a stubbed "Workspace" category. Activate it for deeper workspace admin:
- Workspace list with edit/delete
- Default workspace selection
- Sharing rules (if applicable)

---

## What Stays the Same

- **`WorkspaceSidebarPane` component** — already built, already shows the tree. This is the foundation.
- **`orgContextStore`** — same state management (activeOrgId, activeWorkspaceId, activeFolderId)
- **All folder/workspace CRUD hooks and services** — no backend changes
- **AppShell pane architecture** — unchanged
- **TopBar org switcher** — stays in TopBar but must be cleaned to show ONLY orgs (no workspaces)
- **Folder routes** (`/folders/$folderId`) — still work the same way
- **Call detail routes** (`/calls/$callId`) — unchanged

---

## Navigation Mental Model (After)

```
Pane 1 (Sidebar)     Pane 2 (Always visible on Home)    Pane 3              Pane 4
┌────────────┐       ┌────────────────────┐              ┌──────────────┐    ┌──────────────┐
│            │       │ WORKSPACES      [+]│              │              │    │              │
│  ★ Home    │       │                    │              │  Call List   │    │  Call Detail  │
│    Import  │       │ ▼ Sales Team       │   ← click →  │  (filtered)  │    │  — or —      │
│    Settings│       │   📁 Inbound       │              │              │    │  Workspace   │
│            │       │   📁 Outbound      │              │              │    │  Members     │
│            │       │   📁 Follow-ups    │              │              │    │              │
│            │       │                    │              │              │    │              │
│            │       │ ► Support          │              │              │    │              │
│            │       │ ► Training         │              │              │    │              │
│            │       │                    │              │              │    │              │
│            │       │ ─────────────────  │              │              │    │              │
│            │       │ ▸ Archived (2)     │              │              │    │              │
└────────────┘       └────────────────────┘              └──────────────┘    └──────────────┘
```

Each element has exactly one job:
- **TopBar dropdown:** Switch organizations (rare — "which company am I in?")
- **Pane 1 (Sidebar):** Switch between app sections (Home, Import, Settings)
- **Pane 2:** Navigate workspaces and folders (frequent — "which project/folder am I looking at?")
- **Pane 3:** View content (call list, filtered by Pane 2 selection)
- **Pane 4:** Inspect details (call detail, workspace members, folder info)

**Hard rule:** Org switching = TopBar. Workspace/folder switching = Pane 2. Never mix these.

---

## Edge Cases

- **Workspace invite links** (`/join/workspace.$token`) — still work, independent of navigation
- **Workspace cards overview** — the grid view with stats (call count, member count) is lost. Consider adding a compact stats line to each workspace row in the Pane 2 tree as a lightweight replacement.
- **"No workspace selected" state** — when nothing is selected in Pane 2, Pane 3 shows all calls across all workspaces (the "All Calls" view). This is the default landing state.

---

## Research Reference

Full options comparison with scoring: `artifacts/research/2026-03-02-workspace-folder-navigation-options.md`
