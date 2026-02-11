---
status: fixing
trigger: "Investigate UAT gap for Phase 10.3 test 2: HTTP 400 on POST /functions/v1/youtube-import blocks YouTube vault layout test"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T10:00:00Z
---

## Current Focus

hypothesis: TranscriptAPI v2 response format mismatch and request parameter issues cause transcript parsing failures; additionally, sending Content-Type header on GET requests and using format=json when format=text is more robust for our use case.
test: Updated both edge functions to use format=text, handle all v2 response shapes, remove unnecessary Content-Type header on GET, and add diagnostic logging.
expecting: After redeployment, transcript fetching succeeds or provides clear diagnostic logs if credentials/credits are the issue.
next_action: User must deploy updated edge functions via `supabase functions deploy youtube-import` and `supabase functions deploy youtube-api`.

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

- hypothesis: Wrong base URL or endpoint path for TranscriptAPI v2.
  evidence: Both files already used `https://transcriptapi.com/api/v2/youtube/transcript` which matches v2 docs.
  timestamp: 2026-02-11T10:00:00Z

- hypothesis: Wrong HTTP method (POST vs GET) for transcript fetching.
  evidence: Both files use `fetch()` without specifying method, which defaults to GET. The v2 API expects GET.
  timestamp: 2026-02-11T10:00:00Z

- hypothesis: Wrong query parameter name for video URL.
  evidence: Code uses `video_url` param which matches v2 API docs. API accepts both video IDs and full URLs.
  timestamp: 2026-02-11T10:00:00Z

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

- timestamp: 2026-02-11T10:00:00Z
  checked: TranscriptAPI v2 official docs at https://transcriptapi.com/docs/api
  found: |
    V2 API response format depends on `format` parameter:
    - format=json: `transcript` is an ARRAY of segment objects `[{text, start, duration}]`
    - format=text + include_timestamp=false: `transcript` is a plain STRING
    - format=text + include_timestamp=true: `transcript` is a timestamped string
    Key finding: youtube-api/getVideoTranscript() only checked for transcript as string or text as string.
    If format=json returns an array, it fell through to null → threw 502 error.
  implication: The youtube-api function could not parse v2 json-format transcript responses, causing 502 which youtube-import would surface to client.

- timestamp: 2026-02-11T10:00:00Z
  checked: youtube-import/extractTranscriptText() and youtube-api/getVideoTranscript()
  found: |
    Three issues identified:
    1. youtube-api/getVideoTranscript() did NOT handle array transcript format from v2 json responses
    2. Both functions sent `Content-Type: application/json` header on GET requests (no body) - unnecessary and potentially problematic
    3. Both used format=json when format=text is simpler and more robust for our use case (we only need plain text)
    4. No diagnostic logging of TranscriptAPI errors - making debugging impossible
  implication: Multiple code-level issues compounding. Even if credentials are correct, the v2 json response would not parse correctly in youtube-api.

- timestamp: 2026-02-11T10:00:00Z
  checked: TranscriptAPI error codes in docs
  found: |
    HTTP 400 = "Bad Request: Check your request parameters"
    HTTP 402 = "Payment Required: No credits remaining"
    HTTP 401 = "Unauthorized: Invalid or missing API key"
    The forwarding of TranscriptAPI status codes directly means client sees exact TranscriptAPI error.
    A 400 from client means TranscriptAPI itself rejected the request parameters.
  implication: The 400 may indicate TranscriptAPI is rejecting some aspect of the request. Removing Content-Type header on GET and switching to format=text may resolve this.

## Resolution

root_cause: |
  Compound issue with three contributing factors:
  1. **Response format mismatch**: youtube-api/getVideoTranscript() only handled string transcript but v2 API with format=json returns an array of segment objects, causing 502 errors
  2. **Unnecessary Content-Type header on GET requests**: Both functions sent `Content-Type: application/json` on GET requests with no body, which some servers/proxies may reject with 400
  3. **Suboptimal format parameter**: Using format=json when format=text produces simpler, more reliable plain-text output that our parsing code handles directly
  4. **Insufficient logging**: No diagnostic logging of TranscriptAPI errors made the issue invisible

fix: |
  Applied fixes in 3 files:
  1. supabase/functions/youtube-api/index.ts:
     - Added extractTranscriptFromPayload() function handling all v2 response shapes (string, array, segments, text)
     - Changed format=json → format=text for simpler response
     - Removed Content-Type header from GET request
     - Added diagnostic console.log/error for transcript fetch URL and errors
  2. supabase/functions/youtube-import/index.ts:
     - Refactored extractTranscriptText() into extractTranscriptFromData() handling all v2 shapes (string, array, segments, text)
     - Changed format=json → format=text for simpler response
     - Removed Content-Type header from GET request
     - Added diagnostic logging of transcript fetch URL and error response bodies
  3. supabase/functions/youtube-api/__tests__/youtube-api-regression.test.ts:
     - Updated regression test to verify format=text parameter

verification: |
  - Regression test suite passes (3/3 tests green)
  - Code correctly handles format=text response (plain string transcript)
  - Code defensively handles format=json response (array of segments) if format param is ever changed back
  - Diagnostic logging will reveal exact TranscriptAPI errors in Supabase function logs
  - If 400 persists after deployment, check Supabase function logs for the new diagnostic output which will show the exact TranscriptAPI error

files_changed:
  - supabase/functions/youtube-api/index.ts
  - supabase/functions/youtube-import/index.ts
  - supabase/functions/youtube-api/__tests__/youtube-api-regression.test.ts
