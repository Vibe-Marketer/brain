# Phase 16: Workspace Redesign - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Rename Bank → Organization, Vault → Workspace, Hub → Folder across all UI surfaces, DB schema (additive), emails, errors, tooltips. Implement Organization/Workspace/Folder creation, switching, and management UX. URL redirects for old paths. Onboarding diagram for the 4-level model. Invite flows with role assignment. Folder management within workspaces.

Does NOT include: new import connectors, routing rules, MCP changes, or any AI features. Those are Phases 17–21.

</domain>

<decisions>
## Implementation Decisions

### Hierarchy navigation
- **Organization switcher:** Dedicated thin header bar above the sidebar showing current org name. One click to switch orgs via dropdown.
- **Workspace switching:** Sidebar section with workspaces listed as expandable items. Click to switch. Current workspace highlighted. Folders nest underneath each workspace. Matches v1 vault sidebar pattern.
- **Breadcrumbs:** Full breadcrumb trail (Org > Workspace > Folder > Call) always visible at the top of the main content area. Each level clickable for navigation.
- **Org switch behavior:** Switching organizations resets the view to that org's workspace list. No position memory across orgs — clean slate each time.

### Onboarding & model clarity
- **4-level diagram:** Interactive explorer — user clicks through levels one at a time. Each click reveals the next layer (Account → Organization → Workspace → Folder → Call) with a brief explanation. More engaging than static, less passive than auto-animation.
- **Trigger:** Show on first login after signup. Also accessible later via a "How it works" link in the sidebar or help menu so users can revisit.
- **Personal org:** Distinct treatment with a special label/icon (e.g., house icon). Onboarding explains: "This is your personal space. Create an Organization to collaborate with others."
- **My Calls workspace:** Auto-created as the default import destination. User can rename it but cannot delete it (every org needs at least one workspace). Default destination for imports unless routing rules override.

### Invite & membership flow
- **Invite mechanism:** Email invite AND shareable invite link (like Slack/Discord). Invite links can be revoked.
- **Role picker:** Claude's discretion — pick the approach that fits the dialog context best.
- **Invite acceptance:** Claude's discretion — must satisfy WKSP-10 (invitees know what they're accepting: who invited them, org name, workspace name, assigned role, what they'll have access to).
- **Member management:** Separate tabs for "Members" and "Pending Invites" in workspace settings. Pending invites tab shows resend/revoke options.

### Folder management
- **Folder location:** Sidebar under parent workspace. Click a folder to filter the call list to that folder's contents.
- **Folder depth:** One level of nesting allowed (folders can contain subfolders, max 2 levels deep). Gives structure without over-organization.
- **Call assignment:** Drag-and-drop on desktop (drag call onto sidebar folder) AND action menu everywhere (right-click / "..." menu → "Move to folder" → pick folder). Both mechanisms available.
- **Archive behavior:** Archived folders move to an "Archived" section. Calls stay inside the archived folder. Folder is hidden from main sidebar view. Can be fully restored.
- **Archive = visibility toggle:** Archiving excludes calls/folders from searches AND MCP results. It is NOT deletion — all content is preserved and fully restorable. Users archive to "soft hide" groups of calls they don't want cluttering searches or MCP responses, and un-archive to bring them back.

### Claude's Discretion
- Role picker UX (dropdown vs cards — pick what fits the invite dialog)
- Invite acceptance flow design (must satisfy WKSP-10: invitees see who invited them, org name, workspace name, role, and access scope before accepting)
- Exact breadcrumb styling and truncation on narrow screens
- Folder creation UX (inline rename vs dialog)
- Sidebar expand/collapse animation details

</decisions>

<specifics>
## Specific Ideas

- Workspace switching should match the current v1 vault sidebar pattern — users familiar with v1 should feel at home
- Personal org gets a house icon to visually distinguish it from team orgs
- Archive is explicitly a visibility/query toggle, not a deletion mechanism — archived content is excluded from search and MCP but fully restorable at any time

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-workspace-redesign*
*Context gathered: 2026-02-27*
