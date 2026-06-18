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

*Source: spike 005 (32-agent RedTeam, repo-grounded) + pp-fathom/pp-fireflies teardown + `honcho/src` inspection (workspace/peer/session, deriver, dreamer, conclusions) + CallVault code audit (`recordings` keyed by `owner_user_id`/`source_app`; intelligence currently lazy-cached, not normalized). See [`README.md`](./README.md) in this folder for the plain-English summary, and [`../spikes/005-aggregate-intelligence-moat-redteam/README.md`](../spikes/005-aggregate-intelligence-moat-redteam/README.md) for the full RedTeam verdict.*
