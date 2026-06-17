# Ticket ceeaaf33 — AI title generation says "None of the selected calls have a Fathom recording ID" on a real Fathom call

**Outcome: NO code changes made.** The only correct fix requires a database schema /
migration change, and this worktree is hard-barred from touching `supabase/migrations/**`.
Routing to a human.

## What the user reported

User selected a call that *is* a Fathom call and clicked **Generate AI Titles**. Got:

> "None of the selected calls have a Fathom recording ID. AI title generation requires
> calls synced from Fathom."

User's own hypothesis: the call was moved/copied between organizations and lost its
`source = fathom` / original import source in the process. **That hypothesis is essentially
correct** — confirmed by code + migration analysis below.

## Root cause (fully traced through frontend → edge function → display RPC → copy migration)

The call is a **cross-org copied Fathom call**. When a recording is copied to another org via
`copy_recording_to_organization` (migration `20260331050000_fix_copy_recording_timeout_v2.sql`),
the copy:

- ✅ copies `recordings.full_transcript` (the transcript IS present in the target org)
- ✅ preserves `recordings.source_app = 'fathom'`
- ❌ leaves `recordings.fathom_provider_id` = NULL (not copied)
- ❌ sets `recordings.source_call_id` = NULL (line 130: "NULL to avoid dedup constraint collision")
- ❌ creates **no** `fathom_raw_calls` row in the target org (per the comment in
  `20260309210000_fix_cross_org_routing_chunks_and_workspace.sql`: "Copied recordings do not
  have a fathom_calls entry in the target org")

That single fact (no `fathom_provider_id`, no `fathom_raw_calls` row) breaks the feature at
**three** independent layers:

### Layer 1 — Frontend filter (the visible symptom)
`src/components/transcripts/useWorkspaces.ts:428` maps the call to a `Meeting` with
`recording_id: recording.fathom_provider_id ?? recording.id`. For a copied call
`fathom_provider_id` is NULL, so `recording_id` becomes the **UUID** (`recordings.id`).

`src/components/transcript-library/BulkActionToolbarEnhanced.tsx:218-229`
(`handleGenerateAITitles`, and the identical `handleAutoTagCalls:281-291`) filters with:
```js
const n = Number(c.recording_id);   // Number(uuid) === NaN
return !isNaN(n) && n > 0;          // → false → call filtered out
```
With every selected call filtered out, `recordingIds.length === 0` → the misleading
"None of the selected calls have a Fathom recording ID" toast fires. This is the exact error
the user saw.

### Layer 2 — Edge function (`supabase/functions/generate-ai-titles/index.ts`)
Even if the frontend passed a correct identifier, the function:
- accepts only numeric IDs (`generateTitlesSchema`: `z.array(z.number().int().positive())`,
  re-filtered at line 427 to `!isNaN(id) && id > 0`), and
- reads the transcript exclusively from `fathom_raw_calls` keyed by numeric
  `recording_id` + `user_id` (lines 457-462), returning "Call not found or unauthorized"
  when the row is absent.

A copied call has no numeric id to send and no `fathom_raw_calls` row to read. The transcript
it needs is sitting in `recordings.full_transcript`, which this function never looks at.

### Layer 3 — Display RPC (`get_workspace_recordings`)
Defined in migration `20260610121000_rename_legacy_recording_id_to_fathom_provider_id.sql`
(lines 413-468). It sources `ai_generated_title` only from
`LEFT JOIN fathom_raw_calls frc ON frc.recording_id = r.fathom_provider_id`. For a copied call
`r.fathom_provider_id` is NULL, so the join never matches and `ai_generated_title` is always
NULL in the UI — i.e. even a successfully generated title would never display.

Also note: the `recordings` table has **no `ai_generated_title` column** (verified in
`src/types/supabase.ts` recordings Row, lines 2855-2881). AI titles are stored only in
`fathom_raw_calls.ai_generated_title`.

## Why no code change was made

A frontend-only change (e.g. passing `canonical_uuid`, or relaxing the `Number()` filter) would
only swap one error for another — the edge function would reject/!find it (Layer 2), and even if
it didn't, the title would never surface in the UI (Layer 3). That would be a speculative partial
fix, not a real one.

A complete fix necessarily changes the database layer, which is off-limits here:
- **Layer 3** (`get_workspace_recordings`) lives in `supabase/migrations/**`.
- The cleanest real fixes (below) all add a column and/or change SQL functions = migrations.

## Recommended fix for a human (pick one path)

**Option A — store/read AI titles on the canonical `recordings` row (preferred, generalizes
to all non-Fathom sources too):**
1. Migration: add `ai_generated_title` (+ `ai_title_generated_at`) to `recordings`.
2. Migration: change `get_workspace_recordings` to
   `COALESCE(r.ai_generated_title, frc.ai_generated_title)`.
3. Edge function `generate-ai-titles`: accept UUIDs (widen the zod schema), resolve via
   `src/lib/recording-ids.ts` (`toRecordingUuid`/`toRecordingUuidBatch`), read transcript from
   `recordings.full_transcript` when no `fathom_raw_calls` row exists, and write the title back
   to `recordings.ai_generated_title`.
4. Frontend `BulkActionToolbarEnhanced.tsx` (`handleGenerateAITitles` **and**
   `handleAutoTagCalls`): stop gating on `Number(recording_id)`; send the canonical id
   (`canonical_uuid ?? recording_id`) and let the backend resolve. Fix the misleading toast copy.

**Option B — backfill Fathom linkage on copy (narrower, keeps the Fathom-only model):**
Change `copy_recording_to_organization` to either preserve `fathom_provider_id` and create a
matching `fathom_raw_calls` row in the target org, or assign a new numeric id and seed
`fathom_raw_calls` (incl. `full_transcript`) so the existing numeric pipeline works unchanged.
Note: this still requires deciding how to backfill **already-copied** calls (a one-time data
migration).

Both options touch `supabase/migrations/**` and/or require deploying `generate-ai-titles`, so
they need an operator who can run migrations and verify end-to-end.

## How to reproduce (for the human)
1. In an org with a synced Fathom call, use "Copy to organization" to copy it to a second org.
2. Switch to the second org, open the transcript library, select the copied call.
3. Click **Generate AI Titles** → the "None of the selected calls have a Fathom recording ID"
   toast appears, despite the call being from Fathom and having a transcript.
   (Same applies to **Auto-tag** via `handleAutoTagCalls`.)

## Key file references
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx:218-229` (titles), `:281-291` (tags)
- `src/hooks/useWorkspaces.ts:416-475` (`mapRecordingToMeeting`, the `recording_id` fallback at :428)
- `supabase/functions/generate-ai-titles/index.ts:88-89, 425-462` (numeric-only, fathom_raw_calls-only)
- `supabase/migrations/20260610121000_rename_legacy_recording_id_to_fathom_provider_id.sql:413-468` (display RPC)
- `supabase/migrations/20260331050000_fix_copy_recording_timeout_v2.sql:93-134` (copy drops fathom linkage)
- `supabase/migrations/20260309210000_fix_cross_org_routing_chunks_and_workspace.sql:5-11` (no fathom_calls entry for copies)
