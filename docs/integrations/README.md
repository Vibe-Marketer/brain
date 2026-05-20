# CALLVAULT INTEGRATION SPEC — INDEX

**Date:** 2026-05-15
**Audience:** Engineering team building call/transcript source integrations.
**Status:** v1 — ground truth. Update as Phase 0 fixes ship.

This is the **exact spec** for adding 8 call recording sources to CallVault (Fireflies, Grain, GHL, tl;dv, RingCentral, Microsoft Teams, Plaud, Mojo Dialer) — plus the universal procedure for adding any future source #9, #10, #N.

Not a "framework." Not a "research note." An exact, executable specification.

---

## DOCUMENTS

| # | Doc | When to read |
|---|-----|--------------|
| 01 | [`01-connector-pipeline-vet.md`](./01-connector-pipeline-vet.md) | **READ FIRST.** Audit of the existing `_shared/connector-pipeline.ts` — 20 findings, 5 critical patches required before any new connector. |
| 02 | [`02-platform-specs.md`](./02-platform-specs.md) | When building a specific connector. One section per platform with exact endpoints, scopes, rate limits, webhook payloads, ConnectorRecord mapping. |
| 03 | [`03-connector-sop.md`](./03-connector-sop.md) | The exact 11-step procedure for adding any source. Layer model + checklist. Use for code review of new connector PRs. |
| 04 | [`04-zapier-reverse-engineering.md`](./04-zapier-reverse-engineering.md) | When considering reverse-engineering. Modes A/B/C decision tree + when RE is worth it (Plaud yes, Mojo no, the other 6 not applicable). |
| 05 | [`05-rollout-plan.md`](./05-rollout-plan.md) | Phased build order, dev-day estimates, risk register, 1-engineer vs 2-engineer timelines. |

---

## TL;DR

**The pipeline (`_shared/connector-pipeline.ts`) is solid bones. The fix-list is 5 critical patches (3 dev-days), then each new connector is ~3-8 days of work.**

**Build order:**
1. Phase 0 — Pipeline patches (5 days). Required before any new connector.
2. Phase 1 — **Grain** (3-5 days). Cleanest API, sets the pattern.
3. Phase 2 — **Fireflies** (2.5 days). API key, GraphQL.
4. Phase 3 — **Plaud Path A** (2 days). Via Zapier webhook (sanctioned).
5. Phase 4 — **GoHighLevel** (5-6 days). Marketplace App, Ed25519, multi-tenant.
6. Phase 5 — **tl;dv** (3 days). Defensive wrapper for alpha API.
7. Phase 6 — **RingCentral** (5-6 days). OAuth + telephony sessions + poll on disconnect.
8. Phase 7 — **Microsoft Teams** (7-8 days). Graph subscriptions + admin consent + encryption.
9. Phase 8 — **Mojo Dialer** (3 days). Manual CSV+MP3 import (no API exists).
10. Phase 9 — **Plaud Path B** (4 days). Direct openplaud-style integration. Only if Path A validates demand.

**Total dev-days:** ~37 sequential, ~3.5 weeks at 2 engineers in parallel.

---

## NON-NEGOTIABLE PRINCIPLES

These are NOT suggestions. Reject PRs that violate them.

1. **All connectors use `runPipeline()` from `_shared/connector-pipeline.ts`.** No custom dedup. No custom insert.
2. **All HTTP through per-platform `<platform>-client.ts` with retry + auth headers.** Never call `fetch` directly from sync code.
3. **ConnectorRecord is the contract.** Every connector's job is "platform payload → ConnectorRecord."
4. **Webhook signature verification is non-optional.** Use `_shared/webhook-verify.ts`. Fail closed on invalid sig.
5. **Read raw body before parsing for signature checks.** Pretty-printed JSON breaks HMAC.
6. **Return 200 on webhook receivers unless signature failed.** Platforms retry on non-2xx and will hammer you.
7. **Audit every recording outcome to `sync_job_items`** so we can answer "did sync see meeting X?"
8. **No Fathom-specific or Zoom-specific code in `_shared/connector-pipeline.ts`** (current violation: lines 192-194 fix in F-04).
9. **Tier requirements surfaced in connect UI.** No "404 on connect" because user is on the wrong plan.
10. **Verify before claiming "deployed" — hit the URL and read the logs.** Per root `CLAUDE.md`.

---

## WHEN TO REVERSE-ENGINEER

Follow the decision tree in `04-zapier-reverse-engineering.md`. Summary:

- **Has official public API?** → use it. RE wastes time.
- **No public API, but Zapier has an integration?** → check if first-party (Mode B). For our 8: only Plaud. Path A (Zapier webhook) ships first; pursue partnership for direct.
- **No public API, no Zapier?** → check community RE projects. For Plaud: openplaud (179 stars). For Mojo: nothing exists.
- **No community RE either?** → printing-press browser-sniff methodology (skill: `printing-press`).

---

## CHECKLISTS TO COPY INTO PRs

### New connector PR — must have

```
[ ] §02 platform spec section written and reviewed
[ ] OAuth app registered (or API-key flow built)
[ ] _shared/<platform>-client.ts implemented + unit tests pass
[ ] OAuth functions deployed and connect flow works end-to-end
[ ] Webhook receiver implemented with signature verification (when applicable)
[ ] Sync function implements cursor-based pagination
[ ] ConnectorRecord mapping covers all fields in the §02 spec
[ ] runPipeline integration verified — new + duplicate + re-import cases
[ ] sync_job_items audit rows written for every recording
[ ] Frontend connect UI built, tier badge present, error states handled
[ ] Integration test with real account passes
[ ] RLS regression test still passes
[ ] Runbook entry added in docs/operations/
[ ] Sentry/Langfuse alerts configured for >1% failure rate
[ ] Customer support team briefed on the new connector
[ ] Tier requirement surfaced in CallVault marketing / pricing pages
```

### Pipeline fix PR — Phase 0 — must have

```
[ ] F-01: audio_url, video_url, media_url_expires_at added to ConnectorRecord
[ ] F-02: full_transcript nullable + transcript_status + reconcile-transcripts function
[ ] F-03: 23505 unique-violation gracefully handled in insertRecording
[ ] F-04: Fathom-specific branch removed from pipeline
[ ] F-05: _shared/webhook-verify.ts shipped + Fathom/Zoom/Polar webhooks migrated
[ ] F-06: _shared/oauth-refresh.ts with transparent 401 retry
[ ] F-07: Langfuse spans on pipeline.dedup, pipeline.route, pipeline.insert, pipeline.cross_org_copy
[ ] F-14: _shared/transcript-normalizer.ts with discriminated union
[ ] F-15: sync_job_items migration + RLS + service-role insert policies
[ ] All existing Fathom + Zoom integration tests pass on patched pipeline
[ ] RLS regression test passes
```

---

## OPEN QUESTIONS FOR THE TEAM

1. **Multi-org targeting:** Does the connect flow let user choose which org to land recordings in? Current pipeline defaults to "personal." Decision needed before GHL ships (since each Location is its own context).
2. **Plaud partnership outreach:** Who at Andrew's network has a Plaud contact? Speeds up Phase 9 timeline.
3. **Storage budget:** 8 connectors at ~100 recordings/customer/month at ~50MB/recording = ~40GB/customer/year storage growth. Confirm Supabase Storage plan supports this.
4. **Compliance recording lane for Teams:** Do we want to pursue Microsoft Compliance Recording partner certification? Lucrative but multi-month process. Punt to Phase 10.
5. **AI Title generation per source:** Existing `generate-ai-titles` Edge Function — does it run on all sources or just Fathom? Audit before Phase 1.
6. **Routing rules UX for multi-source:** With 8 sources, routing rules UI needs source-app filter. Frontend work outside this spec.

---

## CHANGELOG

- **2026-05-15** — v1 created. Connector-pipeline vet + 8 platform specs + SOP + Zapier RE + rollout plan. Research sources: official platform docs cited inline in §02.

---

*This spec was produced from deep research across 4 parallel research streams plus a line-by-line audit of `_shared/connector-pipeline.ts` (521 LOC) plus inspection of `fathom-client.ts`, `zoom-client.ts`, `dedup-fingerprint.ts`, `oauth-encrypt.ts`, `sync-meetings`, `zoom-sync-meetings`, and the recordings + import_sources database migrations. Every endpoint URL, scope string, rate limit number, and gotcha is verified against authoritative sources. Confidence tags ([HIGH] / [MED] / [LOW] / [DOCS GAP]) in §02 indicate verification level — anything tagged [LOW] or [DOCS GAP] requires confirmation before production ship.*
