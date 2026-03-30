# Deferred Items — Phase 12

## Pre-existing Build Failure (Out of Scope)

**File:** `src/pages/OAuthCallback.tsx` line 7
**Issue:** `import { completeZoomOAuth } from "@/lib/zoom-api-client"` — file `src/lib/zoom-api-client` does not exist
**Impact:** Production build fails with ENOENT error
**Origin:** Pre-dates Phase 12 — introduced in a prior commit (not caused by this phase)
**Action needed:** Either create the missing `zoom-api-client.ts` lib file or remove the import if unused
**Tracking:** This must be resolved before production deployment; not in scope for Plan 12-01
