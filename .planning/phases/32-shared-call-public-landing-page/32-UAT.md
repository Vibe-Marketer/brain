---
phase: 32
status: pending-operator
created: 2026-05-12
---

# Phase 32 — End-to-End UAT Script (SHARE-04)

Operator runs this script on `https://app.callvaultai.com` after Vercel auto-deploys main. Each step captures a dev-browser screenshot.

Prerequisites:
- `VITE_POLAR_FREE_PRODUCT_ID` set in Vercel env vars (otherwise the post-signup Polar provisioning step skips with a console warning — non-blocking).
- Two distinct test accounts available: the operator account (sender) AND `qa-share-{timestamp}@vibeos.com` (recipient).

---

## 1. Sender — create a share link

1. Sign in as operator. Open any call. Click **Share Call**.
2. EXPECT in the modal: section label `Add recipient`, placeholder `recipient@example.com`, helper text `Anyone with the link can view this call (account required).`.
3. Enter `qa-share-{timestamp}@vibeos.com`. Click **Create link** (sentence-case, NOT `CREATE`).
4. EXPECT: link appears with subtle `ring-foreground/10` ring (no green border). "Copied to clipboard" text in `text-foreground`.
5. Copy the URL.

## 2. Public view (incognito)

1. Open URL in incognito. EXPECT Loom-style card: logo, `RiLinksLine` icon, `{Inviter} shared a call with you` heading, call title sub-line, `Sign up to view` primary CTA (with vibe-orange arrow), `Open in existing account` secondary CTA, `Free tier — no credit card needed` helper.

## 3. Sign-up path

1. Click **Sign up to view** → redirected to `/login?signup=true&share={token}`.
2. EXPECT: heading `Create your account`, sub-heading `You're on the Free plan. Set a password to view the call.`, email pre-filled with `qa-share-{timestamp}@vibeos.com`, disabled, with `RiLockLine` icon, helper `Locked to the recipient of this share link.`
3. Enter password. Click **Create account**.
4. EXPECT (immediate-session): toast `Account created — welcome to CallVault!` → land on `/s/{token}` → full call view.
5. EXPECT (email-confirm pending): full-screen `Check your email` confirmation.

## 4. Existing-account path

1. Sign in directly as `qa-share-{timestamp}@vibeos.com`. Open share URL.
2. EXPECT: full call view renders directly.

## 5. Wrong-account path

1. Sign in as the OPERATOR account. Open the share URL.
2. EXPECT: `This share is for a different account` card with `RiUserLine`, body `This call was shared with qa***@vibeos.com. Sign out and sign back in with that account.`, primary `Sign out` (auto-focused), secondary `Cancel` (ghost).
3. Click **Sign out** → label changes to `Signing out...` → lands on `/s/{token}` public landing.

## 6. Sender views own link

1. Sign in as operator. Open the share URL.
2. EXPECT: full call view directly (sender bypass).

## 7. ShareCallDialog cleanup

1. Open Share Call modal. Create 5+ links.
2. EXPECT: modal stays in viewport; inner list scrolls; no green tints; `RiLinksLine` icons not broken-looking dots; footer `Revoked links stop working immediately.`; button `Close` (sentence-case).

## Sign-off Checklist

- [ ] Step 1: Share link created with new copy + tokens
- [ ] Step 2: Public landing renders (incognito)
- [ ] Step 3: Signup pre-fills locked email, lands on call view
- [ ] Step 4: Correct-recipient sign-in lands on call view
- [ ] Step 5: Wrong-account masked-email + sign-out flow works
- [ ] Step 6: Sender bypass works
- [ ] Step 7: Modal cleanup verified
