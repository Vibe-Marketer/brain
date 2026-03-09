-- =============================================================================
-- RLS PERMISSIONS TEST QUERIES
-- =============================================================================
-- Purpose: Verify the full permission model works correctly across org and
--          workspace levels. Run these queries as individual users (set local
--          auth.uid()) or via psql with set_config('request.jwt.claims', ...).
--
-- Issue: #97
-- Date: 2026-03-10
--
-- HOW TO USE:
--   Replace UUIDs in SET statements with real user/workspace/org IDs from
--   your database. Run the queries within a transaction that sets auth.uid()
--   to simulate different users. Use ROLLBACK after each block.
--
-- SETUP: Run the schema below once to create test fixtures, then run each
--        test case individually.
-- =============================================================================

-- =============================================================================
-- SCHEMA: Create test fixtures (run once in a test environment only)
-- =============================================================================
/*
DO $$
DECLARE
  v_org_id        UUID;
  v_workspace_id  UUID;
  v_owner_id      UUID := gen_random_uuid();
  v_admin_id      UUID := gen_random_uuid();
  v_member_id     UUID := gen_random_uuid();
  v_outsider_id   UUID := gen_random_uuid();
  v_recording_id  BIGINT;
BEGIN
  -- Create test org + home workspace
  INSERT INTO organizations (name, type) VALUES ('Test Org', 'business')
  RETURNING id INTO v_org_id;

  INSERT INTO workspaces (organization_id, name, workspace_type, is_home)
  VALUES (v_org_id, 'Home', 'team', TRUE)
  RETURNING id INTO v_workspace_id;

  -- Add owner, admin, member to org
  INSERT INTO organization_memberships (organization_id, user_id, role) VALUES
    (v_org_id, v_owner_id, 'organization_owner'),
    (v_org_id, v_admin_id, 'organization_admin'),
    (v_org_id, v_member_id, 'member');

  -- Add workspace memberships
  INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES
    (v_workspace_id, v_owner_id, 'workspace_owner'),
    (v_workspace_id, v_admin_id, 'workspace_admin'),
    (v_workspace_id, v_member_id, 'member');

  -- Create a recording owned by the org owner
  INSERT INTO recordings (organization_id, owner_user_id, title)
  VALUES (v_org_id, v_owner_id, 'Test Call')
  RETURNING id INTO v_recording_id;

  -- Add recording to the home workspace
  INSERT INTO workspace_entries (workspace_id, recording_id)
  VALUES (v_workspace_id, v_recording_id);

  RAISE NOTICE 'org_id: %, workspace_id: %, recording_id: %', v_org_id, v_workspace_id, v_recording_id;
  RAISE NOTICE 'owner_id: %, admin_id: %, member_id: %, outsider_id: %',
    v_owner_id, v_admin_id, v_member_id, v_outsider_id;
END;
$$;
*/

-- =============================================================================
-- TEST 1: Regular member sees recordings from their workspaces only
-- =============================================================================
-- Expected: Returns the recording (member is in workspace that has the recording)
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<MEMBER_USER_ID>"}';

  SELECT
    r.id,
    r.title,
    'VISIBLE' AS status
  FROM recordings r
  WHERE r.organization_id = '<ORG_ID>';
  -- Expected: 1 row (the recording in their workspace)

ROLLBACK;

-- =============================================================================
-- TEST 2: Outsider cannot see org recordings
-- =============================================================================
-- Expected: Returns 0 rows (not an org member)
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<OUTSIDER_USER_ID>"}';

  SELECT COUNT(*) AS visible_count
  FROM recordings
  WHERE organization_id = '<ORG_ID>';
  -- Expected: 0

ROLLBACK;

-- =============================================================================
-- TEST 3: Org admin sees ALL recordings in their org
-- =============================================================================
-- Expected: Returns all recordings, including ones in workspaces they're not a member of
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<ORG_ADMIN_USER_ID>"}';

  SELECT
    r.id,
    r.title,
    'VISIBLE' AS status
  FROM recordings r
  WHERE r.organization_id = '<ORG_ID>';
  -- Expected: ALL recordings in org (not just workspace-scoped ones)

ROLLBACK;

-- =============================================================================
-- TEST 4: Removal cascade — remove member from workspace, calls disappear
-- =============================================================================
-- Step A: Verify member can see the recording BEFORE removal
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<MEMBER_USER_ID>"}';

  SELECT COUNT(*) AS count_before
  FROM recordings
  WHERE organization_id = '<ORG_ID>';
  -- Expected: > 0 (they can see the recording)

ROLLBACK;

-- Step B: Remove member from workspace (run as admin)
-- DELETE FROM workspace_memberships WHERE workspace_id = '<WORKSPACE_ID>' AND user_id = '<MEMBER_USER_ID>';

-- Step C: Verify member can NO LONGER see the recording AFTER removal
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<MEMBER_USER_ID>"}';

  SELECT COUNT(*) AS count_after
  FROM recordings
  WHERE organization_id = '<ORG_ID>';
  -- Expected: 0 (calls hidden after workspace membership removed)

ROLLBACK;

-- =============================================================================
-- TEST 5: Org admin still sees recordings after member is removed from workspace
-- =============================================================================
-- Admin visibility is not affected by workspace membership changes
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<ORG_ADMIN_USER_ID>"}';

  SELECT COUNT(*) AS admin_can_see
  FROM recordings
  WHERE organization_id = '<ORG_ID>';
  -- Expected: > 0 (org admin always sees all recordings)

ROLLBACK;

-- =============================================================================
-- TEST 6: Personal folders — hidden calls stop appearing
-- =============================================================================
-- When a recording is no longer visible (workspace removed), it disappears
-- from personal folder views because the JOIN to recordings is RLS-filtered.
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<MEMBER_USER_ID>"}';

  -- This query joins personal folder assignments to recordings.
  -- Hidden recordings are silently filtered by RLS on the recordings JOIN.
  SELECT
    pfr.id           AS assignment_id,
    r.id             AS recording_id,
    r.title          AS recording_title,
    CASE WHEN r.id IS NOT NULL THEN 'VISIBLE' ELSE 'HIDDEN' END AS status
  FROM personal_folder_recordings pfr
  LEFT JOIN recordings r ON r.id = pfr.recording_id
  WHERE pfr.user_id = '<MEMBER_USER_ID>';
  -- Expected: recording_id is NULL or status is HIDDEN for removed recordings
  -- The pfr row still exists but the recording is filtered by RLS

ROLLBACK;

-- =============================================================================
-- TEST 7: workspace_entries visibility — members see entries for their workspace
-- =============================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<MEMBER_USER_ID>"}';

  SELECT
    we.recording_id,
    we.workspace_id
  FROM workspace_entries we
  WHERE we.workspace_id = '<WORKSPACE_ID>';
  -- Expected: rows for workspace (member is in this workspace)

ROLLBACK;

-- Non-member cannot see workspace entries
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<OUTSIDER_USER_ID>"}';

  SELECT COUNT(*) AS count
  FROM workspace_entries
  WHERE workspace_id = '<WORKSPACE_ID>';
  -- Expected: 0 (not a workspace member)

ROLLBACK;

-- =============================================================================
-- TEST 8: workspace_memberships visibility — org admin sees all
-- =============================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<ORG_ADMIN_USER_ID>"}';

  SELECT COUNT(*) AS membership_count
  FROM workspace_memberships wm
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE w.organization_id = '<ORG_ID>';
  -- Expected: all memberships across all workspaces in this org

ROLLBACK;

-- Regular member only sees their own workspace memberships
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<MEMBER_USER_ID>"}';

  SELECT wm.workspace_id, wm.user_id, wm.role
  FROM workspace_memberships wm
  WHERE wm.workspace_id = '<WORKSPACE_ID>';
  -- Expected: only rows for workspaces this user is a member of

ROLLBACK;

-- =============================================================================
-- TEST 9: Recording owner always sees their own recordings
-- =============================================================================
-- Even if removed from all workspaces, a user can still see recordings they own
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<RECORDING_OWNER_USER_ID>"}';

  SELECT COUNT(*) AS own_recordings
  FROM recordings
  WHERE owner_user_id = '<RECORDING_OWNER_USER_ID>';
  -- Expected: > 0 (owner always sees own recordings regardless of workspace)

ROLLBACK;

-- =============================================================================
-- TEST 10: Multi-workspace scenario — recording in 2 workspaces, member of 1
-- =============================================================================
-- A recording added to workspace A and workspace B should be visible to a user
-- who is only a member of workspace A.
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "<WORKSPACE_A_ONLY_USER_ID>"}';

  SELECT r.id, r.title
  FROM recordings r
  WHERE r.organization_id = '<ORG_ID>'
    AND r.id = '<RECORDING_IN_BOTH_WORKSPACES>';
  -- Expected: 1 row (visible because user is in workspace A)

ROLLBACK;

-- =============================================================================
-- DIAGNOSTIC: Check RLS policies on key tables
-- =============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('recordings', 'workspace_entries', 'workspace_memberships', 'workspaces', 'organization_memberships')
ORDER BY tablename, cmd, policyname;

-- =============================================================================
-- DIAGNOSTIC: Check helper functions exist and are SECURITY DEFINER
-- =============================================================================
SELECT
  proname,
  prosecdef AS is_security_definer,
  proconfig AS search_path
FROM pg_proc
WHERE proname IN (
  'is_organization_member',
  'is_organization_admin_or_owner',
  'is_workspace_member',
  'is_workspace_admin_or_owner',
  'get_workspace_organization_id'
);
-- Expected: all 5 functions, prosecdef = true, search_path includes 'public'

-- =============================================================================
-- DIAGNOSTIC: Verify all critical tables have RLS enabled
-- =============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE tablename IN (
  'recordings',
  'workspace_entries',
  'workspace_memberships',
  'workspaces',
  'organization_memberships',
  'organizations',
  'personal_folders',
  'personal_tags',
  'personal_folder_recordings',
  'personal_tag_recordings',
  'organization_invitations'
)
ORDER BY tablename;
-- Expected: rls_enabled = true for all rows

-- =============================================================================
-- END OF TEST FILE
-- =============================================================================
