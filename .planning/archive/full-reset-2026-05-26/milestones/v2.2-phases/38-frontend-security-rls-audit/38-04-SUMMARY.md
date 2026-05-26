---
plan: 38-04
phase: 38
title: Cross-org cache audit + OAuth token client-side audit
status: complete
completed: 2026-05-12
requirements: [SEC-03C, SEC-03D]
---

# Plan 38-04 Summary

## What was built

Two security-hardening fixes shipped together:

1. **Cross-org cache clear on org switch** (SEC-03C) — Zustand subscription in `AuthContext` calls `queryClient.clear()` whenever `useOrgContextStore.activeOrgId` changes. Closes the gap where the existing SIGNED_OUT and account-switch handlers didn't fire on in-place org switching.

2. **OAuth token client-side isolation** (SEC-03D) — 5 client-side hooks/components no longer pull raw provider tokens. They now select `*_token_expires` timestamps and use truthiness checks for the "connected?" boolean signal.

Two audit docs document the findings:
- `docs/security/cross-org-cache-audit.md` — code-evidence audit + query-key factory coverage table.
- `docs/security/oauth-token-isolation.md` — every grep hit classified (Allowed / Fixed / Acceptable-Writes / Deferred).

## Files

**Modified:**
- `src/contexts/AuthContext.tsx` — added Zustand subscription useEffect for org-switch cache clear.
- `src/hooks/useSetupWizard.ts` — replaced `oauth_access_token` selects with `oauth_token_expires` (2 sites).
- `src/components/settings/IntegrationsTab.tsx` — same replacement.
- `src/components/import/FathomImportDetail.tsx` — same replacement.
- `src/hooks/useIntegrationSync.ts` — removed `oauth_access_token`, `google_oauth_access_token`, `zoom_oauth_access_token`, `zoom_oauth_refresh_token` from the select; connection checks now use `*_token_expires > now`. Type interface trimmed to match.

**Created:**
- `docs/security/cross-org-cache-audit.md`
- `docs/security/oauth-token-isolation.md`

## SEC-03C — Cross-org cache audit

**Before:** `queryClient.clear()` fired on logout (SIGNED_OUT) and on account-switch (SIGNED_IN with different user_id). It did NOT fire when the user toggled orgs within the same session — the existing `setActiveOrg` in `orgContextStore` was a clean Zustand setter with no cache integration.

**After:** New `useEffect` subscribes to the org-context store. On every `activeOrgId` transition (from non-null to a different value), the cache is cleared.

**Query-key factory audit:** keys for `recordings`, `folders`, `tags`, `workspaces`, `workspace-entries`, `organizations`, `contacts`, `routingRules`, and `rawCalls` already include `orgId` or a transitively-scoping ID (workspaceId, recordingId). Keys without orgId (`imports.*`, `sharing.sharedWithMe`, `teams.list`) either have zero callers (`calls.list`) or exceed the plan's <5-caller modification scope (deferred). All are defended by the new clear-on-switch hook anyway.

## SEC-03D — OAuth token client-side audit

**Grep audit** (`grep -rn "access_token\|refresh_token" src/`) classified every hit:

| Category | Count | Status |
|----------|------:|--------|
| Allowed (Supabase JWT only — `session.access_token`) | 6 | OK |
| Fixed in Phase 38 (provider tokens replaced with `_token_expires`) | 5 | Done |
| Acceptable writes (null-writes during disconnect flow) | 4 | OK |
| Deferred (Zoom refresh-token presence signal needs server-derived view) | 1 | v2.3 BACKLOG |

The 5 fixed sites covered IntegrationsTab, FathomImportDetail, useSetupWizard (×2), and useIntegrationSync. The latter was the most complex — it was selecting 10 columns including 3 raw provider tokens. Post-fix, it selects only 4 `_token_expires` timestamps + email + poll_at. The Fathom and Zoom "connected?" checks now use `expires && expires > now` instead of `(access_token && expires && expires > now)`.

The deferred item (Zoom refresh-token presence) is a defense-in-depth nice-to-have: today the server's refresh job nulls out `zoom_oauth_token_expires` on failure, so the truthiness signal stays correct. The v2.3 follow-up would add a server-derived `has_zoom_refresh_token` boolean to make this explicit.

## Verification

- `grep -c "Active org changed" src/contexts/AuthContext.tsx` → 1.
- `grep -rn "oauth_access_token\|oauth_refresh_token" src/ | grep -v "src/types/supabase.ts" | grep -v "\.test\." | grep -v "// SEC-03D"` — only 4 hits remain, all in `import-sources.service.ts` and all are `null` writes (disconnect flow).
- `npm run type-check` exits 0.
- `npm run build` exits 0.

## Self-Check: PASSED

- [x] AuthContext clears cache on org switch.
- [x] Query-key factory audited; remaining gaps documented.
- [x] 5 client-side raw-token reads replaced with `_token_expires` truthiness.
- [x] 4 remaining hits classified as acceptable null-writes.
- [x] `docs/security/cross-org-cache-audit.md` documents result.
- [x] `docs/security/oauth-token-isolation.md` documents every hit + result.
- [x] SEC-03C satisfied.
- [x] SEC-03D satisfied.
