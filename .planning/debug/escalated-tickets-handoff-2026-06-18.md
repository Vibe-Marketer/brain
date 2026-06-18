---
status: open
type: debug-agent-handoff
created: 2026-06-18
author: Don (reconciliation session)
audience: debug agent working the live autopilot escalations
db_project: vltmrnjsubfzrgrtdqey (Supabase, prod)
---

# Handoff — Live Autopilot Escalations (CallVault prod)

Context: Autopilot is **live on real production traffic** (kill switch off). As of
2026-06-18: 125 tickets, ~119 resolved. But "resolved" on the dashboard is being used
loosely — it covers real autonomous deploys, benign-closes, human-dismissals, AND a few
tickets marked resolved with **no fix behind them**. This doc is the triage of the tickets
Andrew submitted (`source=in_app_user`) plus the one open `manual` ticket, so you can pick up
the real work without re-deriving it.

**TL;DR — two tickets need you. The rest are correctly closed or in-flight.**

| Ticket | Page | State | Verdict |
|---|---|---|---|
| `1559f66a` | /import (Read.ai) | resolved | 🔴 **FALSELY RESOLVED — CRITICAL, no fix shipped. WORK THIS.** |
| `ceeaaf33` | / (Fathom AI title) | escalated | 🟠 **BLOCKED — migration won't apply via pooler. WORK THIS.** |
| `bec522ee` | /admin/tickets | in_progress | ⏳ Runner re-claimed it; had a gate-pass fix at awaiting_approval (run 7966469f, sha 02248d02). Check it. |
| `a68d2cdf` | /admin/tickets | resolved | ✅ Correctly closed — feature already exists in HEAD; reporter confirmed "verified working." No action. |
| `20246f6b` | /?callId | resolved | ✅ Fixed by Andrew manually, commit `25dba227` (Obsidian transcript export). No action. |
| `b5898054` | /settings/mcp | resolved | ✅ Fixed by Andrew manually, commit `e54c27d7` (settings chunk-load). No action. |
| `6c350e3b` `54fe26ac` `1220abe7` | /import, /admin/tickets | resolved | ✅ Autonomously fixed + deployed by the loop. No action. |
| `7abffb57` | /admin/tickets | resolved | ✅ Benign — agent verified nothing was broken. No action. |

---

## 🔴 1559f66a — Read.ai reconnect fails at token exchange (CRITICAL, customer-blocking)

- **Full ID:** `1559f66a-2405-4e58-8f66-37614c435323`
- **Severity:** critical · **Status:** resolved (WRONGLY — agent made no fix; a human/dismiss closed it)
- **Reporter (Andrew), 2026-06-16:** *"Read AI Integration… not importing or connecting. It said my refresh token had expired, so I tried to connect again via the link and that didn't work — got the error… Not sure why."* Reported from `/import`, Chrome 149 / macOS.
- **What the autopilot already concluded (tier-2 digest, twice):**
  - `VERDICT: ESCALATE — agent made no fix.`
  - *"Read.ai reconnect 500 is a real customer-blocking defect, but the likely cause is a **redirect_uri precedence change** — likely a **regression from the OAuth-unification refactor** (redirect-URI resolution)."*
- **Lead to chase (start here):** the OAuth-unification refactor changed how `redirect_uri` is
  resolved/precedence-ordered. Read.ai's reconnect/token-exchange leg likely now sends or expects
  the wrong redirect_uri → 500 at the token exchange. Look at the OAuth connect/callback flow for
  Read.ai specifically vs. the unified path; compare redirect_uri construction before/after the
  refactor. Also handle the expired-refresh-token reconnect path (it should re-auth cleanly, not 500).
- **Why it matters:** this is the only CRITICAL in the set and it was closed with nothing behind it.
  Re-open it. Do not trust the "resolved" status.
- **Note:** the full reporter body includes a structured debug-panel report (console + network). Pull
  it (recipe below) — there should be the actual 500 response and the failing request URL/redirect_uri.

## 🟠 ceeaaf33 — Fathom linkage lost on cross-org copy → AI title generation fails (migration-blocked)

- **Full ID:** `ceeaaf33-ebbf-497e-b2d8-b1aa457f859a`
- **Severity:** medium · **Status:** escalated (recurring — re-claimed and re-held repeatedly)
- **Reporter (Andrew), 2026-06-17:** *"AI TITLE generation… said 'None of the selected calls have a
  Fathom recording ID. AI title generation requires calls synced from Fathom.' That SHOULD NOT BE THE
  CASE — this is actually a Fathom Call. Perhaps in moving from one organization to another the 'source'
  being 'fathom' was lost… if there's an issue with the 'original import source' that also needs fixing."*
- **Diagnosis (already done by GSD — believed correct):** a **cross-org copy drops the Fathom linkage**.
  Breaks at:
  - `src/hooks/useWorkspaces.ts:428` ✅ verified — linkage point is `recording_id:
    recording.fathom_provider_id ?? recording.id` (Fathom id goes null after cross-org copy → falls
    back to UUID → the AI-title path no longer recognizes it as a Fathom call).
  - `supabase/functions/generate-ai-titles/` ✅ verified exists.
  - `get_workspace_recordings` RPC — cited in the diagnosis but **not located by a quick grep of
    `supabase/migrations/`**. Find where it's actually defined before trusting that part of the diagnosis.
- **Why it's still open — TWO blockers, not one:**
  1. The fix needs a **DB migration**, and the autopilot runner has **no `DATABASE_URL`/migration creds**
     (`needs-human:migration-no-creds`). This is structural — see the migration-creds decision below.
  2. A migration was authored — `supabase/migrations/20260618150000_recordings_canonical_ai_title.sql`
     — **but it is NOT in `~/dev/brain`** (it was created in an ephemeral autopilot worktree that gets
     destroyed per run, so it may be gone — you likely need to re-author it). The migration agent
     **could not apply it** anyway:
     ```
     failed to parse rows: ERROR: prepared statement "lrupsc_1_0" already exists (SQLSTATE 42P05)
     ```
     That's the classic **transaction-pooler + prepared-statements** conflict. Applying migrations
     through Supabase's pooled connection (port 6543) with prepared statements breaks. Fix the apply
     path: use the **direct/session connection** (port 5432) or run `supabase db push` with
     `--single-transaction` / disable prepared statements (`?prepared_statements=false` / pgbouncer-safe).
- **Two things to deliver:** (a) the actual data/linkage fix (recover/derive Fathom source after cross-org
  copy — confirm whether the migration `20260618150000_...` is correct), and (b) a migration-apply path
  that works against the prod pooler so this class of fix can land at all.
- **Recording-ID caveat (repo invariant):** never `parseInt`/`Number`/string-coerce recording IDs —
  route through `toRecordingUuid()`/`toRecordingUuidBatch()` in `src/lib/recording-ids.ts`. UUID
  `recordings.id` vs legacy BIGINT is a known dual system.

## ⏳ bec522ee — /admin/tickets bug (in flight)

- **Full ID:** `bec522ee-7084-4287-98dd-06e2f3174c8c` · **Severity:** high · **Status:** in_progress (runner re-claimed)
- Had a **gate-passing fix at awaiting_approval**: runner_run `7966469f`, `gate=pass`, `test_exit=0`,
  `fix_sha=02248d02c6bc`, branch `fix/ticket-bec522ee`. Either approve that in AdminTab or let the
  current run supersede it. Check it isn't stuck oscillating between claim and escalate.

---

## How to pull more (prod REST, service role)

Creds: `~/dev/autopilot/.env` → `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

```bash
cd ~/dev/autopilot && set -a && source .env && set +a
H=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

# Full reporter + agent thread for a ticket (the real bug detail lives here, NOT in tickets.context):
curl -s "$SUPABASE_URL/rest/v1/ticket_messages?select=author_type,body,created_at&ticket_id=eq.<FULL_UUID>&order=created_at.asc" "${H[@]}"

# Every autopilot run for a ticket (outcome/gate/fix_sha/branch):
curl -s "$SUPABASE_URL/rest/v1/runner_runs?select=id,started_at,outcome,status,gate_verdict,test_exit,branch,fix_sha&ticket_id=eq.<FULL_UUID>&order=started_at.desc" "${H[@]}"

# Re-open a wrongly-resolved ticket (e.g. 1559f66a) so the loop or you can work it:
curl -s -X PATCH "$SUPABASE_URL/rest/v1/tickets?id=eq.1559f66a-2405-4e58-8f66-37614c435323" \
  "${H[@]}" -H "Content-Type: application/json" -d '{"status":"new","attempts":0}'
```

- The autopilot's own fix branches are `gsd/ticket-<prefix>` / `fix/ticket-<prefix>` (in the
  `~/dev/autopilot` clone/worktrees; that repo has **no remote** — local only).
- Engine lives at `~/dev/autopilot` (separate repo). DB schema + admin UI live in `~/dev/brain`.
- `tickets.context` only carries url/org/client_claims — the symptom text + console/network dump are
  in `ticket_messages.body` (and `attachments`).

## Open structural decision (Andrew's call, blocks the whole `needs-human:migration-no-creds` class)

The runner has no migration credentials, so **any fix needing a schema change dead-ends** (ceeaaf33 is
the live example). Two options: (1) give the runner scoped migration creds + a pooler-safe apply path,
or (2) route migration-needing fixes to a dedicated human/approval lane. Until decided, expect more
`needs-human:migration-no-creds` escalations.
