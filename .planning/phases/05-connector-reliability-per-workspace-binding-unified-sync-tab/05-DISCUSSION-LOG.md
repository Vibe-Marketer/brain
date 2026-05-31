# Phase 5: Connector Reliability + Per-Workspace Binding + Unified Sync Tab - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 05-Connector Reliability + Per-Workspace Binding + Unified Sync Tab
**Areas discussed:** Workspace Binding Model, Existing Connections Migration, Unified Connections Surface, Reliability Failure Behavior, Sync Tab Source of Truth

---

## Workspace Binding Model

| Option | Description | Selected |
|--------|-------------|----------|
| Connect-time required | Every new connector/account must pick a workspace during setup. | yes |
| Default workspace first, editable later | Auto-bind to current/default workspace, then allow edit. | |
| Routing rule plus explicit override | Default workspace plus routing rules can override where calls land. | |

**User's choice:** Connect-time required.
**Notes:** Connector setup must require a workspace. Changing the connector workspace affects future syncs only. Existing recordings remain where they are. Unbound webhook/sync events fall back to default workspace rather than dropping data. Connector rows/cards always show the bound workspace.

---

## Existing Connections Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Assign to default workspace automatically | Existing connector accounts get default workspace binding. | yes |
| Prompt once on next visit | Ask the user to choose workspace for existing connections. | |
| Infer from existing synced recordings | Use recording/workspace history where possible. | |

**User's choice:** Assign existing connector accounts to the default workspace automatically.
**Notes:** Show a passive notice with a change action. Preserve multiple connected accounts per provider. Do not create automatic multi-workspace fanout from one connector. Calls/transcripts are the objects users move or copy. Existing calls must never be moved by migration, reconnect, or binding changes unless the user explicitly asks. Migration should be minimal.

---

## Unified Connections Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Connected accounts by provider | Provider/account/workspace/status first. | yes |
| Workspace health summary | Workspace-level health numbers first. | |
| Action-first setup grid | Lead with setup actions. | |

**User's choice:** Prioritize connected accounts by provider.
**Notes:** The same Connections component should appear in workspace settings and global Settings/Connectors. Workspace view shows only connectors bound to that workspace. Rows should be compact with a single Manage action. Manage contains source-specific details/actions such as sync when supported, reconnect, PLAUD bridge management, change workspace, and disconnect. Import provider cards remain setup-first with status/link hints.

---

## Reliability Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Only alert when user action is needed | Retry silently, show action only when the user must fix it. | yes |
| Show degraded state during retries | Passive retry/rate-limit state visible while recovering. | partial |
| Notify for every failure event | Toast/notice every retry/failure. | |

**User's choice:** Best-practice approach: no noisy alerts, with passive status in the Connections surface.
**Notes:** Token refresh failure becomes Reconnect required. Rate limits back off automatically and show passive status/next retry. Partial syncs are success with warnings. Exhausted webhook retries mark the connector errored with last failure information. No new user-facing replay queue unless existing low-risk support is found.

---

## Sync Tab Source of Truth

| Option | Description | Selected |
|--------|-------------|----------|
| Already-in-vault recordings from all sources | Fix synced list to read canonical recordings across sources. | yes |
| Available-to-import plus already-in-vault | Combine external queue and vault inventory. | |
| Keep provider-focused, add non-Fathom providers | Preserve current fetch-provider mental model source-by-source. | |

**User's choice:** Keep the current Import Meetings workflow shape with top numbers/source/date selectors, and fix the synced list below it.
**Notes:** User clarified the target must respect the actual current three-pane Transcripts architecture. The decision applies to the current Import Meetings / SyncTab Pane 3 content, not the normal Home transcript table. Home remains the primary library view.

---

## the agent's Discretion

- Exact UI labels, badges, and source-specific Manage details can be set during planning.
- Retry thresholds and escalation timing can follow provider best practices and existing connector capabilities.
- Storage shape for workspace binding can be chosen after codebase research, as long as it preserves multi-account behavior and does not move existing calls.

## Deferred Ideas

- Automatic multi-workspace fanout from one connector account.
- New user-facing webhook replay queue unless already available at low risk.
- Bulk/provider routing rules that assign workspace per call.
- File upload and async transcription UI.
