# Phase 35 Plan 01: Live-Verified Design Notes

**Verified:** 2026-09-07, this session, against TEST project (`.env.test`) via REST + generated schema (`src/types/supabase.ts`, kept in sync with live DB). No `.env` (prod credentials) exists in this worktree, so prod could not be re-queried live in this task — prod facts below are carried from `35-RESEARCH.md`'s own live-prod introspection (same milestone, `vltmrnjsubfzrgrtdqey`) and flagged as such, not re-verified here. Read-only throughout; zero DDL, zero writes.

## Finding 1: `recordings` timing columns — exact live schema

Live TEST REST introspection (`select=*` on `recordings`) + generated schema cross-check confirm the **exact** column set (no guessing beyond what's live):

| Column | Type | Notes |
|---|---|---|
| `recording_start_time` | `timestamptz` (nullable) | The only "recording started at" candidate that exists. `started_at`, `start_time`, `call_date`, `recorded_at`, `meeting_start` do **not** exist as columns — RESEARCH.md's candidate list was speculative; only `recording_start_time` is real. |
| `recording_end_time` | `timestamptz` (nullable) | Companion column, also exists. |
| `created_at` / `synced_at` / `updated_at` | `timestamptz` (non-null) | Ingest-pipeline timestamps, NOT capture start time — do not conflate with `recording_start_time` (they reflect when CallVault synced the row, not when the call began). |

**Populated fraction — TEST project:** 0/7 rows have `recording_start_time` populated (all 7 live TEST recordings show `recording_start_time: null`, `recording_end_time: null`). TEST project also has **0 rows in `transcript_chunks`** at all (`content-range: */0` on an unfiltered count) and only 7 `recordings` rows total. TEST is not a usable population sample for this question — it has essentially no organic call data. This means Task 1 cannot independently reconfirm the fraction from TEST; the only actual population evidence is a corpus of 54,373/61,253 (~89%) `transcript_chunks.timestamp_start`-populated rows against **prod** (per 35-RESEARCH.md, live-verified in this same milestone but not re-confirmed in this task). `recording_start_time`'s own populated fraction on `recordings` specifically (as opposed to `transcript_chunks.timestamp_start`) was never live-sampled by RESEARCH.md either — this remains an open gap: we know the *column exists* with confidence, but not its prod fill-rate independent of `timestamp_start`.

**Precision:** `timestamptz` — full second precision (ISO-8601 with offset), not minute-granularity. If populated, `recording_start_time` is precise enough for meaningful interval-overlap math.

**Conclusion:** `recording_start_time` is confirmed as a real, correctly-typed column (matches RESEARCH.md's A1 assumption exactly — not a false citation). Its prod fill-rate specifically is still unconfirmed live; TEST offers zero signal either way (0/7 populated, but n=7 is not a meaningful sample and TEST data is clearly synthetic/thin, not representative of prod's real usage). This is the single open fact the Task 2 decision must be made against: **A1 (derived absolute instant) is schema-viable but its real-world reliability is not independently reconfirmed this session; A2 (coarse fallback) has no compensating live evidence problem since it doesn't depend on this column at all.**

## Finding 2: `transcript_chunks.timestamp_start`/`timestamp_end` — reconfirmed shape

Generated schema (`src/types/supabase.ts:4235-4260`) confirms: `timestamp_start: string | null`, `timestamp_end: string | null` — both nullable free-text (`TEXT`), no format constraint at the schema level (matches RESEARCH.md's live-sampled `"HH:MM:SS"` format finding). No numeric offset column exists on `transcript_chunks` (see Finding 3).

## Finding 3: `canonical-recording.ts` `startSeconds` — does NOT survive to persisted `transcript_chunks`

Confirmed by direct read of `supabase/functions/_shared/canonical-recording.ts` + the live `transcript_chunks` schema:

- `CanonicalTranscriptTurn.startSeconds`/`endSeconds` (numeric, seconds-offset) is an **in-memory ingest-time field only**.
- `canonicalTurnsToSegments()` converts each turn into a `CanonicalTranscriptSegment`, which **does** carry `start_seconds`/`end_seconds` as numeric fields (lines 20-29) — but that segment shape is `recordings.transcript_segments` (a `Json` column on `recordings`, confirmed at `src/types/supabase.ts:3236`), not `transcript_chunks`.
- The only value that reaches the segment's persisted-adjacent text form is `timestamp: formatOffset(startSeconds ?? 0)` — a `"H:MM:SS"`/`"M:SS"` **string**, matching the same lossy TEXT-offset shape RESEARCH.md already flagged for `transcript_chunks.timestamp_start`.
- `transcript_chunks` itself (confirmed schema, Finding 2) has no `start_seconds`/`end_seconds` numeric columns at all. Whatever process populates `transcript_chunks` from `recordings.transcript_segments` (a DB-side parse — `supabase/migrations/20260528070000_codify_parse_transcript_to_segments.sql`, not re-read in full this session due to scope) evidently does not carry the numeric offset through; it re-derives/reuses the string `timestamp_start`.

**Verdict:** The numeric `startSeconds` anchor RESEARCH.md's Open Question 1 hoped might be "a cleaner future alignment signal" is **not currently available** at the layer this phase reads (`transcript_chunks`). It exists transiently in `recordings.transcript_segments` (JSON) during/shortly after ingest, but Phase 35's stated scope reads `transcript_chunks`, not `recordings.transcript_segments` directly. Using it would mean a second read path against a different table's JSON blob — an architecture change beyond this phase's locked scope, not a drop-in anchor swap. This closes RESEARCH.md's tertiary-source Open Question definitively: **not viable without a schema/scope change**, so it must not be adopted this phase.

## Decision Inputs for Task 2 (live data, not assumptions)

- **Anchor candidate A1** (`recording_start_time` + parse `timestamp_start`): schema-real, `timestamptz` second-precision, TEXT offset ~89% populated on prod `transcript_chunks` per RESEARCH.md's prior live sample — but `recording_start_time`'s own prod fill-rate was never independently sampled (this session's TEST sample is too thin/empty to help, and prod creds are unavailable in this worktree).
- **Anchor candidate A2** (coarse same-event fallback, no fine-grained interval): has no live-data dependency risk at all — always available regardless of `recording_start_time` fill-rate.
- **`startSeconds` as an anchor:** ruled out this session (Finding 3) — not persisted to `transcript_chunks`, out of locked scope to adopt.
- **Write-target B1 (`identity_aliases` evidence)** vs **B2 (new `speaker_resolution_decisions` ledger)**: no new live data surfaced this session beyond RESEARCH.md's existing analysis (`identity_aliases.evidence` is a plain `text` column, confirmed at `src/types/supabase.ts` — confirms RESEARCH.md's A3 concern that it may not hold rich per-decision provenance like donor recording, interval, or confidence as structured fields; it would need a delimited/serialized string).

These are the exact live findings the Task 2 checkpoint should present to the human — see 35-01-PLAN.md's Task 2 options block, options `anchor-derived-absolute`, `anchor-coarse-fallback`, `write-evidence`, `write-ledger`.
