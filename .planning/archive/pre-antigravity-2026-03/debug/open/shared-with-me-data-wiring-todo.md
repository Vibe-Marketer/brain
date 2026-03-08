# TODO: Shared-With-Me Data Wiring After Schema Migration

Date: 2026-02-10
Status: Partially complete (core route stable, advanced sources pending)

## Problem

- The pane-structured `/shared-with-me` UI is in place.
- Legacy table references (`call_share_access_log`, `team_memberships`) are not available in current schema cache in this environment.
- This causes runtime errors when old queries run.

## Current Temporary State

- Page is stable with pane UX intact (no hard-fail from missing legacy tables).
- DB-backed shared links path is wired through RPC.
- Team/direct-report source expansion is still pending.

## Follow-up Work

1. Confirm canonical sharing schema/tables in production DB.
2. Confirm canonical sharing schema for team/direct-report sources.
3. Re-enable team/direct-report sources once canonical tables are confirmed.
4. Add defensive fallback for missing optional sharing sources.

## Acceptance Criteria

- `/shared-with-me` loads without console errors.
- Direct links, team shares, and manager shares populate from supported schema.
- Pane structure remains intact (pane 2 filters + pane 4 detail).
