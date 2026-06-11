---
phase: 01
slug: paste-pipeline-polish
status: human_needed
verified: 2026-06-11
verifier: Retroactive bookkeeping audit (01-09 archive audit follow-up) — static probes + targeted test run
---

# Phase 01 — Retroactive Verification

> Phase executed 2026-05-27 (5/5 plans, all SUMMARYs present). No formal phase-level verification record existed; this record was created retroactively on 2026-06-11 from cheap local probes. No deploys or browser checks were run for this record.

## Success Criteria (from ROADMAP)

| # | Criterion | Status | Evidence (2026-06-11 probes) |
|---|-----------|--------|------------------------------|
| 1 | VTT/SRT/Otter paste produces timestamped segments + inferred speakers; raw fallback unchanged | **passed** (fixture-level) | Parsers exist: `supabase/functions/_shared/{vtt,srt,otter,loom,fathom-transcript}-parser.ts`. Test run today: `npm test -- --run` on `loom-parser.test.ts` (7), `save-pasted-transcript.test.ts` (23), `import-source-flow.test.ts` (14) — **44/44 passed**, 452ms. |
| 2 | `save-pasted-transcript.integration.test.ts` runs against real Supabase, exercises auth/dedup/format-detection/membership, gates CI on green | **human_needed** | File exists and uses real `createClient` from `@supabase/supabase-js` — no `vi.mock` of the client (probe today). BUT the suite **skips** (15 tests) without seeded `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` / `TEST_ORG_ID` / `OTHER_ORG_ID` env (per 01-04-SUMMARY and STATE.md todo). It has never executed against a seeded real Supabase project in any recorded session. |
| 3 | Failed pastes show friendly inline errors — never stack trace, never silence | **human_needed** | Error-handling code shipped in `PasteTranscriptModal.tsx` per 01-02-SUMMARY, but the planned Interceptor browser walkthrough was blocked (`tab_create` timeout, recorded in 01-04-SUMMARY). No visual proof exists. |
| 4 | `FileUploadDropzone` removed from import flow surfaces; build clean; Edge Function stays deployed | **passed** (code-level) | Probe today: `rg "import.*FileUploadDropzone" src/` → 0 matches. Component file remains (`src/components/import/FileUploadDropzone.tsx`, intentionally retained, unreferenced); only other hit is the guard test `ImportPage.connector-routing.test.ts`. Route/flow/registry guard tests passed 2026-05-27 (38 tests, 01-03-SUMMARY) and `import-source-flow.test.ts` re-passed today. `file-upload-transcribe` deployment status not re-probed (no deploy checks in this record). |
| 5 | `docs/architecture/transcript-formats.md` documents canonical CallVault JSON shape | **passed** | File exists (5.7K); documents `TranscriptSegment` interface, `recordings.transcript_segments` JSONB canonical shape, detection heuristics, and raw fallback contract. |

## Human-needed items

1. Seed `TEST_USER_*` / `TEST_ORG_ID` / `OTHER_ORG_ID` fixtures and run the 15 skipped real-Supabase integration tests for `save-pasted-transcript` (criterion 2).
2. Browser walkthrough of failed-paste UX (bad format, dedup hit, parse error, permission denied) on `/import` (criterion 3).
3. Confirm `file-upload-transcribe` Edge Function is still deployed (criterion 4, deploy-side half).

## What this record does NOT prove

- No live paste against production or staging.
- CI gating on the integration suite is not demonstrated — the suite self-skips in the current environment.

## Sign-off

- [x] All 5 criteria assessed against disk + targeted test run (44/44 green, 2026-06-11).
- [x] Code-level criteria (1, 4, 5) confirmed by probes.
- [ ] Live/visual criteria (2, 3) — human verification still required; listed above.
