---
phase: 01
slug: paste-pipeline-polish
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-27
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Vite build + browser verification |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run supabase/functions/_shared/__tests__/srt-parser.test.ts supabase/functions/_shared/__tests__/otter-parser.test.ts supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` |
| **Full suite command** | `npm run build && npm test -- --run supabase/functions/_shared/__tests__/srt-parser.test.ts supabase/functions/_shared/__tests__/otter-parser.test.ts supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts` |
| **Estimated runtime** | ~90-180 seconds without real Supabase credentials; longer when integration env is present |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for parser/source regressions.
- **After every plan wave:** Run `npm run build` plus all Phase 1 unit/source tests.
- **Before `$gsd-verify-work`:** Full suite must be green; real-Supabase integration tests must either pass with credentials or explicitly skip due to missing credentials.
- **Max feedback latency:** 180 seconds for local parser/build checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | Parser contract | 1 | MAN-02 | T-01/T-02 | Malformed structured transcripts preserve raw text; missing speakers are not invented | unit/source | `npm test -- --run supabase/functions/_shared/__tests__/srt-parser.test.ts supabase/functions/_shared/__tests__/otter-parser.test.ts supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | pending | pending |
| 01-02-01 | Import Transcript UX | 1 | MAN-05 | T-01/T-03 | User sees transcript-import language and friendly inline errors | build/browser | `npm run build` plus browser walkthrough | pending | pending |
| 01-03-01 | Hide file upload | 1 | MAN-06 | T-03/T-04 | Audio/video upload entry points are hidden; compatibility source handling remains | build/source/browser | `npm run build` plus `rg "FileUploadDropzone|file-upload" src` review | pending | pending |
| 01-04-01 | Integration verification | 2 | MAN-04 | T-05 | Real Supabase behavior is tested without mocked clients | integration | `npm test -- --run supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts` | pending | pending |

---

## Wave 0 Requirements

- [ ] Confirm whether `supabase/functions/_shared/__tests__/loom-parser.test.ts` exists; add it if Loom parser behavior is changed.
- [ ] Confirm `save-pasted-transcript.integration.test.ts` skips safely without all required `SUPABASE_TEST_*` env vars.
- [ ] Confirm browser verification tooling is available for `/import` UI walkthrough.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audio/video upload not reachable from UI | MAN-06 | Requires navigation and visual inspection of import/onboarding surfaces | Open `/import`, onboarding, and source list surfaces; verify no File Upload/audio/video dropzone CTA appears |
| Import Transcript accepts transcript files | MAN-02/MAN-05 | File chooser behavior is browser-mediated | Open Import Transcript modal and verify `.vtt`, `.srt`, `.txt`, `.md` are accepted while copy does not imply audio/video transcription |
| Real-Supabase integration test pass | MAN-04 | Requires seeded test credentials | Run integration test with `SUPABASE_TEST_URL`, anon key, service key, seeded user credentials, `TEST_ORG_ID`, and `OTHER_ORG_ID` |

---

## Validation Sign-Off

- [x] All tasks have automated or manual verify paths.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers missing verification prerequisites.
- [x] No watch-mode flags.
- [x] Feedback latency target is under 180 seconds for local checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
