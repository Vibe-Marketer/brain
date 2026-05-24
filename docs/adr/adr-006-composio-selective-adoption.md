# ADR-006: Composio selective adoption for integration platform sources

- **Status:** Accepted (Phase B — scaffolded 2026-05-23)
- **Date:** 2026-05-23
- **Authors:** AI-assisted, reviewed by Andrew Naegele
- **Supersedes:** —
- **Related:** [ADR-001 Vercel AI SDK](./adr-001-vercel-ai-sdk.md), `docs/specs/SPEC-connector-framework.md`, `docs/integrations/03-connector-sop.md`

> **NOTE:** This ADR is a STUB. It captures the decisions currently asserted by code-comments and PR descriptions in PR #279. Expand to the full ADR template (`adr-template.md`) when the Composio integration moves out of scaffold and into pilot.

---

## Context

CallVault currently ships native connectors for Fathom, Fireflies, Zoom, Plaud, and YouTube. Each native connector owns its OAuth flow, token refresh, webhook signing, retry, and pagination. The marginal cost of adding the next native connector (Otter, Avoma, Grain, Read.ai, Chorus, Gong, Dialpad, Webex, Microsoft Teams, Google Meet) is dominated by per-vendor auth + webhook engineering rather than canonical-pipeline mapping work.

Composio (composio.dev) provides a meta-integration platform: it owns OAuth registration, token refresh, and webhook delivery for ~250 vendors and re-emits a uniform trigger envelope. Adopting it for every vendor would lock CallVault into Composio's roadmap; adopting it for none would force CallVault to spend per-vendor engineering on commoditized auth glue.

## Decision

CallVault adopts Composio **selectively**, not wholesale.

1. **Native sources stay native.** Fathom, Fireflies, Zoom, Plaud, YouTube remain on their dedicated edge functions and Composio is not introduced into their paths.
2. **Composio targets the enterprise call-platform tier.** Initial in-scope vendors: **Gong, Dialpad, Webex, Microsoft Teams, Google Meet**. These share three traits — substantial per-vendor OAuth complexity, webhook delivery, and Composio first-class support.
3. **Selective adoption requires a connector framework.** A dispatcher edge function (`connector-dispatcher`) routes `{ source, action }` to registered adapters. Adapters declare `adapter: 'native' | 'composio'`. The canonical recording pipeline is unchanged — every adapter terminates in `runCanonicalConnectorPipeline`.
4. **Webhook policy:** Composio deliveries are HMAC-SHA256 signed; signature verification uses the same constant-time-compare pattern as fireflies-webhook. Unmatched `connected_account_id` returns **HTTP 200 ignored** (anti-enumeration, matches fireflies-webhook precedent) — Composio retries on non-2xx, so 4xx/5xx for unknown accounts would either leak which accounts exist or create infinite retry storms.
5. **Storage:** Composio's `connected_account_id` lives on a dedicated `import_sources.composio_connected_account_id` column with a partial unique index, NOT inside the `connection_metadata` JSONB blob. The JSONB blob remains shared infrastructure for other adapters.

## Acceptance criteria (success gate for Phase B exit)

The Composio framework is accepted when:

- **Otter native ≤ 2 days** of focused work to add (proves the native-side scaffolding holds).
- **Gong via Composio ≤ 1 day** of focused work to add (proves the Composio-side scaffolding holds).
- At least one Composio-routed source passes end-to-end against a live Composio account and lands a canonical recording.
- Anti-enumeration posture verified: webhook returns 200 ignored on unknown accounts in production traffic.

## Consequences

**Positive:**

- Per-vendor engineering for in-scope Composio targets compresses from days to hours (auth + webhook is Composio's surface).
- Migration plan is reversible — Composio adapters can be re-implemented natively if Composio's product diverges from CallVault's needs.
- Native connectors are unaffected; risk is bounded to in-scope vendors.

**Negative:**

- Composio is a new vendor dependency for these sources. Outage on Composio's side = outage for CallVault's Gong/Dialpad/Webex paths.
- Two integration models now exist; reviewers need to know which path applies. Mitigated by SPEC-connector-framework.md and the SOP appendix.
- Composio's pricing scales per workspace-connection — economics need a periodic review.

## Out of scope (for this ADR)

- Fireflies-via-Composio (Fireflies is already native and works).
- Migrating native connectors backward to Composio.
- Composio's polling-based adapter pattern for vendors with zero trigger support — covered by SPEC-connector-framework.md when adopted.

## Rollout

Phase A (this PR): scaffold. The dispatcher, adapter interface, and three vendor normalizers exist but are NOT wired into the production import path. `@composio-unverified` tag marks every call site that requires live-traffic confirmation.

Phase B (next): pilot Gong via Composio against a real workspace.

Phase C: open the gate for additional Composio targets (Dialpad, Webex, MS Teams, Google Meet) one vendor at a time.

## References

- `docs/specs/SPEC-connector-framework.md` — dispatcher contract, adapter interface
- `docs/integrations/03-connector-sop.md` — Composio adapter appendix
- `supabase/functions/_shared/connector-framework.ts` — discriminated request shape
- `supabase/functions/composio-trigger-webhook/index.ts` — webhook ingress
- `supabase/migrations/20260523192117_composio_integration_ids.sql` — storage column
