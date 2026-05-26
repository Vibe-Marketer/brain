---
phase: 31
phase_name: Auth, Signup & Payment Gate
mapped: 2026-05-12
---

# Phase 31 — Codebase Patterns

## Auth Flow Patterns Present in Repo

### Pattern A — Centered Auth Card Layout

Used by: `Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`

```tsx
<div className="min-h-screen flex items-center justify-center bg-background p-4">
  <div className="w-full max-w-sm">
    <div className="rounded-2xl border border-border bg-card shadow-lg px-8 py-10">
      {/* logo + heading + form */}
    </div>
    {/* mode-switcher outside card */}
  </div>
</div>
```

Lock for Phase 31. Do not change card dimensions.

### Pattern B — Confirmation-Screen State Swap

Source of truth: `ForgotPassword.tsx:46-127`. State pattern:

```tsx
const [sent, setSent] = useState(false);
// On success: setSent(true) + toast.success(...)
{sent ? <ConfirmationView /> : <FormView />}
```

ConfirmationView contains:
- Heading swap (`text-xl font-semibold`)
- Sub-heading paragraph
- Bordered callout (`rounded-lg border border-border p-4`) with "Didn't receive it? try again" reset button
- `Button variant="hollow"` with `<Link to="/login">` + `<RiArrowLeftLine className="mr-2 h-4 w-4" />`

**Phase 31 reuse:** mirror in `Login.tsx` for the email-confirmation-after-signup state.

### Pattern C — `getErrorToastMessage(error)` Toast in catch block

Used by: `Login.tsx:73, 100, 133, 152`, `ForgotPassword.tsx:38`.

```tsx
catch (error: unknown) {
  toast.error(getErrorToastMessage(error));
}
```

**Phase 31 extension:** add Supabase-Auth-specific cases BEFORE the generic `invalid` / `validation` branches in `getUserFriendlyError`. Order matters — Supabase exact-message matches must precede the generic-substring fallbacks.

### Pattern D — `getPostLoginRedirect()` helper

`Login.tsx:19-32`. Reads `sessionStorage.pendingShareToken` and `?next=` param.

**Phase 31 extension:** add `?signup=true&plan=...&email=...` handling for the post-payment account-creation entry. Parse these params in `Login.tsx` mount; switch UI mode to signup-completion automatically.

### Pattern E — Sonner Toast Mount

`App.tsx:292` — `<SonnerToaster position="bottom-right" richColors />`. Inside `<Router>`, after `<Routes>`, global.

**Phase 31 verification:** confirmed. No move needed. Consider adding `duration={6000}` for better visibility — small change, big UX win.

### Pattern F — `useSubscription` for plan gating

`src/hooks/useSubscription.ts:143-216`. Returns `{ tier, isPaid, isTrialing, isLoading }`.

**Phase 31 reuse:** new `useRequirePaidPlan` hook composes `useSubscription` + `user_profiles.grandfathered` query, returns redirect target or null.

### Pattern G — ProtectedRoute composition

`src/components/ProtectedRoute.tsx`. Currently checks `user` + `pendingShareToken`. **Phase 31 extension:** layer in `useRequirePaidPlan` either inside `ProtectedRoute` OR as a separate wrapper around `/setup` and `/onboarding`-equivalent routes (currently `/setup`).

### Pattern H — Service + Hook Separation

Per `src/CLAUDE.md`. New code follows: `services/billing-gate.service.ts` for the grandfathering check (pure async), `hooks/useRequirePaidPlan.ts` for the React-side caching.

In Phase 31, the gate logic is small enough that a single hook composing `useSubscription` is sufficient. Don't over-engineer a service file unless the gate logic exceeds ~30 lines.

## Existing Migration Pattern

Reference: `supabase/migrations/20260507052421_workspace_type_retirement.sql` — column add + backfill in one migration. Phase 31 grandfathered migration follows same pattern: `ALTER TABLE`, `UPDATE` backfill, `COMMENT ON COLUMN`.

## Test Harness

- Integration tests: per Andrew's locked rule, hit real DB. Use `supabase` test project envs from `.env.test` (or whichever the project uses).
- Dev-browser: mandatory verification step against `app.callvaultai.com` after deploy.
