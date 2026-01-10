# SPEC: Collaboration Navigation Restructure

## What
Move Teams and Coaches functionality from Settings into a new top-level "Collaboration" navigation item with its own 3-pane layout structure. This creates a dedicated space for team collaboration features and establishes routing at `/team` and `/coaches`.

## Why
Teams and Coaches are core collaboration features that deserve dedicated navigation rather than being buried in Settings. This improves discoverability and creates room for future collaboration features while keeping Settings focused on personal and system configuration.

## User Experience

**Navigation:**
- Users see a new "Collaboration" item in the main sidebar (5th item, after Home/AI Chat/Sorting/Settings)
- Icon uses `RiTeamLine` (unfocused) and `RiTeamFill` (focused) from Remix Icon
- Clicking Collaboration opens `/team` by default
- Uses consistent 3-pane layout pattern from Settings page

**Collaboration Layout (3-pane):**
- Left pane: Sub-navigation tabs for "Team" and "Coaches"
- Middle pane: Active content (TeamManagement component or Coaches component)
- Right pane: Contextual info/actions for the active section (if needed)

**Routes:**
- `/team` - Team management (based on existing TeamManagement.tsx)
- `/coaches` - Coaches management (based on existing CoachesTab.tsx)

**Settings Cleanup:**
- Teams category removed from Settings sidebar
- Coaches category removed from Settings sidebar
- Settings remains focused on: Account, Preferences, Integrations, Organization, Security

**Access Control:**
- `/team` requires TEAM or ADMIN role (maintains current TeamManagement behavior)
- `/coaches` available to all users (maintains current CoachesTab behavior)
- Users without TEAM/ADMIN role see only Coaches in Collaboration sub-nav

## Scope

**Applies to:**
- `src/components/ui/sidebar-nav.tsx` - Add Collaboration nav item
- `src/App.tsx` - Add new routes for `/team` and `/coaches`, add redirects
- `src/components/settings/SettingsCategoryPane.tsx` - Remove Teams and Coaches categories
- Create new `src/pages/CollaborationPage.tsx` - 3-pane layout wrapper
- Reuse `src/components/team/TeamManagement.tsx` - For Team tab content
- Reuse `src/components/settings/CoachesTab.tsx` - For Coaches tab content

**Does NOT apply to:**
- No changes to actual Teams or Coaches functionality
- No changes to role-based access control logic
- No changes to existing Settings categories (Account, Preferences, etc.)
- No visual/design changes to TeamManagement or CoachesTab components

## Decisions Made

**Route Structure:** Use simple top-level routes (`/team`, `/coaches`) rather than nested structure like `/collaboration/team`. This keeps URLs clean and follows the pattern of other main navigation items.

**Base Component:** Use `TeamManagement.tsx` (not `TeamTab.tsx`) as the Team page implementation because it's a richer, dedicated component already designed for standalone use.

**Icon Choice:** Use `RiTeamLine`/`RiTeamFill` for Collaboration nav item because it directly represents team/collaboration concepts and comes from the approved Remix Icon library.

**Layout Pattern:** Use 3-pane layout matching Settings page for consistency. Users familiar with Settings navigation will immediately understand the Collaboration navigation pattern.

**Settings Removal:** Completely remove Teams and Coaches from Settings rather than leaving redirects or placeholders. Settings should not reference moved features.

**Default Route:** `/team` is the default when clicking Collaboration nav item (alphabetically first, and likely more frequently accessed by admins).

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User without TEAM/ADMIN role visits `/team` | Redirect to `/coaches` with optional toast message explaining access restriction |
| Direct navigation to old `/settings/team` | Redirect to `/team` (permanent, no message needed) |
| Direct navigation to old `/settings/coaches` | Redirect to `/coaches` (permanent, no message needed) |
| Direct navigation to old `/team-management` | Redirect to `/team` (permanent, maintains backward compatibility) |
| User clicks Collaboration nav without role access | Opens `/coaches` directly (skips `/team` since they can't access it) |
| Empty state for Teams/Coaches | Maintain existing empty state handling from current components |

## Open Questions

None - all decisions have been made.

## Priority

**Must have:**
- Add Collaboration nav item to sidebar
- Create 3-pane CollaborationPage layout
- Add routes for `/team` and `/coaches`
- Remove Teams and Coaches from Settings categories
- Add redirects for old routes
- Maintain role-based access control

**Nice to have:**
- Breadcrumb showing "Collaboration > Team" or "Collaboration > Coaches" in page header
- Smooth transition animation when switching between Team/Coaches tabs
- Active state indication in Collaboration sub-nav tabs
