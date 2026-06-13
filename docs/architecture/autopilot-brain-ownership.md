# Autopilot ⇄ Brain — Ownership & Architecture

**Status:** Authoritative. Last verified against code 2026-06-13.

Two repos, one product. They share **no code** — they integrate **only** through the Supabase database.

```
┌────────────────────────────┐         ┌────────────────────────────┐
│  brain  (this repo)        │         │  autopilot  (~/dev/autopilot)│
│  /Users/admin/dev/brain    │         │  headless launchd daemon     │
│                            │         │  (no frontend, zero react)   │
│  • CallVault React app     │         │  • src/claimer.ts            │
│  • Admin control plane:    │         │  • src/runner.ts (fix agent) │
│    AdminTab, runner_runs    │         │  • src/qa-poller.ts          │
│    reads, kill-switch toggle│         │  • src/watchdog.ts           │
│  • Supabase Edge Functions │         │  • gate/ (push-gate)         │
│  • Supabase MIGRATIONS      │         │  • clone/ + worktrees/       │
│    = schema source of truth │         │  • qa/ (crawler + triage)    │
│                            │         │  • launchd/ (scheduler)      │
└─────────────┬──────────────┘         └──────────────┬─────────────┘
              │                                        │
              │        Supabase Postgres (shared)      │
              └────────────────┬───────────────────────┘
                               │
        tickets · runner_state · runner_runs · qa_runs
        (the ENTIRE integration contract — DB rows only)
```

## Who owns what

| Concern | Owner | Notes |
|---|---|---|
| CallVault product UI | **brain** | React + Vite + Tailwind + Radix |
| Autopilot admin/observability UI | **brain** | AdminTab, run ledger reads, kill-switch toggle |
| DB schema (tables, RLS, RPCs) | **brain** | `supabase/migrations/*` — single source of truth for both repos |
| Edge Functions | **brain** | `supabase/functions/*` |
| The autonomous fix agent (claim→fix→gate→merge) | **autopilot** | `src/runner.ts` et al. |
| Push-gate (deterministic test-integrity check) | **autopilot** | `gate/` |
| QA crawler + triage | **autopilot** | `qa/` |
| Daemon scheduling | **autopilot** | `launchd/` — runs on a cadence on this machine |
| Per-run isolation | **autopilot** | `clone/` + `worktrees/` (concurrency = 1, load-bearing) |

## The seam: shared Supabase tables
- `tickets` — the work queue. Brain's UI + crawler create rows; autopilot claims/updates them.
- `runner_state` — singleton heartbeat + `kill_switch`. Brain's toggle flips it; autopilot reads it.
- `runner_runs` — per-run ledger (status, diff, test result, gate verdict, duration, cost). Autopilot writes; brain's AdminTab reads.
- `qa_runs` — nightly QA crawl summaries.

**Rule:** if a change spans both repos, it almost always means a schema change in brain + a consumer change in autopilot. Coordinate via the migration.

## Local navigation
`brain/autopilot` is a **gitignored symlink** to `~/dev/autopilot` for convenience (`cd autopilot`, grep across both). It is intentionally NOT committed — a committed symlink to a sibling repo breaks on other machines and on Vercel builds. The daemon repo is versioned independently.

## Caveats
- `~/dev/autopilot` currently has **no git remote** → its commits are local-only on this machine. Wire a remote before relying on off-machine deploy/backup of daemon code.
- Concurrency is fixed at **1** (atomic claim boundary + shared clone reset per run). Never raise it; throughput scales via run-cap + cadence only.
