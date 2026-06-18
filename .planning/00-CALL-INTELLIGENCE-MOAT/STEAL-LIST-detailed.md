# Patterns to Steal — cli-printing-press + Honcho

**Purpose:** Exactly what's worth lifting from the two pp-cli tools and from Honcho, what to leave behind, and why. No build — a decision doc.

**The one principle both share (steal this above all):**
> Do the expensive work *as data arrives*, store a small **distilled artifact**, then query that artifact — **never put the raw corpus in a context window.**
> pp-cli does it for **exact outcomes** (SQL aggregates). Honcho does it for **semantic derivations** (representations). Together they cover the whole question space over your owned call data.

---

## Part 1 — cli-printing-press (pp-fathom / pp-fireflies)

### Best features (what's actually good in there)
The storage is unremarkable; the value is the **compound-insight commands** and the discipline around them. Everything below is a *concept* to reimplement in your Postgres — not the Go/SQLite/CLI machinery.

### Steal list (ranked)

1. **Compound-insight commands — the moat.**
   `commitments`, `velocity`, `topics --weeks 12`, `person/account timeline`, `coverage`/`stale` audits — cross-record aggregates the source vendor's own UI never exposes.
   - **Why:** this is the entire differentiator. Exact answers ("7 open commitments across 142 calls") that LLM-over-transcripts can't produce reliably or cheaply.
   - **How it maps:** Postgres views / RPC functions over a `call_facts` table, exposed as MCP tools. No CLI.

2. **Extract-once / aggregate-forever architecture.**
   Sync/derive structured facts once; run unlimited cheap aggregates afterward.
   - **Why:** kills the token-waste problem at the root — query cost is flat regardless of corpus size, and accuracy doesn't degrade as call volume grows (competitors' does).
   - **How it maps:** materialize structured fields at ingest into `call_facts`; aggregate in SQL forever.

3. **`--data-source auto/local/live` + write-through cache.**
   Live by default, transparently offline-capable, and *every read silently enriches the store*.
   - **Why:** the genuinely smart UX bit — freshness when you want it, instant cached answers otherwise, and the index grows from normal use.
   - **How it maps:** computed answers carry a freshness/provenance flag; reads can backfill facts.

4. **Full-text search over the corpus with zero API quota (their FTS5 layer).**
   - **Why:** "search every transcript for 'pricing objection'" without burning provider API calls.
   - **How it maps:** Postgres `tsvector`/FTS over `recordings.full_transcript`.

5. **Read-only MCP hints (`mcp:read-only` → `readOnlyHint`).**
   - **Why:** hosts (Claude Desktop, etc.) stop gating your read tools behind per-call permission prompts. Small, real DX win.
   - **How it maps:** tag your read RPC tools in `mcp-server/tools/read/`.

6. **The emission-gate discipline** (they only build a store when there are list-resources worth hoarding).
   - **Why:** don't materialize facts you won't aggregate. Keeps the layer lean.
   - **How it maps:** only promote fields you'll actually query (commitments, topics, talk-ratio) — not everything.

### Leave behind (explicitly do NOT steal)
- **The Go toolchain** — you're Node/TS/Deno (spike 004). No CGO-free SQLite binary buys you anything inside a SaaS.
- **The CLI itself** — you want the outcomes, not a CLI. MCP tools + REST are your surface.
- **Local SQLite** — you already own the data in multi-tenant Postgres; a second local store is redundant.
- **The generator** — one-shot value; you're building a deliberate layer, not regenerating CLIs.
- **The single-user-local model** — you're multi-tenant; scope by `owner_user_id` + RLS instead.

---

## Part 2 — Honcho

### Best features (what's actually good)
Honcho is the **semantic half** — the derivations SQL can't do. Its data model is already multi-tenant; don't replicate it as N hosted instances.

### Steal list (ranked)

1. **The Workspace / Peer / Session model.**
   `workspace` = tenant boundary, `peer` = any participant (customer/rep/account/contact), `session` = a conversation (a call), `message` = an atomic unit.
   - **Why:** it's multi-tenant *by construction* and maps perfectly onto call data — one deployment, entity-scoped, exactly like your RLS Postgres. This dissolves the "10k instances" fear: you scope by peer/session, not by hosting.
   - **How it maps:** workspace = CallVault, peer = customer contact/account, session = call.

2. **The background `deriver` (derive-as-data-arrives).**
   Honcho updates a per-peer representation in the background when new messages land — not per-query.
   - **Why:** this is the L2 mechanism that honors the core principle. The LLM work is amortized into ingest, so queries are cheap and never touch the raw corpus.
   - **How it maps:** a derive job triggered on new `call_facts`, updating a representation/conclusions store.

3. **The Conclusions API (deductive + inductive facts about a peer).**
   - **Why:** this is "outcomes" for the *semantic* layer — durable, queryable claims about a relationship that evolve over time. (It's literally the `Relevant conclusions:` block you see each session — you're already running the product you'd sell.)
   - **How it maps:** a `conclusions`/`representation` table queried cheaply via MCP.

4. **Dialectic / `peer.chat()` over the representation.**
   Natural-language Q&A against the *distilled representation*, not the transcript pile.
   - **Why:** answers "what's shifted with this account?" without stuffing 200 calls into context.
   - **How it maps:** an MCP tool that queries the representation, not `recordings`.

5. **Low-latency static `representation()` endpoint (precompute-for-read).**
   - **Why:** instant reads for the common case; recompute only when stale.
   - **How it maps:** cache the current representation per entity; refresh on new facts.

6. **Multi-peer perspective** ("what one peer knows about another") — optional.
   - **Why:** useful for groups/accounts/teams views later.

### Leave behind (explicitly do NOT steal)
- **"Self-hosted per individual / one instance per user"** — a misread of the model (and what the RedTeam got wrong). It's **one multi-tenant service**, workspace/peer-scoped. Use Honcho managed or a single self-host; or rebuild the deriver→conclusions loop natively in Postgres if you want zero dependency.
- **Unsupervised "dreams" sold raw to customers** — the soft derivations can be wrong about real people in real deals. Premium tier + human-in-the-loop, not auto-asserted.
- **"No LLM" framing** — Honcho *is* an LLM layer; it just amortizes the cost. Sell "the AI already did the work; you query the answer," not "no AI."

---

## The Why, in one paragraph

Both tools are the same architectural move applied to two data types. You already own the hard part — every customer's calls, across all providers, normalized into `recordings`. What you're missing is the **distilled-artifact layer** on top: a `call_facts` table for **exact** outcomes (steal from pp-cli) and a per-peer **representation/conclusions** store for **semantic** derivations (steal from Honcho). Both compute as data arrives and answer from a small artifact, so cost is flat and accuracy holds as call volume grows — the exact opposite of every RAG/LLM-over-transcripts competitor. Owning that substrate and serving *both* halves over it, queryable from the customer's own AI tools, is the defensible position. The tools are just the fastest blueprints for building it; the moat is the owned data + the two-layer integration.

---

## Part 3 — Non-obvious guards, robustness & new ideas (the stuff that makes it actually *work*)

> Surfaced on a second pass through the printing-press `references/` + the real pp-fathom/pp-fireflies code, plus our own discussion. Several of these are **correctness guards**, not features — without them the "exact answers" moat quietly produces exact-but-**wrong** answers, which is worse than no answer.

### A. Correctness & trust guards (skip these and the moat lies)
- **Partial sync = "incomplete", never "empty".** A 429/403/timeout mid-sync must mark the call set *incomplete*, not write zero rows. Otherwise `GROUP BY` returns an authoritative wrong number and nobody can tell "0 commitments" from "we got throttled." *(cli `cliutil/ratelimit.go`, `per-source-rate-limiting.md`)* — **the single most important guard for a SQL-truth product.**
- **Version every fact row.** Stamp each row with the extractor/schema version that produced it; when you improve the commitment/topic logic, re-derive only stale rows and never mix v1+v2 facts in one aggregate. "Extract once" silently rots without this. *(cli `store.go` schema-version gate + additive `ensureColumn`/`backfill`)*
- **Every provider gets a result or a reason.** Fan-out across the 6 providers must return per-provider results in deterministic order, isolate one provider's crash, and on timeout explicitly mark un-run providers — never silently drop one. That invariant is what makes "synced everything" trustworthy. *(cli `fanout.go`)*
- **Envelope-unwrap / single-object counting bugs.** Each provider wraps payloads differently; a counter that assumes an array reports "0" for single-object endpoints and ingest silently loses rows. Write tests against this exact checklist. *(`dogfood-testing.md`)*

### B. Sync robustness (directly relevant to the current Fathom non-200 / inconsistent-connection pain)
- **Adaptive per-provider rate limiter.** Self-tunes: ramp +25% after 10 successes, halve + record ceiling on 429, cap future ramps at 90% of ceiling — discovers each provider's undocumented limits at runtime instead of hardcoded guesses. *(cli `ratelimit.go`)*
- **Robust `Retry-After` parsing.** Handle delta-seconds, HTTP-date, AND Unix epoch sec/ms; cap at 60s so a hostile header can't pin you for hours. (Several APIs send epoch ms — a real bug source.)
- **Three resume modes, one cursor.** `latest-only` (cheap "new calls" poll), `since` (backfill), `full` (rebuild) — all over a per-tenant-per-provider cursor row. Most home-grown sync conflates these and either misses or re-pulls everything. *(cli `sync.go`)*
- **Structured partial-failure events + per-tenant `critical` providers.** One tenant's revoked Zoom token → a warning event, not a failed batch; only a provider flagged critical fails the run. Emit as DB rows the dashboard/MCP can read. *(cli `sync.go` `sync_warning`/`sync_summary`)*
- **Health probe must use the REAL fetch client.** A HEAD-based or unauth ping lies — it reports a provider "down" when sync works fine (and vice-versa). Tristate: reachable / blocked (up, refusing) / unreachable. *(cli `probe.go`)* — **build the live Fathom status check on the real sync path, not a separate ping.**

### C. New outcome-command ideas (upside — beyond commitments/topics/talk-ratio)
- **Negative-space / "gap" commands** — the highest-value sales-intel outputs, all pure SQL over the facts layer:
  - deals/contacts discussed on calls with **no follow-up logged** (`crm-gaps`)
  - accounts that **went quiet** — cadence stalled (early churn signal)
  - mandatory-record meetings that **weren't recorded** (`coverage`)
  - recordings **missing transcript/summary** (`stale`)
  These surface *absence*, which is what managers actually act on. *(cli `crm_gaps_ff.go` et al.)*

### D. MCP surface & security
- **A `which` / capability-resolver tool.** Instead of 15 flat MCP tools the calling LLM picks wrong, expose one resolver: natural-language query → the one right tool, each carrying a `why_it_matters` "use when…" string (which doubles as the tool description). Cuts wrong-tool selection. *(cli `which.go`)*
- **Enforced read-only DB role behind the `readOnlyHint`.** Give the aggregate/MCP path a Postgres role with SELECT-only on the facts tables — a prompt-injected tool call then *physically cannot* write, even if the hint is ignored. *(cli `store.go` `OpenReadOnly`)*
- **PII/secret redaction policy.** Vendor-anchored auto-redact for token shapes (`sk-…`, `Bearer cal_live_…`); warn-by-default (not auto-delete) on generic emails/names — a false-positive auto-redact destroys data irreversibly; a false-positive warning costs a prompt. You store raw multi-tenant transcripts; this is your write-to-`recordings`/logs policy. *(`secret-protection.md`)*
- **Map columns from SDK field-name evidence, not guesses.** When a provider's wire key is cryptic, harvest its official SDK arg/field names to author the canonical mapping, and record that provenance so the next API change is debuggable. *(`crowd-sniff.md`)*

### E. Strategic / cost (from our discussion, not the repo)
- **Cost flips from query-time to ingest-time — and total cost can go UP.** Today extraction is lazy (only when a call is viewed) and truncated to 15k chars. Extract-at-ingest (full transcript) means paying LLM extraction for *every* call, including ones never queried. At 10k users × hundreds of calls that's a real recurring bill. Pick a policy: extract-on-ingest for active/paid accounts, lazy-but-cached for the rest, or a tier gate. **This one number decides L1's margins.**
- **Ingestion reliability is L0 — the moat sits on it.** Exact aggregates over incompletely-synced calls = confidently wrong. The current Fathom non-200 / inconsistent-connection-across-3-areas issue isn't separate from this plan; it's the foundation. Unify the connection process and make sync *provably complete* before selling "exact answers." (ties to guard A.1)
- **Freshness lag is real — set it as a UX expectation.** Background derivation (facts + Honcho representations) is async; there's a delay between a call landing and its insights being queryable. Expose a "facts updated as of …" timestamp.
- **The compounding asymmetry IS the pitch.** Cost-per-answer *drops* as a customer's history grows (more rows, same cheap query) while every RAG/LLM-over-transcripts competitor gets more expensive. Say that out loud in positioning.

---

*Source: spike 005 (32-agent RedTeam, repo-grounded) + pp-fathom/pp-fireflies teardown + `honcho/src` inspection (workspace/peer/session, deriver, dreamer, conclusions) + CallVault code audit (`recordings` keyed by `owner_user_id`/`source_app`; intelligence currently lazy-cached, not normalized). See [`README.md`](./README.md) in this folder for the plain-English summary, and [`../spikes/005-aggregate-intelligence-moat-redteam/README.md`](../spikes/005-aggregate-intelligence-moat-redteam/README.md) for the full RedTeam verdict.*
