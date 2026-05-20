# PHASED ROLLOUT PLAN — 8 PLATFORMS

This is the **sequence** for actually doing the work. Ordered by leverage: easiest API quality + biggest user base first. Total elapsed time at 1 engineer: ~6.5 weeks. With 2 engineers in parallel after Phase 0: ~3.5 weeks.

**Date:** 2026-05-15
**Owner:** Andrew + engineering team
**Reference:** `01-connector-pipeline-vet.md`, `02-platform-specs.md`, `03-connector-sop.md`, `04-zapier-reverse-engineering.md`

---

## PHASE 0 — PIPELINE FOUNDATION FIXES (BLOCKER — DO FIRST)

**Why first:** These 5 issues from the vet are pipeline-wide. If you build Fireflies before fixing them, you'll duplicate the workaround in every subsequent connector. ~5 days of work saves ~15 days of rework across 8 platforms.

| Day | Task | Output |
|-----|------|--------|
| 0.5 | F-01 — Add `audio_url`, `video_url`, `media_url_expires_at` to `ConnectorRecord`. Migration adds `media_url_expires_at` column to `recordings`. | `_shared/connector-pipeline.ts`, migration `20260516_media_url_expiry.sql` |
| 1.0 | F-02 — Nullable `full_transcript` + `transcript_status` + `transcript_format` + `transcript_raw`. Build `<reconcile-transcripts>` scheduled function that re-fetches `pending` rows. Migration. | `_shared/connector-pipeline.ts`, `supabase/functions/reconcile-transcripts/`, migration |
| 0.5 | F-03 — Wrap insertRecording in PG error-code 23505 catch with idempotent re-query path. | `_shared/connector-pipeline.ts` |
| 0.25 | F-04 — Move Fathom branch out of pipeline; add `legacy_id_numeric` to ConnectorRecord, set in Fathom connector. | `_shared/connector-pipeline.ts`, `sync-meetings/index.ts` |
| 0.5 | F-05 — Build `_shared/webhook-verify.ts` with `verifyHmacSha256`, `verifyEd25519`, `verifyTimestamped`. Migrate Fathom + Zoom + Polar webhook receivers to use it. | `_shared/webhook-verify.ts` + 3 webhook files |
| 1.0 | F-06 — Build `_shared/oauth-refresh.ts` with `fetchWithTokenRefresh` (transparent retry on 401). Migrate Zoom + Fathom to use it. | `_shared/oauth-refresh.ts` |
| 0.5 | F-07 — Wire Langfuse spans into pipeline stages. | `_shared/connector-pipeline.ts` |
| 0.5 | F-14 — Build `_shared/transcript-normalizer.ts` with discriminated union for VTT/SRT/Fathom/Fireflies/Grain/plain. Backfill existing parsers as adapters. | `_shared/transcript-normalizer.ts` |
| 0.25 | F-15 — Create `sync_job_items` table migration + RLS. | migration |

**Phase 0 total: ~5 dev-days.**

**Gate to enter Phase 1:** Run RLS regression test + full integration test of Fathom + Zoom on the patched pipeline. Zero regressions.

---

## PHASE 1 — GRAIN (REFERENCE BUILD)

**Why first connector:** Cleanest API surface — OAuth2, cursor pagination, multiple transcript formats, 300/min rate limit, well-documented. Sets the canonical pattern for all subsequent connectors.

| Day | Task |
|-----|------|
| 1 | OAuth app registration + secrets + `_shared/grain-client.ts` |
| 1 | `grain-oauth-url`, `grain-oauth-callback`, `grain-oauth-refresh` |
| 1 | `grain-sync-meetings` (cursor poll) + `grain-create-webhook` |
| 1 | `grain-webhook` receiver + ConnectorRecord mapping |
| 0.5 | Frontend connect UI + tier badge |
| 0.5 | Integration test with real Grain account + RLS regression |
| **Day 5** | **SHIP** |

**Phase 1 total: 3-5 dev-days** (varies based on Grain support response time for webhook-signing confirmation).

**Outputs:**
- Working Grain integration end-to-end
- Canonical reference for future connector PRs
- "Behind the Connector" runbook entry in `docs/operations/`

---

## PHASE 2 — FIREFLIES (PARALLEL ELIGIBLE)

**Why second:** API-key auth (simpler than OAuth), GraphQL surface — validates the adapter handles non-REST. Smaller dev cost.

Can run in parallel with Phase 1 if 2 engineers available.

| Day | Task |
|-----|------|
| 0.5 | `_shared/fireflies-client.ts` (GraphQL helper) |
| 0.5 | `save-fireflies-key` + frontend connect modal |
| 1 | `fireflies-sync-meetings` (offset poll with date-window beyond 5000 skip) |
| 0.5 | `fireflies-webhook` + HMAC-SHA256 verify |
| 0.25 | ConnectorRecord mapping + transcript normalizer adapter |
| 0.25 | Tier-badge UI ("Requires Business plan or higher") |
| 0.5 | Integration test |
| **Day 3.5** | **SHIP** |

**Phase 2 total: 2.5-3 dev-days.**

---

## PHASE 3 — PLAUD PATH A (ZAPIER, 2 DAYS)

**Why third:** Highest ratio of customer demand to dev cost. Plaud has rabid users; sanctioned webhook ingestion ships in 2 days.

| Day | Task |
|-----|------|
| 0.5 | `plaud-zapier-webhook` Edge Function with HMAC signing |
| 0.5 | ConnectorRecord mapping + audio fetch from URL |
| 0.5 | Frontend "Connect via Zapier" UI with copy-paste webhook URL + Zap template link |
| 0.5 | Live test with real Plaud + Zapier account, document Zap creation flow |
| **Day 2** | **SHIP Path A** |

**Phase 3 total: 2 dev-days.**

**Email partnerships@plaud.ai concurrently** with "We're CallVault, ingesting Plaud recordings for our customers. Considering openplaud-style integration but would prefer partner API access. Can we discuss?"

---

## PHASE 4 — GOHIGHLEVEL (HIGHEST FRICTION OF MODE A)

**Why fourth:** Multi-tenant sub-account model + Marketplace App review + Ed25519 signing. Most complex Mode A platform but high-volume customer base.

| Day | Task |
|-----|------|
| 1 | Marketplace App registration + secrets + `_shared/ghl-client.ts` |
| 1 | `_shared/ghl-webhook-verify.ts` (Ed25519 + RSA fallback) |
| 1 | `ghl-oauth-url` (`/chooselocation`) + `ghl-oauth-callback` (per-location storage) + `ghl-oauth-refresh` (22h schedule) |
| 1 | `ghl-webhook` + recording-poll-with-backoff Edge Function |
| 0.5 | `ghl-sync-conversations` + `ghl-fetch-recording` (stream WAV to Storage) |
| 0.5 | Frontend connect UI (per-Location flow + Unlimited tier badge) |
| 1 | Integration test + Marketplace App submission (review takes 3-7 business days separately) |
| **Day 6** | **SHIP** (live for customers after GHL review) |

**Phase 4 total: 5-6 dev-days** + GHL review wait time.

---

## PHASE 5 — TL;DV (DEFENSIVE WRAP)

**Why fifth:** Alpha API — needs heavy defensive wrapping. Less mature surface but real demand from sales orgs.

| Day | Task |
|-----|------|
| 0.5 | `_shared/tldv-client.ts` with Zod response validators |
| 0.5 | `save-tldv-key` + connect modal |
| 1 | `tldv-sync-meetings` (page poll) + `tldv-webhook` (`MeetingReady` + `TranscriptReady`) |
| 0.5 | Media download with 6h-TTL refetch logic |
| 0.25 | ConnectorRecord mapping |
| 0.25 | Frontend connect + Business-tier badge |
| 0.5 | Integration test + version-pinning verification |
| **Day 3.5** | **SHIP** |

**Phase 5 total: 3 dev-days.**

---

## PHASE 6 — RINGCENTRAL

**Why sixth:** Heavy operational overhead — Heavy rate-limit group + no recording-completion event + sandbox dead. Need extra care but customer demand justifies it.

| Day | Task |
|-----|------|
| 1 | OAuth app + PKCE + `_shared/ringcentral-client.ts` with sandbox-dead reality + media subdomain support |
| 1 | `ringcentral-oauth-url` + `ringcentral-oauth-callback` (PKCE state mgmt) |
| 0.5 | `ringcentral-create-subscription` + `ringcentral-renew-subscriptions` (80% TTL) |
| 1.5 | `ringcentral-webhook` (telephony sessions) → `ringcentral-poll-recording` (5s/30s/2min/10min backoff) |
| 0.5 | `ringcentral-fetch-recording` (Bearer auth to media.ringcentral.com) + Storage upload |
| 0.5 | Frontend connect + Advanced-tier badge + custom-rate-limit-increase request UX |
| 0.5 | Integration test (real RC sandbox-free account) |
| 0.5 | Request custom rate-limit increase from RingCentral support |
| **Day 6** | **SHIP** |

**Phase 6 total: 5-6 dev-days.**

---

## PHASE 7 — MICROSOFT TEAMS (HIGHEST FRICTION OVERALL)

**Why seventh:** Two competing APIs + admin consent + applicationAccessPolicy + change-notification encryption + license complexity. Save for when team has connector muscle memory.

| Day | Task |
|-----|------|
| 1 | Azure AD app registration + secrets + `_shared/teams-client.ts` |
| 0.5 | `_shared/teams-decrypt.ts` (RSA-decrypt encrypted resourceData) + cert generation tooling |
| 1.5 | `teams-oauth-url` + `teams-oauth-callback` + admin-consent guidance UI |
| 1 | `teams-create-subscription` (encryption cert + lifecycle URL + getAllRecordings) + `teams-renew-subscriptions` |
| 1 | `teams-webhook` (validation token + decrypt + dedup) + `teams-lifecycle` (reauth + removed events) |
| 1 | `teams-fetch-recording` (MP4 + VTT, both stream to Storage) |
| 0.5 | `teams-sync-meetings` (delta query for backfill) |
| 0.5 | Frontend connect UI with tenant-admin instructions + license guidance |
| 1 | Integration test (test tenant with E3 + admin consent + applicationAccessPolicy) |
| **Day 8** | **SHIP** |

**Phase 7 total: 7-8 dev-days.**

---

## PHASE 8 — MOJO DIALER (MANUAL IMPORT)

**Why eighth:** Simplest path because no API to build against. Build last for real estate / outbound-dialer customers.

| Day | Task |
|-----|------|
| 0.5 | Get real Mojo test account, export sample CSV + MP3 batch, document exact CSV columns + MP3 filename pattern |
| 0.5 | `mojo-csv-upload` Edge Function — multipart parse, CSV validation (Zod) |
| 0.5 | MP3 matching logic (timestamp + phone fuzzy match) + Storage upload |
| 0.5 | `mojo-process-row` worker — per-row pipeline ingest |
| 0.5 | Frontend Mojo Importer UI (drag-drop CSV + ZIP, parsed preview, import button) |
| 0.5 | Integration test with real Mojo export bundle |
| **Day 3** | **SHIP** |

**Phase 8 total: 3 dev-days.**

---

## PHASE 9 — PLAUD PATH B (DIRECT, POWER USERS)

**Why ninth (after others ship):** Optional upgrade lane for Plaud users who want hands-off sync without paying Zapier. Build only if Phase 3 (Path A) shows real demand.

| Day | Task |
|-----|------|
| 0.5 | Port `arbuzmell/plaud-api` (MIT) endpoint list to TypeScript in `_shared/plaud-client.ts` with browser User-Agent + region routing |
| 1 | `plaud-otp-send` + `plaud-otp-verify` Edge Functions + token storage |
| 1 | `plaud-sync-recordings` (5-min poll) + dedup via `plaud_recording_id` |
| 0.5 | `plaud-fetch-media` (signed S3 from resource.plaud.ai) + Storage upload |
| 0.5 | Frontend OTP flow + Google/Apple "paste token" fallback UX |
| 0.5 | Integration test (real Plaud account, both email + OAuth user variants) |
| **Day 4** | **SHIP Path B** |

**Phase 9 total: 4 dev-days.**

---

## ELAPSED TIMELINE — 1 ENGINEER (SEQUENTIAL)

| Week | Phase(s) | Cumulative dev-days |
|------|----------|----------------------|
| 1 | Phase 0 (pipeline fixes) | 5 |
| 2 | Phase 1 (Grain) + Phase 2 (Fireflies) | 9 |
| 3 | Phase 3 (Plaud A) + Phase 4 (GHL build, awaiting review) | 13 |
| 4 | Phase 5 (tl;dv) + start Phase 6 (RC) | 17 |
| 5 | Finish Phase 6 (RC) + start Phase 7 (Teams) | 22 |
| 6 | Finish Phase 7 (Teams) | 30 |
| 7 | Phase 8 (Mojo) + Phase 9 (Plaud B if validated) | 37 |

**Total: ~7 weeks 1 engineer, with GHL Marketplace review running in parallel.**

---

## ELAPSED TIMELINE — 2 ENGINEERS (PARALLEL)

| Week | Engineer A | Engineer B |
|------|-----------|-----------|
| 1 | Phase 0 (pipeline fixes — joint work) | Phase 0 (pipeline fixes — joint work) |
| 2 | Phase 1 (Grain) | Phase 2 (Fireflies) |
| 3 | Phase 4 (GHL — most complex Mode A) | Phase 3 (Plaud A) + Phase 5 (tl;dv) |
| 4 | Phase 6 (RingCentral) | Phase 8 (Mojo) |
| 5 | Phase 7 (Teams) | Phase 7 (Teams — pairing on complexity) |
| 6 | Phase 9 (Plaud B if validated) | Cleanup + connector runbooks + marketing collateral |

**Total: ~3.5-4 weeks elapsed, 2 engineers.**

---

## RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GHL Marketplace review takes >2 weeks | Medium | High | Submit Phase 4 build early; keep PIT-based internal flow as fallback |
| Grain webhook signing requires support escalation | High | Low | Ship with random-URL secret as poor-man's auth; switch to HMAC when confirmed |
| Plaud changes API and breaks Path B | Medium | Medium | Path A (Zapier) remains as fallback; openplaud community catches changes fast |
| Teams applicationAccessPolicy is too complex for self-serve customers | High | High | Build admin-consent assistance UI + Loom video walkthrough; offer concierge onboarding for first 10 enterprise customers |
| tl;dv API breaks during alpha period | Medium | Medium | Zod validators fail-soft to Langfuse; defensive `_shared/tldv-client.ts` |
| RingCentral Heavy rate limit blocks backfill | High | Medium | Request custom limit increase day 1 of build; cap backfill window to 30 days initially |
| Mojo CSV format isn't what we documented | High | Low | Verify with real Mojo account BEFORE building (SOP-0 step 1) |
| Plaud partnership request denied | Medium | Low | Path A (Zapier) carries indefinitely; Path B (openplaud) ships as-is |

---

## TIER REQUIREMENTS — CUSTOMER-FACING

Surface in CallVault marketing + connect flow so customers know what they need:

| Platform | Minimum customer plan | Cost to customer |
|----------|----------------------|------------------|
| Fireflies | Business | $19/user/mo annual |
| Grain | Business | $48/user/mo annual |
| GHL | Unlimited | $297/mo |
| tl;dv | Business | per their pricing |
| RingCentral | Advanced | ~$25/user/mo |
| Teams | M365 Business Standard or above + admin consent | varies |
| Plaud | Plaud device + Zapier (Path A) or just Plaud (Path B) | $20/mo Zapier (Path A only) |
| Mojo | Call Recording add-on | per Mojo pricing |

---

## SUCCESS METRICS — 90 DAYS POST-LAUNCH

Per platform:
- Connect-success rate ≥ 90% (target: 95%)
- Sync failure rate < 1% per day
- Time from "click connect" → "first recording visible" < 5 min
- Customer support tickets per 100 connected sources < 3

Aggregate:
- ≥ 30% of CallVault paying customers connected ≥ 1 of the new 8 sources
- ≥ 5% connected ≥ 2 sources (multi-source value validation)
- ≥ 1 customer using Plaud + Mojo + RingCentral simultaneously (real-estate operator profile)

---

## WHAT TO DO IF A PLATFORM CHANGES MID-BUILD

- **Documented breaking change** → revise `02-platform-specs.md` section, update `_shared/<platform>-client.ts`, communicate to customers within 24h via in-app banner.
- **Undocumented change discovered via 4xx/5xx spike** → escalate to platform support, file ticket, deploy temporary fallback (retry/skip), document in runbook.
- **Platform deprecates the API entirely** → check for Zapier-mode-B fallback (per `04-zapier-reverse-engineering.md`) or build manual-import (Mojo path).

---

## NEXT 5 PLATFORMS (PLAN FOR THE FUTURE)

When the first 8 are shipped, the most likely next additions:

1. **Otter.ai** — meeting transcription (similar to Fireflies); Mode A.
2. **CallRail** — inbound call tracking; Mode A REST API.
3. **Chorus.ai / Gong** — sales conversation intelligence; Mode A (enterprise OAuth).
4. **Aircall** — call center; Mode A REST API.
5. **Dialpad** — UCaaS; Mode A REST API.

All five are Mode A (official public API). At this point each new connector should be a ~3-day build using the SOP. The pipeline pays for itself.
