---
phase: 40
researched: 2026-05-12
status: complete
---

# Phase 40 — Research

> CONTEXT.md is highly specified (locked decisions inline). This document captures only the load-bearing technical findings that inform `40-01-PLAN.md` through `40-04-PLAN.md`.

## RESEARCH COMPLETE

## Domain Findings

### 1. Where the canonical "single Fathom call" fetch path lives

Phase 39's `fathom-reconcile` already implements every primitive `fathom-refresh` needs:

| Primitive | Source | Lines |
|-----------|--------|-------|
| `resolveCredentials(supabase, sourceId, userId)` — reads OAuth tokens (encrypted or plain) | `supabase/functions/fathom-reconcile/index.ts` | 46–83 |
| `refreshIfExpired(supabase, sourceId, creds)` — refreshes expired OAuth token | same | 85–128 |
| `syncOneMeeting(supabase, userId, sourceId, meeting)` — normalizes a single Fathom meeting JSON, calls `runPipeline`, upserts mirror | same | 136–238 |
| `FathomClient.fetchWithRetry` — exponential backoff + 429 handling | `_shared/fathom-client.ts` | full file |

**Decision:** Copy these primitives' shape into `fathom-refresh/index.ts`, but for a SINGLE meeting fetched directly by `recording_id`. Do NOT import from `fathom-reconcile/index.ts` (edge functions are sandboxed per-function — cross-function imports break the deploy bundler). Extract shared helpers via plain copy.

### 2. The single-meeting Fathom endpoint

The Fathom external API exposes a meeting list at `GET /external/v1/meetings`. A direct "fetch one meeting by recording_id" endpoint is NOT documented separately — `fathom-reconcile` paginates the LIST endpoint with filters.

**Strategy:** Use the list endpoint with `recording_id` filter when possible, else fetch with a tight `created_after` window. Concretely:

```typescript
const url = new URL('https://api.fathom.ai/external/v1/meetings');
url.searchParams.append('limit', '1');
url.searchParams.append('include_transcript', 'true');
url.searchParams.append('include_summary', 'true');
url.searchParams.append('recording_id', String(legacyRecordingId));
```

If the API rejects `recording_id` as a query param, fall back to:
1. Read `recording_start_time` from `fathom_raw_calls` for this recording (Phase 39 mirror).
2. Set `created_after = start - 1 day`, paginate up to 5 pages with limit=50.
3. Find the row where `meeting.recording_id === legacyRecordingId`.

Plan `40-01` implements both paths and selects at runtime by probing.

### 3. UUID → legacy_recording_id resolution

Already solved by Phase 30. `src/lib/recording-ids.ts` exports `toRecordingUuid`. The edge function needs the reverse direction (UUID → BIGINT legacy id). This is a single SELECT against `recordings`:

```typescript
const { data: rec } = await supabase
  .from('recordings')
  .select('id, legacy_recording_id, organization_id, owner_user_id, source_app, created_at')
  .eq('id', recordingUuid)
  .maybeSingle();
```

Authorization: `rec.owner_user_id === authenticatedUserId` (matches Phase 37 SEC-04 patterns + the rest of `supabase/functions/_shared/auth.ts`).

### 4. Which fields are "preserved" vs "overwritten"

The CONTEXT lists the invariants. Mapping them to actual columns:

**Preserved (must NOT be touched by the UPDATE):**
- `recordings.id` — UUID stays (we UPDATE WHERE id = ?)
- `recordings.organization_id` — not in UPDATE SET
- `recordings.owner_user_id` — not in UPDATE SET
- `recordings.legacy_recording_id` — not in UPDATE SET
- `recordings.source_app` — not in UPDATE SET
- `recordings.source_call_id` — not in UPDATE SET
- `recordings.created_at` — not in UPDATE SET
- `workspace_entries.*` rows for this recording — UNTOUCHED
- `folder_assignments` rows keyed by `call_recording_id` (legacy id) — UNTOUCHED
- `call_tag_assignments` rows keyed by UUID — UNTOUCHED
- `tag_assignments` rows — UNTOUCHED

**Overwritten:**
- `recordings.title`
- `recordings.full_transcript`
- `recordings.summary`
- `recordings.duration`
- `recordings.recording_end_time` (recomputed from new Fathom payload — same start time)
- `recordings.synced_at` (NEW value — current timestamp)
- `recordings.source_metadata` (merged: keep existing keys, overwrite Fathom-managed keys like `summary`, `synced_at`, `fathom_url`)

**Mirror also re-upserted:**
- `fathom_raw_calls` row matching `(recording_id, user_id)` — full re-upsert with `mirror_version` retained from existing row (or 1).

### 5. Frontend cache invalidation keys

From `src/lib/query-config.ts`, the relevant keys are:

| Key | Used by |
|-----|---------|
| `queryKeys.calls.detail(canonicalUuid)` | `useCallDetailQueries` |
| `queryKeys.rawCalls.detail(canonicalUuid, 'fathom')` | `useRawCallData` (verify exact shape) |
| `queryKeys.calls.list()` | Workspace + folder views |
| `queryKeys.recordings.detail(canonicalUuid)` | TranscriptsTab, transcripts list |

**Action:** After `fathom-refresh` returns success, `queryClient.invalidateQueries({ queryKey: queryKeys.calls.detail(uuid) })` plus a coarse `queryClient.invalidateQueries({ queryKey: queryKeys.calls.all })` to catch list views.

### 6. Real-DB integration test pattern

Established in Phase 39 (`src/test/migrations/phase39-fathom-mirror-schema.integration.test.ts`):
- Use `makeIntegrationClient()` + `integrationDbReachable` from `src/test/integration-setup.ts`.
- Use the "donor" pattern (find existing user with fathom data) to avoid `auth.users` admin perms.
- Use a synthetic recording_id ABOVE Fathom's real range (e.g. `9_900_000_000_000 + rand`).
- ALWAYS clean up in `afterAll` (idempotent re-run).

**For Phase 40:** Insert a fixture recording + workspace_entry + folder_assignment + call_tag_assignment, call `fathom-refresh` against a stubbed Fathom response (cannot hit real Fathom in CI — use a flag/env to switch between live + stub), then SELECT the row and assert which fields changed.

The cleanest pattern: don't stub Fathom. Instead, factor the "fetch single meeting from Fathom" into a single module-internal function and write a SECOND test that verifies the UPDATE-and-preserve invariants using a hand-built `meeting` JSON object passed directly to `syncOneMeetingRefresh()`. The HTTP path is contract-tested separately.

## Validation Architecture

(Nyquist Dimension 8 — required for plan-checker)

| Dim | Probe | Threshold |
|-----|-------|-----------|
| Inputs | Recording UUID, user JWT | UUID valid + recording owned by user |
| Outputs | Updated `recordings` row | title/transcript/summary/duration changed; UUID/org_id/owner_id/created_at unchanged |
| Errors | 404, 401, 429, 500 | Correct status code + body per CONTEXT.md error-handling matrix |
| Side effects | `fathom_raw_calls` upsert | recording_id + user_id match input |
| Invariants | workspace_entries, folder_assignments, call_tag_assignments | Row counts unchanged after refresh |
| Performance | p95 < 5s for a single Fathom refresh | Manual measure during dev-browser verify |
| Concurrency | Two refresh calls in flight for same UUID | Last-write-wins is acceptable (no locking required for v1) |
| Auth | Different-org user calls refresh | 404 (RLS denies SELECT) — never 200 |

