# POSITIONING

**Status:** Canonical · **Last verified against code:** 2026-06-08 · **Owner:** Andrew Naegele

> The outward-facing positioning doctrine for CallVault. Pairs with [`THE-MOAT.md`](./THE-MOAT.md) (the why) — this is the *what we say*. Every capability claim here is code-backed (see THE-MOAT.md for `file:line`) or labeled ROADMAP. Marketing, product, and sales copy get measured against this. When reality and this doc conflict, verify against code and fix the doc.

---

## The category

**CallVault is a conversation vault, not an AI notetaker.**

- ❌ Stop saying: "call intelligence platform," "AI notetaker," "meeting assistant," "AI-powered."
- ✅ Say: **"The conversation vault. Every recorder. Your AI. Your data."**

The brand line stays: **AI-ready, not AI-powered.** CallVault is the clean, owned, permissioned corpus your AI plugs into — not another chatbot bolted onto recordings.

---

## The bleeding-neck pain we own

> *"My team's conversations are scattered across whatever tool each person recorded with. Nothing can answer a question across all of it. And nobody lets me point my own AI at the whole thing — because every vendor only owns its own recordings and wants my data locked in their app."*

This is the sharpest, most-proven pain in the meeting-transcript market **and** the one incumbents are structurally worst-positioned to copy. We own it because we're the only player whose business model lets us:

1. **Ingest from every recorder** (Fathom, Zoom, Fireflies, YouTube, upload, paste) — not just our own.
2. **Hand the full corpus to the customer's own AI** via per-org MCP — not lock it in our UI.
3. **Make the data owned and portable** — not a retention hostage.

---

## Three messaging pillars (each code-backed)

### Pillar 1 — "Every recorder, one vault"
Five sources land in one canonical `recordings` corpus today: Fathom, Zoom, Fireflies, YouTube, file upload (with Whisper transcription), plus Fathom share-link paste. No incumbent ingests competitors' recordings — their corpus is only what their bot caught.
*Proof:* `connector-pipeline.ts`, per-source functions (see THE-MOAT.md §1).

### Pillar 2 — "Your AI, not ours"
Each paid org gets auto-provisioned MCP access — 41 tools across read/write/admin/AI — so Claude, ChatGPT, or Cursor query the corpus directly. BYO-AI to a *multi-source, team-wide, customer-owned* corpus is unclaimed white space; single-source per-user MCPs (Fireflies, Granola) don't cover it.
*Proof:* `mcp-tool-categories.ts`, `mcp_auto_provision.sql` (see THE-MOAT.md §2).

### Pillar 3 — "Your data, owned and out"
Hard org isolation (RLS + CI-guarded cross-org leak test) plus one-click export in 7+ formats including an LLM-ready bundle. Consent-clean, never trained on. The literal opposite of incumbent lock-in.
*Proof:* `rls-regression.test.ts`, `export-utils.ts` (see THE-MOAT.md §3–4).

---

## Ideal customer

Teams whose conversations are genuinely fragmented across tools and who want their own AI on top:
- **Agencies / consultancies** running client calls across mixed recorders
- **Coaching / training orgs** reviewing student calls (coaching portal is built)
- **Multi-business operators** needing hard isolation per org (the multi-tenant model is the spine)
- **AI-forward teams** that already use Claude/ChatGPT/Cursor and want them grounded in their real conversations

The wedge customer is anyone who has said "wait, which tool was that call recorded in?"

---

## Competitive frame

| | Incumbent notetakers (Fathom, Otter, Fireflies, Grain, tl;dv) | Suite AI (Zoom/Teams/Google) | **CallVault** |
|---|---|---|---|
| Sources | Only what their bot recorded | Only their own ecosystem | **Every recorder** |
| Corpus | Per-vendor silo | Single-ecosystem | **One owned, normalized corpus** |
| AI | Locked in their UI, metered | Locked to their model | **Your AI via MCP** |
| Data | Retention hostage | Inside the suite | **Owned, exportable** |
| Can they copy us? | No — would cannibalize capture + AI revenue | No — single-ecosystem by definition | — |

**The line that disqualifies every competitor:** *"Everyone else wants to be your recorder. We don't care where the call happened — we're the vault on top of all of them."*

---

## What we say / what we never say

**Say (all shipped, code-verified):**
- "Unify Fathom, Zoom, Fireflies, YouTube, and uploads into one vault."
- "Point your own Claude or ChatGPT at your entire org's conversations."
- "Your data, owned, exportable, never trained on."
- "Hard isolation per organization — verified by a continuous cross-org leak test."

**Never say (not backed by code — yet):**
- ❌ "We automatically dedupe the same meeting across Fathom and Zoom." — **ROADMAP.** Only same-source exact dedup ships today. (THE-MOAT.md §ROADMAP.)
- ❌ "36 MCP tools." — It's **41**. Kill the stale number.
- ❌ "Microsoft Teams integration" / "Teams as a source." — There is **no MS Teams ingestion**; the `teams/` function is unrelated dead CRUD code.
- ❌ "A dedicated MCP server per customer." — It's per-org **access on a shared endpoint**. Say "per-org MCP access."
- ❌ Anything positioning us as a *recorder* or *single-meeting notetaker*.

---

## The feature-decision test (gate every roadmap item)

**Does this deepen the corpus moat, or widen us into a fight we lose?**

✅ Deepen: more sources in, cross-conversation intelligence, cross-source dedup (closes the one false claim), faster onboarding/backfill, visible ownership+isolation.
❌ Widen: better recording, better single-meeting summaries, anything that fights Fathom where capture is free.

If a feature doesn't deepen the corpus, the AI access to it, the ownership of it, or the speed of filling it — it's probably a widen. Default to no.

---

## Top near-term positioning moves

1. **Rename everywhere.** Purge "call intelligence platform" from UI, site, and decks. Ship "the conversation vault."
2. **Lead with ownership + neutrality.** "Every recorder, your AI, your data, never trained on" is the headline and the Otter/consent defense at once.
3. **Wire cross-source dedup** so the most-unique claim becomes true, then claim it loudly.
4. **Make onboarding land the whole backlog fast** — speed of accumulation is the switching-cost moat.
