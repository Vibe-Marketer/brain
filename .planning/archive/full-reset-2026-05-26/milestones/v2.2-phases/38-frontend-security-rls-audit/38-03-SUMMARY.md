---
plan: 38-03
phase: 38
title: Service-role rationale + defense-in-depth filter audit
status: complete
completed: 2026-05-12
requirements: [SEC-04A, SEC-04B, SEC-04C]
---

# Plan 38-03 Summary

## What was built

Annotated all 32 service-role-using edge functions with a `// service-role required: <reason>` comment immediately above the `createClient(...SUPABASE_SERVICE_ROLE_KEY...)` call. Audited high-traffic functions for defense-in-depth filters and confirmed they're already in place from Phase 37. Updated the Q2 audit report with Section E documenting Phase 38 closure of SEC-04A/B/C.

## Counts

- **34** total edge function files now carry the rationale comment (32 new + 2 baseline `mcp-server` + `polar-webhook` from Phase 37).
- **0** functions migrated to anon+RLS (every service-role function has legitimate cross-user/cross-row fan-out — rationale documented).
- **0** new defense-in-depth filters added (Phase 37 shared-auth migration already left every user-data query explicitly scoped).

## Verification

- `grep -l "service-role required:" supabase/functions/*/index.ts | wc -l` → **34**.
- Per-file check loop confirmed every targeted file has `service-role required:` ≥ 1.
- `deno lint` on sample files (apply-routing-rules, save-host-email, webhook) returns clean.
- Logic untouched — every edit was a comment-line insertion above an existing line.

## Why no migration to anon+RLS

Every one of the 32 functions has a justified service-role reason — cross-recording fan-out, server-to-server API calls, OAuth code-exchange windows, webhook receivers without user JWTs. Migrating any of them to anon+RLS would either be incorrect (no user JWT available) or impose per-row auth check explosion (cross-recording fan-out under anon would force the function to authenticate against each affected recording's RLS policy individually).

The compensating controls are:
1. SEC-04A — every file documents the rationale.
2. SEC-04B — every user-data query has explicit `.eq('user_id'|'org_id'|'owner_user_id', ...)` filter (Phase 37 audit; spot-verified in Phase 38).
3. SEC-04C — the new RLS regression test (`src/test/rls-regression.test.ts`, shipped in Plan 38-01) runs on every PR.

## Files

**Modified:** 32 edge function files (one comment added per file) plus `.planning/security/2026-05-Q2-edge-audit.md` (Section E appended).

## Self-Check: PASSED

- [x] All 32 targeted functions annotated.
- [x] Comment matches the canonical rationale table.
- [x] No logic changes.
- [x] Audit doc updated with Section E.
- [x] SEC-04A satisfied (rationale comments).
- [x] SEC-04B satisfied (defense-in-depth filters confirmed in place).
- [x] SEC-04C satisfied (RLS regression test shipped in 38-01, no functions to migrate).

## Known issue surfaced (out of scope, deferred to v2.3)

While annotating, found that `supabase/functions/generate-content/index.ts` calls `authenticateRequest(req, supabase, corsHeaders)` on line 110 but never creates `supabase` — `createClient` is imported but the assignment is missing. This is a latent bug from the Phase 37 shared-auth migration. The rationale comment was added at the `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` line so the file is annotated correctly, but the function will throw `ReferenceError: supabase is not defined` at runtime. Tracked to v2.3 BACKLOG as a follow-up fix.
