---
phase: 24-fathom-share-link-save
type: validation
status: filled
created: 2026-05-07
test_files_added: 4
total_tests: 48
passing: 48
failing: 0
---

# Phase 24 — Nyquist Validation Report

**Phase:** 24 — Fathom Share-Link Save
**Resolved:** 5/5 gaps — every requirement now has automated coverage that
the test suite enforces on every run.

The submitted gaps were all in the "no test file" category — the SUMMARY
verified the implementation in production via dev-browser + curl, but no
automated regression tests existed to prevent silent breakage. This report
adds the automated layer.

---

## Gaps Filled

### PASTE-01 — User pastes URL + transcript → recording appears in library within 2s

**Test type:** unit (component) + integration (modal ↔ edge fn invocation)
**File:** `src/components/import/__tests__/PasteTranscriptModal.test.tsx`
**Tests:** 9 tests, all passing
**Behavioral coverage:**
- Modal renders the correct URL + transcript fields when open
- Save button is disabled below the 20-char min and enables once transcript
  + active org are present
- Live preview shows detected turn count + speaker count when format is
  recognized; shows "format not auto-detected" when it isn't
- Clicking Save invokes `supabase.functions.invoke('save-pasted-transcript', …)`
  with the right body (`share_url`, `raw_transcript`, `organization_id`)
- On `created` response: shows "Transcript saved" toast, closes modal,
  navigates to `/?callId=<recording_id>` (this is the on-screen mechanism
  that surfaces the new row within the 2s window)
- On `updated` response: shows "Transcript updated" toast (re-paste UX)
- On error response: shows error toast and does NOT navigate (no false-positive
  surface)

The "within 2s" SLA is fundamentally an end-to-end concern; the test verifies
the wiring (invoke → invalidate → navigate) that makes the SLA achievable.
End-to-end timing was verified manually in production per SUMMARY §3.

### PASTE-02 — Pasted transcript searchable via global search within 5s (FTS)

**Test type:** unit (parser) + source regression (edge function payload)
**Files:**
- `supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts`
- `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts`

**Behavioral coverage:**
- Parser returns `parse_status: 'raw'` for unrecognized text (no throw, no
  data loss). Verified for: garbage prose, header-only paste, single-turn
  paste, empty/null/undefined input.
- Edge function source asserts that BOTH the parsed and raw branches write
  to `full_transcript` — which is the column covered by the existing FTS
  GIN index (`idx_recordings_transcript_fts`). The asserted code shape:
  `full_transcript: renderedTranscript` where `renderedTranscript` is the
  bracketed format when parsed, else the raw text.
- Parser exercises the H:MM:SS / MM:SS / M:SS timestamp variants and
  multi-line turn concatenation so structured segments are stable too.

The 5s search latency is a property of Postgres FTS index update lag — not
something a unit test can simulate. The implementation guarantee is that
the user's words always reach `full_transcript` (which the FTS index covers)
even when the parser falls back to raw — and that property is now locked.

### PASTE-03 — Re-pasting same share URL UPDATES existing record (no dup by token)

**Test type:** unit (parser idempotence) + source regression (handler logic)
**Files:**
- `supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts`
- `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts`

**Behavioral coverage:**
- `extractShareToken` produces the **same** token for whitespace variants,
  query-string variants, and hash variants of the same URL. This is the
  dedup key — if it's not stable, dedup silently breaks.
- `extractShareToken` returns `null` for `/calls/`-style URLs (those should
  not collide with `/share/` URLs).
- Edge function source asserts the dedup branch:
  - looks up by `(organization_id, share_token)` before deciding insert vs
    update
  - has both `action = 'created'` and `action = 'updated'` reachable
  - sets `source_call_id = shareToken` so the existing global dedup
    constraint `(organization_id, source_app, source_call_id)` is also
    populated as defense-in-depth (per SUMMARY decision)
- Migration source asserts the partial unique index on
  `(organization_id, share_token) WHERE share_token IS NOT NULL` exists.

### PASTE-04 — Recording detail renders paste-source cleanly

**Test type:** unit (component rendering)
**File:** `src/components/call-detail/__tests__/PasteSourceRendering.test.tsx`
**Tests:** 8 tests, all passing
**Behavioral coverage:**
- `CallDetailHeader` with `source_platform === 'fathom-paste'` renders
  "VIEW ON FATHOM" — never the misleading plain "VIEW" (which would imply
  a video the user can play)
- `CallDetailHeader` with `source_platform === 'fathom'` (API-import) still
  renders plain "VIEW" — no regression
- `CallDetailHeader` with paste-source AND no `share_url` suppresses the
  button entirely (no broken outbound link)
- `CallDetailHeader` "VIEW ON FATHOM" uses `window.open(url, '_blank',
  'noopener,noreferrer')` — T-24-08 mitigation
- `CallOverviewTab` with paste-source renders the **"From Fathom share link"**
  pill
- `CallOverviewTab` with non-paste source does NOT render the pill
- `CallOverviewTab` with paste-source still renders core metadata: date,
  duration, recording id, share link, speaker count — paste recordings are
  first-class, not a degraded view
- Static check: every `.tsx`/`.ts` file in `src/components/call-detail/`
  contains zero `<video>` tags and zero `VideoPlayer` imports — there is
  literally no broken video player to render

### LEGAL — Zero outbound HTTP calls to fathom.video from any edge function

**Test type:** source regression
**File:** `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts`
**Behavioral coverage:**
- Strips comments + string literals from the edge function source, then
  asserts that `fathom.video` does not appear in any executable code path.
  Comment + allow-list-regex string-literal mentions are explicitly
  permitted (legal posture stays intact).
- Asserts no `axios` or `node-fetch` import.
- Asserts the only HTTP client import is `@supabase/supabase-js` (the
  Supabase client; targets the project's own Supabase URL, never fathom).
- Asserts the sentinel comment `// … NEVER fetches from fathom.video …`
  is present — if a future edit removes the legal-posture notice, the test
  catches it.

If any of these break (e.g. someone adds `fetch('https://fathom.video/...')`
to "fix" a missing thumbnail), the test fails and CI blocks the merge.

---

## Tests Created

| # | File | Type | Tests | Command |
|---|------|------|-------|---------|
| 1 | `supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts` | unit | 17 | `npx vitest run supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts` |
| 2 | `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | source regression + behavioral | 14 | `npx vitest run supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` |
| 3 | `src/components/import/__tests__/PasteTranscriptModal.test.tsx` | component | 9 | `npx vitest run src/components/import/__tests__/PasteTranscriptModal.test.tsx` |
| 4 | `src/components/call-detail/__tests__/PasteSourceRendering.test.tsx` | component | 8 | `npx vitest run src/components/call-detail/__tests__/PasteSourceRendering.test.tsx` |

**Total:** 48 tests, 48 passing, 0 failing.

## Verification Map

| Requirement | Test File | Command | Status |
|-------------|-----------|---------|--------|
| PASTE-01 | `PasteTranscriptModal.test.tsx` + `save-pasted-transcript.test.ts` | `npx vitest run src/components/import/__tests__/PasteTranscriptModal.test.tsx` | green |
| PASTE-02 | `fathom-transcript-parser.test.ts` + `save-pasted-transcript.test.ts` | `npx vitest run supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | green |
| PASTE-03 | `fathom-transcript-parser.test.ts` + `save-pasted-transcript.test.ts` | `npx vitest run supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | green |
| PASTE-04 | `PasteSourceRendering.test.tsx` | `npx vitest run src/components/call-detail/__tests__/PasteSourceRendering.test.tsx` | green |
| LEGAL    | `save-pasted-transcript.test.ts` | `npx vitest run supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` | green |

## Test Infrastructure Change

`vitest.config.ts` — added `@shared` alias mirror of `vite.config.ts`. The
`PasteTranscriptModal` component imports
`@shared/fathom-transcript-parser` (per the Phase 24 cross-runtime parser
pattern), but the vitest config didn't have the alias, so the modal was
literally untestable until now. The added alias is identical to the one
already in `vite.config.ts` and `tsconfig.json`/`tsconfig.app.json` — no
implementation behavior changed.

```diff
   resolve: {
     alias: {
       '@': path.resolve(__dirname, './src'),
+      // Mirror vite.config.ts so tests can import pure-TS shared utilities
+      // co-located with edge functions (e.g. fathom-transcript-parser).
+      '@shared': path.resolve(__dirname, './supabase/functions/_shared'),
     },
   },
```

## Files for Commit

- `supabase/functions/_shared/__tests__/fathom-transcript-parser.test.ts` (new)
- `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` (new)
- `src/components/import/__tests__/PasteTranscriptModal.test.tsx` (new)
- `src/components/call-detail/__tests__/PasteSourceRendering.test.tsx` (new)
- `vitest.config.ts` (modified — `@shared` alias added)
- `.planning/phases/24-fathom-share-link-save/24-VALIDATION.md` (new — this file)

## Notes on Adversarial Stance

Every test was written to be capable of failing if the requirement's behavior
breaks:

- The parser tests would fail if `extractShareToken` started ignoring query
  strings (PASTE-03 dedup would silently break).
- The edge function source-regression tests would fail if a future edit
  removed the membership check, the dedup lookup, the bracketed-format
  full_transcript write, or the legal sentinel comment.
- The modal tests would fail if `invoke` was called with the wrong endpoint
  name, missing `organization_id`, or no longer triggered the `callId`
  navigation.
- The detail-rendering tests would fail if the VIEW button stopped branching
  on `source_platform`, if the source pill was deleted, or if anyone added
  a `<video>` tag anywhere in `call-detail/`.

No test was weakened to pass. No requirement was skipped. No implementation
file was modified.

---

*Phase: 24-fathom-share-link-save*
*Validation completed: 2026-05-07*
*Auditor: gsd-nyquist-auditor*
