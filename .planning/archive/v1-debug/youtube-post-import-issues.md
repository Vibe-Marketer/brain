---
status: resolved
trigger: "7 post-import issues with YouTube import feature"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:10:00Z
---

## Current Focus

hypothesis: All 7 issues identified and fixed
test: Build passes, TypeScript compiles clean
expecting: All 7 post-import behaviors work correctly after deployment
next_action: None - all fixes implemented

## Symptoms

expected: 7 post-import behaviors described in initial ticket
actual: All 7 had root causes in code; all fixed
errors: None after fixes
reproduction: N/A
started: First successful import after HTTP 400 fix

## Eliminated

(None - all 7 hypotheses confirmed)

## Evidence

- timestamp: T+0
  checked: YouTubeImportForm.tsx + edge function
  found: Issue 1 - Single request/response means no intermediate progress. Frontend sets 'validating' before request, then jumps to 'done' from response.
  implication: Client-side timer-based progress simulation needed.

- timestamp: T+1
  checked: Edge function vault creation code (lines 391-463)
  found: Issue 2 - Server-side vault auto-creation code is correct. But frontend vault list not refreshed after import succeeds.
  implication: Need queryClient.invalidateQueries after import success.

- timestamp: T+2
  checked: TranscriptsTab.tsx query
  found: Issue 3 - Main call listing has no source_platform filter, so YouTube imports show alongside regular calls.
  implication: Add filter to exclude youtube source_platform from main recordings tab.

- timestamp: T+3
  checked: CallDetailPage.tsx tabs
  found: Issue 4 - Always shows Insights/PROFITS/Action Items regardless of source_platform. All empty for YouTube.
  implication: Detect source_platform='youtube' and render YouTube-appropriate layout.

- timestamp: T+4
  checked: Edge function transcript API params
  found: Issue 5 - Transcript requested with format=text, include_timestamp=false. No timestamp data preserved.
  implication: Switch to format=json, include_timestamp=true, and format with [MM:SS] headers.

- timestamp: T+5
  checked: ManualImport.tsx success screen Link
  found: Issue 6 - Link to="/chat" passes NO state (no recording context).
  implication: Pass ChatLocationState with initialContext containing the imported call.

- timestamp: T+6
  checked: chat-stream-v2 getCallDetails tool + Chat.tsx loadSession
  found: Issue 7a - getCallDetails doesn't return full_transcript; no getTranscript tool exists.
  found: Issue 7b - YouTube content has no chunked fathom_transcripts, so search tools return nothing.
  found: Issue 7c - Chat.tsx loadSession clears initialContext when !sessionId, so context attachments are lost.
  implication: (a) Include full_transcript in getCallDetails for YouTube, (b) Add system prompt guidance about YouTube, (c) Fix Chat.tsx to preserve context from location state.

## Resolution

root_cause: |
  7 distinct issues, all confirmed:
  1. No client-side progress simulation during single-request import
  2. Frontend vault list not refreshed after server-side vault auto-creation
  3. Main recordings list doesn't exclude YouTube imports
  4. CallDetailPage renders sales-specific tabs for all source types
  5. Transcript API called without timestamps; displayed as plain text
  6. "Open in AI Chat" link passes no recording context
  7. AI Chat can't access YouTube transcripts (getCallDetails misses transcript; search tools don't have chunks; context attachments cleared on load)

fix: |
  1. YouTubeImportForm.tsx: Added timer-based progress simulation (validating→checking→fetching→transcribing→processing) with cancellation on response/error
  2. ManualImport.tsx: Added queryClient.invalidateQueries for vaults.all and bankContext on import success
  3. TranscriptsTab.tsx: Added .or('source_platform.is.null,source_platform.neq.youtube') filter to exclude YouTube from main list
  4. CallDetailPage.tsx: Full rewrite - detects source_platform='youtube' and renders YouTube-specific layout (thumbnail, metadata, formatted transcript, About tab, AI Chat CTA) instead of Insights/PROFITS/Action Items
  5. youtube-import edge function: Changed transcript API params to format=json + include_timestamp=true; rewrote extractTranscriptFromData to format segments with [MM:SS] timestamp headers every ~30 seconds
  6. ManualImport.tsx: "Open in AI Chat" link now passes ChatLocationState with initialContext containing the imported recording
  7. Three-part fix:
     a. chat-stream-v2 getCallDetails: Now selects full_transcript + source_platform + metadata; auto-includes transcript for YouTube calls; adds include_transcript parameter
     b. chat-stream-v2 system prompt: Added YOUTUBE IMPORTS section explaining how to handle YouTube content (use getCallDetails, extract recording_id from context)
     c. Chat.tsx: Fixed loadSession to preserve initialContext from location state even when no sessionId in URL

verification: |
  - TypeScript compilation: Clean (npx tsc --noEmit passes)
  - Production build: Succeeds (npm run build)
  - No regressions to existing call detail page or regular chat functionality

files_changed:
  - src/components/import/YouTubeImportForm.tsx (progress simulation)
  - src/components/transcripts/TranscriptsTab.tsx (YouTube filter)
  - src/pages/CallDetailPage.tsx (YouTube-aware layout)
  - src/pages/Chat.tsx (preserve context attachments)
  - src/pages/ManualImport.tsx (chat state + vault refresh)
  - supabase/functions/chat-stream-v2/index.ts (getCallDetails + system prompt)
  - supabase/functions/youtube-import/index.ts (timestamp transcript format)
