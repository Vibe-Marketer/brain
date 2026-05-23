---
description: Add a CallVault recording-source connector through the canonical recordings pipeline
argument-hint: <vendor-slug>
---

# CallVault Add Connector

Vendor slug: `$ARGUMENTS`
Workflow artifacts: `$ARTIFACTS_DIR`

You are adding a recording-source connector to CallVault. The product contract is that downstream consumers keep reading the existing `recordings` table and do not need source-specific code for each vendor.

## Phase 1: Load required context

Read these files first:

- `CLAUDE.md`
- `supabase/CLAUDE.md`
- `src/CLAUDE.md` if you touch frontend labels/icons
- `supabase/functions/_shared/canonical-recording.ts`
- `supabase/functions/_shared/recording-connectors.ts`
- `supabase/functions/_shared/fireflies-connector.ts` as the reference adapter pattern
- `supabase/functions/_shared/__tests__/canonical-recording.test.ts`

## Phase 2: Plan the vendor fit

Determine whether `$ARGUMENTS` provides the canonical fields:

- stable recording/transcript ID
- title
- start timestamp
- duration/end timestamp
- full transcript or transcript turns
- speaker/attendee data
- optional summary
- source/share URL

Write `$ARTIFACTS_DIR/connector-plan.md` with:

- canonical field mapping
- credential strategy
- files to change
- tests to add/run
- downstream surfaces intentionally unchanged

## Phase 3: Implement

Create or update:

- `supabase/functions/_shared/$ARGUMENTS-connector.ts`
- `supabase/functions/_shared/__tests__/$ARGUMENTS-connector.test.ts`
- `supabase/functions/$ARGUMENTS-sync-meetings/index.ts` only if runnable import is in scope
- `src/lib/source-labels.ts` for label-only UI recognition
- `src/services/import-sources.service.ts` retry map only if a sync Edge Function exists

Rules:

- Route database writes through `runCanonicalConnectorPipeline()`.
- Keep the transcript table and call-detail modal layout unchanged.
- Keep MCP server and `summarize-call` reading canonical `recordings` fields.
- Do not create empty recordings when the vendor transcript is missing.
- Do not store credentials in source code or committed config.

## Phase 4: Validate

Run the narrow conformance tests for the changed connector and canonical helpers. Then run type-check if frontend or shared TypeScript imports changed.

Record exact commands and outputs in `$ARTIFACTS_DIR/validation.md`.

## Phase 5: Prepare PR artifacts

Commit the changes on the workflow branch with a conventional commit message.
Write `$ARTIFACTS_DIR/pr-body.md` with:

- summary
- canonical field mapping
- downstream surfaces unchanged
- tests run
- live API calls not tested, if credentials were unavailable

Final response: include changed files, test output summary, and PR readiness status.
