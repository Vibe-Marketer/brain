---
status: investigating
trigger: "Investigate UAT gap for Phase 10.3 test 2: HTTP 400 on POST /functions/v1/youtube-import blocks YouTube vault layout test"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:00:00Z
---

## Current Focus

hypothesis: Production/import environment has function drift (stale youtube-import/youtube-api deployment or missing YouTube secrets), and youtube-import maps downstream failures to HTTP 400.
test: Trace code paths that can emit 400 and compare with current implementation and prior resolved debug session.
expecting: If drift/config issue is real, current repo code will already include auth fix while UAT still reports same symptom.
next_action: Return diagnosis with artifacts and missing remediation steps.

## Symptoms

expected: YouTube import succeeds, enabling YouTube vault video list layout testing.
actual: Import fails with HTTP 400 on POST /functions/v1/youtube-import.
errors: "HTTP 400 on POST /functions/v1/youtube-import"
reproduction: From Manual Import flow, submit YouTube URL via YouTubeImportForm.
started: Reported during Phase 10.3 UAT test 2.

## Eliminated

- hypothesis: Frontend request body shape mismatch causes immediate 400.
  evidence: YouTubeImportForm sends `{ videoUrl, vault_id }`, which matches `ImportRequest` in youtube-import.
  timestamp: 2026-02-11T00:00:00Z

- hypothesis: Current repository still has the old internal auth bug (service role key passed to youtube-api).
  evidence: Current youtube-import uses `userJwtToken` for both youtube-api calls.
  timestamp: 2026-02-11T00:00:00Z

## Evidence

- timestamp: 2026-02-11T00:00:00Z
  checked: .planning/phases/10.3-youtube-specific-vaults-video-intelligence/10.3-UAT.md
  found: Test 2 blocked by repeated HTTP 400 on youtube-import.
  implication: Failure is prerequisite blocker for all YouTube vault UI verification.

- timestamp: 2026-02-11T00:00:00Z
  checked: supabase/functions/youtube-import/index.ts
  found: Function returns HTTP 400 when downstream youtube-api details/transcript fetch is non-ok (even when underlying error is 401/500).
  implication: Client-visible 400 can mask backend auth/config/dependency failures.

- timestamp: 2026-02-11T00:00:00Z
  checked: .planning/debug/resolved/youtube-import-400-error.md
  found: Prior root cause was internal auth token misuse; fix required passing user JWT and deploying function.
  implication: Same symptom in UAT strongly suggests deployment drift or environment mismatch if production is still old.

- timestamp: 2026-02-11T00:00:00Z
  checked: supabase/functions/youtube-api/index.ts
  found: Missing `YOUTUBE_DATA_API_KEY` or `TRANSCRIPT_API_KEY` returns 500; youtube-import would surface as 400 during details/transcript steps.
  implication: Secret/config gaps are alternate high-probability root cause for blanket import failures.

## Resolution

root_cause: Probable environment drift in the import chain: production youtube-import/youtube-api behavior is failing downstream (most likely stale deployment missing prior JWT-forwarding fix and/or missing YouTube secrets), and youtube-import collapses those failures into a generic HTTP 400.
fix: Pending.
verification: Pending.
files_changed: []
