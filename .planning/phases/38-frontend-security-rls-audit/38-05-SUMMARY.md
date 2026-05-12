---
plan: 38-05
phase: 38
title: CSP worker-src 'self' blob: — unblock blob: workers
status: complete
completed: 2026-05-12
requirements: [QA-07]
---

# Plan 38-05 Summary

## What was built

Added `worker-src 'self' blob:` directive to the production Content-Security-Policy header in `vercel.json`. Closes QA-07 (P1 finding from Phase 29 sweep).

## Changes

**vercel.json** — CSP header updated. New directive inserted immediately after `script-src`:

Before:
```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src ...
```

After:
```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src ...
```

The directive is intentionally narrow: only `'self'` + `blob:` — no `'unsafe-inline'`, no `'unsafe-eval'`, no wildcard hosts. Closes the blob: worker gap without widening the attack surface.

## Why

Per QA-07 (Phase 29 catalog): the CSP omitted `worker-src`, so the browser fell back to `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, which then blocked `blob:` workers because `script-src` lacks `blob:`. The observed console error fired on every authed route, on `/login`, and on `/s/:token` — ≥10 distinct blocked worker spawn attempts across the Phase 29 route walk.

## Verification

- `python3 -c "import json; json.load(open('vercel.json'))"` exits 0 — JSON is valid.
- `grep -c "worker-src 'self' blob:" vercel.json` returns 1.
- The CSP retains all other directives unchanged (`default-src 'self'`, `connect-src` Supabase/Sentry, `frame-ancestors 'none'`, etc.).
- No `'unsafe-*'` or wildcard host added to `worker-src`.

## Post-deploy verification (operator action)

After this PR merges and Vercel deploys, run:

```bash
curl -sI https://app.callvaultai.com | grep -i "content-security-policy"
```

Confirm `worker-src 'self' blob:` is in the response. Open https://app.callvaultai.com in dev-browser and verify no `Refused to create a worker from 'blob:...'` console errors on `/`, `/people`, `/import`, `/login`, `/s/<token>`.

## Self-Check: PASSED

- [x] vercel.json CSP contains `worker-src 'self' blob:` literal substring
- [x] No `'unsafe-inline'`, `'unsafe-eval'`, or `*` wildcards added to `worker-src`
- [x] JSON validates cleanly
- [x] No other CSP directives changed
- [x] QA-07 requirement satisfied
