# Phase 4: Team Collaboration - Research

**Researched:** 2026-01-28
**Domain:** Team management, invite flows, role-based access control
**Confidence:** HIGH

## Summary

This phase focuses on enabling team creation and joining via invite links. The existing codebase already has extensive team infrastructure including database tables (`teams`, `team_memberships`, `team_shares`), Edge Functions (`teams`, `team-memberships`), React hooks (`useTeamHierarchy`, `useTeamMembers`, `useOrgChart`), and UI components (`TeamManagement.tsx`, `TeamJoin.tsx`, `TeamInviteDialog.tsx`).

The research reveals that the core infrastructure is mostly complete but the **team join route is missing from App.tsx** - the `TeamJoin.tsx` page exists but is not registered in the router. Additionally, there's a route path inconsistency: the generated invite URL uses `/team/join/:token` but the context document specifies `/join/team/:token`. The team creation flow exists but was reported as "failing silently" - investigation needed.

**Primary recommendation:** Register the TeamJoin route in App.tsx with the correct path pattern (`/join/team/:token` per CONTEXT.md decisions), and debug the team creation flow to identify and fix the silent failure.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Router | ^6.30.1 | Client routing, dynamic route params | Already in use, handles `/join/team/:token` pattern |
| @tanstack/react-query | ^5.90.10 | Server state, caching, mutations | Already used for all data operations |
| @supabase/supabase-js | ^2.84.0 | Database access, RLS enforcement | Already used throughout codebase |
| Zustand | ^5.0.9 | Client state for team context | Already available, use for active team context |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Sonner | ^1.7.4 | Toast notifications | For invite success/error feedback |
| Zod | ^3.25.76 | Input validation | For team name validation |
| crypto.getRandomValues | native | Token generation | For generating secure invite tokens |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom invite tokens | UUID v4 | 32-char URL-safe tokens are shorter and more user-friendly than UUIDs |
| RLS for all access | Edge Function | Edge Functions used for complex multi-step operations (create team + membership atomically) |

**Installation:**
No new packages needed - all dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── pages/
│   ├── TeamJoin.tsx           # EXISTS: Join team via invite token (NOT ROUTED)
│   └── TeamManagement.tsx     # EXISTS: Full team management UI
├── hooks/
│   └── useTeamHierarchy.ts    # EXISTS: Team CRUD, members, org chart hooks
├── components/sharing/
│   ├── TeamInviteDialog.tsx   # EXISTS: Invite flow dialog
│   └── OrgChartView.tsx       # EXISTS: Team hierarchy visualization
└── types/
    └── sharing.ts             # EXISTS: Team, TeamMembership, etc. types

supabase/
├── migrations/
│   └── 20260108000003_create_team_access_tables.sql  # EXISTS
└── functions/
    ├── teams/                 # EXISTS: Team CRUD
    └── team-memberships/      # EXISTS: Membership operations
```

### Pattern 1: Protected Route with Pre-Auth Redirect
**What:** Store invite token in sessionStorage when unauthenticated, redirect to login, then resume join flow
**When to use:** For invite links that may be opened by unauthenticated users
**Example:**
```typescript
// Source: Existing pattern in src/pages/TeamJoin.tsx:117-121
useEffect(() => {
  if (!authLoading && !user) {
    // Store the current URL to redirect back after login
    sessionStorage.setItem('pendingTeamInviteToken', token || '');
    navigate('/login');
  }
}, [token, user, authLoading, navigate]);
```

### Pattern 2: Edge Function for Atomic Operations
**What:** Use Edge Function to create team + add owner as admin member in single transaction
**When to use:** When operation involves multiple related inserts that must succeed together
**Example:**
```typescript
// Source: Existing pattern in supabase/functions/teams/index.ts
// 1. Create team
const { data: team } = await supabaseClient.from('teams').insert({...}).select().single();

// 2. Create admin membership for owner
const { data: membership } = await supabaseClient.from('team_memberships').insert({
  team_id: team.id,
  user_id: user_id,
  role: 'admin',
  status: 'active',
  joined_at: new Date().toISOString(),
}).select().single();

// 3. If membership fails, rollback team
if (membershipCreateError) {
  await supabaseClient.from('teams').delete().eq('id', team.id);
}
```

### Pattern 3: Security Definer Functions for RLS Performance
**What:** Create PostgreSQL functions with SECURITY DEFINER to avoid RLS recursion in policies
**When to use:** When RLS policies need to query the same table they're protecting
**Example:**
```sql
-- Source: Existing pattern in migrations/20260128000001_fix_team_memberships_rls_recursion.sql
CREATE OR REPLACE FUNCTION is_active_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypasses RLS to prevent infinite recursion
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_memberships
    WHERE team_id = p_team_id AND user_id = p_user_id AND status = 'active'
  );
END;
$$;
```

### Anti-Patterns to Avoid
- **Missing route registration:** Page components exist but aren't accessible (current bug)
- **Inconsistent URL patterns:** Generate URLs with one pattern, register routes with another
- **RLS self-reference:** Policies that query their own table cause infinite recursion
- **Silent failures:** Swallowing errors without user feedback (reported team creation issue)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secure token generation | Math.random() strings | `crypto.getRandomValues()` | Already implemented in `generateInviteToken()` |
| Invite expiration | Manual date math | `getInviteExpiration()` helper | 7-day expiry per CONTEXT.md, function exists |
| Org chart tree building | Recursive rendering | `buildOrgChart()` + `OrgChartView` | Tree structure builder already exists |
| Team membership checks | Inline RLS queries | `is_active_team_member()` function | SECURITY DEFINER avoids RLS recursion |
| Role permission checks | Ad-hoc conditionals | `isAdmin`, `isManager` from hooks | Already computed in `useTeamMembers` |

**Key insight:** The team collaboration infrastructure is 80% complete. The remaining work is integration (routing), bug fixes (silent failures), and UX polish (onboarding flow awareness).

## Common Pitfalls

### Pitfall 1: Route Not Registered
**What goes wrong:** TeamJoin.tsx exists but `/join/team/:token` route not in App.tsx
**Why it happens:** Page created but route definition missed in different file
**How to avoid:** Add route to App.tsx: `<Route path="/join/team/:token" element={<TeamJoin />} />`
**Warning signs:** 404 errors when clicking invite links

### Pitfall 2: URL Pattern Mismatch
**What goes wrong:** Code generates `/team/join/:token` but users expect `/join/team/:token`
**Why it happens:** CONTEXT.md specified `/join/team/:token`, code used different pattern
**How to avoid:** Update `generateTeamInvite()` in useTeamHierarchy.ts to use `/join/team/`
**Warning signs:** "Invalid invite link" errors even for fresh invites

### Pitfall 3: RLS Infinite Recursion
**What goes wrong:** "infinite recursion detected in policy for relation 'team_memberships'"
**Why it happens:** Policy queries team_memberships to check if user is member
**How to avoid:** Use SECURITY DEFINER helper functions (already implemented)
**Warning signs:** Error occurs on any team-related operation

### Pitfall 4: Silent Team Creation Failure
**What goes wrong:** User clicks "Create Team" but nothing happens
**Why it happens:** Error caught but not displayed, mutation doesn't throw
**How to avoid:** Ensure `toast.error()` called in catch block, check network tab
**Warning signs:** No toast, no navigation, no error in console

### Pitfall 5: Unauthenticated User Flow Break
**What goes wrong:** User follows invite link, redirected to login, invite context lost
**Why it happens:** Invite token not persisted across login redirect
**How to avoid:** Already handled via `sessionStorage.setItem('pendingTeamInviteToken', token)`
**Warning signs:** User logs in but doesn't auto-join team

### Pitfall 6: Invite Token Collision with User ID
**What goes wrong:** Pending membership created with inviter's user_id as placeholder
**Why it happens:** Current implementation uses `user_id: userId` (inviter) for pending invite
**How to avoid:** Consider using NULL for user_id until acceptance, or use `invited_by_user_id`
**Warning signs:** Duplicate key violations when same user gets multiple invites

## Code Examples

Verified patterns from existing codebase:

### Adding Missing Route to App.tsx
```typescript
// Location: src/App.tsx (add to Routes)
import TeamJoin from '@/pages/TeamJoin';

// In Routes section, add before catch-all:
<Route path="/join/team/:token" element={<TeamJoin />} />
```

### Correct Invite URL Generation
```typescript
// Location: src/hooks/useTeamHierarchy.ts:364
// Change from:
const inviteUrl = `${window.location.origin}/team/join/${inviteToken}`;
// To (per CONTEXT.md):
const inviteUrl = `${window.location.origin}/join/team/${inviteToken}`;
```

### Team Creation Modal (Minimal Friction)
```typescript
// Per CONTEXT.md: "Collect only team name (minimal friction)"
// Existing CreateTeamDialog in TeamManagement.tsx has more fields
// Simplify to:
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create Team</DialogTitle>
    </DialogHeader>
    <Input
      placeholder="Team name"
      value={teamName}
      onChange={(e) => setTeamName(e.target.value)}
    />
    <DialogFooter>
      <Button onClick={handleCreate}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Post-Join Navigation
```typescript
// Per CONTEXT.md: "After creation, navigate to team dashboard"
// In team creation success handler:
toast.success("Team created successfully");
navigate('/team');  // Navigate to team management page
```

### Invite Expiration (7 Days per CONTEXT.md)
```typescript
// Current implementation uses 30 days - needs update
function getInviteExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);  // Changed from 30 to 7 per CONTEXT.md
  return date.toISOString();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Check RLS in policy directly | SECURITY DEFINER helper functions | Migration 20260128000001 | Prevents infinite recursion |
| Single team per user | Multiple teams allowed | Per CONTEXT.md decisions | Users can belong to multiple teams |
| 30-day invite expiry | 7-day invite expiry | CONTEXT.md decision | More secure, shorter window |

**Deprecated/outdated:**
- `domain_auto_join` field exists but auto-join feature not prioritized for this phase (focus on invite links)

## Open Questions

Things that require investigation during implementation:

1. **Silent team creation failure**
   - What we know: User reports team creation "fails silently"
   - What's unclear: Is it RLS, Edge Function error, or frontend issue?
   - Recommendation: Add console logging at each step, check Network tab, verify Edge Function response

2. **Team switcher implementation**
   - What we know: CONTEXT.md says "Teams appear in top-right dropdown"
   - What's unclear: Is there an existing team switcher component? How to persist active team?
   - Recommendation: May need new component, use Zustand store for activeTeamId

3. **Pending setup status for incomplete onboarding**
   - What we know: CONTEXT.md mentions marking users as "pending setup" if they haven't completed onboarding
   - What's unclear: What database field tracks this? What onboarding steps are required?
   - Recommendation: May need new column on team_memberships or check user_settings

4. **Email invite option**
   - What we know: CONTEXT.md says "both copy-link AND email invite options"
   - What's unclear: Is there an email sending Edge Function? Resend integration?
   - Recommendation: Prioritize copy-link for MVP, email as follow-up

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis - `src/pages/TeamJoin.tsx`, `src/pages/TeamManagement.tsx`
- Existing hooks - `src/hooks/useTeamHierarchy.ts`
- Database schema - `supabase/migrations/20260108000003_create_team_access_tables.sql`
- Edge Functions - `supabase/functions/teams/index.ts`
- RLS fix migration - `supabase/migrations/20260128000001_fix_team_memberships_rls_recursion.sql`
- CONTEXT.md decisions - Phase 4 locked decisions from discussion

### Secondary (MEDIUM confidence)
- Supabase RLS documentation - https://supabase.com/docs/guides/database/postgres/row-level-security
- React Router v6 patterns - Dynamic route params with `useParams`

### Tertiary (LOW confidence)
- None - all findings verified against existing code or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already implemented in codebase
- Architecture: HIGH - Patterns extracted from existing working code
- Pitfalls: HIGH - Route issue verified, RLS issue already fixed in migration
- Code examples: HIGH - From existing codebase, minor modifications needed

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable infrastructure already exists)

## Implementation Priority

Based on research, here's the recommended task order:

1. **CRITICAL: Register `/join/team/:token` route** - Currently blocked
2. **CRITICAL: Fix URL pattern** - Change from `/team/join/` to `/join/team/`
3. **HIGH: Debug team creation failure** - Reported as silent failure
4. **HIGH: Update invite expiry to 7 days** - Per CONTEXT.md
5. **MEDIUM: Simplify CreateTeamDialog** - Only collect team name per CONTEXT.md
6. **MEDIUM: Add team switcher to header** - Per CONTEXT.md
7. **LOW: Add email invite option** - Per CONTEXT.md (copy-link works first)
