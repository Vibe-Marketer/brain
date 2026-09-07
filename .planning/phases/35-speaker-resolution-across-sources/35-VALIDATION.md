---
phase: 35
slug: speaker-resolution-across-sources
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-07
---

# Phase 35 — Validation Strategy

> Zero real multi-recording events exist in prod (events=0 rows, event_id NULL everywhere) and zero real anonymous-diarization-label rows exist in transcript_chunks (all 61,253 sampled rows are genuine names). This phase is untestable against real data — every fixture is synthetic. Per Andrew's standing directive: tests must prove real behavior, not ceremony. Keep fixture count lean; each test must be adversarially designed to fail if the real logic regresses, not just assert a happy path against fabricated data that could pass trivially.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Quick run command** | `npx vitest run supabase/functions/_shared/__tests__/speaker-resolver.test.ts` |
| **Full suite command** | `npm run test:integration` (TEST project) |

## Sampling Rate

- **Per task commit:** unit tests (pure module, no DB).
- **Per wave merge:** integration tests against TEST.
- **Phase gate:** full suite green before verify.

## Per-Task Verification Map

| Requirement | Secure/correct behavior | Test type | Why this proves something (not ceremony) |
|---|---|---|
| IDENT-04 | Named speaker from recording A fills an anonymous label in recording B for the same event, by real timeline overlap | unit — adversarial: two overlapping intervals that are CLOSE but don't actually overlap must NOT propagate a name | Proves the alignment logic actually checks overlap, not just "same event" |
| IDENT-05 | A source's over-segmented Speaker-1/Speaker-2 pair collapses to one labeled speaker when a labeled source shows one continuous speaker across that same interval | unit — adversarial: two genuinely DIFFERENT speakers on the unlabeled side must NOT be incorrectly collapsed | Proves consensus logic distinguishes real multi-speaker overlap from diarization over-segmentation |
| SC3 (stay unresolved) | Zero calendar/attendee/named-source evidence → speaker stays unresolved | unit — assert the resolver returns null/unresolved, not a guessed name, when evidence is absent | Direct proof of the no-guessing guarantee, mirrors Phase 34's DisplayNameCandidate literal-type pattern |

## Wave 0 Requirements

- [ ] `supabase/functions/_shared/speaker-resolver.ts` + unit test — new, synthetic fixtures only (no real-data sample exists to model from)

## Manual-Only Verifications

None — this phase has no real-data proof point available; everything is provable synthetically or it isn't provable at all yet.

## Validation Sign-Off

- [ ] Every test is adversarial (includes a case designed to fail if the logic is wrong), not happy-path-only
- [ ] No test asserts something that would also pass against a stub/no-op
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
