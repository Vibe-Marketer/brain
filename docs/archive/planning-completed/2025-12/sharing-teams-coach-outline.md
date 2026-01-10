## CallVault Sharing & Access System — Complete Specification

---

## Executive Summary

Three distinct sharing models, each solving different problems:

| Model | Use Case | Billing | Visibility Default | Data Ownership |
|-------|----------|---------|-------------------|----------------|
| **Single Call Share** | "Check out this call" | None (free) | One call only | Sharer owns |
| **Coach Access** | "Review my sales calls" | Separate accounts | Nothing until configured | Coachee owns |
| **Team Access** | "Our sales org" | Centralized | Manager sees direct reports | Member owns |

All three are additive. A user could:
- Share a single call with a prospect
- Have a coach reviewing their "Sales Calls" folder
- Be part of a company team where their manager sees their calls

No conflicts. Each system operates independently.

---

---

# Part 1: Single Call Sharing

---

## Purpose

Lightweight, frictionless sharing of individual calls. No relationships, no ongoing access, no complexity. Just "here's a call, take a look."

---

## How It Works

**Sharer generates link:**
1. Opens any call they own
2. Clicks "Share" button
3. System generates unique link: `callvault.ai/s/abc123xyz`
4. Optionally: Add recipient email for tracking
5. Copies link, sends via any channel (email, Slack, text, whatever)

**Recipient views call:**
1. Clicks link
2. Lands on signup/login page (account required)
3. Creates free account or logs in
4. Redirected to shared call view
5. Can view transcript, summary, speakers, play recording

**Access characteristics:**
- Read-only (cannot edit, delete, tag, or organize)
- Single call only (no access to sharer's other calls)
- Permanent until revoked (no expiration by default)
- Sharer can revoke anytime

---

## What's IN (Single Call MVP)

**For Sharer:**
- Generate shareable link for any owned call
- Optional: Specify recipient email (for tracking who accessed)
- View list of all shared links for a call
- Revoke any link instantly
- See access log (who viewed, when)

**For Recipient:**
- View transcript (full text)
- View AI-generated summary
- View speakers and invitees
- Play recording (if available)
- See call metadata (date, duration, platform)

**Access Requirements:**
- Account required to view (free tier sufficient)
- Email verification required
- Link is single-use per account (can't share your shared link with others)

---

## What's OUT (Single Call MVP)

- ❌ No expiring links (add later if needed)
- ❌ No password protection
- ❌ No download/export for recipient
- ❌ No commenting or notes
- ❌ No AI analysis by recipient
- ❌ No bulk sharing (one call at a time)
- ❌ No anonymous viewing (account required)

---

## Key Rules

**One link = one recipient**
- Each generated link is intended for one person
- If recipient shares the link, new person must create account
- Access log shows all accounts that used the link
- Sharer can revoke if link spreads unexpectedly

**Recipient cannot reshare**
- No "share" button on shared-with-me calls
- No ability to generate new links for someone else's call
- Only owner can create share links

**Relationship to other models**
- Single call share does NOT create coach relationship
- Single call share does NOT create team membership
- It's a one-off, isolated permission grant

**Fathom share_url is separate**
- `share_url` from Fathom remains untouched
- That's Fathom's public link (may not require account)
- CallVault sharing is internal, requires account, tracked

---

## Schema

```sql
call_share_links
├── id UUID PRIMARY KEY
├── call_recording_id UUID REFERENCES call_recordings(id)
├── created_by_user_id UUID REFERENCES auth.users(id)
├── share_token TEXT UNIQUE  -- the "abc123xyz" in the URL
├── recipient_email TEXT  -- optional, for tracking intent
├── status TEXT DEFAULT 'active'  -- 'active', 'revoked'
├── created_at TIMESTAMP
├── revoked_at TIMESTAMP

call_share_access_log
├── id UUID PRIMARY KEY
├── share_link_id UUID REFERENCES call_share_links(id)
├── accessed_by_user_id UUID REFERENCES auth.users(id)
├── accessed_at TIMESTAMP
├── ip_address TEXT  -- optional, for security
```

---

## User Stories

✅ "I want to share a great discovery call with a prospect so they can review what we discussed"

✅ "I want to share a call with my VA so they can transcribe action items"

✅ "I want to see who has accessed the calls I've shared"

✅ "I want to revoke access if I shared with the wrong person"

✅ "I want recipients to create an account so I know who's viewing"

---

---

# Part 2: Coach Access

---

## Purpose

Ongoing, delegated read access across organizational boundaries. Coachee owns their data and explicitly grants limited access to an external coach. Cross-organization, coachee-controlled, folder/tag-based granularity.

---

## The Two Invitation Flows

**Flow A: Coachee Invites Coach**
> "I want my coach to see my sales calls"

1. Coachee clicks "Invite Coach" in settings
2. Enters coach's email
3. System generates unique invite link
4. Coach receives email with link
5. Coach clicks link → signup/login with relationship pre-attached
6. Upon signup, coach sees coachee in their dashboard
7. Coachee configures what's shared (folders, tags, or all)
8. Coach sees shared calls once configured

**Flow B: Coach Invites Coachee**
> "Join my coaching program and share your calls with me"

1. Coach generates invite link from their dashboard
2. Shares link with coaching client (email, Slack, course platform)
3. Coachee clicks link → signup page
4. Coachee signs up (free or paid, their choice, their billing)
5. Relationship auto-created with coach
6. Coachee prompted to configure sharing
7. Coach sees coachee once sharing configured

---

## What's IN (Coach MVP)

**Relationships**
- One coach can have unlimited coachees
- One coachee can have multiple coaches
- Relationships explicit and visible to both parties
- Either party can end relationship

**Sharing Model**
- Folder-based: "Share everything in my 'Sales Calls' folder"
- Tag-based: "Share everything tagged 'For Review'"
- All calls: "Share everything" (opt-in, not default)
- Rules are additive (multiple folders/tags)
- New calls auto-shared if matching existing rules
- Rules evaluated at query time (move call out of folder = access revoked)

**Coach Capabilities**
- View shared call transcripts
- View summaries and metadata
- Play recordings
- Run their own AI agents against shared calls
- Leave private notes (visible only to coach)
- Filter/search across all coachees
- See calls grouped by coachee

**Coachee Capabilities**
- Full control over own calls
- Configure sharing rules per coach
- See "Shared with [Coach]" indicators
- Revoke access instantly
- Pause sharing (temporary, preserves relationship)

**Multi-Platform Support**
- Works regardless of source (Fathom, Zoom, PLAUD, uploads)
- Coach sees unified view
- Platform displayed as metadata

---

## What's OUT (Coach MVP)

**Billing/Monetization**
- ❌ Affiliate revenue tracking
- ❌ Coach-pays-for-coachee
- ❌ Revenue sharing

**Advanced Permissions**
- ❌ Download restrictions
- ❌ Per-call time limits
- ❌ View-only vs comment permissions

**Collaboration**
- ❌ Shared annotations
- ❌ Chat/messaging
- ❌ Assignment workflows

**Organization**
- ❌ Coach modifying coachee's folders/tags
- ❌ Coach reorganizing coachee's calls

---

## Key Rules

**Ownership**
- Coachee always owns their data
- Coach has read-only access
- Deleting call removes from coach view
- Coachee revokes access instantly, no approval

**Account Independence**
- Completely separate accounts
- Separate logins, billing, settings
- No sub-accounts or seats
- Coachee's plan determines their features

**Visibility Isolation**
- Coach A cannot see Coach B has access to same coachee
- Coachee sees all coach relationships
- Coaches cannot see each other's notes

**Default States**
- New relationship = nothing shared
- New calls = auto-shared if matching rules
- Relationship ended = immediate revocation

**Invite Links**
- Single-use per signup
- Expire after 30 days
- Clicking while logged in = add to existing account

---

## Sharing Granularity

| Share Type | How It Works |
|------------|--------------|
| Folder | All calls in folder shared, including future additions |
| Tag | All calls with tag shared, including future tags |
| All Calls | Everything shared (use sparingly) |
| Automatic | New calls matching rules auto-share |

**Example:**
```
Coachee: Andrew
Coach: Dan Henry

Sharing Rules:
├── Folder: "Sales Calls" → Shared
├── Tag: "Coaching Review" → Shared
└── Folder: "Personal Notes" → NOT shared

Andrew records new call:
├── Placed in "Sales Calls" → Dan sees it
├── Tagged "Coaching Review" → Dan sees it
├── Neither → Dan does NOT see it
└── Both → Dan sees it (deduplicated)
```

---

## Permission Matrix (Coach)

| Action | Coach Can Do? |
|--------|---------------|
| View transcript | ✅ |
| View summary | ✅ |
| View speakers/invitees | ✅ |
| Play recording | ✅ |
| Run AI analysis | ✅ (own agents) |
| Add private notes | ✅ |
| Download/export | ❌ |
| Edit title/summary | ❌ |
| Add to folders | ❌ |
| Delete calls | ❌ |
| Share with others | ❌ |

---

## Relationship States

```
PENDING   → Invited, hasn't signed up/accepted
ACTIVE    → Both confirmed, sharing enabled
PAUSED    → Coachee temporarily disabled (relationship intact)
REVOKED   → Coachee ended relationship
REMOVED   → Coach ended relationship
```

Only `ACTIVE` allows access. `PAUSED` for easy reactivation.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Coach signs up, coachee hasn't configured sharing | Coach sees coachee with "No shared calls" |
| Coachee deletes account | All relationships terminated |
| Coach deletes account | Relationships terminated, coachee data unaffected |
| Same call in two shared folders | Appears once (deduplicated) |
| Coachee removes call from shared folder | Coach loses access immediately |
| Coach invited but never signs up | Pending, link expires 30 days |

---

## Schema

```sql
coach_relationships
├── id UUID PRIMARY KEY
├── coach_user_id UUID REFERENCES auth.users(id)
├── coachee_user_id UUID REFERENCES auth.users(id)
├── status TEXT  -- 'pending', 'active', 'paused', 'revoked', 'removed'
├── invited_by TEXT  -- 'coach' or 'coachee'
├── invite_token TEXT UNIQUE  -- for pending invites
├── created_at TIMESTAMP
├── accepted_at TIMESTAMP
├── ended_at TIMESTAMP
├── UNIQUE(coach_user_id, coachee_user_id)

coach_shares
├── id UUID PRIMARY KEY
├── relationship_id UUID REFERENCES coach_relationships(id)
├── share_type TEXT  -- 'folder', 'tag', 'all_calls'
├── folder_id UUID REFERENCES folders(id)
├── tag_id UUID REFERENCES call_tags(id)
├── created_at TIMESTAMP
├── CHECK (
    (share_type = 'folder' AND folder_id IS NOT NULL) OR
    (share_type = 'tag' AND tag_id IS NOT NULL) OR
    (share_type = 'all_calls')
  )

coach_notes
├── id UUID PRIMARY KEY
├── relationship_id UUID REFERENCES coach_relationships(id)
├── call_recording_id UUID REFERENCES call_recordings(id)
├── note TEXT
├── created_at TIMESTAMP
├── updated_at TIMESTAMP
```

---

## User Stories

✅ "As a sales coach, I want to review clients' discovery calls without manual sharing"

✅ "As a coachee, I want to share only sales calls, not internal meetings"

✅ "As a coach with 50 clients, I want all their calls in one dashboard"

✅ "As a coachee, I want to stop sharing when our engagement ends"

✅ "As a coach, I want private notes on client calls"

✅ "As a coachee using Fathom and Zoom, I want my coach to see both"

---

---

# Part 3: Team Access

---

## Purpose

Organizational access within a company. Manager-controlled visibility following reporting hierarchy. Centralized billing, departmental boundaries respected, privacy by default with automatic manager visibility.

---

## Core Principle: Private by Default, Manager Visibility

Every team member's calls are **private to them** unless:
1. Their manager has automatic visibility (direct report relationship)
2. They explicitly share with specific teammates
3. Admin has opted into full visibility (optional, off by default)

---

## The Hierarchy Model

```
Team: Acme Corp
├── Jessica (Admin/Owner)
│   ├── Can see: Own calls + optionally all (if "admin sees all" enabled)
│   └── Manages: Department heads
│
├── Marcus (Sales Director)
│   ├── Can see: Own calls + all direct reports
│   ├── Reports to: Jessica
│   └── Manages: Sarah, Mike, Dana
│
├── Sarah (Sales Rep)
│   ├── Can see: Own calls only
│   └── Reports to: Marcus
│
├── Mike (Sales Rep)
│   ├── Can see: Own calls only
│   └── Reports to: Marcus
│
└── Rachel (Customer Success)
    ├── Can see: Own calls only
    └── Reports to: Jessica (different department)
```

**Marcus sees:** His calls + Sarah's + Mike's + Dana's

**Sarah sees:** Only her calls (unless someone shares with her)

**Jessica sees:** Her calls only (unless "admin sees all" enabled)

**Rachel sees:** Her calls only (Marcus can't see hers)

---

## Invitation Flow

**Manager Invites Direct Report:**
1. Manager clicks "Add Team Member"
2. Enters email address
3. Relationship: "Reports to me"
4. System sends invite
5. New member signs up → linked as direct report
6. Manager has immediate visibility

**Admin Invites Manager:**
1. Admin invites new manager
2. Sets role (Manager vs Member)
3. Manager joins with no direct reports
4. Manager invites their own team

**Peer Invite (No Automatic Visibility):**
1. Any member invites peer
2. Peer joins team
3. No automatic visibility
4. Manager relationship set separately

**Domain Auto-Join (Optional):**
1. Admin enables for verified domain
2. New user signs up with matching email
3. Prompted: "Join the Acme team?"
4. Accepts → added as member (no manager assigned)
5. Admin/manager assigns reporting relationship

---

## What's IN (Team MVP)

**Hierarchy Structure**
- Each member has zero or one manager
- Managers have unlimited direct reports
- Manager automatically sees all direct report calls
- Multi-level hierarchy (Director → Manager → Rep)
- Skip-level visibility follows chain

**Visibility Rules**
- Default: Private (only you see your calls)
- Manager relationship: Automatic read access to direct reports
- Explicit sharing: Share folders/tags with specific teammates
- Admin override: Optional "admin sees all" (off by default)

**Manager Capabilities**
- View all direct reports' calls
- Run AI agents on direct reports' calls
- Leave private notes (not visible to rep)
- See aggregated team view
- Cannot modify/delete direct reports' calls

**Member Capabilities**
- Full control over own calls
- Share specific folders/tags with teammates
- See who has access to their calls
- Cannot see peers unless explicitly shared

**Admin Capabilities**
- All manager capabilities
- Manage team billing
- Set team-wide defaults
- Enable/disable "admin sees all"
- Reassign reporting relationships
- Remove members
- Manage shared AI agents

**Explicit Peer Sharing**
- Any member shares folders/tags with specific teammates
- Same model as coach sharing
- Granular rules (folder, tag, or all)
- Read-only access
- Revocable anytime

**Shared Resources**
- Tags are team-wide (everyone sees same options)
- Folders are personal (your structure is yours)
- AI agents can be personal or team-shared
- Collaborative folders: Create, share with specific people

**Billing**
- Per-seat pricing
- Admin receives single invoice
- Adding members increases bill
- Removing members decreases at next cycle

---

## What's OUT (Team MVP)

**Complex Permissions**
- ❌ Custom roles beyond admin/manager/member
- ❌ Department-level visibility rules
- ❌ Project-based access groups

**Multi-Team**
- ❌ User in multiple teams
- ❌ Cross-team sharing

**Advanced Security**
- ❌ SSO/SAML
- ❌ IP allowlisting
- ❌ Audit logs
- ❌ Data retention policies

**Collaboration**
- ❌ @mentions
- ❌ Approval workflows
- ❌ Review queues

**Analytics**
- ❌ Per-member activity tracking
- ❌ Team performance dashboards

---

## Key Rules

**Ownership**
- Each person owns their own calls
- Manager visibility is read-only
- Leaving team = your calls stay with you
- Getting removed = admin chooses: delete or member keeps

**Hierarchy Changes**
- Change manager = old loses access, new gains access
- Promote to manager = gain visibility when directs assigned
- Demote to member = lose visibility into former directs

**Admin Override**
- "Admin sees all" is OFF by default
- When enabled, admin sees every call
- Should be disclosed to team
- Useful for small teams, problematic for large orgs

**Visibility Not Transitive**
- Manager sees direct reports
- Manager does NOT see direct reports' shared-with-them calls
- Hierarchy and peer sharing are separate systems

---

## Sharing Granularity (Team Peer Sharing)

Same as coach model:

| Share Type | How It Works |
|------------|--------------|
| Folder | All calls in folder, including future |
| Tag | All calls with tag, including future |
| All Calls | Everything (rarely appropriate for peers) |

**Example:**
```
Team: Acme Sales
Marcus manages Sarah and Mike

Peer Shares:
├── Sarah shared "Won Deals" folder with Mike
├── Mike shared "Objection Handling" tag with Sarah

What each sees:

Marcus:
├── His calls
├── Sarah's calls (manager)
├── Mike's calls (manager)

Sarah:
├── Her calls
├── Mike's "Objection Handling" tagged calls (peer share)

Mike:
├── His calls
├── Sarah's "Won Deals" folder calls (peer share)
```

---

## Permission Matrix (Team)

| Action | Member (Own) | Manager (Direct Report) | Peer (Shared) |
|--------|--------------|------------------------|---------------|
| View transcript | ✅ | ✅ | ✅ |
| View summary | ✅ | ✅ | ✅ |
| Play recording | ✅ | ✅ | ✅ |
| Run AI analysis | ✅ | ✅ | ✅ |
| Add private notes | ✅ | ✅ | ❌ |
| Download/export | ✅ | ❌ | ❌ |
| Edit title/summary | ✅ | ❌ | ❌ |
| Add to folders | ✅ | ❌ | ❌ |
| Delete calls | ✅ | ❌ | ❌ |
| Change sharing | ✅ | ❌ | ❌ |

---

## Membership States

```
PENDING     → Invited, hasn't signed up
ACTIVE      → Full team member
SUSPENDED   → Admin disabled (keeps seat, no access)
REMOVED     → No longer on team
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Last admin tries to leave | Blocked—must transfer admin first |
| Member leaves, has calls | Calls stay with member |
| Manager leaves | Direct reports need reassignment |
| Rep changes managers | Old loses access, new gains access |
| Peer sharing revoked | Immediate access loss |
| Circular hierarchy attempted | Blocked—tree structure enforced |
| Manager tries to share direct report's call | Cannot—only owner can share |
| Share with someone outside team | Not allowed |
| Domain auto-join + existing account | Prompted to join, keeps existing calls |

---

## Schema

```sql
teams
├── id UUID PRIMARY KEY
├── name TEXT
├── owner_id UUID REFERENCES auth.users(id)
├── admin_sees_all BOOLEAN DEFAULT false
├── domain_auto_join TEXT  -- e.g., 'acme.com'
├── created_at TIMESTAMP

team_memberships
├── id UUID PRIMARY KEY
├── team_id UUID REFERENCES teams(id)
├── user_id UUID REFERENCES auth.users(id)
├── role TEXT  -- 'admin', 'manager', 'member'
├── manager_membership_id UUID REFERENCES team_memberships(id)
├── status TEXT  -- 'pending', 'active', 'suspended', 'removed'
├── invite_token TEXT UNIQUE
├── invited_by_user_id UUID REFERENCES auth.users(id)
├── joined_at TIMESTAMP
├── UNIQUE(team_id, user_id)

team_shares  -- peer-to-peer within team
├── id UUID PRIMARY KEY
├── team_id UUID REFERENCES teams(id)
├── owner_user_id UUID REFERENCES auth.users(id)
├── recipient_user_id UUID REFERENCES auth.users(id)
├── share_type TEXT  -- 'folder', 'tag', 'all_calls'
├── folder_id UUID REFERENCES folders(id)
├── tag_id UUID REFERENCES call_tags(id)
├── created_at TIMESTAMP

manager_notes
├── id UUID PRIMARY KEY
├── manager_user_id UUID REFERENCES auth.users(id)
├── call_recording_id UUID REFERENCES call_recordings(id)
├── note TEXT
├── created_at TIMESTAMP
```

---

## User Stories

✅ "As a sales rep, I don't want teammates seeing my calls unless I share"

✅ "As a manager, I want to review my team's calls without asking each rep"

✅ "As a rep, I want to share a great call with a peer to learn from"

✅ "As a director, I want to see all calls from my managers and their teams"

✅ "As an admin, I want to control whether I have full visibility"

✅ "As Customer Success, I don't want Sales seeing my calls"

✅ "As a manager, I want private coaching notes on rep calls"

---

---

# Part 4: Answers to All Questions

---

## 1. Scope

**Answer: All three, layered**

| Model | When to Use |
|-------|-------------|
| Single Call Share | Quick, one-off sharing with anyone |
| Coach Access | Ongoing external relationship |
| Team Access | Internal organizational hierarchy |

They don't conflict. User can use all three simultaneously.

---

## 2. User Roles

**Answer: C) Both hierarchies supported**

```
Personal Account (base)
├── Can share single calls with anyone
├── Can have coaches (external)
└── Can be on a team (internal)

Team Structure:
├── Admin (billing, settings, optional "see all")
├── Manager (sees direct reports)
└── Member (sees own + explicit shares)

Coach Structure:
├── Coach (sees what coachee shares)
└── Coachee (controls what's shared)
```

---

## 3. Sharing Granularity

**Answer: All of the above**

| Granularity | Single Call | Coach | Team |
|-------------|-------------|-------|------|
| Individual calls | ✅ | ❌ (folder/tag only) | ❌ |
| Folders | ❌ | ✅ | ✅ (peer sharing) |
| Tags | ❌ | ✅ | ✅ (peer sharing) |
| Automatic (new calls) | ❌ | ✅ | ✅ |
| Search results | ❌ | ❌ | ❌ (future) |

Single call is one-off. Coach and team use folder/tag rules that auto-include future calls.

---

## 4. Permission Levels

**For Single Call Recipients:**
- ✅ View transcript
- ✅ View summary
- ✅ View speakers/invitees
- ✅ Play recording
- ❌ Add comments/notes
- ❌ Run AI analysis
- ❌ Download/export

**For Coaches:**
- ✅ View transcript
- ✅ View summary
- ✅ View speakers/invitees
- ✅ Play recording
- ✅ Add private notes (coach only sees)
- ✅ Run AI analysis (own agents)
- ❌ Download/export
- ❌ Edit anything

**For Team Members (on own calls):**
- ✅ Everything above +
- ✅ Edit title/summary
- ✅ Add to folders
- ✅ Delete calls
- ✅ Change sharing

**For Managers (on direct report calls):**
- ✅ View/play/analyze
- ✅ Add private notes
- ❌ Edit/delete/reorganize

**Privacy override:** Individual always owns right to privacy. Manager sees calls, but member can mark specific calls "private" to hide from manager (optional feature, consider for v2).

---

## 5. Invitation Mechanism

**Answer: Both A and B**

**Email Invitation (all models):**
- User enters email
- System sends invite link
- Recipient creates account or logs in
- Access granted after acceptance

**Link Sharing (single call only):**
- User generates shareable link
- Anyone with link can access
- **Account required to view** (yes, this is correct)
- Prevents anonymous access, enables tracking

**Organization-based (teams only):**
- Domain auto-join optional
- Users with @company.com auto-prompted to join team
- Still requires accepting prompt

---

## 6. Privacy Controls

**Answer: Folder/tag level is primary**

**Default behavior:**
- All calls private by default
- Coach sees nothing until coachee configures folder/tag rules
- Manager sees direct reports automatically (can be overridden)

**Per-call control:**
- Not MVP priority
- Folder/tag level is sufficient for 90% of cases
- Consider "hide from manager" toggle in v2 for sensitive 1:1s

**Recommendation:** Set sharing rules at folder/tag level. If someone needs granular control, they create a folder for shared stuff and keep sensitive calls elsewhere.

---

## 7. Existing Share URL

**Answer: Keep it separate**

- `share_url` from Fathom = Fathom's public link
- CallVault sharing = internal, tracked, account-required
- Two different systems, both valid
- Display both in UI: "Fathom Public Link" vs "Share in CallVault"

Future: Other integrations (Zoom, PLAUD) may have their own share URLs. CallVault sharing works regardless of source.

---

---

# Part 5: Complete Side-by-Side Comparison

| Aspect | Single Call | Coach | Team |
|--------|-------------|-------|------|
| **Purpose** | One-off share | Ongoing external | Internal org |
| **Relationship** | None | Cross-org | Within org |
| **Billing** | Free | Separate accounts | Centralized |
| **Visibility default** | One call only | Nothing until configured | Manager sees direct reports |
| **Sharing granularity** | Single call | Folder/tag | Manager auto + folder/tag peer |
| **Account required** | Yes | Yes | Yes |
| **Notes feature** | No | Coach notes | Manager notes |
| **Duration** | Until revoked | Until ended | Until leaves team |
| **Who controls** | Sharer | Coachee | Admin + individual |
| **Multi-platform** | N/A | Yes | Yes |

---

---

# Part 6: Implementation Priority

**Phase 1: Single Call Sharing**
- Lowest complexity
- Immediate value
- Foundation for "account required" pattern
- ~1-2 weeks

**Phase 2: Coach Access**
- Your immediate use case (coaching program)
- Cross-org sharing validated
- ~3-4 weeks

**Phase 3: Team Access**
- Highest complexity (hierarchy, billing)
- B2B feature
- ~4-6 weeks

---

## Database Schema (Complete)

```sql
-- ==========================================
-- SINGLE CALL SHARING
-- ==========================================

call_share_links
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── call_recording_id UUID NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE
├── created_by_user_id UUID NOT NULL REFERENCES auth.users(id)
├── share_token TEXT UNIQUE NOT NULL  -- URL token
├── recipient_email TEXT  -- optional tracking
├── status TEXT NOT NULL DEFAULT 'active'  -- 'active', 'revoked'
├── created_at TIMESTAMPTZ DEFAULT now()
├── revoked_at TIMESTAMPTZ

call_share_access_log
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── share_link_id UUID NOT NULL REFERENCES call_share_links(id) ON DELETE CASCADE
├── accessed_by_user_id UUID NOT NULL REFERENCES auth.users(id)
├── accessed_at TIMESTAMPTZ DEFAULT now()
├── ip_address TEXT

-- ==========================================
-- COACH ACCESS
-- ==========================================

coach_relationships
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── coach_user_id UUID NOT NULL REFERENCES auth.users(id)
├── coachee_user_id UUID NOT NULL REFERENCES auth.users(id)
├── status TEXT NOT NULL DEFAULT 'pending'  -- 'pending', 'active', 'paused', 'revoked', 'removed'
├── invited_by TEXT NOT NULL  -- 'coach', 'coachee'
├── invite_token TEXT UNIQUE
├── invite_expires_at TIMESTAMPTZ
├── created_at TIMESTAMPTZ DEFAULT now()
├── accepted_at TIMESTAMPTZ
├── ended_at TIMESTAMPTZ
├── UNIQUE(coach_user_id, coachee_user_id)
├── CHECK(coach_user_id != coachee_user_id)

coach_shares
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── relationship_id UUID NOT NULL REFERENCES coach_relationships(id) ON DELETE CASCADE
├── share_type TEXT NOT NULL  -- 'folder', 'tag', 'all_calls'
├── folder_id UUID REFERENCES folders(id) ON DELETE CASCADE
├── tag_id UUID REFERENCES call_tags(id) ON DELETE CASCADE
├── created_at TIMESTAMPTZ DEFAULT now()
├── CHECK (
    (share_type = 'folder' AND folder_id IS NOT NULL AND tag_id IS NULL) OR
    (share_type = 'tag' AND tag_id IS NOT NULL AND folder_id IS NULL) OR
    (share_type = 'all_calls' AND folder_id IS NULL AND tag_id IS NULL)
  )

coach_notes
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── relationship_id UUID NOT NULL REFERENCES coach_relationships(id) ON DELETE CASCADE
├── call_recording_id UUID NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE
├── note TEXT NOT NULL
├── created_at TIMESTAMPTZ DEFAULT now()
├── updated_at TIMESTAMPTZ DEFAULT now()
├── UNIQUE(relationship_id, call_recording_id)

-- ==========================================
-- TEAM ACCESS
-- ==========================================

teams
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── name TEXT NOT NULL
├── owner_user_id UUID NOT NULL REFERENCES auth.users(id)
├── admin_sees_all BOOLEAN NOT NULL DEFAULT false
├── domain_auto_join TEXT  -- e.g., 'acme.com'
├── created_at TIMESTAMPTZ DEFAULT now()
├── updated_at TIMESTAMPTZ DEFAULT now()

team_memberships
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE
├── user_id UUID NOT NULL REFERENCES auth.users(id)
├── role TEXT NOT NULL DEFAULT 'member'  -- 'admin', 'manager', 'member'
├── manager_membership_id UUID REFERENCES team_memberships(id)
├── status TEXT NOT NULL DEFAULT 'pending'  -- 'pending', 'active', 'suspended', 'removed'
├── invite_token TEXT UNIQUE
├── invite_expires_at TIMESTAMPTZ
├── invited_by_user_id UUID REFERENCES auth.users(id)
├── created_at TIMESTAMPTZ DEFAULT now()
├── joined_at TIMESTAMPTZ
├── UNIQUE(team_id, user_id)
├── CHECK(manager_membership_id != id)  -- can't be own manager

team_shares  -- peer-to-peer within team
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE
├── owner_user_id UUID NOT NULL REFERENCES auth.users(id)
├── recipient_user_id UUID NOT NULL REFERENCES auth.users(id)
├── share_type TEXT NOT NULL  -- 'folder', 'tag', 'all_calls'
├── folder_id UUID REFERENCES folders(id) ON DELETE CASCADE
├── tag_id UUID REFERENCES call_tags(id) ON DELETE CASCADE
├── created_at TIMESTAMPTZ DEFAULT now()
├── CHECK(owner_user_id != recipient_user_id)
├── CHECK (
    (share_type = 'folder' AND folder_id IS NOT NULL AND tag_id IS NULL) OR
    (share_type = 'tag' AND tag_id IS NOT NULL AND folder_id IS NULL) OR
    (share_type = 'all_calls' AND folder_id IS NULL AND tag_id IS NULL)
  )

manager_notes
├── id UUID PRIMARY KEY DEFAULT gen_random_uuid()
├── manager_user_id UUID NOT NULL REFERENCES auth.users(id)
├── call_recording_id UUID NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE
├── note TEXT NOT NULL
├── created_at TIMESTAMPTZ DEFAULT now()
├── updated_at TIMESTAMPTZ DEFAULT now()
├── UNIQUE(manager_user_id, call_recording_id)

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_call_share_links_token ON call_share_links(share_token);
CREATE INDEX idx_call_share_links_call ON call_share_links(call_recording_id);
CREATE INDEX idx_coach_relationships_coach ON coach_relationships(coach_user_id, status);
CREATE INDEX idx_coach_relationships_coachee ON coach_relationships(coachee_user_id, status);
CREATE INDEX idx_coach_shares_relationship ON coach_shares(relationship_id);
CREATE INDEX idx_team_memberships_team ON team_memberships(team_id, status);
CREATE INDEX idx_team_memberships_user ON team_memberships(user_id, status);
CREATE INDEX idx_team_memberships_manager ON team_memberships(manager_membership_id);
```

---

This specification is complete. All three models defined, all questions answered, schema ready for implementation.