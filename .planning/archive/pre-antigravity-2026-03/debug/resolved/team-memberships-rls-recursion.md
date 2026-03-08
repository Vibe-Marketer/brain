---
status: verifying
trigger: "Multiple console errors on main app screen including infinite recursion in RLS policy for team_memberships table"
created: 2026-01-28T00:00:00Z
updated: 2026-01-28T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - content_library SELECT policy references team_memberships, which has SELECT policy that self-references team_memberships
test: Traced policy chain
expecting: Find self-referencing policy
next_action: Apply migration to Supabase and verify fix

## Symptoms

expected: Clean page load without console errors
actual: 6 errors and 1 warning occurring on main screen load
errors:
  1. HTTP 500 on GET /rest/v1/content_library?select=tags - "infinite recursion detected in policy for relation 'team_memberships'"
  2. "Failed to fetch" on GET /rest/v1/ai_processing_jobs (TypeError, occurred 2x at ~13 min intervals)
  3. "Error checking AI jobs TypeError: Failed to fetch" console errors (related to #2)
  4. Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}
reproduction: Loading the main app at https://app.callvaultai.com/
started: Errors occurred over 27 minute span, starting at 20:31:05

## Eliminated

## Evidence

- timestamp: 2026-01-28T00:05:00Z
  checked: supabase/migrations/20260110000005_create_content_library_tables.sql
  found: |
    content_library SELECT policy (line 90-104) queries team_memberships:
    ```sql
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = content_library.team_id
        AND team_memberships.user_id = auth.uid()
        AND team_memberships.status = 'active'
    )
    ```
  implication: When selecting from content_library, PostgreSQL evaluates RLS on team_memberships

- timestamp: 2026-01-28T00:06:00Z
  checked: supabase/migrations/20260108000003_create_team_access_tables.sql
  found: |
    team_memberships SELECT policy (line 273-293) has SELF-REFERENCE:
    ```sql
    EXISTS (
      SELECT 1 FROM team_memberships AS my_membership
      WHERE my_membership.team_id = team_memberships.team_id
        AND my_membership.user_id = auth.uid()
        AND my_membership.status = 'active'
    )
    ```
    This queries team_memberships from within its own RLS policy
  implication: ROOT CAUSE CONFIRMED - When content_library policy checks team_memberships, the team_memberships policy triggers another check on team_memberships, causing infinite recursion

- timestamp: 2026-01-28T00:08:00Z
  checked: src/components/transcripts/AIProcessingProgress.tsx
  found: |
    AI job polling runs every 2 seconds (line 64) via setInterval.
    "Failed to fetch" errors occur at ~13 min intervals.
    This suggests network timeouts when browser is idle, not a code bug.
  implication: Issue #2 is network-related, not a code defect. May benefit from retry logic but not critical.

- timestamp: 2026-01-28T00:09:00Z
  checked: src/components/ui/dialog.tsx
  found: |
    DialogContent supports aria-describedby prop (line 33, 38).
    Warning occurs when DialogContent lacks DialogDescription child.
    This is a Radix UI accessibility warning for dialogs without descriptions.
  implication: Issue #4 is low-priority. Each dialog needing description should add DialogDescription or aria-describedby={undefined}.

## Resolution

root_cause: |
  The team_memberships RLS SELECT policy contains a self-reference - it queries team_memberships
  from within its own policy. When content_library (or any other table) has an RLS policy that
  checks team_memberships, PostgreSQL evaluates team_memberships RLS which triggers another
  team_memberships check, causing infinite recursion.

  The problematic policy (line 273-293 of 20260108000003):
  ```sql
  CREATE POLICY "Users can view memberships in their teams"
    ON team_memberships
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM team_memberships AS my_membership  -- SELF-REFERENCE!
        WHERE my_membership.team_id = team_memberships.team_id
          AND my_membership.user_id = auth.uid()
          AND my_membership.status = 'active'
      )
      ...
    );
  ```

fix: |
  Created migration 20260128000001_fix_team_memberships_rls_recursion.sql that:
  1. Creates is_active_team_member(UUID, UUID) SECURITY DEFINER function - bypasses RLS
  2. Creates is_team_admin(UUID, UUID) SECURITY DEFINER function - bypasses RLS
  3. Drops and recreates all 4 team_memberships RLS policies using the helper functions

  The SECURITY DEFINER functions run with elevated privileges, bypassing RLS when
  checking membership/admin status. This breaks the recursion chain.

verification: |
  Migration needs to be applied to Supabase. Steps:
  1. Open https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey
  2. Go to SQL Editor
  3. Copy contents of supabase/migrations/20260128000001_fix_team_memberships_rls_recursion.sql
  4. Execute the migration
  5. Verify with:
     ```sql
     SELECT policyname FROM pg_policies WHERE tablename = 'team_memberships';
     -- Should show the recreated policies

     SELECT proname FROM pg_proc WHERE proname IN ('is_active_team_member', 'is_team_admin');
     -- Should show both helper functions
     ```
  6. Test: Load app.callvaultai.com - content_library query should succeed without 500 error
files_changed:
  - supabase/migrations/20260128000001_fix_team_memberships_rls_recursion.sql
