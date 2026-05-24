# SPEC: Connector framework (dispatcher + adapter contract)

- **Status:** Draft (Phase B — scaffolded 2026-05-23)
- **Related:** [ADR-006 Composio selective adoption](../adr/adr-006-composio-selective-adoption.md), `docs/integrations/03-connector-sop.md`

> **NOTE:** This SPEC is a STUB. It captures the contract the scaffold in PR #279 already implements. Expand each section to operator-grade detail when the framework moves out of scaffold and into pilot.

---

## Purpose

Defines the shared dispatcher + adapter layer that sits above the canonical recording pipeline. Native and Composio-routed connectors both terminate in `runCanonicalConnectorPipeline`; this framework defines how requests arrive at the right adapter and what an adapter implementation must expose.

## Surfaces

| Surface | Path | Purpose |
|---------|------|---------|
| Frontend registry | `src/config/source-registry.ts` | Source identity, label, icon, `adapter: 'native' \| 'composio'`, optional `composioToolkit` slug |
| Backend dispatcher | `supabase/functions/connector-dispatcher/index.ts` | Routes `{ source, action }` to a registered adapter |
| Adapter contract | `supabase/functions/_shared/connector-framework.ts` | `ConnectorAdapter` interface + adapter registry |
| Canonical recording shape | `supabase/functions/_shared/canonical-recording.ts` | Unchanged — every adapter's terminal output |
| Pipeline | `supabase/functions/_shared/recording-connectors.ts` → `connector-pipeline.ts` | Hard-insert path, deduplication, workspace routing |

## Dispatcher contract

`POST /connector-dispatcher`

```jsonc
{
  "source": "<source_app id from registry>",
  "action": "connect" | "disconnect" | "fetch" | "sync" | "status",
  "payload": { /* per-action; dispatcher does not inspect */ }
}
```

| Response | When |
|----------|------|
| 200 + `{ success: true, ... }` | Adapter executed successfully |
| 200 + `{ success: false, skipped: true }` | Idempotent dedup — record already exists |
| 400 | Request shape invalid (missing source, unknown action) |
| 404 | No adapter registered for `source` |
| 501 | Adapter exists but does not implement the requested `action` |
| 500 | Adapter handler threw; sanitized `error.message` returned |

## Adapter interface

```ts
interface ConnectorAdapter {
  source: string; // must match a SourceConfig.id on the frontend
  connect?:    (ctx, request) => Promise<AdapterResult>;
  disconnect?: (ctx, request) => Promise<AdapterResult>;
  fetch?:      (ctx, request) => Promise<AdapterResult>;
  sync?:       (ctx, request) => Promise<AdapterResult>;
  status?:     (ctx, request) => Promise<AdapterResult>;
}

interface AdapterResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  skipped?: boolean;
}
```

Unimplemented actions return 501 — the dispatcher does not paper over missing handlers.

## Registry change-management

Registry entries are append-only for an adopted source. Removing or renaming a `source_app` value is a data-migration concern, not a code change. New entries MUST:

- Use lowercase-kebab-case for `id` (matches `canonical-recording.ts` `SOURCE_APP_PATTERN`).
- Declare `adapter`. If `adapter === 'composio'`, also declare `composioToolkit`.
- Use the existing Remix Icon set (per root CLAUDE.md hard constraint).

A future test (planned per `consolidated-review.md` M7) will pin these invariants at build time so a typo in a new entry surfaces in CI, not on click.

## Native vs Composio adapter expectations

| Concern | Native adapter | Composio adapter |
|---------|---------------|------------------|
| OAuth flow | Per-vendor function (`{vendor}-oauth-url`/`{vendor}-oauth-callback`) | `composio-oauth-callback` (single function) |
| Token refresh | Per-vendor function (`{vendor}-oauth-refresh`) | Composio platform handles refresh |
| Webhook ingress | Per-vendor function (`{vendor}-webhook`) | `composio-trigger-webhook` (single function, per-toolkit normalizer) |
| Signature verification | Per-vendor scheme (HMAC, JWT, etc.) | HMAC-SHA256 with `COMPOSIO_WEBHOOK_SECRET` |
| Storage key | `import_sources.connection_metadata` JSONB + vendor-specific columns | `import_sources.composio_connected_account_id` (typed column, partial unique index) |

## Anti-patterns (rejected before merge)

- An adapter writing directly to `recordings` instead of going through `runCanonicalConnectorPipeline`.
- Routing identifiers stored in `connection_metadata` JSONB when a typed column exists — bypasses partial unique indexes and breaks `.maybeSingle()` determinism.
- Returning 5xx for a malformed Composio payload — Composio retries on non-2xx; bad data becomes an infinite retry loop. Return 200 ignored with a redacted `console.error` breadcrumb.
- Returning 4xx for an unknown `connected_account_id` — leaks which accounts CallVault tracks (anti-enumeration).

## Pilot acceptance criteria

Per ADR-006:

- **Otter native** ≤ 2 days to add — proves the native scaffolding holds.
- **Gong via Composio** ≤ 1 day to add — proves the Composio scaffolding holds.
- At least one Composio-routed source passes end-to-end against a live Composio account.

## References

- ADR-006 — selective adoption rationale
- `docs/integrations/03-connector-sop.md` — the SOP every connector PR is reviewed against (Composio appendix pending)
- `supabase/functions/_shared/__tests__/connector-framework.test.ts` — dispatcher unit tests
