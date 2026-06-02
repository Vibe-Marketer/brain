---
status: resolved
trigger: "Failed to generate titles:call not found or unauthorized is showing up whenever Daniel tries to create a \"ai title\" in the app. He is on a FREE account but should be able to use the ai features for a certain number of credits."
created: "2026-06-02"
updated: "2026-06-02"
---

# Debug Session: AI Title Call Not Authorized

## Symptoms

- expected_behavior: FREE account users with remaining AI credits can generate AI titles for eligible calls.
- actual_behavior: The app shows `Failed to generate titles:call not found or unauthorized`.
- error_messages: `Call not found or unauthorized` returned by `generate-ai-titles`.
- timeline: Reported 2026-06-02; exact start date unknown.
- reproduction: Daniel selects/uses the AI title action in the app while on a FREE account.

## Current Focus

- hypothesis: The title function is rejecting a recording identifier/ownership check before the free-tier credit logic runs.
- test: Trace frontend selected IDs into `generate-ai-titles` and compare them with the Edge Function lookup predicates.
- expecting: A UUID/BIGINT mismatch or workspace-scoped recording row lookup excludes legitimate user-accessible calls.
- next_action: inspect frontend caller, edge function lookup, and AI usage enforcement

## Evidence

- timestamp: "2026-06-02T15:08:00-04:00"
  observation: `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` gates AI title generation through `useAiGate.trackAction('auto_name')`, so FREE users with remaining quota should reach the title function.
- timestamp: "2026-06-02T15:08:00-04:00"
  observation: `supabase/functions/generate-ai-titles/index.ts` only assigned `userId` when `user_id` was present in the request body. Normal frontend calls do not send `user_id`, so the later `.eq('user_id', userId)` call lookup used an unset value and returned `Call not found or unauthorized`.
- timestamp: "2026-06-02T15:09:00-04:00"
  observation: Patched normal app calls to authenticate the Supabase JWT before title lookup; preserved service-role `user_id` fan-out for internal webhook/sync callers and rejected mismatched user JWT spoofing.

## Eliminated

- hypothesis: FREE-tier credit limits block Daniel before generation.
  reason: The reported error is emitted from the per-recording call lookup, after the frontend quota gate has already allowed the action and before model generation.

## Resolution

- root_cause: Normal app invocations of `generate-ai-titles` never initialized `userId`, causing legitimate calls to fail the `fathom_raw_calls.user_id = userId` lookup as unauthorized.
- fix: Authenticate normal requests with `authenticateRequest`, allow `user_id` only with the service-role bearer token, reject mismatched `user_id` over a user JWT, and add a regression invariant test.
- verification: `npx vitest run supabase/functions/generate-ai-titles/__tests__/auth-invariants.test.ts` passed; `deno check supabase/functions/generate-ai-titles/index.ts` passed after aligning the Edge Function AI SDK import.
- files_changed: `supabase/functions/generate-ai-titles/index.ts`, `supabase/functions/_shared/auth.ts`, `supabase/functions/generate-ai-titles/__tests__/auth-invariants.test.ts`, `deno.lock`
