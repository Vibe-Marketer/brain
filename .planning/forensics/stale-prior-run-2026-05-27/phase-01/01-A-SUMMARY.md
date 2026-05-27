---
phase: 1
plan: 01-A
status: completed
---

# 01-A-SUMMARY: Manual Transcript Parsers (SRT/Otter + Loom Bug Fix)

- Implemented SRT and Otter parser support for the paste path via `_shared/srt-parser.ts` and `_shared/otter-parser.ts`.
- Integrated SRT/Otter detection and normalization into `save-pasted-transcript` and `PasteTranscriptModal`.
- Included the user-reported Loom paste bug fix as valid Phase 1 scope: `loom-parser.ts` is integrated when a Loom share URL is supplied.
- Added source-level regression coverage so the Edge Function imports the exact SRT symbols it calls and allows explicit SRT/Otter/Loom `source_app` values.
- Current proof: SRT parser tests pass and `deno check supabase/functions/save-pasted-transcript/index.ts` passes. Real Supabase integration tests still require credentials.
