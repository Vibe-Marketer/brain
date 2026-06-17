---
spike: 005
name: aggregate-intelligence-moat-redteam
type: standard
validates: "Given the cli-printing-press 'local-store + compound-insight' pattern, when projected onto CallVault as a 3-layer aggregate-call-intelligence moat (SQL outcomes + Honcho memory + coding-hooks) and adversarially stress-tested, then the feasibility, the defensible kernel, and the minimum-lovable build are clear."
verdict: PARTIAL
related: [001, 002a, 003, 004]
tags: [strategy, moat, sql-aggregation, honcho, mcp, redteam, providers, multi-tenant]
---

# Spike 005: Aggregate-Call-Intelligence Moat — RedTeam Feasibility Verdict

## What This Validates

Given the `cli-printing-press` "local-store-of-API-data + offline compound-insight commands" pattern (proven by pp-fathom / pp-fireflies), when projected onto CallVault as a 3-layer "aggregate call intelligence" moat and adversarially stress-tested with a 32-agent RedTeam grounded in the actual repo, then we get a decision-grade verdict on feasibility, the defensible kernel, and what to build first.

This spike **pivoted away from building code**. The originally-decomposed build spikes (run the Go generator on CallVault; reimplement the pattern in TS; external-hoard fit) were superseded once the real question surfaced: *should CallVault commit months to this moat, and is it even the right architecture?* That is a strategy question, answered by RedTeam, not a feasibility prototype.

## Research (grounding)

- **cli-printing-press** = generator emitting **Go** CLIs with a generic `resources(id, data JSON)` + FTS5 + `sync_state` cursor SQLite store and "compound-insight" commands (`commitments`, `velocity`, `person timeline`). The storage is unremarkable; **the moat is the compute-in-SQL insight commands.** Value depends on the data being **external** (behind someone else's rate-limited API). For data you already own in Postgres, the local hoard is redundant. (Source: `mvanhorn/printing-press-library` pp-fathom/pp-fireflies teardown.)
- **CallVault sources from 5 providers:** Fathom, Fireflies, Grain, Plaud, Read.ai (edge functions: `*-oauth-*`, `*-sync-*`, `*-webhook`). pp-fathom and pp-fireflies already exist in the public library — 2 of 5 providers already have community printing-press CLIs.
- **Prior art:** spikes 001–004 (CallVault API→dev-surface→CLI; runtime locked to Node/npm). The printing-press generator emits Go — in tension with that lock.

## The Thesis That Was Red-Teamed

3-layer moat, projected to 1,000s–10,000s of users:
- **L1 — SQL compound-insight layer:** Postgres views/RPC in existing Supabase compute exact aggregate outcomes (commitments, velocity, topic trends, talk-ratio, cross-provider rollups) over 100s–1000s of calls across all providers, exposed as precise MCP tools + REST endpoints. Explicitly NOT RAG/CAG/LLM-over-transcripts.
- **L2 — Honcho memory add-on (premium):** self-hosted-per-individual derivations/insights-over-time.
- **L3 — Client coding-tool peer hooks:** Claude Code/Cursor start/stop hooks as an additional personalization source.
- **Moat claim:** no competitor combines exact SQL outcomes + MCP Honcho insights + coding-tool integration, over ALL calls across ALL providers.

## Results — Verdict

**REAL-BUT-FRAGILE, and L1-only.** The moat is genuine but it is *not* the three-layer thing.

### Convergence across 32 agents (engineers, architects, pentesters, interns, repo-grounded)

**Strongest claim (28/32):** "return small computed answers, not raw transcripts" — true by construction, already half-built (`canonical-recording.ts` normalizes providers into one `recordings` table; MCP layer already returns small computed payloads; 271 migrations). Accuracy+cost asymmetry vs RAG widens with scale.

**Critical weaknesses (by independent agent convergence):**
1. **L2 Honcho-at-scale is architecturally incoherent (~17 agents).** "Self-hosted per-individual" inside multi-tenant SaaS = 10k instances (fleet ops a solo operator can't carry) OR shared namespacing (then it's "a Postgres table with a marketing wrapper" — moat gone). Zero Honcho code in repo. Phase-21 research already rejected the Honcho SDK under the zero-new-packages invariant.
2. **Structured columns to aggregate over don't exist yet (~6 agents).** Extraction is lazy (fires on first MCP call), truncated to 15k chars; topics live on `transcript_chunks.topics TEXT[]`, not on `recordings`. No `commitment_count`, no `extracted_commitments JSONB`, no `talk_ratio`, no rollup views. L1 is downstream of an unbuilt ingest-time extraction pass.
3. **Cross-provider normalization is an ongoing ETL contract, not a solved foundation (~8 agents).** `fathom_calls` (BIGINT PKs, `source_platform` CHECK) coexists with newer `recordings` mid-migration; provider intelligence sits in heterogeneous JSONB keys. Every provider API change breaks normalization — permanent ops tax.
4. **"All 5 providers" is ~2–3 clean today (~5 agents).** Fathom fully working; Fireflies capped (50 req/day free/Pro), Grain partial, Plaud hardcodes empty participants, others gated. Today the moat is effectively "over your Fathom calls."
5. **L3 coding-hooks = wrong audience (~3 agents).** RevOps/CS buyers ≠ Claude Code/Cursor users. Founder pet feature; dilutes focus.
6. **Scope sprawl (~4 agents).** L1×L2×L3×5 providers for a solo operator across 7 businesses = "sprawl wearing a moat costume."

### Defensible kernel
**"Extract once at ingest → aggregate forever in SQL → over data you own and have normalized across providers."** Incumbents (Gong/Chorus/Read.ai) are committed to RAG-over-transcripts; matching exact enumeration/counting/trending at corpus scale means rebuilding their ingest. That asymmetry is the moat — earned by *finishing extraction + normalization*, not by adding layers.

### SQL/LLM boundary — does "no LLM" survive?
Partially. Rebrand "no LLM" → **"extract once, aggregate forever."**
- **LLM at INGEST (once/call):** extract atoms (commitments, action items, topics, speakers, sentiment) — irreducibly semantic (Vercel AI SDK + OpenRouter).
- **SQL at QUERY (unlimited):** count/enumerate/rank/trend/rollup — exact, ~free. "No RAG/no LLM" is TRUE for this high-frequency RevOps query class.
- **LLM at QUERY (rare):** open-ended "why is this deal stalling" — fed the small SQL result + targeted snippets, never the haystack.

### Minimum-Lovable Version
**BUILD FIRST (weeks; no new infra, no Go, no Honcho, no second datastore):**
1. Ingest-time extraction pass → materialize structured columns (`commitments`, `action_items`, `topics`, `talk_ratio`) on `recordings`, **Fathom only**.
2. 3–5 SQL aggregate RPCs (`commitments`, `velocity`, `topic-trend`) as precise MCP tools + REST endpoints.
3. Put in front of ~5 power users; validate willingness to pay for exact cross-call outcomes.

**DEFER:** cross-provider expansion (one connector at a time); unified cross-provider insight schema.
**REDESIGN:** L2 memory → shared multi-tenant memory table with per-org namespacing on existing Postgres, only after L1 revenue. Kill "self-hosted per-individual."
**KILL/PARK:** L3 coding-hooks.

## Investigation Trail
- Located printing-press as `github.com/mvanhorn/cli-printing-press`; "MySQL" the user described is actually local **SQLite**.
- Recon agent teardown of pp-fathom/pp-fireflies confirmed: generic JSON store + FTS5; moat = compute-in-SQL insight commands; value requires external data.
- Discovered CallVault's 5 source providers from edge functions; 2 already have community printing-press CLIs.
- User reframed twice: (a) "use it for every provider to own the full dataset," then (b) the real pain — "MCP over 100s of calls is token-wasteful/inaccurate" + the full 3-layer moat vision (SQL + Honcho + coding-hooks).
- Ran 32-agent RedTeam ParallelAnalysis (repo-grounded, Sonnet attackers, ~1.6M subagent tokens) → verdict above.
