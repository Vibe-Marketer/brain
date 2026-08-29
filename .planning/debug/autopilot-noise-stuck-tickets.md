---
status: verifying
trigger: "Andrew reports the autopilot dashboard and ticket UI are producing noise he cannot act on: repeated 'skipped:known-unfixable' runs stuck showing 'running' forever with unknown gate; a 'Survival Trust' widget with unexplained terms (Matured fixes, Canary failures, Defers); an escalated Bug ticket (#dbadbc) that has received the identical watchdog note (claude-headless OAuth session expired) roughly every 1-2 days for 12+ days with no fix and no plain-English cause; a customer-reported URGENT Improvement ticket (#632728) that shows no autopilot activity at all despite Andrew clicking 'Work Now', autopilot showing 'idle', and status stuck on 'New'; a blank URGENT Feature Request ticket (#f01a51) from the internal watchdog with zero message content; and no way to tell from the Dashboard whether any specific ticket is actively being worked."
created: 2026-08-29
updated: 2026-08-29
goal: find_and_fix
---

# Debug: Autopilot dashboard/ticket noise — duplicate unfixable watchdog tickets, unclear UI, urgent ticket not worked

## Symptoms

1. **Dashboard "runs" list is misleading.** Multiple entries show status `skipped:known-unfixable`, `Gate: unknown`, `Duration: running` (even for runs from 6 days ago), `Budget est.: not recorded`, `Fix SHA: unknown`. A run cannot be simultaneously "skipped" and "running" — this reads as a stuck/incorrectly-rendered state, not real information.

2. **"Survival Trust" widget is unexplained and looks broken.** Shows `source:in_app_user:error:unknown`, `Manual review`, `Survival 100%`, `Matured fixes: 3`, `Canary failures: 0`, `Defers: 0`, `3 held / 0 reopened / 0 canaries due`. Andrew has no idea what "matured fixes" means, why fixes are "held" instead of shipped, or what action (if any) this widget wants from him.

3. **Ticket #dbadbc (Bug, Escalated, URGENT) is stuck in an infinite unhelpful loop.** Every 1-2 days for 12+ days, the autopilot watchdog posts the IDENTICAL note: `origin: autopilot-watchdog; script: tools-health.sh; exit_code: 1; failing_checks: ["FAIL claude-headless rc=1 out=Failed to authenticate: OAuth session expired and could not be refreshed"]`. Every single run's "CAUSE" and plain-English summary say "Not available — the plain-English summary could not be generated this time." Activity log shows the same cycle repeating: "Handed off for a closer look" → "Autopilot note" → "Autopilot started working on it" → "Requeued to try again", with a real Gate result of `fail · needs-human:no-code-change` and Diff/Tests both "not recorded". This is autopilot re-attempting a problem it structurally cannot fix (a local OAuth session on Andrew's machine) instead of surfacing it once as "needs your action" and stopping.

4. **Customer-reported URGENT ticket #632728 shows zero autopilot engagement.** Andrew clicked "Work Now"; UI says autopilot is "idle"; ticket status is still "New"; nothing appears on the Dashboard for it — only visible in Tickets list. No research, no GSD steps, no run record at all.

5. **Ticket #f01a51 (Feature Request, URGENT, source: Internal watchdog) has NO messages at all.** A ticket was created and marked URGENT with completely empty content — nothing for a human or the autopilot to act on.

6. **No dashboard visibility into per-ticket work state.** Andrew cannot tell from the Dashboard whether autopilot is actively working a specific ticket, queued, idle, or stuck. This information currently only exists (partially) inside each ticket's detail view.

## Prior related investigation (same repo, different angle)
`.planning/debug/autopilot-tickets-stuck-no-autofix.md` (resolved 2026-06-16) already root-caused a related-but-distinct set of issues: budget cap starving urgent work, an approval wall nothing auto-clears, and a fix-averse agent burning tokens declaring "not a bug" instead of fixing. That investigation did NOT cover: (a) the watchdog's own infra-health tickets (like the claude-headless OAuth failure) being endlessly re-escalated instead of deduped/silenced-after-first-notify, (b) the "skipped:known-unfixable" + "running" contradictory run-status rendering, (c) the unexplained Survival Trust / trust-ladder widget copy, (d) a specific urgent customer ticket receiving zero engagement despite manual "Work Now", or (e) a blank auto-filed ticket. Treat this as the current session; consult the prior file for engine architecture context (claim.ts, runner.ts, trust.ts, approval.ts) but do not assume its fixes shipped — verify current state fresh.

## Current Focus
- hypothesis: ALL SIX ROOT-CAUSED AND FIXED (see Resolution). Andrew approved all 4 decision points; every fix shipped and committed.
- next_action: Awaiting human verification in the live Dashboard/Tickets UI (Andrew to confirm dbadbc25 is gone from Needs You, the trust widget reads plainly, and a fresh urgent improvement ticket gets claimed). Autopilot-repo commits (claim.ts, weekly-council.ts) are LOCAL ONLY — not pushed, since the live self-fix engine actively pushes to that same branch (5 commits ahead at investigation time) and force-merging a branch a live autonomous process pushes to is out of scope for this session. Needs a manual merge window.
- reasoning_checkpoint:
    hypothesis: "#dbadbc re-escalates daily because the nightly qa-crawler (auth'd as Andrew) clicks 'Run agent' on the Needs You card, calling requeueTicketForAgent() which resets escalated->new; the engine then re-claims a host-OAuth problem it structurally cannot fix and re-escalates."
    confirming_evidence:
      - "ticket_events: escalated->new is actor=Andrew(auth.uid) at ~07:39 UTC (=03:39 ET); claim/escalate is actor=NULL(service role). The reopen is a JWT session, not the engine."
      - "07:39 UTC reopen falls inside the nightly-crawl window (launchd com.callvault.qa-nightly, Hour 3 Min 30 local). Crawler logs into app.callvaultai.com as Andrew."
      - "qa-crawler.ts DENY_PATTERN (line 78) has no 'run agent'/'requeue'/'run' token; crawler 'exercises safe interactive controls with real clicks' across /admin routes."
      - "DashboardSection NeedsYouCard 'Run agent' button (line 366) calls requeue.mutate -> requeueTicketForAgent (admin-dashboard.service.ts:117-123) = update status:new, attempts:0, next_attempt_at:null. No unfixable guard."
      - "critic-transcripts/dbadbc25-*.txt exist on 08-20/22/24/29 — same cadence."
      - "Prior migration 20260703120000 documented the identical 'escalated->new at ~07:38 UTC daily' loop for ticket 27aeb6cb and only patched it with a one-off single-row resolve."
    falsification_test: "If the crawler were NOT the reopener, the escalated->new events would not cluster inside the 03:30 ET crawl window and/or would carry a NULL (service-role) actor. Both are false — they are Andrew-attributed and in-window."
    fix_rationale: "Two independent guards: (a) add run agent|requeue|work now|run to qa-crawler DENY_PATTERN so QA never mutates ticket state; (b) give requeueTicketForAgent an unfixable guard (refuse to reopen a ticket whose recent runs are skipped:known-unfixable / needs-human:*) and/or add a terminal 'wont_fix' path so unfixable host-infra tickets stop cycling."
    blind_spots: "Have not located a standalone daily requeue script (none appears to exist — the crawler click is the mechanism). Have not visually reproduced the crawler click via Interceptor; inference is from code + event forensics, which is strong but not a live click capture."
- tdd_checkpoint: null

## Evidence
- timestamp: 2026-08-29
  checked: runner_state (prod vltmrnjsubfzrgrtdqey)
  found: status=idle, kill_switch=false, heartbeat fresh, last_result="cycle: 0 claim(s), 0 merge(s), last=queue empty". Dispatcher IS alive and heartbeating.
  implication: "Nothing to claim" is a TYPE-FILTER artifact, not a dead dispatcher.
- timestamp: 2026-08-29
  checked: selectNextTicket (autopilot/src/lib/claim.ts:204-212)
  found: candidate query is `.in("type", ["bug","task"]).eq("status","new")...`. feature_request/improvement/suggestion/question are explicitly excluded ("backlog").
  implication: "#632728 (type=improvement, urgent=true, priority=3, status=new, attempts=0) is STRUCTURALLY unclaimable — urgent/priority never even evaluated. Same gate blocks #f01a51 (feature_request). This is the root cause of Symptom #4 and why 'Work Now' does nothing."
- timestamp: 2026-08-29
  checked: ticket dbadbc25 rows + ticket_events + ticket_messages (prod)
  found: occurrence_count=1 (watchdog dedup WORKS — single row, not re-filed). status=escalated, severity=high, urgent=FALSE. 25 events, cycle escalated->new(Andrew,~07:39 UTC)->in_progress->escalated(service role) repeating ~daily since 08-18. 8 agent messages, one per cycle. Context = tools-health FAIL claude-headless OAuth session expired.
  implication: The repeat noise is NOT re-filing and NOT the watchdog. It is the crawler-triggered reopen + engine re-escalation loop. Also UI labels severity=high as 'URGENT' (mislabel — ticket is not urgent).
- timestamp: 2026-08-29
  checked: pg_cron.job, tickets triggers, tickets functions (prod, via Bun SQL)
  found: NO pg_cron job and NO trigger flips escalated->new. Only triggers are ticket_status_audit (logs auth.uid()) and updated_at. ticket_status enum = {new,triaged,in_progress,awaiting_approval,awaiting_user,resolved,rejected,escalated} — terminal-ish states resolved+rejected exist; escalated is revivable.
  implication: The reopen is application/browser-driven, not DB-scheduled. auth.uid()=Andrew proves a JWT session (the crawler), not the service-role engine.
- timestamp: 2026-08-29
  checked: nightly-crawl.sh + qa-crawler.ts (brain) + com.callvault.qa-nightly.plist
  found: launchd runs nightly-crawl.sh at 03:30 ET; it runs qa-crawler.ts against app.callvaultai.com signed in as Andrew, crawling APP_ROUTES incl /admin, clicking "safe interactive controls with real clicks" (MAX 25/route). DENY_PATTERN lacks run agent|requeue|work now|run.
  implication: The crawler clicks the "Run agent" button on the escalated ticket => requeueTicketForAgent => escalated->new. Self-inflicted loop. (Symptom #3 root cause.)
- timestamp: 2026-08-29
  checked: runner_runs recent rows + DashboardSection.tsx:95 formatDuration + TicketEvidence.tsx:410 runGateLabel
  found: recent runs are status=skipped/outcome=skipped:known-unfixable/finished_at SET (NOT actually running), but duration_sec/gate_verdict/est_cost/fix_sha are NULL. formatDuration(null) returns literal "running"; runGateLabel(null) returns "unknown"; diff/cost/sha render "not recorded"/"unknown".
  implication: Symptom #1/#2 contradictory rendering = the skip path writes an incomplete runner_runs row + formatDuration conflates "no duration recorded" with "still running". Data is stale/incomplete, not a stuck job.
- timestamp: 2026-08-29
  checked: weekly-council.ts:238-244 (autopilot qa) + ticket f01a51 messages/events
  found: council inserts type=feature_request with body in context.{title,description}; creates NO ticket_messages row. f01a51 has 0 messages, 0 events, but populated context. It is NOT urgent (urgent=false, severity=low, origin=weekly-council NOT watchdog).
  implication: Symptom #5 "blank ticket" = content stored in context JSON, ticket detail UI renders from ticket_messages (empty) => appears blank. Also mis-described as URGENT/watchdog in the report.
- timestamp: 2026-08-29
  checked: Survival Trust widget (DashboardSection.tsx:720-800) + admin-dashboard.service metrics
  found: renders raw trust-ladder telemetry per fix-category (survivalRate, matured fixes, canaryFailedCount, deferredRuns, held, canaries due) and raw fix_category strings like source:in_app_user:error:unknown. Accurate but opaque; non-actionable for the operator.
  implication: Symptom #2 (widget) = internal engine vocabulary surfaced without plain-English framing or a "what do I do" — a copy/placement problem, not a functional bug.

## Eliminated
- hypothesis: Watchdog re-files a NEW ticket every cycle (no dedup).
  evidence: watchdog.ts runToolsHealth() dedupes on context->>watchdog_fingerprint and skips when an open ticket exists; live occurrence_count=1, single dbadbc row. Dedup works.
  timestamp: 2026-08-29
- hypothesis: A pg_cron job / DB trigger flips escalated->new.
  evidence: Enumerated cron.job (5 unrelated jobs) and tickets triggers (audit + updated_at only). None touch escalated->new.
  timestamp: 2026-08-29
- hypothesis: #632728 stuck due to prior budget-cap/compareTickets sort-only priority chokepoint.
  evidence: runner_state is idle with budget available ("queue empty"), not budget-capped. The block is the .in("type",["bug","task"]) filter excluding type=improvement BEFORE any priority logic. New/distinct cause.
  timestamp: 2026-08-29

## Resolution
- root_cause: |
    SIX distinct root causes (live-verified, prod ref vltmrnjsubfzrgrtdqey):
    #3 (headline, #dbadbc infinite loop): The nightly QA crawler (launchd com.callvault.qa-nightly, 03:30 ET) signs into prod AS ANDREW and clicks the "Run agent" button on the escalated ticket in the Dashboard "Needs You" card, because qa-crawler.ts DENY_PATTERN omits run agent|requeue|work now|run. That calls requeueTicketForAgent() (escalated->new, attempts=0, no unfixable guard). The engine re-claims a host-level OAuth-session failure it structurally cannot fix, re-escalates, and the cycle repeats daily. Watchdog dedup is NOT the problem (occurrence_count=1). ticket_status has no non-revivable "needs human / wont_fix" terminal state for infra tickets, so escalated is always revivable. Prior migration 20260703120000 hit the identical loop (ticket 27aeb6cb) and only patched one row.
    #4 (#632728 zero engagement): selectNextTicket filters .in("type",["bug","task"]); type=improvement is excluded from the claim loop entirely. urgent/priority/"Work Now" are never evaluated. Same gate strands #f01a51 (feature_request). workTicketNow() also had no type awareness, so "Work now" silently no-op'd on any excluded type.
    #1/#2 (contradictory run rows): the skipped:known-unfixable path writes an incomplete runner_runs row (null duration_sec/gate_verdict/est_cost/fix_sha) and DashboardSection formatDuration(null) returns the literal "running"; runGateLabel(null) returns "unknown". A finished skip renders as a stuck running/unknown run.
    #2 (Survival Trust widget): raw trust-ladder telemetry (matured/canary/defer/held + raw fix_category strings) surfaced to the operator with no plain-English framing and no action — copy/placement problem. "Held" in the footer chip was ALSO misleading in the opposite direction Andrew assumed: it's a terminal "already proven safe" state, not "waiting to ship."
    #5 (#f01a51 blank): weekly-council.ts writes ticket body into context.{title,description} but creates no ticket_messages row; the ticket detail UI renders from ticket_messages -> appears empty. It is not urgent and not from the watchdog.
    #6 (no per-ticket work visibility): confirmed still true (prior audit) — tickets list has no "being worked on" indicator/auto-refresh; live state only on the Dashboard card. NOT addressed this session (out of scope of the 4 approved decision points — logged as a follow-up feature, not a bug fix).
- fix: |
    Andrew approved all 4 decision points (2026-08-29). Everything shipped:

    #3 (dbadbc25 loop):
    (a) One-off prod UPDATE resolving ticket dbadbc25 to status='resolved' (mirrors migration 20260703120000's resolution of ticket 27aeb6cb) — run via a one-off script (not a migration file), confirmed prod ref vltmrnjsubfzrgrtdqey before executing. BEFORE: status=escalated, occurrence_count=1. AFTER: status=resolved. No schema touched.
    (b) scripts/qa/qa-crawler.ts: added `run agent|requeue|work now|\brun\b|dismiss` to DENY_PATTERN so the nightly crawler can never click ticket-mutating buttons again.
    (c) src/services/admin-dashboard.service.ts: added an unfixable guard to requeueTicketForAgent() — refuses (throws TicketKnownUnfixableError, surfaced via the existing toast) when the ticket's most recent runner_runs row is skipped:known-unfixable or needs-human:*. Backstop independent of the crawler fix.

    #4 (#632728 improvement ticket unclaimable):
    autopilot/src/lib/claim.ts selectNextTicket: broadened the type fetch to include improvement/feature_request, gated by new isBacklogTypeClaimable() (urgent=true OR source in [manual, in_app_user]) so watchdog/nightly_qa/internal-sourced backlog tickets stay excluded. src/services/admin-ticket-controls.service.ts workTicketNow(): added a claimable-type check that refuses up front with a plain-English reason for types the claim loop will never fetch (suggestion/question), instead of silently setting urgent/priority with no effect.

    #3 Survival Trust widget: renamed to "Autopilot Track Record" with a one-line subtitle; relabeled all 4 jargon metrics (Matured fixes -> Fixes reviewed (30d), Canary failures -> Broke after shipping, Defers -> Delayed by autopilot, Survival -> Held up after shipping) with hover tooltips carrying the precise definition; footer chips reworded (held -> proven safe, reopened -> reopened after shipping, canaries due -> due for a safety re-check); added trustActionSummary() — one explicit "what you need to do" line per category. Underlying data/logic unchanged.

    #1/#4a (contradictory run rendering): DashboardSection.tsx formatDuration/runGateLabel now key off run.finished_at (null = genuinely running; non-null with missing fields = finished with nothing to record, never "running"). Skipped runs render a compact "Skipped — needs a human" line instead of the full Gate/Duration/Budget/SHA grid. TicketEvidence.tsx's own runGateLabel null-case aligned from "unknown" to "n/a" for consistency.

    #5/#4b (blank #f01a51-style tickets): autopilot/qa/weekly-council.ts postTicket() now reads back the inserted ticket id and writes a ticket_messages row (author_type='agent') with the title+rationale. src/components/settings/TicketDetailDialog.tsx falls back to rendering context.title/description as a synthetic message when ticket_messages is empty — covers tickets filed before this fix.

    #6: not addressed — logged as a follow-up (add a "being worked on/queued/idle" indicator + auto-refresh to the tickets list).
- verification: |
    - Live prod: dbadbc25 confirmed status='resolved' via direct read after the UPDATE (before/after logged in this session's tool output).
    - autopilot repo (bun test, real runs, no mocking gaps): claim.test.ts 36/36 pass (7 new backlog-gate tests incl. a direct 632728-shape regression test through selectNextTicket); weekly-council.test.ts 9/9 pass (2 new tests, fetch mocked, no live calls made).
    - brain repo: vitest is BROKEN in this sandboxed environment for every test file (pre-existing, confirmed by running untouched test files with the identical failure) — root cause is a nested-git-worktree quirk: this checkout (/Users/admin/dev/brain/main) is itself nested inside another independent worktree+lockfile at /Users/admin/dev/brain, and Vite's workspace-root climb resolves setupFiles against the wrong ancestor ("Cannot find module '/@fs/Users/admin/dev/brain/src/test/setup.ts'" — missing "/main"). Worked around for verification ONLY (not committed) with a temporary vitest.debug.config.ts using an absolute setupFiles path: admin-dashboard.service.test.ts 40/40 pass, admin-ticket-controls.service.test.ts 9/9 pass, TicketDetailDialog.test.tsx 18/18 pass — all including every new test added this session. Temp config deleted after use; never committed.
    - Type-checked every changed brain-repo file individually via `npx tsc -p tsconfig.app.json --noEmit` (DashboardSection.tsx, TicketEvidence.tsx, TicketDetailDialog.tsx, admin-dashboard.service.ts, admin-ticket-controls.service.ts, and their test files) — zero new errors introduced (pre-existing unrelated errors elsewhere in the codebase, confirmed by baseline diff).
    - Did NOT verify in a live browser session (Interceptor) this round — text/logic verification only. Recommend a human pass over the live Dashboard to visually confirm the reworded widget and run rows before final close-out.
- files_changed:
    - brain: scripts/qa/qa-crawler.ts
    - brain: src/services/admin-dashboard.service.ts
    - brain: src/services/__tests__/admin-dashboard.service.test.ts
    - brain: src/services/admin-ticket-controls.service.ts
    - brain: src/services/__tests__/admin-ticket-controls.service.test.ts
    - brain: src/pages/admin/DashboardSection.tsx
    - brain: src/components/admin/TicketEvidence.tsx
    - brain: src/components/settings/TicketDetailDialog.tsx
    - brain: src/components/settings/__tests__/TicketDetailDialog.test.tsx
    - autopilot (~/dev/autopilot, LOCAL COMMITS ONLY — not pushed, see next_action): src/lib/claim.ts, src/lib/claim.test.ts, qa/weekly-council.ts, qa/weekly-council.test.ts
    - prod data (one-off, no migration file): tickets.id=dbadbc25-1a25-49e9-8dc2-ce6b29d8c3f2 status escalated -> resolved
