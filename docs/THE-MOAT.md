# THE MOAT

**Status:** Canonical · **Last verified against code:** 2026-06-08 · **Owner:** Andrew Naegele

> Every claim in this document is grounded in shipped source with a `file:line` citation, or it is explicitly labeled **ROADMAP** (built-but-not-wired, or not built). If a claim here loses its code backing, the claim is wrong — fix the doc, not the reasoning. This is doctrine: build, product, and marketing decisions get measured against it.

---

## The one sentence

**CallVault is the customer-owned vault that unifies every conversation from every recorder into one corpus your own AI plugs into — the one thing no recorder can build, because being the recorder is their business.**

---

## The stack, reduced to first principles

An "AI notetaker" fuses three separable functions and sells them as one slab:

| Layer | What it is | Who owns the value | Trend |
|-------|-----------|--------------------|-------|
| **Capture** | A bot/agent that turns a live conversation into a transcript | Commodity — Recall.ai sells it as infra; Zoom/Teams give it free; Fathom free tier | Price → $0 |
| **Cognition** | The AI that reasons over transcripts (summaries, Q&A, extraction) | Rented from Anthropic/OpenAI — every "AskFred/Otter Chat/Ask Fathom" is a wrapper on rented weights | Commoditized |
| **Corpus** | Where transcripts are stored, normalized, owned, made queryable over time | **The only non-commodity, non-rentable, compounding layer** | Compounds with use |

CallVault owns the **corpus layer** — and owns it precisely because staying neutral about capture and open about cognition is the one move the recorders **can't** make without breaking their own P&L.

---

## What is verified TRUE in code

### 1. Multi-source ingestion into one canonical corpus — **TRUE**

Every source normalizes into a single `recordings` table via a shared insert contract.

- Insert contract + normalizer: `supabase/functions/_shared/connector-pipeline.ts:197-215`; canonical validation `supabase/functions/_shared/canonical-recording.ts:73-92`
- All read/query surfaces hit the one `recordings` table.

**Five reachable sources, each with backend + frontend connect-UI:**

| Source | Auth | Pipeline | Transcription | Evidence |
|--------|------|----------|---------------|----------|
| Fathom | OAuth2 + HMAC webhook | `source_app:'fathom'` | pass-through | `fathom-oauth-url/index.ts:90-95`, `webhook/index.ts:442-461` |
| Zoom | OAuth2 + webhook | `source_app:'zoom'` | pass-through (VTT parse) | `zoom-sync-meetings/index.ts:128-156`, `_shared/vtt-parser.ts` |
| Fireflies | API key + webhook | `source_app:'fireflies'` | pass-through | `_shared/fireflies-connector.ts:143-174` |
| YouTube | public URL | `source_app:'youtube'` | pass-through | `youtube-import/index.ts:730-745` |
| Upload | direct upload | `source_app:'file-upload'` | **Whisper `whisper-1`, 25MB** | `file-upload-transcribe/index.ts:143-150` |
| Paste | none | direct insert | parses pasted Fathom copy; **never calls fathom.video** | `save-pasted-transcript/index.ts:263-300` |

This is the foundation. It is real, shipped, and reachable. **No incumbent notetaker ingests competitors' recordings — their corpus only holds what their own bot captured.** CallVault's does the opposite by design.

### 2. Per-org MCP — bring your own AI to the corpus — **TRUE (stated precisely)**

- **41 tools** (17 read / 12 write / 8 admin / 4 AI), all with live dispatch handlers: `supabase/functions/_shared/mcp-tool-categories.ts:27-76`; case dispatch `mcp-server/index.ts:1273-3855`
- AI tools make real LLM calls (OpenRouter), cost-gated before the paid call: `mcp-server/index.ts:2367,2426-2430`
- OAuth Dynamic Client Registration (RFC 7591) so any MCP client (Claude/ChatGPT/Cursor) registers: `mcp-oauth-register/index.ts:148`
- **Auto-provisioned** on org creation via DB trigger + on upgrade via Polar webhook, Pro+ gated: `migrations/20260410153126_mcp_auto_provision.sql:94-98`; `polar-webhook/index.ts:432`
- Every token scoped to org or workspace: `migrations/20260310160000_mcp_tokens.sql:13-18`

**Precision required:** this is a per-org **credential on a shared endpoint** (`api.callvaultai.com`), not isolated per-tenant infrastructure. Say "per-org MCP access," not "a server per customer." The stale "36 tools" comment inside `mcp-server/index.ts:25` is **wrong** — never repeat it; the real number is 41.

### 3. Hard org isolation — **TRUE**

- RLS enabled and org/workspace-scoped via `auth.uid()`, not permissive: `migrations/20260308000002_tighten_recordings_select_rls.sql:19-42`
- Every `USING(true)` policy is `TO service_role` only (never reaches clients)
- **CI cross-org leak test** signs in two real users across two orgs and asserts 0 cross-org rows across 10 user-facing tables: `src/test/rls-regression.test.ts`

Defense-in-depth: RLS at the DB + token scoping at the MCP layer + a CI regression gate.

### 4. Customer-owned, exportable data — **TRUE (strongest claim)**

- 7+ real client-side formats: PDF, DOCX, TXT, JSON, CSV, Markdown (YAML frontmatter), ZIP bundle — `src/lib/export-utils.ts`
- Plus LLM-Context, Narrative, Analysis-Package — `src/lib/export-utils-advanced.ts:161,240,276`
- Reachable via `SmartExportDialog.tsx` with single/individual/weekly/by-folder/by-tag modes

The data is the customer's and it leaves cleanly. This is the literal opposite of incumbent lock-in.

### 5. Pricing gates the moat correctly — **TRUE**

- 3 tiers: `useSubscription.ts:12` (`'free' | 'pro' | 'team'`); prices Free / $29 / $79 at `PlanCards.tsx:34-89`
- MCP is the paid wall: Free card says `'No MCP / External AI integrations'` (`PlanCards.tsx:48`), Pro says `'Full MCP / External AI access'` (`:65`), server enforces it at `mcp-server/index.ts:1205-1223`

The thing competitors can't copy (BYO-AI to a multi-source owned corpus) is exactly the thing behind the paywall. Correct by construction.

---

## What is NOT yet true — ROADMAP, do not claim

### Cross-source deduplication — **NOT SHIPPED**

The doc set and earlier strategy treated "we dedupe the same meeting across Fathom + Zoom" as a live differentiator. **The code does not do this.**

- The only wired dedup is exact `(organization_id, source_app, source_call_id)` — same-source by construction: `connector-pipeline.ts:82-127`. Two captures of one meeting from two platforms have different `source_app` and will never match.
- The fuzzy 2-of-3 matcher (title/time/participant) is real but wired **Zoom-vs-Zoom only** (`dedup-fingerprint.ts`, called only from `zoom-webhook`/`zoom-sync-meetings`).
- The Fathom-side fuzzy module (`deduplication.ts`) has **zero production callers — it is dead code.**

**Implication:** cross-platform dedup is the single highest-leverage moat-deepening build available (see §"Deepen, don't widen"). Until it's wired across sources, it is ROADMAP and must not appear in positioning as a shipped capability.

---

## Why incumbents structurally cannot copy this

To match CallVault, a recorder (Fathom/Zoom/Otter/Fireflies/Gong) would have to:

1. **Ingest competitors' recordings** — admitting customers use rivals, cannibalizing its own capture product.
2. **Hand the full team-wide corpus to the customer's own AI** — surrendering the AI-credit/seat revenue that funds it (Fireflies credits, Gong credits, Copilot license).
3. **Make data trivially portable and owned** — the opposite of the lock-in its retention depends on.

This is the **incumbent's dilemma**. It's not a feature gap they can close; it's a prohibition baked into their P&L. That dilemma — not any single feature — is the moat.

Corroborating market reality (research, 2026):
- BYO-AI via MCP is now a *checkbox* (Fireflies, Otter, Fellow, Granola all ship one) — **but every one is single-source, and most are per-user-scoped** (Granola's MCP excludes team folders). Multi-source + team-wide + customer-owned remains unclaimed.
- Microsoft will never ingest Google Meet; Google will never ingest Teams. Suite vendors are **single-ecosystem by corporate definition** — structurally disqualified from the multi-vendor reality every real team lives in.
- Otter is the one to watch (explicitly chasing "Conversational Knowledge Engine" + bidirectional MCP) but is still recorder-anchored and carrying live consent litigation (*Brewer v. Otter.ai*, 2025) that poisons a "trust us with everything" pitch.

---

## Deepen, don't widen — the decision test

For every proposed feature, ask: **does this deepen the corpus moat, or widen us into a fight we lose?**

✅ **Deepens (build these):**
- More sources into the corpus (more connectors, faster backfill of legacy recordings)
- Cross-conversation intelligence (folder-level chat, cross-client patterns, objection→rebuttal across reps) — only possible *because* the unified corpus exists
- **Cross-source dedup wired across all sources** (closes the one false claim and is genuinely unique)
- Faster connect-and-accumulate onboarding (onboarding speed = switching-cost depth)
- Visible isolation/ownership proof (the honeypot defense is also the trust sell)

❌ **Widens (don't):**
- Anything that makes CallVault a *better recorder* or a *better single-meeting notetaker* — that's fighting Fathom on Fathom's turf, where capture is free and we lose.

---

## Threat-defense map (summary)

| Threat | Window | Defense that deepens the moat |
|--------|--------|-------------------------------|
| Otter "Knowledge Engine" pivot | 6mo–2yr | Own "every recorder, not just ours" + "never trained on" before Otter is forced to admit multi-tool reality |
| Recall.ai goes direct to customers | 1–3yr | Out-execute on corpus/org-model/switching-cost; consume Recall as a connector, don't race it on capture |
| Aggregation legal/ToS/consent | 6mo–2yr | Lead with official OAuth connectors; make consent-clean, never-trained, exportable a *feature* |
| MS/Google free bundling | 1–3yr | Neutralized by multi-vendor reality — be the Switzerland no suite vendor can be |
| Model-vendor native memory | 2–5yr | Be the best-governed multi-source feed their memory plugs into — their hunger is our distribution |
| Vault-position copycat | 1–3yr | Out-accumulate; the idea is free, the corpus + switching cost is not |
| Corpus honeypot breach | ongoing | Security/isolation is the moat foundation — already RLS + CI-guarded; market it |

Full threat model: see strategy notes / `docs/POSITIONING.md`.
