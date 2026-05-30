---
phase: 04-mcp-ai-write-tools
verified: 2026-05-30T02:37:40Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "MVP mode user-story contract is valid and verifiable"
    - "Ingest markdown summary includes new recording id, share URL, target org/workspace, and created-vs-reused breakdown"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run production MCP smoke on `/mcp/w/{workspace_uuid}` with valid read/write/admin token(s)"
    expected: "tools/list category filtering, ingest + follow-up writes, and markdown envelope verified on live endpoint"
    why_human: "Live workspace credentials are required for production proof and are not available in this verifier session."
---

# Phase 4: MCP AI Write Tools Verification Report

**Phase Goal:** As a AI agent connected to an authorized CallVault workspace, I want to add an already-transcribed call/manual transcript with metadata, speakers, tags, notes, and folder context in one MCP call, so that the recording lands in the correct vault with clear provenance and can be corrected through targeted follow-up write tools.
**Verified:** 2026-05-30T02:37:40Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Goal Achievement

## User Flow Coverage (MVP Mode)

| # | User Flow Step | Expected | Evidence | Status |
|---|---|---|---|---|
| 1 | Goal matches User Story contract | `As a..., I want..., so that...` validator passes | `gsd-sdk query user-story.validate --story "<phase goal>" --raw` returned `"valid": true` with empty `errors` | ✓ VERIFIED |

## Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `ingest_transcript` performs composite ingest with warning surfacing | ✓ VERIFIED | Pipeline-first ingest plus warning accumulation in [ingest_transcript.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/ingest_transcript.ts:111) and [ingest_transcript.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/ingest_transcript.ts:140). |
| 2 | Scope enforcement for org/workspace targeting remains active | ✓ VERIFIED | Shared gate `resolveTargetWorkspace()` in [_ingest_helpers.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/_ingest_helpers.ts:94), called by ingest and write tools. |
| 3 | Manual MCP Import provenance is preserved and visible | ✓ VERIFIED | Metadata marker and label in [_ingest_helpers.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/_ingest_helpers.ts:200) and [source-registry.ts](/Users/admin/dev/brain/src/config/source-registry.ts:249). |
| 4 | MCP-04 write tools exist as targeted tools and `set_speakers` idempotency remains covered | ✓ VERIFIED | Tool modules + registry links in [registry.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/registry.ts:32), [registry.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/registry.ts:38), [registry.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/registry.ts:43), [registry.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/registry.ts:46); idempotency contract in [set-speakers.idempotency.test.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/__tests__/set-speakers.idempotency.test.ts:34). |
| 5 | Tag/speaker inputs accept names and are resolved server-side | ✓ VERIFIED | Name normalization and matching/upsert flow in [_ingest_helpers.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/_ingest_helpers.ts:264) and [_ingest_helpers.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/_ingest_helpers.ts:325). |
| 6 | Admin tools remain admin-only by category | ✓ VERIFIED | `create_organization`/`create_workspace` mapped to `admin` in [mcp-tool-categories.ts](/Users/admin/dev/brain/supabase/functions/_shared/mcp-tool-categories.ts:72). |
| 7 | `tools/list` remains filtered by `enabled_categories` | ✓ VERIFIED | Runtime filter in [index.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/index.ts:273) and call-gate enforcement in [gating.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/gating.ts:62). |
| 8 | Markdown `content[].text` summary includes share URL state (`Share URL: ...` or `Share URL: none`) plus id/org/workspace/breakdown | ✓ VERIFIED | Share URL line now emitted in [_ingest_helpers.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/_ingest_helpers.ts:491); explicit assertions added in [write-tools-boundary.test.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/__tests__/write-tools-boundary.test.ts:1440); markdown envelope via `mcpOk` in [protocol.ts](/Users/admin/dev/brain/supabase/functions/mcp-server/protocol.ts:9). |

**Score:** 8/8 truths verified

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/functions/mcp-server/tools/write/ingest_transcript.ts` | Composite ingest handler | ✓ VERIFIED | Exists, substantive, pipeline-wired. |
| `supabase/functions/mcp-server/tools/write/_ingest_helpers.ts` | Scope/metadata/speaker/tag/summary helpers | ✓ VERIFIED | Includes explicit `Share URL` summary output. |
| `supabase/functions/mcp-server/tools/write/{append_to_transcript,update_call_metadata,set_speakers}.ts` | Targeted follow-up tools | ✓ VERIFIED | Present and wired in registry/tests. |
| `supabase/functions/_shared/mcp-tool-categories.ts` | Category map for read/write/ai/admin | ✓ VERIFIED | Admin and write tool categorization intact. |
| `supabase/functions/mcp-server/protocol.ts` | `content[].text` response envelope | ✓ VERIFIED | `mcpOk` wraps tool output in markdown text payload. |
| `src/config/source-registry.ts` | Manual MCP Import identity in UI | ✓ VERIFIED | Registry label retained. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ingest_transcript.ts` | `connector-pipeline.ts` | `runPipeline()` | WIRED | Pipeline call at [ingest_transcript.ts:111](/Users/admin/dev/brain/supabase/functions/mcp-server/tools/write/ingest_transcript.ts:111). |
| `ingest_transcript.ts` | `_ingest_helpers.ts` | helper imports and summary formatting | WIRED | Helpers imported and called across normalize/apply/summary paths. |
| `index.ts` | `gating.ts` + category map | `enforceCategoryGate()` + `filterToolsForToken()` | WIRED | Both invocation and filter paths present. |
| tool registry | write/admin modules | static module registration | WIRED | All MCP-04 write modules and admin tools registered. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `ingest_transcript.ts` | `pipelineResult.recordingId` | `runPipeline(...)` | Yes | ✓ FLOWING |
| `_ingest_helpers.ts` summary | `recordingUrl` -> `Share URL: ...` line | handler summary input | Yes (explicit value or `none`) | ✓ FLOWING |
| `index.ts` tools listing | `enabled_categories` filtered list | token auth payload + category map | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| MCP write/admin/category contracts remain true | `npm test -- --run ...write-tools-boundary...contract-surface...category-gating...set-speakers.idempotency...` | 4 files passed, 101 tests passed | ✓ PASS |
| MVP user-story contract validity | `gsd-sdk query user-story.validate --story "<phase goal>" --raw` | `"valid": true` | ✓ PASS |

## Probe Execution

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 04 probe scripts | `find scripts -path '*/tests/probe-*.sh'` + phase grep | No phase-declared probe found | ? SKIP |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| MCP-04 | 04-01..04-05 | AI-first transcript ingest + follow-up write tools with scope/category controls | ✓ SATISFIED | All 8 roadmap success criteria now verified in code/tests. |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | - | No `TBD`/`FIXME`/`XXX` markers in phase-critical files | ℹ️ Info | No debt-marker blocker found. |

## Human Verification Required

### 1. Production MCP Smoke

**Test:** Run live MCP tool calls against `https://api.callvaultai.com/mcp/w/{workspace_uuid}` using read/write/admin token scopes.  
**Expected:** `tools/list` visibility matches category scope; `ingest_transcript` and follow-up tools return markdown `content[].text` on production.  
**Why human:** Requires real production credentials/workspace not present in verifier runtime.

## Gaps Summary

No code-level gaps remain from the prior report. Re-verification closed the two blockers introduced in the previous pass (invalid MVP story format and missing explicit share URL summary state). Remaining work is live-environment human smoke verification only.

---

_Verified: 2026-05-30T02:37:40Z_  
_Verifier: the agent (gsd-verifier)_
