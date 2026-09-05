# Deferred Items — Phase 34 Identity Consolidation

Out-of-scope discoveries logged during plan execution per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## From Plan 05 (IdentityEvidenceBadge dev-browser verification)

**1. `transcript_tag_assignments` query returns HTTP 400 in `useCallDetailQueries.ts`'s `callTags` query**

- **Found during:** dev-browser-equivalent verification (real Playwright session against TEST) for Plan 05.
- **Observed:** `GET .../rest/v1/transcript_tag_assignments?select=tag_id%2Ctranscript_tags%28id%2Cname%2Ccolor%29&recording_id=eq.<uuid>&user_id=eq.<uuid>` returned 400 twice when opening the CallDetailDialog for a freshly-seeded recording with no tags.
- **Location:** `src/hooks/useCallDetailQueries.ts`, the `callTags` query (separate from `callSpeakers`, which Plan 05 modified). Pre-existing — this query and its shape were untouched by Plan 05's changes (only the `callSpeakers` query's select/mapping were modified).
- **Why deferred:** Out of scope per the scope-boundary rule — this is a different query in the same file, unrelated to identity_id/evidence work, and reproduces independently of any Plan 05 change (confirmed: the query text at these lines is byte-identical before and after Plan 05's edits).
- **Suggested follow-up:** Investigate whether `transcript_tag_assignments`'s embedded-resource select (`tag_id, transcript_tags(id,name,color)`) has an RLS or FK issue on recordings with zero tag assignments, or whether this is a TEST-project-only artifact (e.g., a stale PostgREST schema cache after Plan 02's migration). Does not block Plan 05 — the Participants/Speakers tab and its evidence popover render correctly regardless of this tag-fetch failure.
