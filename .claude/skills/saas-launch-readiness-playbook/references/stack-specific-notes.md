# Stack-Specific Notes

Gotchas that bite during launch for the Supabase + Vercel + React/Vite stack. Read this before launch day, not during.

---

## Supabase

### PostgREST auth model

PostgREST handles auth via JWT in the `Authorization` header — RLS is your **primary access control mechanism**, not application code. If RLS is off on a table, that table is publicly readable and writable by anyone with the anon key. Always run `rls_verifier.py` before launch.

### `getSession()` vs `getUser()` on the client

```typescript
// CORRECT (client-side) — no network call
const { data: { session } } = await supabase.auth.getSession();

// WRONG (client-side) — makes a network round-trip every time
const { data: { user } } = await supabase.auth.getUser();
```

`getUser()` does a server round-trip on every call. For most client-side checks, `getSession()` reads from local storage and is much faster. Use `getUser()` only when you specifically need server verification (e.g., on a protected server route).

### Edge Functions are deployed separately from the frontend

```bash
# Deploy frontend (Vercel auto-deploys on push to main)
git push origin main

# Deploy edge functions (manual step — easy to forget)
supabase functions deploy
```

Add the function deploy to your CI workflow — otherwise frontend changes ship but the backend lags.

### Service role key

The `service_role` key bypasses RLS entirely. **Never expose it client-side.** It belongs in:
- Edge function environment variables
- GitHub Actions secrets (for migrations only)
- Your local `.env` (gitignored)

If it ever ends up in a `VITE_` prefixed env var, rotate it immediately.

### Connection pooling

Supabase has two connection modes:
- **Direct connection** (`db.xxx.supabase.co:5432`) — good for migrations, NOT for serverless functions
- **Pooler** (`aws-0-region.pooler.supabase.com:6543`) — required for serverless / edge

Edge Functions and Vercel serverless functions should always use the pooler. Direct connections will exhaust limits under load.

---

## Vercel

### Preview deployments for E2E

Every PR gets a preview deployment with a unique URL. Use this as your `BASE_URL` for Playwright in CI:

```yaml
- name: Get preview URL
  id: preview
  run: echo "url=https://${{ github.event.pull_request.head.ref }}-yourorg.vercel.app" >> $GITHUB_OUTPUT

- name: Run E2E
  env:
    BASE_URL: ${{ steps.preview.outputs.url }}
  run: npx playwright test
```

Or use the Vercel CLI to fetch the latest preview URL: `vercel ls --token=$VERCEL_TOKEN`.

### Environment-specific code

```typescript
// Detect Vercel environment, not just NODE_ENV
if (process.env.VERCEL_ENV === 'production') {
  // production-only code
}
```

`VERCEL_ENV` is one of `production` | `preview` | `development`. More specific than `NODE_ENV`.

### Instant rollback

Dashboard → Project → Deployments → previous deploy → Promote to Production. No CLI required. Takes ~5 seconds. Build this muscle memory before launch day, not during.

### Serverless function cold starts

Cold starts can hit 1–3s on free/pro tiers. If your auth flow depends on a serverless function, run a load test specifically targeting that path — k6 will surface the cold-start tail.

Mitigation: enable `vercel.json` `functions.maxDuration` and consider Edge Runtime for low-latency paths.

---

## React + Vite

### `VITE_` env var prefix

Vite **only exposes** environment variables prefixed with `VITE_` to the client bundle. Everything else is server-side / build-time only.

```bash
# In .env:
VITE_SUPABASE_URL=https://xxx.supabase.co       # ✓ available in client
VITE_SUPABASE_ANON_KEY=eyJhbGc...               # ✓ available in client
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...            # ✓ NOT in client (correct!)
SECRET_API_KEY=sk_xxx                           # ✓ NOT in client (correct!)
```

**Common mistake:** prefixing a secret with `VITE_` "to make it work in the browser." Don't. If it's a secret, it should never be in the browser.

### Detect environment

```typescript
// CORRECT (Vite)
import.meta.env.MODE              // 'production' | 'development'
import.meta.env.PROD              // boolean
import.meta.env.DEV               // boolean

// WRONG (Webpack/Node convention — doesn't work in Vite client code)
process.env.NODE_ENV
```

### Bundle size

Run periodically:

```bash
npx vite-bundle-visualizer
```

**Targets:**
- Initial JS bundle: < 200KB gzipped
- Lazy-loaded routes: each < 100KB gzipped

Common bloat sources to investigate:
- `lodash` (use `lodash-es` and tree-shake, or use `radash`)
- `moment` (use `date-fns` or native `Intl.DateTimeFormat`)
- Full icon libraries (import individual icons, not the full set)
- Source maps shipped to production (check `vite.config.ts` `build.sourcemap` is `false` or `'hidden'`)

### Hydration mismatch

If you're using SSR or server components and seeing hydration warnings in production:
- Check for `Date.now()`, `Math.random()`, or locale-dependent formatting in render functions
- Verify `useEffect` is wrapping any DOM-only access
- Check that client and server render the same conditional branches

CallVault's stack is currently SPA (no SSR), so hydration isn't a concern — but if you migrate to Next.js or add Vite SSR, this becomes relevant.

---

## CI/CD

### Pin GitHub Actions by SHA

Floating tags are a supply-chain risk. Pin to commit SHAs:

```yaml
# Risky:
- uses: actions/checkout@v4

# Better:
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
```

Use Dependabot to auto-update these — it bumps SHAs and verifies changes.

### Branch protection bypass

Even with branch protection, repository admins can bypass it by default. Lock this down:

GitHub → Settings → Branches → main → check **"Do not allow bypassing the above settings"**.

Without this, an admin pushing directly to `main` skips all your CI gates.
