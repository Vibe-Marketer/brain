---
status: resolved
trigger: "Two issues: 1. Failed to save transcript. Please try again or contact support. Details: Edge Function returned a non-2xx status code when attempting to save an import of a Loom Video. 2. Failed to create business organization: function gen_random_bytes(integer) does not exist when trying to create a new organization."
created: "2026-06-01T05:34:17Z"
updated: "2026-06-01T05:42:05Z"
---

# Debug Session: Loom Import and Org Create Failures

## Symptoms

- expected_behavior: Loom video import should save a transcript successfully; creating a new business organization should create the org and its default workspace.
- actual_behavior: Loom import save fails with an Edge Function non-2xx status; organization creation fails with `function gen_random_bytes(integer) does not exist`.
- error_messages: `Failed to save transcript. Please try again or contact support. Details Edge Function returned a non-2xx status code`; `Failed to create business organization: function gen_random_bytes(integer) does not exist`.
- timeline: Reported 2026-06-01; unknown whether this previously worked in the current deployed DB/function state.
- reproduction: Import a Loom Video, then save; create a new business organization.

## Current Focus

- hypothesis: Org creation failed because MCP token-generation functions ran with search_path=public while pgcrypto lives in extensions; Loom import failed because Loom metadata supplied fractional duration seconds to integer recordings.duration.
- test: Reproduce production SQL failure, inspect production Edge Function logs, patch migration/function, deploy, and run live smoke tests.
- expecting: `create_business_organization` and `generate_prefixed_mcp_token` work under public search_path; Loom save returns 200 and stores integer duration.
- next_action: complete commit and push
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-01T05:36:00Z
  finding: Production `public.generate_prefixed_mcp_token('organization')` fails under `search_path=public` with `function gen_random_bytes(integer) does not exist`.
  note: `gen_random_bytes(integer)` exists in schema `extensions`; deployed token functions had no locked search_path.

- timestamp: 2026-06-01T05:39:00Z
  finding: Supabase function logs for `save-pasted-transcript` version 89 show the actual Loom save failure.
  result: `[connector-pipeline] Failed to insert recording: invalid input syntax for type integer: "129.239"`
  note: `recordings.duration` is `integer`; Loom metadata can provide fractional `duration_seconds`.

- timestamp: 2026-06-01T05:41:00Z
  finding: Migration applied to production and fixed token generation under public search_path.
  result: `public.generate_prefixed_mcp_token('organization')` returned `cv_org_...`; rollback insert into `mcp_tokens` returned `cv_org_...`; rollback `create_business_organization(...)` returned organization and workspace IDs.

- timestamp: 2026-06-01T05:42:00Z
  finding: Deployed `save-pasted-transcript` version 90 and ran a real HTTP smoke with a temporary auth user/org/workspace.
  result: Edge Function returned HTTP 200 with `action:"created"`; inserted recording had `source_app=loom`, `duration=129`, and `source_metadata.loom_duration_seconds=129` from input `129.239`.

- timestamp: 2026-06-01T10:20:00Z
  checked: src/hooks/useOrganizationMutations.ts -> create_business_organization RPC path
  found: `useCreateBusinessOrganization()` calls `supabase.rpc('create_business_organization', ...)`; the frontend does not generate tokens or call crypto functions itself.
  implication: The `gen_random_bytes(integer) does not exist` error originates in database-side RPC/trigger/default logic, not in React or client TS.

- timestamp: 2026-06-01T10:23:00Z
  checked: supabase/migrations/20260528052504_restore_home_workspace_invariant.sql -> public.create_business_organization()
  found: The RPC inserts `organizations`, then `organization_memberships`, then `workspace_memberships`; the function body itself never calls `gen_random_bytes`.
  implication: The failing crypto call must come from a trigger/default fired during one of those inserts.

- timestamp: 2026-06-01T10:26:00Z
  checked: supabase/migrations/20260430123000_trial_provisioning_and_dead_code_cleanup.sql and 20260410153126_mcp_auto_provision.sql
  found: `tr_provision_mcp_token_for_owner_membership` fires `provision_mcp_token_for_owner_membership()` after `organization_memberships` insert, which calls `maybe_provision_mcp_token(NEW.organization_id)`, which inserts into `mcp_tokens` for paid/trialing owners.
  implication: New org creation now reaches MCP token provisioning as part of the RPC transaction.

- timestamp: 2026-06-01T10:29:00Z
  checked: supabase/migrations/20260310160000_mcp_tokens.sql and 20260528163000_mcp_oauth_client_grants_and_prefixed_tokens.sql
  found: `mcp_tokens.token` has default `encode(gen_random_bytes(32), 'hex')`, and newer trigger/function `set_mcp_token_value()` -> `generate_prefixed_mcp_token()` also calls unqualified `gen_random_bytes(32)` with no `SET search_path = extensions, public` on that function.
  implication: If `pgcrypto` is missing or `extensions` is not on the effective search path in the deployed DB, org creation fails exactly where the reported error points.

- timestamp: 2026-06-01T10:33:00Z
  checked: src/components/import/PasteTranscriptModal.tsx and supabase/functions/save-pasted-transcript/index.ts
  found: Current source explicitly supports Loom on both sides: the modal sends `source_app: 'loom'`, and `save-pasted-transcript` validates `loom`, normalizes Loom transcripts in `normalizeLoom()`, and inserts via `runPipeline()`.
  implication: The repo head does not show an obvious missing Loom code path; a reported non-2xx from production is more likely deployed-function/schema drift or a runtime-only pipeline failure.

- timestamp: 2026-06-01T10:36:00Z
  checked: local tests
  found: `src/components/import/__tests__/PasteTranscriptModal.test.tsx` passed including Loom import cases; `supabase/functions/_shared/__tests__/loom-parser.test.ts` and `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts` passed locally; a real-Supabase integration test also exists for Loom import in `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts`.
  implication: The current repository implementation for Loom import is test-covered and locally green; production failure is not reproduced from source-only inspection.

## Eliminated

- hypothesis: Loom support is missing from deployed function.
  reason: Production logs came from `save-pasted-transcript` v89 after Loom normalization and failed at DB insert, not validation.

- hypothesis: `pgcrypto` extension is missing.
  reason: Production has `extensions.gen_random_bytes(integer)`; failure reproduced only when the function ran with `search_path=public`.

- hypothesis: The organization creation failure is caused by frontend validation or a React hook bug.
  evidence: The client only calls `create_business_organization`; the crypto error string matches DB-side trigger/default code, and no frontend path references `gen_random_bytes`.
  timestamp: 2026-06-01T10:25:00Z

- hypothesis: The current repository head obviously lacks Loom import support.
  evidence: Current source and tests cover Loom detection, metadata fetch, normalization, and save-path invocation successfully.
  timestamp: 2026-06-01T10:37:00Z

## Resolution

- root_cause: Two independent production bugs. Organization creation fired MCP token provisioning, which used unqualified `gen_random_bytes(32)` from functions/defaults that could run with `search_path=public`; Supabase installs pgcrypto in `extensions`, so lookup failed. Loom import fetched source metadata with fractional `duration_seconds` such as `129.239`, then `save-pasted-transcript` passed that value to the shared pipeline, which inserted it into integer column `recordings.duration`.
- fix: Added migration `20260601054000_fix_mcp_token_crypto_search_path.sql` to lock MCP token functions to `extensions, public`, qualify pgcrypto calls, and make the `mcp_tokens.token` default use `extensions.gen_random_bytes`. Updated `save-pasted-transcript` to round provider duration seconds before insert and preserve the rounded value in Loom metadata.
- verification: `deno check supabase/functions/save-pasted-transcript/index.ts`; targeted Vitest for Loom parser and save-pasted source tests; production SQL smoke for token generation, mcp token insert, and `create_business_organization`; deployed `save-pasted-transcript` v90; real Edge Function Loom smoke returned HTTP 200 and stored integer duration.
- files_changed: `supabase/migrations/20260601054000_fix_mcp_token_crypto_search_path.sql`, `supabase/functions/save-pasted-transcript/index.ts`, `supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.test.ts`, `.planning/debug/loom-import-and-org-create-fa.md`
