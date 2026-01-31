# ADR-0006: Dead Code Removal - Phase 6 Code Health

**Date:** 2026-01-31
**Status:** Accepted
**Deciders:** Development Team

## Context

During Phase 6 Code Health & Infrastructure, we identified several code artifacts that are no longer used:

1. **Coach Edge Functions** - Four Supabase Edge Functions related to coach collaboration:
   - `coach-notes` - Coach annotation endpoints
   - `coach-relationships` - Relationship management
   - `coach-shares` - Sharing rule management
   - `send-coach-invite` - Email invitation sending

2. **Orphaned Components**:
   - `src/pages/TeamManagement.tsx` - A 500+ line component with no route or import

## Decision

### Items REMOVED

| Item | Type | Reason | Action |
|------|------|--------|--------|
| `supabase/functions/coach-notes/` | Edge Function | No frontend callers in src/ | **DELETE** |
| `supabase/functions/coach-relationships/` | Edge Function | No frontend callers in src/ | **DELETE** |
| `supabase/functions/coach-shares/` | Edge Function | No frontend callers in src/ | **DELETE** |
| `src/pages/TeamManagement.tsx` | React Component | Not routed in App.tsx, no imports | **DELETE** |

### Items PRESERVED

| Item | Type | Reason |
|------|------|--------|
| `supabase/functions/send-coach-invite/` | Edge Function | Called by `useCoachRelationships` hook at line 242 |
| `src/hooks/useCoachRelationships.ts` | React Hook | Actively used by 5+ components |

## Evidence

### Reference Tracing Results

**coach-notes:**
- `grep -r "coach-notes" src/` → No matches
- Only self-references in `supabase/functions/coach-notes/index.ts`

**coach-relationships:**
- `grep -r "coach-relationships" src/` → No matches
- Only self-references in `supabase/functions/coach-relationships/index.ts`

**coach-shares:**
- `grep -r "coach-shares" src/` → No matches
- Only self-references in `supabase/functions/coach-shares/index.ts`

**send-coach-invite:**
- `grep -r "send-coach-invite" src/` → Match in `useCoachRelationships.ts` line 242
- Actively called by frontend - **KEEP**

**TeamManagement.tsx:**
- `grep -r "TeamManagement" src/` → Only self-export at line 519
- Not in App.tsx routing
- No imports in any file

**useCoachRelationships.ts:**
- Used by: CoachesTab.tsx, CoacheeInviteDialog.tsx, CoachInviteDialog.tsx, CoachDashboard.tsx, SharedWithMe.tsx
- Has comprehensive test coverage in `__tests__/useCoachRelationships.test.ts`
- Actively used - **KEEP**

## Consequences

### Positive
- Reduced codebase size (~57KB of dead code removed)
- Clearer codebase with only active code
- Faster builds (fewer files to process)
- Reduced cognitive load for developers

### Negative
- None identified - removed code had no references

### Dashboard Cleanup Required

The following Edge Functions still exist in the Supabase dashboard and should be deleted manually:
- `coach-notes`
- `coach-relationships`
- `coach-shares`

This is a separate deployment concern from the codebase cleanup.

## Compliance

This removal fulfills **CLEAN-02** requirement: Remove unused code per code health standards.

## References

- Phase 6 Code Health & Infrastructure plan
- Requirement CLEAN-02: Dead code removal
