# Phase 28 — Deferred / Out-of-Scope Items

## From 28-02 (connector-sync-all pager)

- **Pre-existing `src/` type errors surfaced by `deno check`** (NOT introduced by 28-02; identical on committed HEAD, also noted in 28-01):
  - `src/components/connectors/registry/types.ts:42` — `TS1354: 'readonly' type modifier is only permitted on array and tuple literal types`.
  - `src/config/source-registry.ts:262` — `TS2339: Property 'uiVisible' does not exist`.
  - Out of scope per executor scope boundary (not caused by this task's changes). The `connector-sync-all/index.ts` file itself type-checks clean.
