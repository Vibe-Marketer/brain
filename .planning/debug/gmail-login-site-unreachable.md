---
slug: gmail-login-site-unreachable
status: resolved
trigger: customer tried to login with gmail and received a "cite can't be reached"
created: 2026-05-06
updated: 2026-05-06
---

# Gmail Login - Site Can't Be Reached

## Symptoms

- **Expected:** Customer clicks "Sign in with Google" on app.callvaultai.com → Google OAuth consent → redirect back → logged into the app.
- **Actual:** Customer hits browser error "This site can't be reached" mid-flow, before reaching Google's consent screen.
- **Failing URL (provided by user):** `https://vltmrnjsubfzrgrtdqey.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fapp.callvaultai.com%2F`
- **Environment:** Production (app.callvaultai.com)
- **Timeline:** Worked before, broke recently. Customer-facing regression.
- **Reproduction:** Operator can repro from their side via dev-browser.

## Initial Evidence (gathered before session manager hand-off)

- timestamp: 2026-05-06 — DNS lookup `vltmrnjsubfzrgrtdqey.supabase.co` returns **NXDOMAIN** from both system DNS (Tailscale 100.100.100.100) AND Google DNS (8.8.8.8). The hostname does not exist publicly.
- timestamp: 2026-05-06 — `curl https://vltmrnjsubfzrgrtdqey.supabase.co` fails with "Could not resolve host". `ping` same result.
- timestamp: 2026-05-06 — `supabase projects list` shows the project as **linked** (`●`), name `callvault-ai`, ref `vltmrnjsubfzrgrtdqey`, region `East US (North Virginia)`, created 2025-11-23.
- timestamp: 2026-05-06 — `supabase projects api-keys --project-ref vltmrnjsubfzrgrtdqey -o json` returns **`[]`** (empty array). A live project should return at least anon + service_role keys.
- timestamp: 2026-05-06 — `.env` has `VITE_SUPABASE_URL="https://vltmrnjsubfzrgrtdqey.supabase.co"`. All DATABASE_URL / pooler URLs reference the same `vltmrnjsubfzrgrtdqey` project ref.
- timestamp: 2026-05-06 — `supabase/.temp/linked-project.json` confirms `{"ref":"vltmrnjsubfzrgrtdqey","name":"callvault-ai"}`.
- timestamp: 2026-05-06 — `https://app.callvaultai.com` returns HTTP 200, but response header shows `age: 501198` (~5.8 days). This is a stale Vercel CDN cache; the HTML being served does not prove backend is functional.
- timestamp: 2026-05-06 — No alternate Supabase project named "callvault" or similar in the user's projects list — only the unreachable one.
- timestamp: 2026-05-06 — Frontend OAuth call site: `src/pages/Login.tsx:143` — `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '${origin}/' } })`. Standard call. Behavior is to redirect to `<VITE_SUPABASE_URL>/auth/v1/authorize?provider=google&redirect_to=<origin>` — exactly matching the failing URL. So the frontend is doing what it always did; the destination is gone.

## Investigation Evidence (session manager)

- timestamp: 2026-05-06 — `supabase projects list -o json` confirms project `vltmrnjsubfzrgrtdqey` (callvault-ai) has `"status": "INACTIVE"`. **Project is paused at the platform level.**
- timestamp: 2026-05-06 — Differential check: ALL 13 projects across both user orgs (`7x` and `AI Simple`) are `INACTIVE`. This is not an isolated callvault-ai issue — every project the user owns is paused. Strong signal of org-wide billing/plan event.
- timestamp: 2026-05-06 — Management API `GET /v1/projects/vltmrnjsubfzrgrtdqey` returns project metadata with `status: INACTIVE`, region `us-east-1`, no deletion timestamp — the project still exists, it's just paused. Data should be intact.
- timestamp: 2026-05-06 — Attempted `POST /v1/projects/vltmrnjsubfzrgrtdqey/restore` via management API. **Response: `"This organization has unpaid invoices. Settle outstanding payments before trying to restore project."`**

## Hypothesis (CONFIRMED)

**The Supabase project `vltmrnjsubfzrgrtdqey` (callvault-ai) is in `INACTIVE` (paused) state. Restoration is blocked by unpaid invoices on the `AI Simple` Supabase organization.** The DNS NXDOMAIN and empty api-keys are normal symptoms of a paused project — Supabase retracts DNS for paused free-tier / overdue projects. Production HTML still serves only because Vercel's CDN edge cache is ~6 days old, masking the outage at the homepage level. Every backend call (auth, db, storage, edge functions) is failing for every customer.

## Eliminated

- Frontend code regression — `src/pages/Login.tsx:143` is unchanged and constructs the OAuth URL correctly.
- Env var drift — `.env` and supabase CLI link agree on the project ref.
- Google OAuth client config — never reached, since Supabase host doesn't resolve.
- DNS infrastructure issue — only affects this specific project hostname; rest of `*.supabase.co` resolves normally. Confirmed via differential.
- Project deletion — management API still returns project record; data is recoverable.

## Resolution

- **root_cause:** Supabase project `vltmrnjsubfzrgrtdqey` (callvault-ai) is paused (`status: INACTIVE`) at the Supabase platform level due to unpaid invoices on the `AI Simple` organization (`diusatnehodatlojcmjc`). Restore endpoint explicitly returns: *"This organization has unpaid invoices. Settle outstanding payments before trying to restore project."* All 13 of the user's projects across both orgs are `INACTIVE`, indicating a broad billing-state event, not a per-project issue.
- **fix:** Two-step recovery, must be done via Supabase dashboard (cannot be automated by Claude — requires payment method / cardholder action):
  1. **Settle unpaid invoices** for the `AI Simple` org: https://supabase.com/dashboard/org/diusatnehodatlojcmjc/billing → Invoices tab → pay outstanding balance.
  2. **Restore the project**: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey → click "Restore project" (becomes available once invoices clear). Restore typically completes in 1–5 minutes. Data, auth users, edge functions, and OAuth provider config all persist through pause/restore — no migration needed.
- **post-restore verification (Claude can run these once project is back):**
  - `nslookup vltmrnjsubfzrgrtdqey.supabase.co` → expect a real A record, not NXDOMAIN.
  - `curl -I https://vltmrnjsubfzrgrtdqey.supabase.co/auth/v1/health` → expect 200.
  - `supabase projects api-keys --project-ref vltmrnjsubfzrgrtdqey -o json` → expect anon + service_role keys, not `[]`.
  - Test Gmail OAuth via dev-browser on app.callvaultai.com.
  - Purge stale Vercel CDN cache for app.callvaultai.com so a fresh HTML build is served (otherwise the 5.8-day-old cached homepage continues serving until natural expiry).
- **why we won't migrate:** Migration to a new project ref would require updating DNS, Vercel env vars, Google OAuth client redirect URIs, all DATABASE_URL references, and re-running every migration. ~hours of work and risk of data loss. Pay-and-restore is minutes and zero data risk.

## Notes

- This is a **launch-blocking production outage**, not just a customer-specific browser issue.
- Recent commits (`Prepare launch billing and trial flows`, `Clean up launch billing verification paths`) on the launch billing flow are unrelated — root cause is upstream Supabase billing, not callvault's own billing code.
- Customer impact: every customer attempting login has been hitting this error for ~5.8 days (matches stale CDN age). Existing logged-in sessions silently failing on db reads.
- After restore, recommend setting up a Supabase billing alert + a monthly health check (cron pinging `/auth/v1/health` from outside the CDN) so a paused project is caught within minutes, not days.

## Post-Restore Verification (2026-05-06, ~20:10 ET)

- ✅ `dig +short vltmrnjsubfzrgrtdqey.supabase.co @8.8.8.8` → `172.64.149.246, 104.18.38.10` (Cloudflare IPs, DNS restored).
- ✅ Project status transitioned `INACTIVE` → `RESTORING` → `ACTIVE_HEALTHY` over ~90 seconds.
- ✅ `supabase projects api-keys` returns 4 keys (anon, service_role, default×2) — was `[]` before.
- ✅ Customer's exact failing URL now returns `HTTP 302` redirecting to `accounts.google.com/o/oauth2/v2/auth?...` — OAuth flow is intact.
- ✅ Deployed JS bundle on app.callvaultai.com (`/assets/index-CGjGQ8ul.js`) confirmed referencing the same `vltmrnjsubfzrgrtdqey.supabase.co` URL, so the existing build works without redeploy.
- ⚪ Vercel CDN purge not needed — cached HTML + JS reference the same restored Supabase URL, so existing cache continues to work; new visitors get a working app immediately.
- ⏭️ Optional follow-up: live dev-browser login walkthrough to confirm customer-facing flow in a real browser session.
