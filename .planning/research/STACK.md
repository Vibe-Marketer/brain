# Stack Research — v2.0 Autonomous Operations (Self-Healing CallVault)

**Domain:** Solo-operator, Mac-hosted autonomous-fix daemon + Supabase backend (subscription-billed headless `claude`)
**Researched:** 2026-06-12
**Confidence:** HIGH on versions (verified against npm registry + Sentry API docs 2026-06-12); HIGH on integration points (verified against live `~/dev/autopilot` source + `~/dev/brain` Edge Functions)

---

## TL;DR — The whole milestone needs almost no new stack

The v1.0 foundation already ships the hard parts: the daemon pack (Bun + TS), `@supabase/supabase-js@2`, ephemeral worktrees, the deterministic push-gate, the watchdog, the QA crawler (`scripts/qa/qa-crawler.ts` on Playwright `1.57`), the `qa-poller.ts` daemon, codex review, evidence bundles + `autopilot.jsonl`, the Sentry **ingestion** webhook (`sentry-webhook` + `ingest_sentry_ticket` RPC), Resend transactional email (raw `fetch`, no SDK), and the `runner_state` / `tickets` / `ticket_events` schema.

**The five v2.0 workstreams resolve almost entirely to: (a) config-knob changes, (b) new DB columns, (c) prompt/brief composition, and (d) exactly ONE new outbound HTTP call (Sentry resolution write-back).** There is no new infrastructure to stand up, no queue engine, no orchestrator, no new runtime. The genuinely "new" external surface is a single Sentry auth token.

This is the correct posture for a solo-operator Mac daemon. Resist every temptation to add a framework.

---

## Recommended Stack

### Core Technologies (ALL ALREADY PRESENT — keep current versions)

| Technology | Version (installed) | Purpose | Why it stays |
|------------|--------------------|---------|--------------|
| Bun + TypeScript | bun runtime, `typescript@^5.9` | Daemon pack runtime (`~/dev/autopilot`) | Already the daemon's runtime; single-pass launchd model proven. No change. |
| `@supabase/supabase-js` | `^2.84` (latest `2.108.1`) | DB-backed queue, runner_state, ticket_events, RLS-scoped writes | Already the daemon's only real dep. Bump to `^2.108` opportunistically; no API break in the 2.x line that affects current usage. |
| Headless `claude -p` (Claude Code CLI) | subscription-billed, keychain auth | The fix engine + the gsd-debug + Honcho consumer | Proven 5/5 fixtures. The `agent.ts` argv-allowlist spawner is the integration point — gsd-debug and Honcho ride **inside** this process, not as daemon deps. |
| `codex exec` | installed CLI | Post-fix REVIEW (APPROVE/REJECT) | Already wired in `runner.ts`. Unchanged for v2.0. |
| Playwright | `@playwright/test@^1.57` (latest `1.60.0`) | Nightly QA crawl (`qa-crawler.ts`) + `gsd-browser`/Interceptor verification | Already the QA + verification engine. Bump to `1.60` opportunistically. No new browser tooling. |
| `@axe-core/playwright` | `^4.11.1` (latest `4.11.3`) | Accessibility findings in QA crawl | Already a dep. No change. |
| Resend (via raw `fetch`) | API `https://api.resend.com/emails` | Reporter ticket-response comms (RSP) | `send-support-ticket` already calls Resend by raw `fetch` with a Bearer key. Reuse the exact pattern; **do not add the `resend` npm SDK.** |
| launchd | macOS native | Scheduling: dispatcher (`StartInterval`), qa-poller, watchdog, AND nightly QA | Already runs three daemon jobs. Nightly QA is a 4th launchd job, not a new scheduler. |

### Supporting Libraries / Capabilities (NEW for v2.0 — minimal)

| Capability | Version / form | Purpose | Integration point |
|------------|---------------|---------|-------------------|
| **Sentry Web API (resolution write-back)** | REST `/api/0/`, no SDK | Mark Sentry issue `resolved` on merge/deploy (SEN-05) | New Supabase Edge Function `sentry-resolve` (or extend the merge bridge) doing a single `PUT`. Mirror the `fetch`-based pattern already in `sentry-webhook`/`send-support-ticket`. **One new secret: `SENTRY_AUTH_TOKEN`.** |
| **gsd-debug** | installed skill (`~/.claude/skills/gsd-debug`) | Systematic reproduce → root-cause → fix discipline inside the bug lane (SEN-03) | Composed into the agent **brief** (`lib/brief.ts`) — the headless `claude` invokes the skill. **Zero daemon dependency.** Already on this machine. |
| **Honcho** | MCP plugin `@honcho-ai` v0.2.4 (already connected) | Cross-run memory: prior fixes for a fingerprint, recurrence context (SEN-03/04) | The headless `claude` reaches Honcho via MCP during the run. The daemon passes the **fingerprint + ticket context** in the brief; the agent reads/writes Honcho. **Zero daemon dependency.** |
| `p-limit` | `7.3.0` | OPTIONAL — only if intra-run parallelism is ever wanted | **Do NOT adopt yet.** Concurrency is currently 1 by design (the claim UPDATE is the atomicity boundary). Throughput is raised by **budget knobs + poll frequency**, not parallel runs. Listed only to be explicit it's been considered and rejected for now. |

### Development / Operational Tools (already present)

| Tool | Purpose | Notes |
|------|---------|-------|
| `gh` CLI | PR open/merge for diverted (out-of-policy) fixes | Already used. `auto-merge.yml` guard blocks agent PRs from auto-merge. Unchanged. |
| `tsx` | Runs `qa-crawler.ts` (`npm run qa:crawl`) | Already a dep in brain. Nightly QA reuses it. |
| `dotenv` | `^17.3` daemon env loading | Already a daemon dep. |

---

## How each v2.0 question resolves to stack

### 1. Raise throughput to ~25–30 fixes/day with budget/rate/cost guards (ACT-01/02/04)

**No new library.** This is `autopilot.config.ts` knob work plus DB columns:

- `maxRunsPerWindow.maxRuns` is currently `12` over `windowHours: 24`. Raise to `~28`. The rolling-window counter that enforces it already exists (the claimer reads it).
- `pollIntervalSec` is `300` (5 min). 30 runs/day across an 18h non-quiet window with a 2400s watchdog ceiling is comfortably served by the existing single-pass-per-fire model; the **urgent-lane re-loop** in `claimer.ts` already drains backlog faster than the poll interval when work is queued. Consider dropping the interval to `120–180s` so the queue doesn't starve at higher volume.
- **Cost/rate guards:** the `JsonlRunLine` schema in `evidence.ts` tracks `claude_exit`, `verdict`, `test_exit`, `rate_limit_suspected` (via `detectRateLimit()`) but has **NO duration or cost fields**. Add `duration_sec` (already computable from `ts_start`/`ts_end`) and a coarse `est_cost`/`run_no_in_window` to the JSONL line and to a `runner_state`/`ticket_events` surface. Subscription billing means there is no per-token dollar meter — the meaningful guard is **runs-per-window + rate-limit detection + quiet hours**, all of which exist. The cost column is for *observability*, not for a hard dollar gate.
- **Rate-limit backpressure:** `detectRateLimit()` already exists. Wire it so a rate-limit-suspected run **defers** the window (back off) rather than burning retries — small logic change in `claimer.ts`/`runner.ts`, no new dep.

**Verdict:** Pure config + 2–3 new JSONL/DB columns. No package.

### 2. Sentry autonomous debug→fix + resolution write-back (SEN-03/04/05)

Two distinct pieces:

- **Debug→fix (SEN-03/04):** gsd-debug + Honcho are **agent-side**, reached by the headless `claude` during the run. The daemon's only job is to compose a brief that (a) names the Sentry fingerprint, (b) instructs the gsd-debug discipline, (c) hands the Honcho session/peer context. This is `lib/brief.ts` prompt-composition work — **zero new daemon dependency.** The Sentry **ingestion** side (webhook → `ingest_sentry_ticket` RPC → fingerprint dedup) already ships from v1.0 (SEN-01/02); SEN-04 hardens the existing dedup, not a new system.
- **Resolution write-back (SEN-05):** the ONE new external call. On merge/deploy of a Sentry-sourced ticket, `PUT` the issue to `resolved`.

**Sentry API — verified current (2026-06-12):**

```
PUT https://sentry.io/api/0/organizations/{org_slug}/issues/{issue_id}/
Authorization: Bearer <SENTRY_AUTH_TOKEN>
Content-Type: application/json

{ "status": "resolved", "statusDetails": { "inCommit": "<merge_sha>" } }
```

- **Auth:** Bearer **Organization Auth Token** (or internal-integration token). Required scope: **`event:write`** (or `event:admin`).
- **Where it runs:** a new tiny Edge Function `sentry-resolve` invoked by the in-app approve→merge bridge after a Sentry-sourced ticket merges — OR appended to the existing merge-bridge function. Keep the token server-side (Edge Function env), never in the daemon or frontend. This matches the existing trust boundary where `sentry-webhook` already lives.
- **No SDK.** Raw `fetch`, same as `sentry-webhook` and `send-support-ticket`. `@sentry/node` (`10.57.0`) and `@sentry/cli` (`3.5.0`) are **not needed** — they solve error *capture* and *release management*, not issue-status mutation, and would add weight for a single `PUT`.
- **Link requirement:** the `tickets` row must persist the Sentry `issue_id` + `org_slug` at ingestion so the write-back has them. Check the `ingest_sentry_ticket` RPC stores `issue_id` in ticket `context`; if only the fingerprint is stored, add `issue_id` (one column / context key).

**Verdict:** One Edge Function, one `fetch`, one new secret. gsd-debug/Honcho are free (already on machine).

### 3. Nightly automated QA → tickets → resolution (QA-01/02/03)

**The framework already exists.** `scripts/qa/qa-crawler.ts` is Playwright-based, logs in with the test account, crawls every `crawl:true` route from `routes.manifest.ts`, captures console/network/interaction findings, fingerprints them, and writes `qa-report.json`. `qa-poller.ts` already claims `qa_runs` rows and runs `npm run qa:crawl`.

What's missing for v2.0 is **scheduling + auto-ticketing**:

- **Scheduling — use launchd, NOT GitHub Actions, NOT cron.**
  - **launchd** (`StartCalendarInterval`) is the right choice: the QA crawl needs the *authenticated app against the dev/prod target from this Mac*, the same machine that already runs the dispatcher, qa-poller, and watchdog. It survives sleep/wake (runs at next wake), keeps all QA on one host, and reuses the existing daemon-ops muscle. Add a 4th launchd plist (or have qa-poller self-schedule a nightly `requested` row).
  - **GitHub Actions scheduled workflow** is the wrong fit: it would run against prod only, from GitHub's runners, needs prod creds in CI secrets, can't reach a local dev target, and splits QA ops away from the daemon host. The repo's `uptime.yml` already covers the "is prod up from the outside" angle; nightly QA is a deeper authenticated crawl that belongs on the daemon box.
  - **cron** is strictly worse than launchd on macOS (no wake handling, no `KeepAlive`, weaker logging). launchd is the macOS-native answer the rest of the pack already uses.
- **Auto-ticketing (QA-02):** the crawler is **report-only by design** (writes JSON, never tickets). Add a thin step — after a nightly crawl, for each finding above a severity threshold, INSERT a ticket with `source = 'nightly-qa'` and the repro evidence (screenshot + console buffer + route + steps) into ticket `context`, deduped by the crawler's existing fingerprint. This is the *same* DB-insert pattern as `ingest_sentry_ticket`; reuse it (a `ingest_qa_ticket` RPC or a small daemon-side insert). **No new dep — Playwright already captures the screenshot/console.**
- **Resolution (QA-03):** QA-sourced tickets flow through the *existing* dispatcher loop unchanged once they carry `source = 'nightly-qa'`. The only requirement is source attribution (Workstream 5), below.

**Verdict:** One launchd plist + one ticket-insert path reusing the existing crawler's output. No new framework.

### 4. Reporter ticket-response comms (RSP-01/02/03)

**Resend is already wired by raw `fetch`.** `send-support-ticket` posts to `https://api.resend.com/emails` with a Bearer key and a `reply_to`. Closing the loop to reporters is:

- A new (or extended) Edge Function `notify-reporter` that, on ticket status transition (received / in-progress / resolved / escalated), sends a Resend email to the reporter's email **when the ticket has one** (in-app-user and support-form tickets do; Sentry/nightly-QA tickets do not — gate on presence).
- The **trigger** is the existing `ticket_events` audit trail. Two clean options, both no-new-dep:
  1. A Postgres trigger / `pg_cron` sweep on status change that calls the Edge Function (server-side, decoupled from the daemon).
  2. The daemon writes the resolution summary to `ticket_messages` (it already writes `author_type='agent'` messages) and a DB trigger fans that out to email.
- **Resolution summary (RSP-02):** the agent already produces a 7-section evidence bundle into the ticket thread. RSP-02 is *formatting a reporter-friendly subset* of that into the email body — prompt/template work, not a library.
- **In-app notifications:** the `user_notifications` table already exists (used by the watchdog pager). Reuse it for in-app status; Resend covers email.

**Verdict:** Reuse the existing Resend `fetch` pattern + existing `ticket_events`/`ticket_messages`/`user_notifications`. **Do NOT add the `resend` SDK, Twilio, SendGrid, or any new comms vendor.**

### 5. Per-run observability in AdminTab (ACT-04)

The data already streams to `autopilot.jsonl` and partially to `runner_state`/`ticket_events`. Surfacing it is a **read path**, not new infra:

- Extend `JsonlRunLine` (and the `ticket_events`/a `runner_runs` view) with the missing fields: `duration_sec`, `est_cost` (coarse), gate verdict (`gate_pass`/`gate_block_reason`), `codex_review` (already present), `diff_stat` (already present), `test_exit` (already present). Persist the per-run row to the DB (not just the local JSONL) so AdminTab can query it under RLS.
- AdminTab renders it with the **already-locked frontend stack** — React 18 + TanStack Query + Zustand + the Service+Hook pattern. A new `useAutopilotRuns()` hook over a `runner_runs` service. No charting library needed for v1 (status/diff/tests/gate/duration/cost is a table); if a sparkline is wanted later, the repo already has `motion/react` and can use a tiny inline SVG before reaching for a chart lib.

**Verdict:** New DB columns + one read service/hook + AdminTab table. No new dep.

---

## Installation

```bash
# Daemon (~/dev/autopilot) — opportunistic bump only, NOTHING new required:
bun add @supabase/supabase-js@^2.108

# Brain repo — opportunistic bumps only, NOTHING new required:
npm install @playwright/test@^1.60 playwright@^1.60

# NEW external surface — NOT a package. One secret, set server-side:
#   SENTRY_AUTH_TOKEN  (org auth token, scope: event:write)
#   stored in the Supabase Edge Function env, never in the daemon or frontend.
```

That is the entire net-new dependency footprint for the milestone: **zero new npm packages, one new secret.**

---

## Alternatives Considered

| Recommended | Alternative | When the alternative would win |
|-------------|-------------|--------------------------------|
| launchd `StartCalendarInterval` for nightly QA | GitHub Actions scheduled workflow | Only if QA had to run with no always-on host. This Mac IS the always-on host and already runs three launchd daemons; GH Actions can't reach a local dev target and splits ops. |
| Raw `fetch` to Sentry/Resend | `@sentry/node` SDK / `resend` npm SDK | Only if you needed Sentry *capture* in the daemon (you don't — frontend `@sentry/react` does capture) or rich Resend features (batching, attachments-by-SDK). For a single `PUT` and a templated email, `fetch` is lighter and matches the existing pattern. |
| Budget-knob throughput (config + window cap) | `p-limit` parallel runs / a job-queue engine (BullMQ, pg-boss) | Only if a single run couldn't keep up at 28/day. With a 2400s watchdog and an 18h window, serial runs clear ~25–30 comfortably. Parallelism reintroduces the repo-collision risk the concurrency-1 design exists to prevent. |
| gsd-debug + Honcho via the headless agent (in-brief) | A dedicated debugging library / vector-memory store in the daemon | Never, for this architecture. The agent already has both skills/MCP on this machine; pulling them into the daemon would duplicate capability and break the "borrow before build" principle. |
| `ticket_events` trigger → Edge Function for reporter comms | A new notification microservice / message broker | Only at multi-tenant scale. For one product on one Mac, a Postgres trigger + Resend `fetch` is the whole requirement. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Any job-queue engine** (BullMQ, pg-boss, Temporal, Inngest, Redis) | The DB-backed `tickets`/`runner_state` queue with atomic-claim UPDATE is already the queue. Adding an engine adds infra, a broker, and a second source of truth for zero benefit at this scale. | Existing Supabase claim-UPDATE + launchd single-pass model. |
| **`@sentry/node` / `@sentry/cli` in the daemon** | They solve capture + release management, not issue-status mutation. SEN-05 is one `PUT`. | Raw `fetch` to the Sentry REST API with an org auth token. |
| **`resend` npm SDK** | `send-support-ticket` already calls Resend by `fetch`. Adding the SDK forks the pattern and adds a dep for no capability gain. | Reuse the existing `fetch`-to-`api.resend.com/emails` pattern. |
| **A new browser/test framework** (Cypress, Puppeteer, WebdriverIO) | Playwright `1.57` is already the QA crawler AND the verification (gsd-browser/Interceptor) engine. | Existing Playwright + `@axe-core/playwright`. |
| **GitHub Actions for nightly QA** | Can't reach a local/authenticated dev target, needs prod creds in CI, splits QA off the daemon host. `uptime.yml` already covers external prod liveness. | launchd plist on the daemon Mac. |
| **`p-limit` / raised `concurrency`** (for now) | Concurrency 1 is a deliberate safety boundary (the claim UPDATE is the atomicity guarantee; parallel runs risk worktree/repo collisions). Throughput comes from the window cap, not parallelism. | Raise `maxRunsPerWindow.maxRuns` + tighten `pollIntervalSec`. |
| **A charting/dashboard library** (Recharts, Chart.js, D3) for ACT-04 | Per-run observability v1 is a table of status/diff/tests/gate/duration/cost. A chart lib is bundle weight for a list. | TanStack Query + a table; inline SVG/`motion/react` if a trend line is wanted later. |
| **A cost-metering SDK / token-accounting lib** | Runs are subscription-billed — there is no per-token dollar meter to read. The real guard is runs-per-window + rate-limit detection (both already present). | `detectRateLimit()` + `maxRunsPerWindow` + a coarse `est_cost` field for display only. |
| **Telegram bridge / new comms transport** | Explicitly deferred to a later milestone in the v1 re-scope; v2.0 comms are in-app (`user_notifications`) + Resend email. | Existing in-app notifications + Resend. |

---

## Stack Patterns by Variant

**If throughput at 28/day starves the queue (runs can't keep up):**
- First lever: drop `pollIntervalSec` to `120s` and lean on the urgent-lane re-loop in `claimer.ts` (it already drains backlog within one invocation).
- Only if that's insufficient: revisit concurrency — but that requires per-run worktree isolation proofs and a collision policy. Do NOT raise `concurrency` casually; it's a safety boundary, not a perf knob.

**If Sentry-sourced tickets lack the `issue_id` needed for write-back:**
- Add `issue_id` + `org_slug` to the `ingest_sentry_ticket` RPC's stored `context` at ingestion time. The write-back is impossible without them; verify this BEFORE building SEN-05.

**If reporter comms need richer formatting (HTML email, branded template):**
- Stay on Resend `fetch`; Resend accepts an `html` body field. Build the template as a string in the Edge Function (the existing `send-support-ticket` already builds HTML inline). Do not pull in a templating engine for v1.

**If nightly QA findings flood tickets (noisy crawler):**
- The crawler already fingerprints findings; dedupe on fingerprint (same as Sentry) and gate ticket creation on a severity threshold (`high`/`critical` only) before widening. The dedup machinery exists in `ingest_sentry_ticket` — mirror it.

---

## Version Compatibility

| Package / surface | Compatible with | Notes |
|-------------------|-----------------|-------|
| `@supabase/supabase-js@^2.108` | Existing daemon + Edge Functions | No breaking change from `2.84` for the claim/update/select paths the daemon uses. Safe opportunistic bump. |
| Playwright `1.60` | `@axe-core/playwright@4.11.3`, existing `qa-crawler.ts` | Axe-core 4.11.x tracks Playwright 1.5x; no API break. Bump both together or neither. |
| Sentry REST `/api/0/` + org auth token | `event:write` scope | Org auth tokens are the current recommended form (personal tokens still work). Endpoint is stable and version-current as of 2026-06-12. |
| Resend `fetch` API | Existing `RESEND_API_KEY`, `RESEND_DOMAIN_VERIFIED` gate | `send-support-ticket` already proves the path; reporter comms reuse the same key + verified-domain gate. |
| launchd nightly plist | macOS, existing daemon jobs | Coexists with the dispatcher/qa-poller/watchdog jobs; no port, no conflict. |

---

## Sources

- **Live source (HIGH):** `~/dev/autopilot/{autopilot.config.ts, src/claimer.ts, src/runner.ts, src/qa-poller.ts, src/lib/agent.ts, src/lib/evidence.ts}` — confirmed daemon deps (`@supabase/supabase-js@^2.84`, `dotenv@^17.3`), `JsonlRunLine` schema (no cost/duration fields), `detectRateLimit()`, concurrency-1 + `maxRunsPerWindow{24h,12}` knobs, argv-allowlist agent spawner.
- **Live source (HIGH):** `~/dev/brain/{scripts/qa/qa-crawler.ts, supabase/functions/sentry-webhook/index.ts, supabase/functions/send-support-ticket/index.ts, package.json, supabase/migrations/*}` — Playwright `1.57` report-only crawler, Sentry HMAC ingestion + `ingest_sentry_ticket` RPC, Resend raw-`fetch` pattern, `qa_runs`/`runner_state`/`ticket_events`/`user_notifications` schema.
- **npm registry (HIGH, 2026-06-12):** `@sentry/node@10.57.0`, `@sentry/cli@3.5.0`, `playwright@1.60.0`, `@axe-core/playwright@4.11.3`, `resend@6.12.4`, `@supabase/supabase-js@2.108.1`, `p-limit@7.3.0` — current versions verified.
- **Sentry API docs (HIGH, 2026-06-12):** [Update an Issue](https://docs.sentry.io/api/events/update-an-issue/) — `PUT /api/0/organizations/{org_slug}/issues/{issue_id}/`, `{"status":"resolved"}`, Bearer auth, scope `event:write`/`event:admin`. [Auth Tokens](https://docs.sentry.io/account/auth-tokens/), [Permissions & Scopes](https://docs.sentry.io/api/permissions/).
- **Machine config (HIGH):** `~/.claude/skills/gsd-debug/` (installed skill), `~/.claude/plugins/cache/honcho/honcho/0.2.4/` + `~/.claude/settings.json` (`honcho@honcho` MCP connected) — both are agent-side, reached by the headless `claude`, not daemon deps.
- **Prior milestone baseline (HIGH):** `.planning/research/SUMMARY-v1.0.md`, `.planning/PROJECT.md`, `~/.claude/PAI/MEMORY/WORK/20260610-autonomous-admin-center/ISA.md` (ISC safety boundaries, concurrency-1 rationale, subscription-billed execution constraint, machine-level isolation decision).

---
*Stack research for: v2.0 Autonomous Operations (self-healing CallVault) — solo-operator Mac daemon + Supabase.*
*Researched: 2026-06-12*
*Net-new footprint: 0 new npm packages, 1 new secret (`SENTRY_AUTH_TOKEN`).*
