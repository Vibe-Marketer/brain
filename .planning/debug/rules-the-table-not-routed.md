---
status: resolved
trigger: "Current RULES should have routed a call titled THE TABLE out of the primary inbox, but it stayed there."
created: 2026-06-09
updated: 2026-06-09
---

# Debug Session: rules-the-table-not-routed

## Symptoms

- expected_behavior: Active rules should route the call titled "THE TABLE" to the correct group/folder/workspace instead of leaving it in the primary inbox.
- actual_behavior: The call remained in the primary inbox.
- error_messages: None reported.
- timeline: Reported 2026-06-09; unknown whether this ever worked for this specific call/rule.
- reproduction: Find the "THE TABLE" call and compare it against currently active rules.

## Current Focus

- hypothesis: The active rule either did not match the saved title/conditions, was not applied to existing/imported records, or wrote to a destination field the primary inbox view does not honor.
- test: Inspect current rule engine code, active production rules, and the persisted "THE TABLE" recording/folder/workspace placement.
- expecting: Either a clear mismatch in rule condition/data, a missing/failed apply path, or a placement write that did not remove/update the inbox entry.
- next_action: gather initial evidence
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-09T10:01:00-04:00
  observation: Production recording `0352f7db-1ecf-4ed5-a61e-81bbe6760a63` / legacy `152706780` has title `THE TABLE`, source `fathom`, `source_metadata.import_source = webhook`, and no `routed_by_rule_name`.
  result: This is the current failed row, not a historical guess.
- timestamp: 2026-06-09T10:01:00-04:00
  observation: Active production import rule `dc9c91f6-e9db-4ddf-9774-116307bb6e66` is enabled with condition `title equals THE TABLE`, target workspace `a8a541a6-51be-4b11-8b13-69fe55f6b2d5` (`AI Simple Founders`), target folder `5a8fb68c-8d71-4233-92b7-33b218f0e42b` (`THE TABLE`).
  result: The rule itself is valid and matches the failed recording.
- timestamp: 2026-06-09T10:01:00-04:00
  observation: The failed recording currently has a single `workspace_entries` row in workspace `2e57f0aa-e0bb-4e54-a602-33c9e606f2bf` (`INBOX`) with `folder_id = null`.
  result: The primary inbox view is showing the persisted placement correctly.
- timestamp: 2026-06-09T10:01:00-04:00
  observation: Fathom webhook resolved the active Fathom `import_sources` row, whose `workspace_id` is `INBOX`. `webhook/index.ts` passed that returned workspace to `runPipeline`; `runPipeline` skips routing whenever `record.workspace_id` is present.
  result: Connector binding handling suppressed the active routing rule before it could evaluate.

## Eliminated

- hypothesis: The `THE TABLE` rule condition did not match the saved title.
  reason: Production preview showed `matches = true` for the active `THE TABLE` import routing rule against recording `0352f7db-1ecf-4ed5-a61e-81bbe6760a63`.
- hypothesis: This was only a `tag_rules` / folder assignment mismatch.
  reason: The failed row has `source_metadata.import_source = webhook` and the active matching rule is in `import_routing_rules`; the tag-rule mismatch is a separate legacy risk but not the root cause for this row.

## Resolution

- root_cause: Connector webhook/sync callers passed connector account workspace bindings into `runPipeline` as `workspace_id`, and `runPipeline` treats any `workspace_id` as an explicit override that skips import routing rules. The June 5 Fathom webhook saw the active Fathom source bound to `INBOX`, so it inserted `THE TABLE` into `INBOX` instead of evaluating the enabled `THE TABLE` import-routing rule.
- fix: Added `fallback_workspace_id` / `fallback_folder_id` support to the shared connector pipeline and canonical adapter. Connector account bindings now pass through those fallback fields, so routing rules and import-routing defaults run first; one-off requested workspace IDs still use `workspace_id` and remain explicit overrides.
- verification: Targeted Vitest suite passed: `npm run test -- supabase/functions/_shared/__tests__/connector-routing-overrides.test.ts supabase/functions/fathom-reconcile/__tests__/fathom-reconcile.test.ts supabase/functions/read-ai-webhook/__tests__/read-ai-webhook.test.ts supabase/functions/grain-webhook/__tests__/grain-webhook.test.ts supabase/functions/grain-sync-recordings/__tests__/grain-sync-recordings.test.ts supabase/functions/read-ai-sync-meetings/__tests__/read-ai-sync-meetings.test.ts`. `npm run build` passed. Production preview query confirmed the stuck row matches the active `THE TABLE` import-routing rule and is currently still in `INBOX`.
- files_changed: supabase/functions/_shared/connector-pipeline.ts; supabase/functions/_shared/canonical-recording.ts; supabase/functions/_shared/recording-connectors.ts; supabase/functions/webhook/index.ts; supabase/functions/zoom-webhook/index.ts; supabase/functions/read-ai-webhook/index.ts; supabase/functions/grain-webhook/index.ts; supabase/functions/fireflies-webhook/index.ts; supabase/functions/sync-meetings/index.ts; supabase/functions/zoom-sync-meetings/index.ts; supabase/functions/grain-sync-recordings/index.ts; supabase/functions/read-ai-sync-meetings/index.ts; supabase/functions/fireflies-sync-meetings/index.ts; supabase/functions/_shared/__tests__/connector-routing-overrides.test.ts; supabase/functions/grain-sync-recordings/__tests__/grain-sync-recordings.test.ts; supabase/functions/read-ai-sync-meetings/__tests__/read-ai-sync-meetings.test.ts
