# Plan 37-05 Summary — Deployed-vs-Source Orphan Cleanup

**Status:** COMPLETE
**Date:** 2026-05-12
**Requirements:** SEC-05A, SEC-05B, SEC-05C

## Headlines

- **Before:** 77 deployed, 38 source — 39 orphan delta.
- **After:** 38 deployed, 38 source — 0 orphan delta.
- **All 39 confirmed-dead orphans auto-deleted** per CONTEXT.md policy (zero callers in repo + matched a removed feature area).
- **Zero ambiguous functions** — every orphan mapped to a documented removed feature (Google Meet via FOUND-09, automation-*, coach-*, content-*, team-*, manager-notes, dev utilities).

## Deletion Run

Bulk `supabase functions delete <name> --yes` for all 39 orphans on 2026-05-12. Every command returned `Deleted Function <name> from project vltmrnjsubfzrgrtdqey.`

Log: `/tmp/orphan-delete-log.txt`.

## Verification

`supabase functions list | grep -oE "\| [a-z][a-z0-9-]+ +\|" | sort -u | wc -l` returns **38** post-cleanup. Equal to source count.

## Followup (Non-Blocking Stale-Reference Cleanup)

Filed under v2.3 housekeeping — not blocking SEC-05 acceptance:

- `supabase/config.toml` line 76: remove `[functions.manager-notes]` block (function deleted; config entry orphaned).
- `src/lib/query-config.ts` line 117: remove the `managerNotes` query-key entry (function deleted; query-key has no caller).
- `supabase/functions/_shared/deduplication.ts` line 11: remove `google-meet-sync-meetings` from the SCOPE comment (function deleted; comment is stale).

## Acceptance

- [x] SEC-05A: `.planning/security/2026-05-Q2-deployed-source-delta.md` produced.
- [x] SEC-05B: every orphan cross-referenced; all 39 confirmed-dead.
- [x] SEC-05C: deployed count == source count (38 == 38).
