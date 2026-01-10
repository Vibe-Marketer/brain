# SPEC: Teams and Coaches Functionality

## What

Wire up the existing Teams and Coaches UI to actually work. Currently the UI components exist but don't connect to the backend properly. This implementation will:

1. Fix invite generation to create working copy-paste links (with Resend email marked "Coming Soon")
2. Create dedicated join pages that accept invite tokens and create relationships
3. Implement call visibility filtering based on three access patterns: manager→reports, coach→shared, peer→shared
4. Wire up sharing rules configuration to actually filter calls based on folder/tag settings
5. Connect all UI components to Edge Functions following existing patterns

**Files involved:**
- `/src/components/settings/TeamsTab.tsx` - Invite generation UI
- `/src/components/settings/CoachesTab.tsx` - Invite generation UI
- `/src/hooks/use-teams.ts` - Team relationship hooks
- `/src/hooks/use-coaches.ts` - Coach relationship hooks
- `/src/pages/team/join/[token].tsx` (NEW) - Team invite acceptance
- `/src/pages/coach/join/[token].tsx` (NEW) - Coach invite acceptance
- `/supabase/functions/create-team-invite/index.ts` - Generates invite tokens
- `/supabase/functions/create-coach-invite/index.ts` - Generates invite tokens
- `/supabase/functions/accept-team-invite/index.ts` - Processes team joins
- `/supabase/functions/accept-coach-invite/index.ts` - Processes coach joins
- `/supabase/functions/fetch-meetings/index.ts` - Add call visibility filtering
- Database tables: `team_relationships`, `coach_relationships`, `team_invites`, `coach_invites`, `call_sharing_rules`

## Why

The Teams and Coaches feature is half-built. The UI exists but doesn't connect to the backend. Users cannot currently invite teammates or coaches, cannot accept invitations, and cannot see filtered calls based on relationships. This implementation completes the core workflows to make the feature functional.

## User Experience

### Inviting a Teammate

1. User navigates to Settings → Teams tab
2. Clicks "Invite Teammate" button
3. Modal opens with two invite options:
   - **Copy Link** button (working, generates `https://app.callvaultai.com/team/join/abc123xyz`)
   - **Send Email** button (grayed out with "Coming Soon" tooltip)
4. User clicks "Copy Link", sees success toast: "Invite link copied to clipboard"
5. User pastes link to teammate via Slack/email/etc.

### Accepting a Team Invite

1. Invited user clicks link `https://app.callvaultai.com/team/join/abc123xyz`
2. If not logged in → redirected to login, then back to join page
3. Join page shows:
   - "You've been invited to join [Manager Name]'s team"
   - "As a team member, [Manager Name] will automatically see all your calls"
   - "Accept Invitation" button
4. User clicks "Accept Invitation"
5. Edge Function validates token, creates `team_relationships` record
6. User redirected to `/calls` with success toast: "You've joined [Manager Name]'s team"

### Inviting a Coach

1. User navigates to Settings → Coaches tab
2. Clicks "Invite Coach" button
3. Modal opens with same pattern (Copy Link working, Send Email coming soon)
4. User copies link like `https://app.callvaultai.com/coach/join/def456uvw`

### Accepting a Coach Invite

1. Invited coach clicks link
2. Join page shows:
   - "You've been invited to coach [User Name]"
   - "You'll see calls they explicitly share with you based on folders or tags"
   - "Accept Invitation" button
3. Coach accepts, `coach_relationships` record created
4. Coach redirected to `/calls` with success toast: "You're now coaching [User Name]"

### Call Visibility - Manager View

1. Manager opens Calls page
2. Default view shows ONLY their own calls
3. Dropdown filter shows: "My Calls | [Report 1] | [Report 2] | All Team Calls"
4. Manager selects a report → sees ALL of that report's calls automatically
5. Manager selects "All Team Calls" → sees merged view of all reports' calls

### Call Visibility - Coach View

1. Coach opens Calls page
2. Default view shows ONLY calls explicitly shared with them
3. Filter shows: "Shared with Me | [Coachee 1] | [Coachee 2]"
4. Coach selects a coachee → sees ONLY that coachee's calls matching sharing rules (folder/tag based)
5. Calls not matching sharing rules are invisible to coach

### Call Visibility - Peer Sharing

1. User opens Settings → Teams → [teammate name] → Configure Sharing
2. Modal shows:
   - "Choose what to share with [Teammate]:"
   - Folder selector (multi-select): "Share all calls in these folders"
   - Tag selector (multi-select): "Share all calls with these tags"
   - "Share nothing" option (default)
3. User selects "Sales Calls" folder and "Demo" tag
4. Clicks "Save Sharing Rules"
5. Teammate can now see user's calls that are EITHER in "Sales Calls" folder OR tagged "Demo"

### Sharing Rules Configuration (Coach)

Same pattern as peer sharing:
1. User opens Settings → Coaches → [coach name] → Configure Sharing
2. Selects folders/tags to share
3. Coach sees only matching calls

## Scope

### Applies to:

**Core invite workflows:**
- `/src/components/settings/TeamsTab.tsx` - Wire "Invite Teammate" button
- `/src/components/settings/CoachesTab.tsx` - Wire "Invite Coach" button
- `/src/hooks/use-teams.ts` - Add `generateTeamInvite()` function
- `/src/hooks/use-coaches.ts` - Add `generateCoachInvite()` function

**Join pages (NEW):**
- `/src/pages/team/join/[token].tsx` - Team invite acceptance flow
- `/src/pages/coach/join/[token].tsx` - Coach invite acceptance flow

**Call visibility filtering:**
- `/src/hooks/use-meetings-sync.ts` - Add relationship-based filtering
- `/supabase/functions/fetch-meetings/index.ts` - Implement access control logic
- `/src/components/calls/CallsPage.tsx` - Add relationship filter dropdown

**Sharing rules:**
- `/src/components/settings/TeamsTab.tsx` - Wire "Configure Sharing" button
- `/src/components/settings/CoachesTab.tsx` - Wire "Configure Sharing" button
- `/src/hooks/use-teams.ts` - Add `updateSharingRules()` function
- `/src/hooks/use-coaches.ts` - Add `updateSharingRules()` function

### Does NOT apply to:

- Email invitations via Resend (v2 feature - show "Coming Soon" in UI)
- Bulk operations (invite multiple people at once)
- Advanced permissions (read-only vs edit access)
- Notification system for new shared calls
- Team/coach analytics or reporting
- Revoking invitations after sent
- Expiring invite tokens (keep simple for v1)

## Decisions Made

### Invite Generation

**Copy-paste links are the MVP:**
- "Invite Teammate" button opens modal with "Copy Link" button (working)
- "Send Email" button shown but grayed out with tooltip: "Coming soon - email invitations"
- Link format: `https://app.callvaultai.com/team/join/{token}` or `/coach/join/{token}`
- Token generated by Edge Functions, stored in `team_invites`/`coach_invites` tables
- No expiration for v1 (keep simple)

### Join Pages

**Dedicated routes with authentication:**
- Team invites: `/team/join/[token]` dynamic route
- Coach invites: `/coach/join/[token]` dynamic route
- Both require authentication (redirect to login if needed, preserve token in URL)
- Show inviter name, relationship type, and what access they'll have
- Single "Accept Invitation" button calls Edge Function
- On success: create relationship record, redirect to `/calls`, show success toast
- On error: show error message in-page (token invalid, already accepted, etc.)

### Call Visibility Architecture

**Three access patterns with different rules:**

1. **Manager → Reports (Automatic Full Access)**
   - Query: `SELECT * FROM meetings WHERE user_id IN (SELECT report_id FROM team_relationships WHERE manager_id = current_user)`
   - No sharing rules needed - managers see EVERYTHING from reports
   - Filter UI: Dropdown to toggle between "My Calls", individual reports, or "All Team Calls"

2. **Coach → Coachees (Rule-Based Access)**
   - Query: `SELECT * FROM meetings WHERE user_id IN (SELECT coachee_id FROM coach_relationships WHERE coach_id = current_user) AND (folder_id IN sharing_rules OR tags && sharing_rules)`
   - Requires `call_sharing_rules` records configured by coachee
   - Filter UI: "Shared with Me" dropdown showing only coachees who have shared calls

3. **Peer → Peer (Rule-Based Access)**
   - Query: `SELECT * FROM meetings WHERE user_id IN (SELECT peer_id FROM team_relationships WHERE user_id = current_user AND relationship_type = 'peer') AND (folder_id IN sharing_rules OR tags && sharing_rules)`
   - Same rule-based pattern as coaches
   - Filter UI: Similar dropdown for peers with sharing rules

**Implementation approach:**
- Add `relationship_filter` parameter to `/supabase/functions/fetch-meetings/index.ts`
- Values: `own`, `manager-view-{user_id}`, `coach-view-{user_id}`, `peer-view-{user_id}`
- Edge Function applies appropriate SQL filtering based on relationship type
- Frontend dropdown triggers re-fetch with new filter parameter

### Sharing Rules Configuration

**Unified modal pattern:**
- Both TeamsTab and CoachesTab use same "Configure Sharing" modal component
- Modal shows:
  - Folder multi-select (fetches user's folders)
  - Tag multi-select (fetches user's tags)
  - "Share nothing" radio option (default, clears all rules)
- Saves to `call_sharing_rules` table:
  ```sql
  {
    user_id: uuid,           -- person sharing their calls
    shared_with_id: uuid,    -- coach or peer receiving access
    relationship_type: enum, -- 'coach' or 'peer'
    folder_ids: uuid[],      -- array of folder IDs
    tag_ids: uuid[],         -- array of tag IDs
  }
  ```
- OR logic: Call shown if it matches ANY folder OR ANY tag in the rule

### Edge Function Integration

**Follow existing patterns:**
- Hook functions (in `use-teams.ts`, `use-coaches.ts`) call Edge Functions via `fetch()`
- Edge Functions handle all database operations (no direct Supabase client in frontend)
- Return standardized responses: `{ success: boolean, data?: any, error?: string }`
- Frontend hooks use React Query for caching/invalidation where appropriate

### UI Components

**Use existing patterns:**
- Modal: Use existing `<Dialog>` component from shadcn/ui
- Buttons: Follow brand guidelines (Primary for "Accept", Hollow for "Cancel")
- Dropdowns: Use existing `<Select>` component for relationship filters
- Multi-select: Use existing tag/folder selector patterns from other components
- Toasts: Use existing toast system for success/error messages

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User accepts invite they already accepted | Show error: "You've already joined this team/coach relationship" |
| Token is invalid or doesn't exist | Show error: "This invitation link is invalid or has expired" |
| User tries to invite themselves | Edge Function rejects with error: "You cannot invite yourself" |
| Manager removes report while viewing their calls | Filter automatically switches back to "My Calls", show info toast |
| User updates sharing rules to exclude all folders/tags | Coach/peer sees zero calls from that user (expected behavior) |
| User deletes a folder that's in sharing rules | Sharing rule auto-updates to remove that folder ID (cascade delete) |
| Coach tries to view calls with no sharing rules set | Empty state: "No calls shared with you yet. Ask [Coachee] to configure sharing." |
| User navigates to join page while logged out | Redirect to login with `?redirect=/team/join/{token}` parameter, then back after auth |
| Report leaves team (deletes relationship) | Manager no longer sees their calls, filter dropdown updates |
| User has both coach AND peer relationship with same person | Two separate sharing rule configs (coach rules vs peer rules can differ) |

## Open Questions

None - all decisions made.

## Priority

### Must have (Core functionality):

- Invite link generation (copy-paste working)
- Join pages for team and coach invites
- Token validation and relationship creation
- Manager auto-access to all report calls
- Sharing rules configuration UI
- Call filtering based on relationships and rules
- Basic error handling for invalid tokens

### Nice to have (If time permits):

- Better empty states for "no shared calls" scenarios
- Relationship management UI polish (better loading states)
- Inline editing of sharing rules from relationship list
- Bulk sharing rule updates (apply same rules to multiple people)

---

**Implementation Note:** This spec focuses on wiring up existing UI to backend logic. Most components already exist but don't call the right functions or handle responses properly. The work is primarily integration, not net-new UI development.
