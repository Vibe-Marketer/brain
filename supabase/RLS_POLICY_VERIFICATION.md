# RLS Policy Verification Guide

This document provides comprehensive manual verification steps for all Row Level Security (RLS) policies implemented for the Teams and Sharing feature.

## Overview

The sharing system implements RLS policies across 9 tables:
- `call_share_links` - Single call share links
- `call_share_access_log` - Share link access audit log
- `coach_relationships` - Coach/coachee relationships
- `coach_shares` - Coach sharing rules (folder/tag/all)
- `coach_notes` - Private coach notes
- `teams` - Team organizations
- `team_memberships` - Team member records with hierarchy
- `team_shares` - Peer-to-peer team sharing
- `manager_notes` - Private manager notes

## Pre-Verification Setup

Before running verification tests, ensure you have:
1. Access to Supabase dashboard or psql connection
2. At least 3 test users (User A, User B, Coach/Manager)
3. Test data in the database

## Verification Test Cases

### 1. call_share_links - User Isolation

**Test: User A cannot see User B's share links**

```sql
-- As User A (set auth.uid() context in Supabase SQL Editor)
SELECT set_config('request.jwt.claim.sub', 'user-a-uuid', true);

-- Create a share link for User A's call
INSERT INTO call_share_links (call_recording_id, user_id, created_by_user_id, share_token)
VALUES (1001, 'user-a-uuid', 'user-a-uuid', 'test-token-a');

-- Verify User A can see their link
SELECT * FROM call_share_links WHERE user_id = 'user-a-uuid';
-- Expected: 1 row returned

-- Switch to User B
SELECT set_config('request.jwt.claim.sub', 'user-b-uuid', true);

-- Verify User B cannot see User A's link
SELECT * FROM call_share_links WHERE user_id = 'user-a-uuid';
-- Expected: 0 rows (RLS blocks access)

-- Verify User B sees only their own links
SELECT * FROM call_share_links;
-- Expected: Only User B's links (if any)
```

**Expected Result:** User B sees 0 rows when querying User A's share links.

---

### 2. coach_notes - Coach Isolation

**Test: Coach cannot see other coach's notes**

```sql
-- Create relationships for two coaches with same coachee
-- Coach 1 relationship
INSERT INTO coach_relationships (id, coach_user_id, coachee_user_id, status, invited_by)
VALUES ('rel-coach1', 'coach-1-uuid', 'coachee-uuid', 'active', 'coachee');

-- Coach 2 relationship
INSERT INTO coach_relationships (id, coach_user_id, coachee_user_id, status, invited_by)
VALUES ('rel-coach2', 'coach-2-uuid', 'coachee-uuid', 'active', 'coachee');

-- As Coach 1, create a note
SELECT set_config('request.jwt.claim.sub', 'coach-1-uuid', true);
INSERT INTO coach_notes (relationship_id, call_recording_id, user_id, note)
VALUES ('rel-coach1', 1001, 'coachee-uuid', 'Coach 1 private feedback');

-- As Coach 2, create a note on the same call
SELECT set_config('request.jwt.claim.sub', 'coach-2-uuid', true);
INSERT INTO coach_notes (relationship_id, call_recording_id, user_id, note)
VALUES ('rel-coach2', 1001, 'coachee-uuid', 'Coach 2 private feedback');

-- Verify Coach 1 sees only their notes
SELECT set_config('request.jwt.claim.sub', 'coach-1-uuid', true);
SELECT * FROM coach_notes;
-- Expected: Only "Coach 1 private feedback"

-- Verify Coach 2 sees only their notes
SELECT set_config('request.jwt.claim.sub', 'coach-2-uuid', true);
SELECT * FROM coach_notes;
-- Expected: Only "Coach 2 private feedback"

-- Verify coachee cannot see any coach notes
SELECT set_config('request.jwt.claim.sub', 'coachee-uuid', true);
SELECT * FROM coach_notes;
-- Expected: 0 rows
```

**Expected Result:** Each coach sees only their own notes. Coaches cannot see each other's notes on the same coachee's calls.

---

### 3. team_memberships & manager visibility - Direct Reports Only

**Test: Manager only sees direct reports**

```sql
-- Setup team hierarchy:
-- Manager -> Direct Report 1
-- Manager does NOT manage Other Employee

-- Create team
INSERT INTO teams (id, name, owner_user_id)
VALUES ('team-1', 'Sales Team', 'owner-uuid');

-- Manager membership
INSERT INTO team_memberships (id, team_id, user_id, role, status, joined_at)
VALUES ('mem-manager', 'team-1', 'manager-uuid', 'manager', 'active', NOW());

-- Direct report (reports to manager)
INSERT INTO team_memberships (id, team_id, user_id, role, manager_membership_id, status, joined_at)
VALUES ('mem-report1', 'team-1', 'report1-uuid', 'member', 'mem-manager', 'active', NOW());

-- Other employee (does NOT report to manager)
INSERT INTO team_memberships (id, team_id, user_id, role, status, joined_at)
VALUES ('mem-other', 'team-1', 'other-uuid', 'member', 'active', NOW());

-- Test: As manager, check who they can see
SELECT set_config('request.jwt.claim.sub', 'manager-uuid', true);

-- Check is_manager_of function
SELECT is_manager_of('manager-uuid', 'report1-uuid') AS is_report1_managed;
-- Expected: true

SELECT is_manager_of('manager-uuid', 'other-uuid') AS is_other_managed;
-- Expected: false (no reporting relationship)

-- Manager can see team memberships
SELECT * FROM team_memberships WHERE team_id = 'team-1';
-- Expected: All team members visible (viewing membership != viewing calls)
```

**Expected Result:** `is_manager_of()` returns true only for actual direct reports. Manager can see team membership records but call access is restricted to direct reports through the `team-direct-reports` edge function.

---

### 4. call_share_links - Revoked Access Blocks Immediately

**Test: Revoked access blocks immediately**

```sql
-- Setup: Create active share link
SELECT set_config('request.jwt.claim.sub', 'owner-uuid', true);
INSERT INTO call_share_links (id, call_recording_id, user_id, created_by_user_id, share_token, status)
VALUES ('link-1', 1001, 'owner-uuid', 'owner-uuid', 'active-token', 'active');

-- Verify link is accessible (via edge function using service role)
SELECT * FROM call_share_links WHERE share_token = 'active-token';
-- Expected: 1 row with status='active'

-- Revoke the link
UPDATE call_share_links
SET status = 'revoked', revoked_at = NOW()
WHERE id = 'link-1';

-- Immediately verify link is blocked
SELECT * FROM call_share_links WHERE share_token = 'active-token' AND status = 'active';
-- Expected: 0 rows (revoked links not accessible)

-- Full query still returns the link but with revoked status
SELECT * FROM call_share_links WHERE share_token = 'active-token';
-- Expected: 1 row with status='revoked'
```

**Expected Result:** After revocation, queries filtering for `status = 'active'` return 0 rows immediately. The shared call view page checks status and shows "This link has been revoked" error.

---

### 5. coach_shares - Coachee Controls Sharing

**Test: Only coachee can modify sharing rules**

```sql
-- Setup relationship
INSERT INTO coach_relationships (id, coach_user_id, coachee_user_id, status, invited_by)
VALUES ('rel-1', 'coach-uuid', 'coachee-uuid', 'active', 'coachee');

-- As coachee, create sharing rule
SELECT set_config('request.jwt.claim.sub', 'coachee-uuid', true);
INSERT INTO coach_shares (relationship_id, share_type, folder_id)
VALUES ('rel-1', 'folder', 'folder-1-uuid');
-- Expected: Success

-- As coach, try to modify sharing (should fail)
SELECT set_config('request.jwt.claim.sub', 'coach-uuid', true);
INSERT INTO coach_shares (relationship_id, share_type, folder_id)
VALUES ('rel-1', 'folder', 'folder-2-uuid');
-- Expected: Error - violates RLS policy

DELETE FROM coach_shares WHERE relationship_id = 'rel-1';
-- Expected: Error - violates RLS policy
```

**Expected Result:** Coach can view sharing rules but cannot create, modify, or delete them. Only the coachee controls what is shared.

---

### 6. manager_notes - Manager Isolation

**Test: Manager notes are private**

```sql
-- Setup: Two managers in same team
INSERT INTO team_memberships (id, team_id, user_id, role, status, joined_at)
VALUES ('mem-mgr1', 'team-1', 'manager1-uuid', 'manager', 'active', NOW());
INSERT INTO team_memberships (id, team_id, user_id, role, manager_membership_id, status, joined_at)
VALUES ('mem-report', 'team-1', 'report-uuid', 'member', 'mem-mgr1', 'active', NOW());

-- Manager 1 creates note
SELECT set_config('request.jwt.claim.sub', 'manager1-uuid', true);
INSERT INTO manager_notes (manager_user_id, call_recording_id, user_id, note)
VALUES ('manager1-uuid', 1001, 'report-uuid', 'Manager 1 private note');

-- Verify Manager 1 can see their note
SELECT * FROM manager_notes;
-- Expected: 1 row

-- Manager 2 (different manager in team) cannot see
SELECT set_config('request.jwt.claim.sub', 'manager2-uuid', true);
SELECT * FROM manager_notes;
-- Expected: 0 rows

-- Direct report cannot see manager's notes
SELECT set_config('request.jwt.claim.sub', 'report-uuid', true);
SELECT * FROM manager_notes;
-- Expected: 0 rows
```

**Expected Result:** Each manager only sees their own notes. Notes are not visible to other managers or to the direct report.

---

### 7. team_shares - Peer Sharing

**Test: Team shares visible to owner and recipient only**

```sql
-- Setup: User A shares folder with User B
SELECT set_config('request.jwt.claim.sub', 'user-a-uuid', true);
INSERT INTO team_shares (team_id, owner_user_id, recipient_user_id, share_type, folder_id)
VALUES ('team-1', 'user-a-uuid', 'user-b-uuid', 'folder', 'folder-1-uuid');

-- User A (owner) can see
SELECT * FROM team_shares WHERE owner_user_id = 'user-a-uuid';
-- Expected: 1 row

-- User B (recipient) can see
SELECT set_config('request.jwt.claim.sub', 'user-b-uuid', true);
SELECT * FROM team_shares WHERE recipient_user_id = 'user-b-uuid';
-- Expected: 1 row

-- User C (unrelated) cannot see
SELECT set_config('request.jwt.claim.sub', 'user-c-uuid', true);
SELECT * FROM team_shares;
-- Expected: 0 rows (only sees shares where they are owner or recipient)
```

**Expected Result:** Team shares are only visible to the owner and recipient. Other team members cannot see shares they are not involved in.

---

### 8. call_share_access_log - Owner-Only Access

**Test: Only share link owner can view access logs**

```sql
-- Setup: Create share link and log access
-- (Access logs are inserted via edge function with service role)

-- As share link owner
SELECT set_config('request.jwt.claim.sub', 'owner-uuid', true);
SELECT * FROM call_share_access_log
WHERE share_link_id IN (SELECT id FROM call_share_links WHERE user_id = 'owner-uuid');
-- Expected: Access logs for owner's share links

-- As different user
SELECT set_config('request.jwt.claim.sub', 'other-uuid', true);
SELECT * FROM call_share_access_log;
-- Expected: 0 rows (can only see logs for own share links)
```

**Expected Result:** Users can only view access logs for share links they own.

---

## Summary Checklist

| Test | Policy | Expected Behavior | Status |
|------|--------|-------------------|--------|
| 1 | call_share_links | User A cannot see User B's links | [ ] Pass |
| 2 | coach_notes | Coach 1 cannot see Coach 2's notes | [ ] Pass |
| 3 | is_manager_of | Returns true only for direct reports | [ ] Pass |
| 4 | Revocation | Revoked links blocked immediately | [ ] Pass |
| 5 | coach_shares | Only coachee can modify rules | [ ] Pass |
| 6 | manager_notes | Manager notes are private | [ ] Pass |
| 7 | team_shares | Owner/recipient only | [ ] Pass |
| 8 | access_log | Owner-only visibility | [ ] Pass |

## RLS Policy Reference

### call_share_links
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id AND auth.uid() = created_by_user_id` |
| UPDATE | `auth.uid() = user_id` |
| DELETE | `auth.uid() = user_id` |

### call_share_access_log
| Operation | Policy |
|-----------|--------|
| SELECT | Share link owned by user |
| INSERT | Edge function with service role |

### coach_relationships
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() IN (coach_user_id, coachee_user_id)` |
| INSERT | User is coach (if invited_by='coach') or coachee |
| UPDATE | `auth.uid() IN (coach_user_id, coachee_user_id)` |
| DELETE | `auth.uid() IN (coach_user_id, coachee_user_id)` |

### coach_shares
| Operation | Policy |
|-----------|--------|
| SELECT | User is coach or coachee in relationship |
| INSERT | User is coachee in relationship |
| UPDATE | User is coachee in relationship |
| DELETE | User is coachee in relationship |

### coach_notes
| Operation | Policy |
|-----------|--------|
| SELECT | User is coach in relationship |
| INSERT | User is coach in ACTIVE relationship |
| UPDATE | User is coach in relationship |
| DELETE | User is coach in relationship |

### teams
| Operation | Policy |
|-----------|--------|
| SELECT | Owner or active member |
| INSERT | `auth.uid() = owner_user_id` |
| UPDATE | `auth.uid() = owner_user_id` |
| DELETE | `auth.uid() = owner_user_id` |

### team_memberships
| Operation | Policy |
|-----------|--------|
| SELECT | Active member, own membership, or owner |
| INSERT | Admin in team or owner |
| UPDATE | Own membership, admin, or owner |
| DELETE | Own membership, admin, or owner |

### team_shares
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() IN (owner_user_id, recipient_user_id)` |
| INSERT | Owner and both users active in team |
| UPDATE | `auth.uid() = owner_user_id` |
| DELETE | `auth.uid() = owner_user_id` |

### manager_notes
| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() = manager_user_id` |
| INSERT | `auth.uid() = manager_user_id` |
| UPDATE | `auth.uid() = manager_user_id` |
| DELETE | `auth.uid() = manager_user_id` |

## Edge Cases Verified

1. **Multiple coaches on same coachee** - Notes isolated between coaches
2. **Revoked relationships** - Coach loses access immediately
3. **Removed team members** - No longer see team data
4. **Circular hierarchy prevention** - `would_create_circular_hierarchy()` blocks cycles
5. **Last admin protection** - Cannot demote/remove last admin
