# 📌 The Call Intelligence Moat — Plain-English Plan

> **What this folder is:** the idea that could make CallVault answer questions across *hundreds* of a customer's calls — accurately, instantly, and cheaply — in a way no competitor does. This README explains it in plain terms: what to steal, why, and what to ignore. Nothing here is built yet. This is the keep-it-and-decide-later doc.
>
> **Status:** Researched + adversarially stress-tested (32-agent RedTeam, June 2026). Not started. See [the full verdict](#references--citations).

---

## The problem we're solving (in one breath)

Today, if you want AI to answer *"what did I commit to across my last 200 calls?"*, the AI has to read all 200 transcripts. That's:
- **Expensive** — ~200 calls = 1–2 million words shoved into the AI every single time you ask. Dollars per question.
- **Inaccurate** — AI gets lost in huge amounts of text and miscounts or invents things. It can't reliably *be a database*.
- **Limited** — it's why Read.ai brags about "30 calls at a time." That's a ceiling, not a feature.

## The fix (the whole idea)

> **Do the hard work once, when a call comes in. Save the answer. Then every question is an instant lookup — not an AI re-read.**

Two tools already nail this in two different ways. We steal the *ideas* from both. We do **not** adopt the tools themselves.

---

## What to steal — Part 1: "Printing Press" → **exact outcomes from your data**

**Where it comes from:** the [cli-printing-press](https://github.com/mvanhorn/cli-printing-press) project and its ready-made tools [pp-fathom and pp-fireflies](https://github.com/mvanhorn/printing-press-library). (Two of CallVault's five providers already have these — which is why this jumped out.)

**Plain version:** instead of asking AI to read every call, you *pre-calculate the facts* when each call lands — who promised what, what topics came up, who talked how long — and store them in a simple table. Then a question like *"every open promise this quarter"* is a one-line lookup that returns a tiny, exact answer.

**The things worth stealing:**
1. **"Outcome" commands** — pre-built answers like *commitments*, *meeting cadence with an account*, *topic trends over weeks*, *account history*. These are the actual gold. ([details](./STEAL-LIST-detailed.md#part-1--cli-printing-press-pp-fathom--pp-fireflies))
2. **"Calculate once, look up forever"** — the core habit. Cost stays flat whether it's 100 calls or 100,000.
3. **"Live by default, instant when cached"** — answer from fresh data when you want it, from the saved copy otherwise.
4. **Search every transcript for free** — find "pricing objection" across all calls without paying the provider per search.

**Why it matters:** this is the part competitors *can't easily copy* — they'd have to rebuild how they ingest data. It's exact (no AI guessing), and it gets *cheaper per answer* as a customer's call history grows, while everyone else gets more expensive.

---

## What to steal — Part 2: Honcho → **insights about people & relationships over time**

**Where it comes from:** [Honcho](https://honcho.dev) (the memory layer you already self-host — it's the source of the `Relevant conclusions:` notes you see at the start of these sessions). Repo on disk: `~/dev/honcho`.

**Plain version:** Honcho quietly watches conversations and builds an evolving *profile* of each person or account in the background. When you ask *"what's changed with this account?"*, it answers from that profile — it never re-reads every call. It's the same "do it once, look it up" trick, but for the *soft, semantic* questions a database can't answer (why a deal is stalling, what someone cares about).

**The things worth stealing:**
1. **Its people-first model** — Workspace (the company), Peer (a customer/rep/contact), Session (a call). This is *already multi-customer by design* — one shared service, not one copy per user. ([details](./STEAL-LIST-detailed.md#part-2--honcho))
2. **Background "figure it out as it happens"** — build the profile incrementally, so questions are cheap later.
3. **"Conclusions"** — durable, evolving facts about a person/account you can just look up.
4. **Ask-in-plain-English over the profile** — not over the raw transcripts.

**Why it matters:** this is the *other half* of the question space. Printing-press answers the **countable** questions (how many, which, trending up?). Honcho answers the **judgment** questions (what does this pattern mean?). Owning both, over all of a customer's calls, is something no call-intelligence product does today.

---

## What's actually needed to make this real (plain checklist)

You already own the hard part: **every customer's calls, from all 6 providers, already land in one place** (`recordings`). The only missing piece is the "saved answers" layer on top.

1. **One new facts table** — when a call arrives, save its commitments, topics, talk-time, sentiment into a tidy table. (Some providers hand us this already; a couple need a one-time AI extraction at ingest.)
2. **A handful of saved lookups** (*commitments*, *velocity*, *topic-trend*) exposed as commands your AI assistant can call. Returns small exact answers — no transcripts.
3. **Later: the Honcho-style profiles** as a premium tier, built on the same facts.

**Build order & why:** do step 1–2 first (faster proof, and it's exactly the input the profiles need), then the profiles. Prove people will pay for the exact answers before building the semantic layer.

## What to deliberately NOT do (avoid wasted effort)

- ❌ **No CLI** — you want the answers, not a command-line tool.
- ❌ **No Go, no second database** — it all lives in your existing Supabase/Postgres.
- ❌ **No "one Honcho copy per customer."** That was a misread (and a mistake the RedTeam made). It's *one* shared service, scoped per customer — same shape as your existing data security.
- ❌ **Don't claim "no AI."** The honest pitch is *"the AI already did the work — you just look up the answer."*

## ⚠️ The non-obvious stuff that makes or breaks this

A "facts table" sounds simple, but a few things separate *exact-and-right* from *exact-and-confidently-wrong* (which is worse than no answer). Full detail in [`STEAL-LIST-detailed.md` → Part 3](./STEAL-LIST-detailed.md#part-3--non-obvious-guards-robustness--new-ideas-the-stuff-that-makes-it-actually-work). The headlines:

- **L0 — reliable ingestion comes first.** Exact math over half-synced calls = a confident wrong number. The current Fathom connection bug + the 3 inconsistent connection flows aren't a side issue — they're the *foundation* this whole thing sits on. Fix + unify those first.
- **A failed sync must mean "incomplete," not "0."** If a provider rate-limits us mid-pull, we must flag the gap — never write zero and let a query report "0 commitments" when the truth is "we didn't finish."
- **Version the facts.** When we improve the extraction logic later, we must re-calculate old calls — or one report secretly mixes old and new logic.
- **A bigger menu of answers:** the highest-value ones are *absence* questions — "deals discussed with no follow-up," "accounts that went quiet," "meetings that should've been recorded but weren't." Pure database lookups, no AI.
- **The cost moves up-front.** Calculating facts for *every* call (not just viewed ones) is a real recurring bill at scale — needs a policy (e.g. only auto-calculate for paying/active accounts).

## The "why" in one sentence

> You already own every customer's full call history across all providers — the moat is adding a thin layer that answers both the **exact** questions (like a database) and the **judgment** questions (like a memory) *without ever re-reading the calls* — and letting customers ask it from their own AI tools.

---

## References & citations

**The deep-dive companion (in this folder):**
- [`STEAL-LIST-detailed.md`](./STEAL-LIST-detailed.md) — the full, ranked, technical steal list with SQL and mapping.

**Where the full analysis lives:**
- [Spike 005 — RedTeam verdict & provenance](../spikes/005-aggregate-intelligence-moat-redteam/README.md) — the 32-agent stress test, what it got wrong, and the corrected facts.
- [Spike manifest](../spikes/MANIFEST.md) — `## 005 Verdict (RedTeam)`.

**External sources:**
- cli-printing-press generator → https://github.com/mvanhorn/cli-printing-press
- pp-fathom / pp-fireflies (the proven examples) → https://github.com/mvanhorn/printing-press-library
- Honcho → https://honcho.dev · docs https://honcho.dev/docs · local repo `~/dev/honcho`

**Grounded in your own code (verified June 2026):**
- `supabase/functions/_shared/canonical-recording.ts` — where all 6 providers normalize into one shape.
- `supabase/migrations/20260131000007_create_recordings_tables.sql` — the `recordings` table (keyed by `owner_user_id` + `source_app`); note it has **no** structured commitments/topics/talk-ratio columns yet — that's the gap.
- `supabase/functions/mcp-server/tools/{read,ai,write}/` — where the new lookup commands would be exposed.
- `~/dev/honcho/src/` — Honcho's Workspace/Peer/Session model + `deriver`, `dreamer`, `conclusions`.

**Reality checks baked in:**
- All 6 providers (Fathom, Fireflies, Grain, Plaud, Read.ai, Zoom) **already ingest** calls — no provider-connection work remains. The gap is the facts layer, and it's the *same gap for all of them*.
- The "soft insights" can be wrong about real people in real deals → keep a human in the loop, premium tier.

---
*Created from spike 005 (June 2026): cli-printing-press teardown + 32-agent RedTeam + Honcho source inspection + CallVault code audit. Plain-English front door; see the detailed files above for specifics.*
