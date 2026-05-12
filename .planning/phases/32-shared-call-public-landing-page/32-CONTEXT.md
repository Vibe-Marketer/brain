---
phase: 32
phase_name: Shared-Call Public Landing Page
gathered: 2026-05-11
status: Ready for planning
mode: Interactive discuss (gsd-autonomous)
---

# Phase 32: Shared-Call Public Landing Page — Context

<domain>
## Phase Boundary

Replace the current `/s/:token` redirect-to-login behavior with a Loom-style public landing page that:

- Names the inviter and the call without requiring authentication.
- Offers two clear paths: **"Sign up to view"** (free-tier signup for share-link recipients) and **"Open in existing account"** (sign in).
- When a signed-in user opens a link addressed to a different email, shows the masked recipient address with a one-click sign-out button.
- Backend: `share-call` Edge Function returns distinguishable responses for `WRONG_RECIPIENT` vs `CALL_NOT_FOUND` (today both return `HTTP 404 / CALL_NOT_FOUND` — the discrimination signal is destroyed, frontend can't fix alone).
- Visual cleanup of the Share Call modal (orange/red borders, broken icon, dialog overflow).
- Single-call share works end-to-end after all of the above.

Out of scope: signup for non-share-recipient users (Phase 31 owns the external-pricing flow), multi-call share links, share-link revocation UI (already exists).
</domain>

<decisions>
## Implementation Decisions

### Share-Recipient Signup — Free-Tier Allowed (Friction-Reduced)

Andrew's call: share-link recipients can sign up to a **Free tier specifically** to view the shared call, bypassing the Phase 31 external-pricing-redirect for this entry point only.

**Why:** lowest friction at the highest-converting moment (someone is actively trying to view content someone shared with them). Higher Free → Pro conversion rate than forcing pay-to-view.

**Implementation rules:**
- Signup must use the **recipient email from the share token**, NOT a free-form email field. This guarantees the new account matches the share recipient — eliminating the wrong-recipient class entirely for new accounts.
- Free tier is auto-assigned on signup (no plan picker, no Polar checkout). Standard Polar customer record is still created via `polar-create-customer` so the account is ready for later upgrade.
- The Free-tier-from-share-link signup path is a **separate entry point** from the main `/login` signup CTA. It does NOT bypass Phase 31's payment gate for users who arrive without a share token.
- Plan-phase should add a `signup_source` field (or use existing `user_metadata`) to track that an account was created via share-link — useful for analytics and any future feature-gate logic.

### Wrong-Account UX — Masked Email + Sign-Out

When a signed-in user opens `/s/:token` and the token is addressed to a different email:

```
This call was shared with na***@gmail.com.
Sign out and sign in with that email to view.

[Sign out]   [Cancel]
```

- Masking format: keep first 2 characters of the local part, asterisks for the rest, full domain. Example: `naegele412@gmail.com` → `na***@gmail.com`.
- "Sign out" button signs out and routes back to `/s/:token` (the unauthenticated landing).
- "Cancel" navigates to `/` (their main app).
- No "Request access" button in this milestone — adds backend complexity (sender re-issue flow). Deferred to v2.3 backlog.

### Backend Signal Restoration (QA-22, SHARE-02) — Phase 32 Owns This

The `share-call` Edge Function (`supabase/functions/share-call/index.ts:280`) currently returns `HTTP 404 / CALL_NOT_FOUND` for both "token doesn't exist" and "token exists but wrong recipient." The frontend cannot tell these apart.

**Backend change:**
- When the token lookup succeeds but `recipient_email !== current_user.email`, return:
  - `HTTP 403`
  - body: `{"error": "Wrong recipient", "code": "WRONG_RECIPIENT", "recipient_masked": "na***@gmail.com"}`
- When the token lookup fails (token doesn't exist or revoked), keep `HTTP 404 / CALL_NOT_FOUND`.
- When the request is unauthenticated (public landing), return:
  - `HTTP 200` with public-safe payload: `{ "inviter_name": "Andrew N.", "call_title": "Q3 Sales Sync", "is_public_view": true }` — NEVER include transcript, internal IDs, full attendee list, or anything else not needed to render the landing page.
- Verify the recipient masking happens **server-side** to prevent any client manipulation.

### Share Call Modal Visual Cleanup (SHARE-03)

Three confirmed issues from Phase 29 sweep:
1. Spurious orange/red field-borders on recipient email input → audit and replace with default `border-border` token (no validation-style colors unless the field is actually in error state).
2. Broken-looking red-dots icon next to the email field → remove or replace with a contextual icon (`RiMailLine` from Remix Icons).
3. Modal content overflows the parent dialog → enforce `max-w-md` and `overflow-hidden` on the modal container, allow `overflow-y-auto` only on the form body, not the full modal.

Use brand-guidelines-v4.4 tokens and shadcn primitives. No new design system work — this is cleanup.

### End-to-End Verification (SHARE-04)

Dev-browser cross-account flow against `app.callvaultai.com`:
1. **Persona A** (sender): create a share link for `qa-share-{timestamp}@vibeos.com`.
2. **Public view**: incognito session, open the link → see Loom-style landing with inviter name + call title + two CTAs.
3. **Sign-up path**: click "Sign up to view" → signup form pre-fills the recipient email → finish signup (free tier) → land on /s/:token → see full call.
4. **Existing-account path**: in a second tab, sign in as `qa-share-{timestamp}@vibeos.com` → open share link → see call directly.
5. **Wrong-account path**: signed in as a different account → open share link → see masked email + sign-out button → click sign-out → land on /s/:token public landing.
6. **Sender views own link**: as the sender (not the recipient), open the link → either see the call (sender always allowed) OR see "You're the sender" indicator — plan-phase decides which UX is cleaner.

### Test Strategy — Real-DB + Live Browser

Per Andrew's locked rule: integration tests use real DB, not mocks. Apply to:
- Backend response shape for WRONG_RECIPIENT vs CALL_NOT_FOUND vs unauthenticated public view.
- Frontend SharedCallView state machine: loading → public-landing → wrong-account → call-view.
- Free-tier-from-share-link signup integration.

Dev-browser verification on the full happy path + wrong-account path on staging or prod after deploy.

### Dependencies & Sequencing

- Depends on Phase 31's auth/signup flow being functional (locked external-pricing redirect for general signup, ForgotPassword-pattern confirmation screen, error toasts wired). The Phase 32 free-tier-from-share-link signup re-uses the same Login form components.
- Backend response shape change happens **before** frontend message rendering. Cannot ship the frontend half independently.
- The `share-call` Edge Function modification needs the `_shared/auth.ts` migration that Phase 37 plans — coordinate or accept that Phase 32's backend change ships before the auth-helper migration.
</decisions>

<code_context>
## Existing Code Insights

**Already in place:**
- `supabase/functions/share-call/index.ts` — full CRUD for share links (POST/GET/DELETE/access-log). Line 280 is the error to modify.
- `src/pages/SharedCallView.tsx` — current frontend. Line 51-58 auto-redirects to /login if unauthenticated — REPLACE with the public landing.
- `src/hooks/useSharing.ts` — `useSharedCall` hook used by SharedCallView.
- `src/components/dialogs/ShareCallDialog.tsx` (or similar) — Share Call modal that needs visual cleanup.
- Phase 31 deliverables: Login.tsx evolution, ForgotPassword-pattern confirmation screen, error toast system — all reused here.

**Files likely modified:**
- `supabase/functions/share-call/index.ts` — return WRONG_RECIPIENT (403) vs CALL_NOT_FOUND (404) vs public-view (200) per the matrix above.
- `src/pages/SharedCallView.tsx` — three-state UI: public landing, wrong-account, full call. Remove the auto-redirect-to-login behavior.
- `src/hooks/useSharing.ts` — handle the new response shape (recipient_masked, is_public_view).
- New: `src/components/share/PublicShareLanding.tsx` — Loom-style landing card with inviter + call title + two CTAs.
- New: `src/components/share/WrongAccountState.tsx` — masked-email + sign-out card.
- `src/components/dialogs/ShareCallDialog.tsx` — visual cleanup (border, icon, overflow).
- New (or modified Login.tsx): share-link-signup branch that pre-fills email from token and routes to Free tier.

**Design tokens (per src/CLAUDE.md):**
- `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground` for landing card chrome.
- `bg-foreground text-background` for primary CTAs (`Sign up to view`).
- `variant="hollow"` for secondary CTAs (`Open in existing account`).
- Remix Icons only: `RiLinksLine`, `RiUserLine`, `RiLogoutBoxRLine`, `RiMailLine`.

**Backend security (per supabase/CLAUDE.md):**
- RLS on share_links and share_link_access_log.
- Service-role used only for token lookup (token IS the credential for public path).
- Email masking server-side, never client-side.
</code_context>

<specifics>
## Specific Requirements (from REQUIREMENTS.md)

- **SHARE-01** — `/s/:token` shows public landing (Loom/Zoom-style): inviter name, call title, two CTAs.
- **SHARE-02** — Wrong-account error shows masked recipient email + sign-out button. **Backend-first** — requires `share-call` response shape change first.
- **SHARE-03** — Share Call modal visual cleanup: borders, icon, dialog overflow.
- **SHARE-04** — Single-call share works end-to-end.
- **QA-22** — Backend signal destruction at `share-call` Edge Function — fix is the SHARE-02 backend change.

## Success Criteria (from ROADMAP.md)

1. `/s/:token` renders a public landing page with inviter, call title, sign-up + open-in-existing-account CTAs — no auth required.
2. Wrong-account recipient sees masked email + explicit sign-out button.
3. Share Call modal: no spurious borders, no broken icon, fits inside its dialog.
4. End-to-end: sender creates share → recipient (correct account) views the call.

## Verification Strategy

- Dev-browser cross-account flow on prod (per the 6-step matrix above).
- Edge function logs clean for share-call responses (no unexpected 500s).
- Network response shape verified per case (200 public, 200 authenticated correct, 403 wrong recipient, 404 not found).
- Integration tests pass green.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 32 section
- `.planning/REQUIREMENTS.md` — SHARE-01..04, QA-22
- `.planning/phases/29-qa-sweep-regression-catalog/` — QA-22 backend signal destruction details
- `.planning/phases/31-auth-signup-payment-gate/31-CONTEXT.md` — auth/signup decisions reused here
- `.planning/phases/31-auth-signup-payment-gate/31-UI-SPEC.md` — design contract reused
- `supabase/functions/share-call/index.ts` — Edge Function to modify
- `src/pages/SharedCallView.tsx` — frontend to evolve
- `src/hooks/useSharing.ts` — share-call data hook
- `src/components/dialogs/ShareCallDialog.tsx` — Share Call modal (visual cleanup)
- `src/pages/ForgotPassword.tsx` — confirmation screen pattern
- `docs/design/brand-guidelines-v4.4.md` — design system
- `src/CLAUDE.md` — frontend conventions
- `supabase/CLAUDE.md` — backend conventions
</canonical_refs>

<deferred>
## Deferred Ideas

- **"Request access" button** — let wrong-account users email the sender to re-issue the share link to their email. Adds backend complexity (sender notification + re-issue flow). v2.3 backlog.
- **Multi-recipient share links** — one link addressed to N emails, each gets gated access. Currently each share link is single-recipient. v2.3 backlog.
- **Share-link expiration UI** — make expiration prominent on the public landing ("expires in 3 days"). Current behavior just returns CALL_NOT_FOUND on expiry. Polish item.
- **Share-link analytics** — show sender how many times the link was viewed, by whom (already logged in `share_link_access_log`). UI surfacing deferred.
- **Open Graph / unfurl tags** — when share link is pasted in Slack/Discord/etc., show a preview card. Requires server-side rendering or a static unfurl edge function. v2.3 backlog.
</deferred>
