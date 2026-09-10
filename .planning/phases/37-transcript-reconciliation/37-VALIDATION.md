---
phase: 37
slug: transcript-reconciliation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-10
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project-wide); Deno-esm-import edge functions collected via the `resolve.alias` shim proven in Phase 32 |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npx vitest run supabase/functions/_shared/__tests__/transcript-reconciler.test.ts` |
| **Full suite command** | `rtk vitest run` (unit); `npm run test:integration -- reconcile-transcripts` (integration, TEST-project guarded) |
| **Estimated runtime** | ~20s unit, ~60s integration |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run supabase/functions/_shared/__tests__/transcript-reconciler.test.ts`
- **After every plan wave:** Run `rtk vitest run` full unit suite + relevant integration tests on TEST
- **Before `/gsd-verify-work`:** Full suite must be green, plus a live TEST-project introspection proof before any prod apply
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

Task IDs assigned. Each row maps onto the named plan task's `<verify>` block.

| Requirement | Plan · Task | Threat Ref | Secure/Correct Behavior | Test Type | Automated Command | Status |
|-------------|-------------|------------|--------------------------|-----------|-------------------|--------|
| RECON-01 | 37-02 T1 | — | Overlapping chunks align on a shared derived timeline within ±20s; non-overlapping remain unaligned | unit | `npx vitest run supabase/functions/_shared/__tests__/transcript-reconciler.test.ts -t align` | ⬜ pending |
| RECON-02 | 37-02 T2 | — | Token-level disagreement resolves by weighted vote (provider prior + confidence + majority) | unit | same file, `-t "weighted.vote"` | ⬜ pending |
| RECON-02 (adversarial) | 37-02 T2 | — | True 3-way tie resolves deterministically via fixed provider-priority order, identical output across runs | unit, negative/determinism | same file, `-t "deterministic"` | ⬜ pending |
| RECON-03 | 37-02 T2 | — | Entity lexicon tie-break prefers seeded correct spelling ("ChatGPT" over "ChatGBT") | unit | same file, `-t "entity.*lexicon"` | ⬜ pending |
| RECON-04 | 37-03 T3 | — | `transcript_chunks` rows never mutated by the reconciliation write path | integration, negative | `npm run test:integration -- reconcile-transcripts` | ⬜ pending |
| RECON-05 | 37-02 T3 · 37-03 T3 | — | Reconciled segment records `source_recording_ids`/`agreeing_recording_ids` accurately (sorted) | unit + integration | same files | ⬜ pending |
| RECON-06 | 37-02 T3 | — | Single-source interval marked single-source, never consensus | unit, negative | same file, `-t "single.source"` | ⬜ pending |
| RECON-07 | 37-03 T3 | — | Sweep never writes `transcript_chunks.embedded_at`/embedding, no embedding-pipeline call | integration, negative | `npm run test:integration -- reconcile-transcripts` | ⬜ pending |
| Cross-org isolation | 37-01 T3 | T-37-01 | `reconciled_transcript_segments` RLS enforces the underlying recording/chunk access boundary — no widening | integration, negative | `npm run test:integration -- rls-regression` | ⬜ pending |
| Same-org bucketing | 37-03 T1 · 37-03 T3 | T-37-02 | Chunk pairing + entity-lexicon reads scoped per-org, never cross-org | unit + integration, negative | reconcile-transcripts integration + rls-regression | ⬜ pending |
| Shared-secret gate | 37-03 T3 | T-37-03 | `reconcile-transcripts` rejects requests without valid `X-Reconcile-Secret` before any DB work | integration, negative | `npm run test:integration -- reconcile-transcripts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/functions/_shared/__tests__/transcript-reconciler.test.ts` — covers RECON-01 through RECON-06 (pure-function layer)
- [ ] `supabase/functions/_shared/transcript-reconciler.ts` — the pure module itself (test-first / RED-then-GREEN per this milestone's established TDD-by-convention pattern)
- [ ] `supabase/functions/reconcile-transcripts/index.ts` — forward-only edge function wrapper
- [ ] `supabase/migrations/<timestamp>_create_reconciled_transcript_segments.sql` — new table, styled on `speaker_resolution_decisions`
- [ ] Synthetic integration fixtures seeding `transcript_chunks` rows across 2+ synthetic recordings + one synthetic event with deliberately near-miss text (adversarial disagreement fixtures, not just happy-path identical text)
- [ ] `src/test/rls-regression.test.ts` — register `reconciled_transcript_segments` (cross-org isolation, with a real client-read SELECT policy given the UI tab reads it directly — unlike the service-role-only precedent of `event_match_decisions`/`speaker_resolution_decisions`)
- [ ] `src/components/call-detail/CallReconciledTranscriptTab.tsx` + `ReconciledSegmentProvenanceBadge.tsx` + `useReconciledTranscript.ts` hook + service — frontend layer, per 37-UI-SPEC.md
- [ ] Framework install: none — Vitest and the Deno-alias shim are already configured repo-wide

*Existing infrastructure otherwise covers this phase's requirements — no new test framework or runner needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reconciled tab renders correctly for a real multi-recording event once live on prod | RECON-01..06, UI-SPEC | End-to-end visual confirmation against real ASR output requires a live prod event with 2+ resolved recordings, deferred per this project's end-of-phase human-verify convention | Open a real multi-source event's Reconciled tab in prod; confirm segments render, provenance badges appear only on multi-source segments, and per-recording tabs are unaffected |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (set once the planner's tasks are mapped onto this table)

**Approval:** pending — finalized once plans exist and the per-task table is filled with concrete task IDs
