# Plan 37-03 Summary — Shared-Auth Migration

**Status:** COMPLETE
**Date:** 2026-05-12
**Requirements closed:** SEC-02A

## Result

| Category | Count |
|----------|------:|
| Migrated this plan | 26 |
| Already migrated (SEC-01E baseline) | 4 |
| Exempt (webhook + custom auth) | 6 |
| Needs cleanup review (no JWT pattern found) | 2 |
| **Total** | **38** |

**Verification:** `grep -lr "authHeader.replace('Bearer " supabase/functions/` returns only `mcp-server/index.ts` ✓ (expected exempt).

## Functions Migrated

apply-routing-rules, auto-tag-calls, create-fathom-webhook, fathom-oauth-refresh, fathom-oauth-url, fetch-meetings, generate-ai-titles, generate-content, global-search, polar-cancel, polar-checkout, polar-create-customer, polar-customer-state, save-host-email, save-pasted-transcript, split-recording, summarize-call, sync-meetings, track-ai-usage, youtube-api, youtube-import, zoom-fetch-meetings, zoom-oauth-callback, zoom-oauth-refresh, zoom-oauth-url, zoom-sync-meetings.

## Migration Notes

- `sync-meetings` and `zoom-sync-meetings` reintroduce a local `const jwt` after the shared-auth call because they forward the user's JWT to downstream `generate-ai-titles` / `auto-tag-calls` invocations. Documented in the audit doc Section A.6.
- `mcp-server` retains its manual Bearer extraction — it uses a custom MCP OAuth (hex tokens OR Supabase OAuth JWT). Rationale comment added to file header.
- `teams` and `fetch-single-meeting` show no `authHeader.replace` pattern. Flagged for v2.3 cleanup review (out of phase scope).

## Mechanical Details

- Migration ran via `/tmp/migrate-shared-auth.py` (block-based regex replace + import insertion + `user.id` → `userId` substitution).
- Pattern recognized two variable-name variants: `error: userError` and `error: authError`; token variants `token` and `jwt`.
- Files lint clean (`deno lint` against each modified file).
- Type-checking via `deno check` reveals 57 pre-existing type errors caused by `esm.sh/@supabase/supabase-js@2` type signature drift; these are project-wide, predate this phase, and do not affect runtime (Supabase Edge Runtime bundles via `supabase functions deploy --use-api`).
