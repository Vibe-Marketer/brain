---
spike: 006
name: provider-comparison-synthesis
type: standard
validates: "Given the 4 provider research findings (002-005), when synthesized into a cross-cutting matrix and re-prioritized against Andrew's stated P0/P1 ordering, then we have a phase-plan-ready recommendation for which providers to build, in what order, with what follow-up spikes still required."
verdict: VALIDATED
related: [001, 002, 003, 004, 005]
tags: [synthesis, recommendation]
---

# Spike 006: Provider Comparison & Recommendation

## What This Validates

**Given** four provider research findings (Read.ai, Otter, Fireflies, tl;dv), **when** synthesized against the Fathom reference architecture and Andrew's original P0/P1 priority ordering, **then** we have a phase-plan-ready recommendation: which providers to build, in what order, with what follow-up OAuth-proof spikes still required, and what plan-tier and legal blockers must be cleared first.

## Cross-Provider Comparison Matrix

| Dimension | Fathom (baseline) | Read.ai | Otter | Fireflies | tl;dv |
|---|---|---|---|---|---|
| **Verdict** | ✓ SHIPPED | ⚠ CONDITIONAL | ⚠ CONDITIONAL | ⚠ CONDITIONAL | ⚠ CONDITIONAL |
| **API exists & docs** | ✓ stable | ✓ open beta (Feb 2026) | ✓ beta (launched Oct 2025) | ✓ GA (v2.23.1) | ⚠ v1alpha1 — "expect changes" |
| **Auth model** | OAuth 2.0 | OAuth 2.0 (DCR) | API key (Bearer) | API key (Bearer) | API key (`x-api-key`) |
| **Programmatic webhook subscribe** | ✓ POST `/webhooks` | ✗ user pastes URL in dashboard | ✓ programmatic | ✗ user pastes URL in dashboard | ✗ user pastes URL in dashboard |
| **Webhook signature** | HMAC | HMAC SHA-256 (`X-Read-Signature`) | HMAC SHA-256 | HMAC-SHA256 (`X-Hub-Signature`) | ✗ none — paste-it-yourself shared secret |
| **Multi-account support** | ✓ via `import_sources` | ✓ via `import_sources` | ⚠ workspace-level only | ⚠ per-API-key | ⚠ per-API-key |
| **Min plan tier for API** | depends on user's Fathom plan | **Pro $15/mo** annual | **Enterprise sales contract** | **Business $19/seat/mo** | **Business $59/seat/mo** |
| **Self-serve dev signup** | ✓ | ✓ | ✗ Enterprise sales-gated | ✓ (Developer Program approval) | ✓ |
| **Rate limit** | 60 req/min | undocumented | 500 req/min | 60 req/min (Business) / 50/day (Pro) | undocumented |
| **TOS posture** | permissive | **most permissive** of all 4 | **§11(c) blocks paid commercial use** | §6(a) requires written consent | competing-services clause; not disqualifying |
| **Edge functions to build** | 7 | ~6-7 | ~4 | ~4 | ~4 |
| **Setup wizard complexity** | one-click OAuth | multi-step (paste webhook URL) | API-key paste + sales-call dependency | API-key + Developer Program + manual webhook | API-key + manual webhook |
| **Transcript schema depth** | speakers + segments + summary | comparable | comparable | **richer than Fathom** (chapters, sentiment, AI filters) | comparable |

## Cross-Cutting Patterns

### 1. The "manual webhook paste" pattern is the dominant UX divergence

**Three of four providers** (Read.ai, Fireflies, tl;dv) require the end-user to manually paste the webhook URL + secret into the provider's dashboard. Only Otter offers programmatic subscribe (matching Fathom). This means **every new provider integration except Otter requires a multi-step setup wizard**, not a one-click OAuth handshake.

**Implication:** Frontend complexity per provider grows. The existing `FathomSetupWizard.tsx` is a reasonable template — copy that pattern with provider-specific paste steps.

### 2. Plan tier is the binding constraint, not technical feasibility

**No provider has a free-tier API.** Cost-to-end-user ranges from $15/mo (Read.ai Pro) to $35k/yr (Otter Enterprise). The cheapest provider is Andrew's existing daily driver. The most expensive is the one originally tagged P0.

**Cost ranking (cheapest first):**
1. Read.ai Pro: **$15/mo annual / $19.75 monthly** (webhooks gated at Pro+)
2. Fireflies Business: **$19/seat/mo** (free Pro = 50 req/day, useless for backfill)
3. tl;dv Business: **$59/seat/mo annual** (Pro & Free have no API access)
4. Otter Enterprise: **~$15k–$35k/yr custom contract** (no other tier has API access)

### 3. TOS scrutiny matters more than expected

| Provider | TOS clause | Severity |
|---|---|---|
| Read.ai | none restricting third-party storage / commercial use | ✓ permissive |
| Fireflies | §6(a) "prior written consent" required for any app interacting with the API → Developer Program application **mandatory before launch** | ⚠ procedural friction |
| tl;dv | competing-services clause; CYA email recommended but not disqualifying | ⚠ minor |
| **Otter** | **§11(c) prohibits use "in connection with any paid transcription workflow or as a value-added component of a commercial product or service"** — CallVault arguably fits | 🚨 blocker |

**Otter's §11(c) is a real blocker, not a paranoia clause.** A meeting-transcript app that surfaces Otter transcripts to paying CallVault customers IS a "value-added component of a commercial product." Either get a written carve-out from Otter sales/legal or do not ship Otter integration commercially.

### 4. Auth-model split saves edge-function count for 3 providers

| Provider | Auth | Edge functions saved vs Fathom (7) |
|---|---|---|
| Read.ai | OAuth 2.0 + DCR | -1 (no manual `webhook-create` needed; webhook is paste-only) |
| Otter | API key | -3 (no oauth-url / oauth-callback / oauth-refresh) |
| Fireflies | API key + GraphQL | -3 + GraphQL collapses fetch/sync into 1 |
| tl;dv | API key | -3 (no OAuth trio) |

**Total per-provider build cost (rough):**
- Read.ai: 6-7 edge functions + setup wizard with manual webhook step
- Otter: 4 edge functions + API-key paste UI + sales-coordination workflow
- Fireflies: 4 edge functions + Developer Program application + setup wizard with manual webhook
- tl;dv: 4 edge functions + setup wizard with manual webhook

## Re-prioritized Build Order (vs Andrew's Original P0/P1)

Andrew's original order: **Read.ai (P0), Otter (P0), Fireflies (P1), tl;dv (P1)**.

The research findings re-order this. Otter drops because of plan tier + TOS friction.

### Recommended order (after this research)

1. **Read.ai (P0 → still P0)** — cheapest plan, most permissive TOS, Andrew already uses it. Engineering risks (10-min token churn + manual webhook wizard) are real but solvable. Most user value per dollar of build cost.

2. **Fireflies (P1 → promotes to P2)** — lowest build cost (~4 edge functions), richest transcript schema, 3-month free Business trial for testing. **Procedural blocker:** TOS §6(a) Developer Program application has lead time → file the application this week if pursuing this path so approval lands before build starts.

3. **tl;dv (P1 → stays P3)** — viable but $59/seat/mo plan gate is steep, v1alpha API explicitly warns "expect breaking changes." Build only after Read.ai + Fireflies validate the multi-provider abstraction.

4. **Otter (P0 → demotes to P4)** — best technical surface (only programmatic-webhook provider; 500 req/min rate limit), worst access posture. Defer until: (a) paying CallVault customer specifically requests Otter, AND (b) Andrew has secured an Otter Enterprise account + written §11(c) carve-out from Otter legal. Do NOT build speculatively — the work is wasted if any paying customer can't actually access it.

## Recommended Follow-Up Spikes

Each surviving provider needs an OAuth/API-key proof spike before phase planning. These cannot be parallelized — each requires Andrew to have an active paid account and run live API calls. ~2 hours of work per spike.

| # | Name | Pre-requisites | Scope | Verdict promotion |
|---|---|---|---|---|
| 007 | readai-oauth-proof | Andrew Pro-upgrades Read.ai | DCR registration → auth-code flow → fetch `/v1/meetings?expand[]=transcript` → register webhook in dashboard → trigger meeting → verify HMAC + idempotency → hammer rate limit until 429 | CONDITIONAL → GO/NO-GO |
| 008 | fireflies-api-key-proof | Andrew applies to Fireflies Developer Program (start today; ~5-day approval) → Business trial active | Paste API key → list transcripts via GraphQL → register v2 webhook in dashboard → trigger meeting → verify HMAC-SHA256 + idempotency + 60/min rate limit | CONDITIONAL → GO/NO-GO |
| 009 | tldv-api-key-proof | Andrew Business-upgrades tl;dv | Paste `x-api-key` → fetch `/v1alpha1/meetings` with all query params → register webhook → trigger meeting → verify paste-it-yourself shared-secret → probe undocumented rate limit | CONDITIONAL → GO/NO-GO |
| 010 (DEFERRED) | otter-enterprise-trial-proof | Otter Enterprise trial with API enabled + written TOS §11(c) carve-out | Confirm `api.otter.ai/v1` is correct base (community CLI uses suspect `api.tryotter.com/v1`) → confirm endpoints + webhook event-name casing → end-to-end webhook delivery → field mapping | CONDITIONAL → GO/NO-GO. Spike intentionally deferred until commercial trigger and legal cover both exist. |

## Investigation Trail

- Spike 001: documented Fathom reference architecture (7 edge functions, 5 conventions).
- Spike 002 (parallel agent, 261s): Read.ai → CONDITIONAL.
- Spike 003 (parallel agent, 406s): Otter → CONDITIONAL with major access + legal blockers.
- Spike 004 (parallel agent, 260s): Fireflies → CONDITIONAL with cleanest technical fit.
- Spike 005 (parallel agent, 382s): tl;dv → CONDITIONAL with v1alpha API caveats.
- All four landed CONDITIONAL — no clean GO, no clean NO-GO. Differences are in *kind* of constraint (cost, legal, UX, API maturity), not strength of the API itself.

**Surprise:** The original P0/P1 ordering held up technically (Read.ai is the right first build) but inverted operationally (Otter drops from P0 to P4 due to plan + TOS).

**Surprise:** Fireflies's transcript schema is richer than Fathom's — meaning a Fireflies integration would offer CallVault users *more* transcript metadata than Fathom users get today. That's a competitive selling point.

**Caveat carried forward:** All 4 verdicts are paper-only. Until Andrew runs spikes 007/008/009 with live API calls, these verdicts are claims, not proofs. Especially: undocumented rate limits on Read.ai and tl;dv, base-URL ambiguity on Otter, webhook signature verification on tl;dv (no HMAC scheme).

## Results

**Verdict: VALIDATED.** Synthesis complete. The decision tree is clear:

1. **File the Fireflies Developer Program application this week** (5-day lead time on approval).
2. **Run Spike 007 (Read.ai OAuth proof)** as the next executable step — Andrew's already a Read.ai user, just need to upgrade to Pro.
3. **Run Spike 008 (Fireflies)** in parallel once Developer Program approves.
4. **Hold Spike 009 (tl;dv) and Spike 010 (Otter)** until 007/008 prove the multi-provider abstraction.
5. **Phase 26 plan** kicks off after Spike 007 lands — Read.ai gets the first full integration.

**Impact on phase planning:** Each surviving provider becomes its own phase (Phase 26 = Read.ai, Phase 27 = Fireflies, etc.) following the established `project_integration_provider_pattern.md` rule. The shared abstraction work (refactoring `import_sources` consumers, generalizing `user_settings` columns away from Fathom-specific names) becomes a pre-requisite phase that lands before Phase 26.
