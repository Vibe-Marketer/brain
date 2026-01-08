# SPEC: Sharing & Access Control System (Three-Model Architecture)

## What

Implement a comprehensive three-tier sharing system enabling users to share calls across different contexts: one-off sharing with anyone, ongoing coach relationships, and organizational team hierarchies. Each model operates independently and solves distinct use cases without conflict.

**Three sharing models:**
1. **Single Call Share** - Lightweight one-off sharing via shareable links
2. **Coach Access** - Cross-organization ongoing relationships with folder/tag-based granular sharing
3. **Team Access** - Internal organizational hierarchy with manager visibility and peer collaboration

**Database tables added:**
- `call_share_links` - Single call share tokens
- `call_share_access_log` - Track who accessed shared calls
- `coach_relationships` - Coach/coachee connections
- `coach_shares` - Folder/tag-based sharing rules for coaches
- `coach_notes` - Private coach notes on coachee calls
- `teams` - Organization definitions
- `team_memberships` - Org membership and reporting hierarchy
- `team_shares` - Peer-to-peer sharing within teams
- `manager_notes` - Private manager notes on direct report calls

**Files affected (estimated):**
- Database migrations: `supabase/migrations/YYYYMMDD_create_sharing_tables.sql`
- API client: `src/lib/api-client.ts` - Share management functions
- Types: `src/types/sharing.ts` - TypeScript interfaces
- Components (new):
  - `src/components/sharing/ShareCallDialog.tsx` - Single call sharing UI
  - `src/components/sharing/CoachInviteDialog.tsx` - Coach invitation flow
  - `src/components/sharing/TeamInviteDialog.tsx` - Team invitation flow
  - `src/components/sharing/ShareSettingsPanel.tsx` - Configure sharing rules
  - `src/components/sharing/AccessLogViewer.tsx` - View who accessed shared content
  - `src/components/sharing/SharedWithIndicator.tsx` - Badge showing sharing status
- Components (modified):
  - `src/components/call-detail/CallDetailHeader.tsx` - Add share button
  - `src/components/transcript-library/TranscriptTable.tsx` - Show sharing indicators
  - `src/components/settings/UsersTab.tsx` - Team management integration
- Pages (new):
  - `src/pages/SharedWithMe.tsx` - View calls shared with current user
  - `src/pages/CoachDashboard.tsx` - Coach view of all coachees
  - `src/pages/TeamManagement.tsx` - Team admin settings
- Hooks (new):
  - `src/hooks/useSharing.ts` - Share management hook
  - `src/hooks/useCoachRelationships.ts` - Coach relationship management
  - `src/hooks/useTeamHierarchy.ts` - Team structure queries

## Why

**Business drivers:**
- **Monetization opportunity** - Team access enables B2B/Enterprise pricing tier with per-seat billing
- **Coaching program support** - Critical for user's coaching business (Dan Henry style) where clients need to share calls for review
- **Sales team use case** - Managers need visibility into direct reports' calls for coaching and quality assurance
- **Collaboration** - Enable peer learning by sharing great calls with colleagues
- **Viral growth** - Single call sharing introduces prospects to the platform

**Current limitations:**
- Users can only share via Fathom's public `share_url` (no tracking, no granular control)
- No way to grant ongoing access to a coach or manager
- No organizational structure for companies
- No visibility into who has accessed shared content
- Cannot restrict sharing to specific folders or tags

**User pain points:**
- "I want my coach to see all my sales calls automatically" - Not possible today
- "I need my manager to review my calls without me manually sharing each one" - No solution
- "I want to share a great discovery call with a teammate to learn from" - Only via external Fathom link
- "I want to see who viewed the calls I shared" - No access logs exist

## User Experience

### Model 1: Single Call Share

**Primary flow - Sharer creates link:**
1. User opens any call they own
2. Clicks "Share" button (new button in [CallDetailHeader.tsx](src/components/call-detail/CallDetailHeader.tsx))
3. Dialog opens: "Share this call"
4. Optionally enters recipient email (for tracking purposes)
5. System generates unique token: `callvault.ai/s/abc123xyz`
6. Link copied to clipboard automatically
7. "Link copied!" toast confirmation
8. User sends link via any channel (email, Slack, text)

**Secondary flow - Recipient accesses call:**
1. Recipient clicks link `callvault.ai/s/abc123xyz`
2. If logged out → Redirected to signup/login page with share token preserved
3. After authentication → Redirected to shared call view (read-only)
4. Access logged in `call_share_access_log` table
5. Recipient sees full transcript, summary, speakers, can play recording
6. No edit, delete, tag, or reorganize capabilities (read-only)

**Management flow - View and revoke:**
1. Sharer returns to call detail page
2. Sees "Shared with 3 people" indicator
3. Clicks to expand access log
4. Table shows: Email, Accessed at, IP (optional)
5. "Revoke" button next to each access entry
6. Click revoke → Status changes to 'revoked', access immediately blocked
7. Confirmation: "Access revoked for john@example.com"

**Visual indicators:**
- Share button in call header (next to EDIT button)
- Badge on call in transcript table: "Shared" with count (e.g., "Shared · 3")
- Access log expandable section in call detail view
- Color: Subtle blue/gray for shared indicator (not vibe orange)

### Model 2: Coach Access

**Flow A: Coachee invites coach:**
1. Coachee goes to Settings → "Coaches" tab (new)
2. Clicks "Invite Coach"
3. Dialog: Enter coach's email
4. Optional: Add personal message
5. System sends email to coach with invite link
6. Coach clicks link → Signup/login with relationship pre-attached
7. Relationship status: `PENDING` until coach accepts
8. Coach accepts → Status changes to `ACTIVE`
9. Coachee configures what's shared (see below)

**Flow B: Coach invites coachee:**
1. Coach goes to Settings → "My Coaching Clients" (new)
2. Clicks "Invite Client"
3. System generates shareable invite link
4. Coach copies link, sends to client (email, course platform, Slack)
5. Client clicks link → Signup page
6. Client creates account (free or paid, their choice)
7. Relationship auto-created with status `ACTIVE`
8. Client prompted to configure sharing immediately

**Configuration flow - Set sharing rules:**
1. After relationship established, coachee sees "Configure Sharing" prompt
2. Opens sharing settings for that specific coach
3. Three options:
   - **Share by Folder**: Checkboxes for each folder (e.g., "Sales Calls", "Client Meetings")
   - **Share by Tag**: Checkboxes for each tag (e.g., "For Review", "Great Examples")
   - **Share All Calls**: Toggle (use sparingly, confirm with warning)
4. Rules are additive: Check multiple folders + tags
5. Save → Coach immediately sees matching calls
6. New calls auto-shared if they match rules (real-time evaluation)

**Coach view:**
1. Coach logs in → Sees "Coaching Dashboard" (new page)
2. Left sidebar: List of all coachees with call counts
3. Main view: Table of all calls from all coachees (unified view)
4. Filters: By coachee, by date, by duration, by tags
5. Columns: Title, Coachee Name, Date, Duration, Tags, Actions
6. Click call → Opens read-only call detail view
7. Can add private notes (visible only to coach)
8. Can run AI analysis using their own agents
9. Cannot edit, delete, or reorganize coachee's calls

**Privacy controls:**
1. Coachee sees "Shared with [Coach Name]" badge on shared calls
2. Can pause sharing (temporary, preserves relationship)
3. Can revoke relationship (immediate access loss)
4. Moving call out of shared folder = access revoked immediately
5. Deleting call = removed from coach view

**Visual indicators:**
- "Coaches" tab in Settings sidebar
- Badge on calls: "Shared with Coach" in blue/purple
- Relationship status indicator (Active, Paused, Pending)
- Coach dashboard shows coachee list with call counts

### Model 3: Team Access

**Setup flow - Admin creates team:**
1. User goes to Settings → "Team" tab (new)
2. Clicks "Create Team"
3. Dialog: Enter team name (e.g., "Acme Sales")
4. Optional: Enable "Admin sees all calls" (off by default, show warning)
5. Optional: Enable domain auto-join (e.g., "@acme.com")
6. Team created, user becomes admin/owner

**Invitation flow - Manager invites direct report:**
1. Manager clicks "Add Team Member"
2. Enters email address
3. Selects relationship: "This person reports to me"
4. System sends invite email
5. New member clicks link → Signup/login
6. Relationship established: Member → Manager
7. Manager immediately has read access to all member's calls (automatic)

**Invitation flow - Peer invite (no hierarchy):**
1. Any member invites peer
2. Enters email, no "reports to" selection
3. Peer joins team
4. No automatic visibility (private by default)
5. Manager relationship set separately by admin/manager

**Hierarchy setup:**
1. Admin goes to "Team Management" page
2. Tree view shows org structure:
   ```
   Acme Corp
   ├── Jessica (Admin/Owner)
   │   ├── Marcus (Sales Director)
   │   │   ├── Sarah (Sales Rep)
   │   │   └── Mike (Sales Rep)
   │   └── Rachel (Customer Success)
   ```
3. Drag-and-drop to reassign reporting relationships
4. Change triggers immediate access updates

**Manager view:**
1. Manager sees "Team" filter in main transcript table
2. Toggle "Show Direct Reports" (on by default for managers)
3. Table shows: Own calls + All direct report calls
4. Clear visual distinction: "From: [Rep Name]" in subtitle
5. Can filter by specific direct report
6. Can run AI analysis on direct report calls
7. Can add private manager notes (not visible to rep)
8. Cannot edit, delete, or reorganize direct report calls

**Peer sharing flow:**
1. Any member can share specific folders/tags with specific teammates
2. Same model as coach sharing (folder/tag rules)
3. Opens "Share with Team Member" dialog
4. Select recipient from team member dropdown
5. Select folders/tags to share
6. Recipient sees "Shared by [Teammate]" indicator
7. Read-only access, can revoke anytime

**Privacy controls:**
1. Default: All calls private (only you see them)
2. Exception: Manager sees direct reports automatically
3. Future: "Hide from manager" toggle for sensitive 1:1s (v2 feature)
4. Peer shares are explicit and revocable
5. Admin override: "Admin sees all" must be explicitly enabled

**Visual indicators:**
- "Team" tab in Settings sidebar
- Team member list with org chart visualization
- Badge on calls: "Visible to Manager" in gray, "Shared with Peer" in blue
- Filter toggle: "My Calls" vs "Team Calls" vs "Direct Reports"
- Hierarchical tree view in team management page

### Cross-Model Indicators

**Call table columns (updated):**
- New column: "Shared With" (shows icons/badges)
  - 🔗 Single call share (with count)
  - 👨‍🏫 Coach access
  - 👥 Team visibility (manager or peer)

**Call detail page (updated):**
- Sharing section below call metadata
- Expandable sections:
  - "Shared Links (3)" - Access log for single call shares
  - "Coaches with Access (1)" - List of coaches who can see this
  - "Team Members with Access (2)" - Manager + peer shares
- "Share" button in header opens dialog with all three options

### Edge Cases & Error Handling

**Single call share:**
- Link clicked while logged in → Open call directly (no re-auth)
- Link revoked → Show "This link has been revoked" error page
- Call deleted → Shared link shows "Call no longer available"
- Multiple people use same link → All logged in access log

**Coach access:**
- Coach invited but never signs up → Status stays `PENDING`, expires in 30 days
- Coachee deletes account → All relationships terminated, coach loses access
- Coach deletes account → Relationships removed, coachee data unaffected
- Same call matches multiple rules (folder + tag) → Deduplicated, appears once
- Coachee pauses sharing → Status changes to `PAUSED`, coach sees "Sharing paused by [Name]"

**Team access:**
- Last admin tries to leave → Blocked with error: "Transfer admin role first"
- Member leaves team → Calls stay with member, managers lose access
- Manager changes → Old manager loses access, new manager gains access (immediate)
- Circular hierarchy attempted → Blocked: "Cannot create circular reporting structure"
- Manager tries to share direct report's call → Blocked: "Only call owner can share"
- Member invited to multiple teams → Not allowed in MVP, show error

### Accessibility

**Keyboard navigation:**
- Tab through sharing dialog fields (email, folder checkboxes, buttons)
- Arrow keys to navigate relationship lists
- Enter to confirm sharing, Escape to cancel
- Focus indicators on all interactive elements (2px vibe orange ring)

**Screen reader support:**
- Share button: "Share this call with others"
- Sharing indicators: "This call is shared with 3 people and your coach"
- Relationship status: "Coaching relationship with Dan Henry - Active"
- Access log entries: "Accessed by john@example.com on January 8th at 2:30 PM"
- Revoke button: "Revoke access for john@example.com"

**ARIA attributes:**
- `role="dialog"` on all modals
- `aria-label` on icon-only buttons
- `aria-expanded` on collapsible sections
- `aria-describedby` for form field hints

## Scope

### Phase 1: Single Call Share (MVP - 1-2 weeks)

**✅ In scope:**
- Generate shareable links with unique tokens
- Account-required viewing (free tier sufficient)
- Access logging (who, when, IP)
- Revocation capability
- Basic UI: Share button, dialog, access log viewer

**❌ Out of scope:**
- Expiring links (add later if needed)
- Password protection
- Anonymous viewing (account always required)
- Bulk sharing (one call at a time)
- Download/export for recipients
- Commenting or notes by recipients
- AI analysis by recipients

### Phase 2: Coach Access (MVP - 3-4 weeks)

**✅ In scope:**
- Bidirectional invitation flow (coach invites coachee, coachee invites coach)
- Relationship states (pending, active, paused, revoked, removed)
- Folder-based sharing rules
- Tag-based sharing rules
- "Share all calls" option (with confirmation)
- Automatic sharing of new calls matching rules
- Coach dashboard (unified view of all coachees)
- Private coach notes (visible only to coach)
- Coach can run AI agents on shared calls
- Real-time access evaluation (move out of folder = access revoked)
- Email invitations with 30-day expiry
- Multi-coach support (coachee can have multiple coaches)
- Multi-coachee support (coach can have unlimited coachees)

**❌ Out of scope:**
- Affiliate revenue tracking / monetization
- Coach-pays-for-coachee billing model
- Shared annotations (collaborative notes)
- Chat/messaging between coach and coachee
- Assignment workflows ("review this call by Friday")
- Coach modifying coachee's folders/tags
- Download restrictions (may add later)
- Per-call time-limited access
- View-only vs. comment permission levels

### Phase 3: Team Access (Full Feature - 4-6 weeks)

**✅ In scope:**
- Team creation by any user (becomes admin)
- Email invitation system for team members
- Role system: Admin, Manager, Member
- Reporting hierarchy (manager_membership_id FK)
- Manager sees direct reports automatically (read-only)
- Multi-level hierarchy support (Director → Manager → Rep)
- Peer-to-peer sharing (folder/tag rules, same as coach model)
- Private manager notes (not visible to direct report)
- Admin toggle: "Admin sees all" (off by default)
- Domain auto-join (optional, for verified domains)
- Per-seat billing integration (admin receives invoice)
- Team member management UI (add, remove, reassign)
- Org chart visualization (tree view)
- Shared tags across team (everyone sees same tag options)
- Personal folders (your structure stays private)
- Explicit ownership retention (leaving team = keep your calls)

**❌ Out of scope:**
- Custom roles beyond admin/manager/member (e.g., "Viewer", "Analyst")
- Department-level visibility rules (all teams are flat with hierarchy)
- Project-based access groups
- User in multiple teams (one team per user in MVP)
- Cross-team sharing
- SSO/SAML integration (Enterprise feature, later)
- IP allowlisting / advanced security
- Comprehensive audit logs (basic access logs only)
- Data retention policies
- @mentions in notes
- Approval workflows / review queues
- Per-member activity tracking dashboards
- Team performance analytics (may add later)

### Database Changes

**New tables (all models):**
```sql
-- Single Call Share
call_share_links (id, call_recording_id, created_by_user_id, share_token, recipient_email, status, created_at, revoked_at)
call_share_access_log (id, share_link_id, accessed_by_user_id, accessed_at, ip_address)

-- Coach Access
coach_relationships (id, coach_user_id, coachee_user_id, status, invited_by, invite_token, invite_expires_at, created_at, accepted_at, ended_at)
coach_shares (id, relationship_id, share_type, folder_id, tag_id, created_at)
coach_notes (id, relationship_id, call_recording_id, note, created_at, updated_at)

-- Team Access
teams (id, name, owner_user_id, admin_sees_all, domain_auto_join, created_at, updated_at)
team_memberships (id, team_id, user_id, role, manager_membership_id, status, invite_token, invite_expires_at, invited_by_user_id, created_at, joined_at)
team_shares (id, team_id, owner_user_id, recipient_user_id, share_type, folder_id, tag_id, created_at)
manager_notes (id, manager_user_id, call_recording_id, note, created_at, updated_at)
```

**Indexes required:**
```sql
CREATE INDEX idx_call_share_links_token ON call_share_links(share_token);
CREATE INDEX idx_call_share_links_call ON call_share_links(call_recording_id);
CREATE INDEX idx_coach_relationships_coach ON coach_relationships(coach_user_id, status);
CREATE INDEX idx_coach_relationships_coachee ON coach_relationships(coachee_user_id, status);
CREATE INDEX idx_coach_shares_relationship ON coach_shares(relationship_id);
CREATE INDEX idx_team_memberships_team ON team_memberships(team_id, status);
CREATE INDEX idx_team_memberships_user ON team_memberships(user_id, status);
CREATE INDEX idx_team_memberships_manager ON team_memberships(manager_membership_id);
```

**Row-Level Security (RLS) policies:**
- `call_share_links`: Owner can manage, anyone with active token can read
- `coach_relationships`: Both parties can view, either can end
- `coach_shares`: Coachee can manage, coach can read
- `coach_notes`: Only coach can read/write their notes
- `teams`: Members can view, admins can modify
- `team_memberships`: Members can view own, admins can manage all
- `team_shares`: Owner can manage, recipient can view
- `manager_notes`: Only manager can read/write their notes

**Existing tables - no changes required:**
- `fathom_calls` - No new columns needed (join via relationships)
- `folders` - Already supports multi-user via `assigned_by` (teams-ready)
- `call_tags` - No changes needed

### API Endpoints (Supabase Edge Functions)

**New endpoints:**
```typescript
// Single Call Share
POST   /share-call                    // Create share link
GET    /share-call/:token             // Fetch shared call by token
DELETE /share-call/:id                // Revoke share link
GET    /share-call/:id/access-log     // Get access log

// Coach Access
POST   /coach-relationships           // Create relationship (invite)
GET    /coach-relationships           // List all relationships for current user
PATCH  /coach-relationships/:id       // Update status (pause, revoke)
DELETE /coach-relationships/:id       // End relationship
POST   /coach-shares                  // Add sharing rule
DELETE /coach-shares/:id              // Remove sharing rule
GET    /coach/coachees                // Get all coachees (coach view)
GET    /coach/shared-calls            // Get all shared calls for coach
POST   /coach-notes                   // Create/update note
GET    /coach-notes/:call_id          // Get notes for call

// Team Access
POST   /teams                         // Create team
GET    /teams/:id                     // Get team details
PATCH  /teams/:id                     // Update team settings
DELETE /teams/:id                     // Delete team
POST   /team-memberships              // Invite member
PATCH  /team-memberships/:id          // Update member (role, manager)
DELETE /team-memberships/:id          // Remove member
GET    /team-memberships/:team_id     // Get all members (org chart)
GET    /team/direct-reports           // Get direct report calls (manager view)
POST   /team-shares                   // Create peer share
DELETE /team-shares/:id               // Remove peer share
POST   /manager-notes                 // Create/update note
GET    /manager-notes/:call_id        // Get notes for call
```

### Frontend Components

**New components:**
```
src/components/sharing/
├── ShareCallDialog.tsx              // Single call share modal
├── ShareSettingsPanel.tsx           // Configure coach/team sharing rules
├── CoachInviteDialog.tsx            // Invite coach flow
├── CoacheeInviteDialog.tsx          // Invite coachee flow (coach-side)
├── TeamInviteDialog.tsx             // Invite team member flow
├── AccessLogViewer.tsx              // View who accessed shared content
├── SharedWithIndicator.tsx          // Badge/pill showing sharing status
├── RelationshipCard.tsx             // Display single coach/team relationship
├── RelationshipList.tsx             // List of all relationships
├── SharingRulesForm.tsx             // Folder/tag selection for sharing
└── OrgChartView.tsx                 // Team hierarchy visualization
```

**Modified components:**
```
src/components/call-detail/CallDetailHeader.tsx
  → Add "Share" button next to Edit button
  → Opens ShareCallDialog with all three options

src/components/transcript-library/TranscriptTable.tsx
  → Add "Shared With" column
  → Show indicators: shared links, coach access, team visibility

src/components/settings/UsersTab.tsx
  → Integrate with team_memberships table
  → Show org chart for team admins

src/components/Layout.tsx
  → Add "Team" and "Coaches" to settings navigation (if applicable)
```

**New pages:**
```
src/pages/SharedWithMe.tsx           // View all calls shared with current user
src/pages/CoachDashboard.tsx         // Coach view of all coachees' calls
src/pages/TeamManagement.tsx         // Team admin management page
src/pages/SharedCallView.tsx         // Public-ish view for shared call links
```

**New hooks:**
```typescript
// src/hooks/useSharing.ts
export function useSharing(callId: string) {
  // Create/revoke share links
  // Get access logs
  // Check sharing status
}

// src/hooks/useCoachRelationships.ts
export function useCoachRelationships() {
  // List all relationships (coach or coachee)
  // Invite/accept/end relationships
  // Configure sharing rules
  // Get shared calls for coach view
}

// src/hooks/useTeamHierarchy.ts
export function useTeamHierarchy(teamId: string) {
  // Get org chart structure
  // Manage team memberships
  // Handle reporting relationships
  // Get direct report calls for manager
}

// src/hooks/useAccessControl.ts
export function useAccessControl(callId: string) {
  // Check if current user can access call
  // Determine access level (owner, coach, manager, peer)
  // Get all people with access to this call
}
```

### Brand Guidelines Compliance

**Colors:**
- Sharing indicators: Subtle blue/gray (not vibe orange)
- Active relationships: Green checkmark with `text-cb-ink-muted`
- Pending invites: Yellow/amber with `text-cb-ink-muted`
- Revoked access: Red with `text-cb-ink-muted`
- Share buttons: Use `variant="hollow"` (white/bordered)

**Typography:**
- Dialog titles: Montserrat Extra Bold, ALL CAPS, 18px
- Relationship names: Inter Medium (500), 14px
- Access log entries: Inter Light (300), 12px
- Status badges: Inter Medium (500), 11px uppercase

**Icons:**
- All from Remix Icon library (`@remixicon/react`)
- Share: `RiShareLine` / `RiShareFill`
- Coach: `RiUserStarLine` / `RiUserStarFill`
- Team: `RiTeamLine` / `RiTeamFill`
- Access log: `RiEyeLine` / `RiEyeFill`
- Manager: `RiUserSettingsLine` / `RiUserSettingsFill`
- Size: 16px (`h-4 w-4`) for inline/buttons

**Buttons:**
- Primary actions (Share, Invite): `variant="default"` (slate gradient)
- Secondary actions (Cancel, Close): `variant="hollow"` (white/bordered)
- Destructive actions (Revoke, Remove): `variant="destructive"` (red gradient)

**Spacing:**
- Dialog padding: `p-6` (24px)
- Form field gaps: `gap-4` (16px)
- Button groups: `gap-2` (8px)
- List items: `gap-3` (12px)

### Data Validation & Security

**Share tokens:**
- Length: 32 characters, URL-safe (base64url)
- Collision prevention: Check uniqueness before insert
- Expiration: No expiry by default (revocable)
- Rate limiting: Max 10 share links per call, max 50 per user per day

**Invite tokens:**
- Length: 32 characters, URL-safe
- Expiry: 30 days from creation
- Single-use: Consumed on acceptance
- Rate limiting: Max 100 invites per user per month

**Email validation:**
- RFC 5322 compliant
- Domain verification (MX record check) - Optional, don't block on failure
- No disposable email domains (reject if on blacklist)

**Access control checks:**
- Every query must verify user has access (RLS enforced)
- Manager relationship validated before showing direct report calls
- Coach relationship must be `ACTIVE` to see shared calls
- Team membership must be `ACTIVE` to see team content

**Privacy safeguards:**
- Coach A cannot see Coach B has access to same coachee
- Managers cannot see each other's private notes
- Peer shares within team are isolated (A shares with B ≠ B sees A's other shares)
- Admin override (`admin_sees_all`) must be explicitly enabled, show warning

### Testing Requirements

**Unit tests:**
- Share token generation (uniqueness, format)
- Access control logic (who can see what)
- Relationship state transitions (pending → active → revoked)
- Sharing rule evaluation (folder + tag matching)
- Hierarchy traversal (multi-level manager access)

**Integration tests:**
- Full invitation flow (send email → click link → accept → access granted)
- Revocation flow (owner revokes → recipient loses access immediately)
- Moving call out of shared folder → coach/peer loses access
- Manager change → old loses access, new gains access
- Team deletion → all relationships terminated

**E2E tests:**
- User A shares call → User B receives link → B logs in → B views call
- Coachee invites coach → Coach accepts → Coachee configures sharing → Coach sees calls
- Admin creates team → Invites manager → Manager invites rep → Manager sees rep's calls
- Member shares folder with peer → Peer sees calls in that folder

**Performance tests:**
- Coach with 50 coachees, 1000+ total calls (query performance)
- Manager with 20 direct reports (org chart rendering)
- User with 100 shared links (access log loading)
- Complex sharing rules (10 folders + 15 tags shared)

### Migration Strategy

**Phase 1 launch:**
- Deploy database migrations (all tables)
- Deploy API endpoints (all functions)
- Feature flag: `ENABLE_SHARING_V1` = true
- Rollout: 10% → 50% → 100% over 1 week
- Monitoring: Track error rates, query performance, invitation acceptance rates

**Data migration:**
- No existing data migration needed (new tables only)
- Existing `share_url` field remains untouched (Fathom's link)
- Users explicitly opt-in to new sharing features

**Rollback plan:**
- Feature flag off → UI hidden, API endpoints return 503
- Database tables remain (no data loss)
- Can re-enable without data migration

### Monitoring & Analytics

**Key metrics:**
- Share link creation rate (calls shared per day)
- Access log entry rate (how many people view shared calls)
- Coach relationship acceptance rate (invites sent → accepted)
- Team creation rate (new teams per week)
- Average team size (members per team)
- Sharing rule complexity (folders + tags per relationship)
- Manager utilization (managers actively viewing direct report calls)

**Error tracking:**
- Failed invitations (email delivery issues)
- Invalid share tokens (404 rate on /s/:token)
- Unauthorized access attempts (403 rate)
- RLS policy violations (Postgres errors)
- Circular hierarchy prevention triggers

**Performance monitoring:**
- Query latency for coach dashboard (target: <500ms)
- Query latency for team direct reports view (target: <1s)
- Org chart rendering time (target: <200ms for 100 members)
- Share link resolution time (target: <100ms)

### Success Criteria

**Phase 1 (Single Call Share):**
- ✅ 50+ users create share links in first week
- ✅ Share link creation → access rate >30% (30% of shared links get clicked)
- ✅ No unauthorized access incidents (RLS working)
- ✅ <0.5% error rate on share link resolution

**Phase 2 (Coach Access):**
- ✅ 20+ coach relationships established in first month
- ✅ Coach invitation acceptance rate >60%
- ✅ Average 3+ folders/tags shared per relationship
- ✅ Coaches actively viewing coachee calls (>1x per week)

**Phase 3 (Team Access):**
- ✅ 5+ teams created in first month
- ✅ Average team size >5 members
- ✅ Managers viewing direct report calls daily
- ✅ Peer sharing used by >40% of team members

**Business goals:**
- Enable B2B sales conversations (teams feature)
- Support user's coaching program launch (coach access)
- Increase viral coefficient (single call share → signups)

## Implementation Notes

### Phasing Recommendation

**Week 1-2: Single Call Share**
1. Database migrations (call_share_links, call_share_access_log)
2. API endpoints (create, revoke, access log)
3. ShareCallDialog component
4. Share button in CallDetailHeader
5. AccessLogViewer component
6. SharedCallView page (public access)
7. RLS policies
8. Email templates (share notification)
9. Testing (unit, integration, E2E)

**Week 3-6: Coach Access**
1. Database migrations (coach_relationships, coach_shares, coach_notes)
2. API endpoints (invite, accept, configure, view)
3. CoachInviteDialog + CoacheeInviteDialog components
4. ShareSettingsPanel component (folder/tag rules)
5. CoachDashboard page
6. SharedWithMe page
7. Relationship status indicators
8. Private notes UI
9. RLS policies
10. Email templates (coach invitations)
11. Testing

**Week 7-12: Team Access**
1. Database migrations (teams, team_memberships, team_shares, manager_notes)
2. API endpoints (create team, manage members, hierarchy)
3. TeamInviteDialog component
4. TeamManagement page
5. OrgChartView component
6. Manager direct reports view
7. Peer sharing UI
8. Admin controls (admin_sees_all toggle)
9. Billing integration (per-seat)
10. RLS policies
11. Email templates (team invitations)
12. Testing

### Technical Decisions

**Why separate tables for each model:**
- Clean separation of concerns (no polymorphic relationships)
- Simpler RLS policies (specific to each context)
- Easier to query (no complex joins across unrelated models)
- Independent evolution (change coach model without affecting teams)

**Why folder/tag rules instead of per-call:**
- Reduces manual work (automatic sharing of new calls)
- More intuitive UX (share a category, not 100 individual calls)
- Scalable (10 rules vs. 1000 per-call grants)
- Easier to revoke (delete rule = bulk revocation)

**Why account required for all sharing:**
- Enables access tracking (who viewed, when)
- Prevents anonymous abuse
- Builds user base (shared calls = signup opportunity)
- Consistent security model (all access audited)

**Why no download/export in MVP:**
- Reduces data leakage risk (keep calls within platform)
- Simpler permission model (view-only)
- Can add later with granular controls if needed

**Why separate notes tables (coach_notes, manager_notes):**
- Privacy isolation (coaches can't see each other's notes)
- Efficient queries (index on user_id + call_id)
- Clear ownership (only note author can read/write)

### Fathom Integration

**Existing `share_url` field:**
- Remains unchanged (Fathom's public link)
- No conflict with CallVault sharing
- Users can use both: Fathom link for external, CallVault for internal

**Display in UI:**
- Show both options: "Fathom Public Link" + "Share in CallVault"
- Clarify difference: Public vs. Account-required
- Separate buttons in CallDetailHeader

**Future integrations:**
- Zoom, PLAUD, uploads may not have `share_url`
- CallVault sharing works regardless of source
- Universal solution for all call types

### Open Questions

1. **Billing integration for teams:**
   - Use existing Stripe subscription system?
   - Add per-seat pricing tier?
   - How to handle mid-cycle additions/removals?

2. **Email delivery service:**
   - Use Supabase Auth email (limited styling)?
   - Integrate Resend/SendGrid for branded emails?
   - Template system for invitations?

3. **Coach monetization (future):**
   - Affiliate tracking (coach gets credit for coachee signups)?
   - Revenue sharing (coach gets % of coachee subscription)?
   - White-label options for coaches?

4. **Privacy compliance:**
   - GDPR considerations (consent for sharing)?
   - Data export for shared content (must include shared-with-me)?
   - Right to be forgotten (what happens to coach notes)?

5. **Manager override controls:**
   - Should reps have "hide from manager" toggle?
   - Should admins be able to see hidden calls?
   - Compliance vs. privacy balance?

## Related Documentation

- [Teams Feature Specification](../planning/teams-feature-specification.md) - Original teams planning doc
- [API Naming Conventions](../architecture/api-naming-conventions.md) - Naming standards for new endpoints
- [Brand Guidelines v4.1](../design/brand-guidelines-v4.1.md) - Design system compliance
- [Database Schema](../../supabase/migrations/00000000000000_consolidated_schema.sql) - Current schema
- [Folder Architecture](../../supabase/migrations/20251201000002_create_folders_tables.sql) - Teams-ready folder system

---

**Status:** Specification complete, ready for implementation
**Priority:** High (Phase 1), Medium (Phase 2), Medium (Phase 3)
**Estimated effort:** 12-14 weeks total (2 + 4 + 6-8 weeks)
**Dependencies:** Existing user authentication, call storage, folder/tag system
