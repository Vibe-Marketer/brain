---
status: verifying
trigger: "HTTP 400 error when importing YouTube video via POST /functions/v1/youtube-import"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:00:00Z
---

## Current Focus

hypothesis: The youtube-import function was using service role key for auth when calling youtube-api, but youtube-api expects a JWT user token
test: Applied fix to pass user's JWT token instead of service role key
detailed: Both youtube-api calls (video-details and transcript) now use userJwtToken instead of supabaseServiceKey
next_action: Deploy functions and verify fix works in production

## Symptoms

expected: YouTube video imports successfully and appears in vault (ideally dedicated YouTube vault separate from transcripts)
actual: Import fails with HTTP 400 error after clicking "Import Video" button
errors: POST https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/youtube-import returned HTTP 400, duration 1236ms
reproduction: 1) Navigate to http://localhost:8080/import 2) Click "Import Video" button
timeline: Unknown if this feature ever worked or when it broke

## Eliminated

- hypothesis: Missing videoUrl parameter
  evidence: Frontend sends correct body format { videoUrl, vault_id }
  timestamp: 2026-02-10

- hypothesis: Invalid YouTube URL format
  evidence: Validation happens after body parsing, and error would be different
  timestamp: 2026-02-10

## Evidence

- timestamp: 2026-02-10
  checked: youtube-import edge function (lines 203-228)
  found: youtube-import calls youtube-api with service role key: `Authorization: Bearer ${supabaseServiceKey}`
  implication: This is incorrect authentication method

- timestamp: 2026-02-10
  checked: youtube-api edge function (lines 247-263)
  found: youtube-api validates auth with `supabase.auth.getUser(token)` which expects a JWT user token
  implication: Service role key cannot be validated by getUser(), causing 401 in youtube-api

- timestamp: 2026-02-10
  checked: Error handling flow in youtube-import (line 218-228)
  found: When youtube-api returns non-ok response (401), youtube-import returns 400 to client
  implication: The 400 error seen by user is actually caused by 401 auth failure between functions

- timestamp: 2026-02-10
  checked: Applied fix to youtube-import/index.ts
  found: Changed 3 locations:
    - Line 119: Added `const userJwtToken = token;` to store user's JWT
    - Line 212: Changed youtube-api call to use `userJwtToken` instead of `supabaseServiceKey`
    - Line 260: Changed youtube-api call to use `userJwtToken` instead of `supabaseServiceKey`
  implication: Authentication should now work correctly between edge functions

## Resolution

root_cause: The youtube-import function was using the service role key as a Bearer token when calling the youtube-api function, but youtube-api validates tokens using supabase.auth.getUser() which only accepts JWT user tokens, not service role keys. This caused a 401 Unauthorized error internally, which youtube-import converted to a 400 error for the client.

fix: Changed youtube-import to pass the original user's JWT token (extracted from req.headers.get('Authorization')) when calling youtube-api, instead of the service role key. This fix was applied to both the video-details fetch (line 212) and transcript fetch (line 260).

verification: Code fix applied successfully. Functions need to be deployed to Supabase to verify in production.
files_changed:
  - supabase/functions/youtube-import/index.ts: Changed Authorization header from supabaseServiceKey to userJwtToken in both internal youtube-api calls
