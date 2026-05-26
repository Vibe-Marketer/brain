---
isa_id: connector-unification
status: active
created: 2026-05-23
owner: andrew@aisimple.co
tier: E4
github_issue: 283
worktree: /Users/admin/.archon/workspaces/Vibe-Marketer/brain/worktrees/feat/connector-unification
phase: phase-2-ui-shell
---

# ISA — Connector Unification

> Single ConnectorPanel + useConnector primitive that EVERY integration
> surface (Settings, Import dashboard, Import detail, Setup Wizard,
> future surfaces) consumes. Adding a new source becomes one adapter file.

## Problem

Integration UI is fractured across **19 components** with no single source
of truth for connection status. The same connection (e.g. Fathom) is
rendered three different ways and read from two different tables:

| Surface | Reads from | Connection check |
|---|---|---|
| Settings → IntegrationsTab | `user_settings.oauth_token_expires` (via `useIntegrationSync`) | "Has the token expired?" |
| Import dashboard | `import_sources` rows (via `useImportSources`) | "Is any row `is_active=true`?" |
| Per-source ImportDetail panes | bespoke queries | varies |

**Real-world consequence (2026-05-23 incident, post-mortem inline):**
The `import_sources.webhook_path_token` column was missing from prod even
though the parent migration was recorded as applied. `useImportSources()`
threw 42703, returned empty, every source on Import showed "Setup needed".
**Settings** simultaneously showed "Connected" because it read a different
table that didn't reference the broken column. Divergence hid the
incident for hours; users saw mixed state across surfaces.

**Adding a new source before this workstream** required touching ~5 components
(settings wizard, import detail, status row, integration manager, sync pane).
The current target is that native provider connectors can be added in ≤ 2 days
once provider credentials/API access exist.

## Vision

A single declarative model where:

```jsx
<ConnectorPanel sourceApp="fathom" layout="settings" />
<ConnectorPanel sourceApp="fathom" layout="card" />
<ConnectorPanel sourceApp="fathom" layout="detail" />
<ConnectorPanel sourceApp="fathom" layout="wizard" />
```

… each render variant of ONE component, consuming ONE hook
(`useConnector`), reading from ONE adapter registry. Each consumer page
becomes a thin layout container. Per-source quirks live exclusively in
the per-source adapter file. New sources land as ONE new file at
`src/components/connectors/registry/adapters/<name>.ts`.

## Out of Scope

- **Backend connector logic** — edge functions stay where they are; only
  the React UI + status hook is consolidated.
- **Multi-tenant changes** — this is per-user scope, no org-context shifts.
- **OAuth callback rewrite** — the existing flow is fine post-#268/#282;
  this ISA reuses it via adapter `getOAuthAuthUrl()`.
- **Backwards-compat shims for the 14 dead components** — Phase 7 deletes
  them outright after migration.
- **Cosmetic redesign** — visual style is unchanged; layouts match
  current Settings + Import looks pixel-for-pixel until a separate
  design ISA proposes changes.
- **Mobile-specific layouts** — out of scope for v1; ConnectorPanel
  renders responsively but no separate mobile components.

## Principles

1. **One source of truth** — `useConnector` reads BOTH `import_sources`
   AND `user_settings`, returns ONE canonical `ConnectorStatus`. No
   consumer reads either table directly.
2. **Declarative per-source** — adapters describe the source; UI shells
   render the description. New behavior = new adapter, not new
   component branching.
3. **Phased rollout, never YOLO** — each phase ships independently and
   can be reverted alone. No single mega-PR.
4. **Additive before subtractive** — Phase 1-2 land new primitives WITH
   existing components intact. Phase 3-6 migrate consumers one at a
   time. Phase 7 deletes only after every consumer has migrated.
5. **Visual parity in migration phases** — Interceptor screenshots
   before AND after each consumer migration; visual diff is a merge
   blocker. We do not redesign during migration.

## Constraints

- **React Query** is the existing data-fetching layer; new hook must
  use it (no new state management).
- **shadcn/ui** components are the design-system foundation; layouts
  use existing primitives (Card, Button, Badge, etc.).
- **Test infra** — Vitest, integration tests skip without service-role
  env var (existing pattern).
- **No new edge functions** in this ISA — adapters call existing
  endpoints only.
- **No schema changes** in this ISA — schema fixes are out of scope.
- **`@/components/connectors/`** is the canonical namespace. Files
  under `@/components/integrations/`, `@/components/sync/`,
  `@/components/shared/IntegrationManager.tsx` are legacy until Phase 7.
- **TypeScript strict mode** — all new code must type-check clean.

## Goal

> By the end of Phase 7, every integration UI surface in the app
> renders via `<ConnectorPanel sourceApp="..." layout="..." />` and
> reads its state via `useConnector(sourceApp)`. The 14 legacy
> components are deleted. Adding a native provider connector takes ≤ 2 days.

## Criteria

Each ISC ID is permanent — never renumbered. Anti-criteria are
prefixed `Anti:` and derive from Out-of-Scope.

- [ ] ISC-01: `useConnector(sourceApp)` returns ConnectorStatus with
      a single `connected: boolean` that agrees with both
      `import_sources.is_active` and `user_settings.*_oauth_token_expires`.
- [ ] ISC-02: `deriveConnectorStatus()` has ≥ 10 unit tests covering
      Phase 1 incident patterns. (✅ landed in PR #284)
- [ ] ISC-03: `connectorRegistry.getConnectorAdapter()` throws
      loudly for unknown source_app (no silent empty render).
- [ ] ISC-04: `ConnectorPanel` renders 4 layout variants:
      `settings`, `card`, `detail`, `wizard`.
- [ ] ISC-05: Each layout variant has a Storybook-style isolated test
      story (or equivalent fixture).
- [ ] ISC-06: Settings → IntegrationsTab renders 100% via
      ConnectorPanel; no direct `useIntegrationSync` import remains
      in that file.
- [ ] ISC-07: Import dashboard renders source cards via ConnectorPanel;
      no `deriveSourceStatus` call remains in ImportOverviewDashboard.
- [ ] ISC-08: Each per-source ImportDetail pane (Fathom, Zoom,
      Fireflies) renders via ConnectorPanel; bespoke queries removed.
- [ ] ISC-09: SetupWizard renders via ConnectorPanel layout=`wizard`;
      FathomSetupWizard.tsx and ZoomSetupWizard.tsx deleted.
- [ ] ISC-10: 14 legacy components deleted; grep returns zero matches:
      `IntegrationManager`, `IntegrationStatusRow`, `IntegrationSourceCard`,
      `IntegrationSourceGroup`, `IntegrationSyncPane`,
      `InlineConnectionWizard`, `AddIntegrationButton`,
      `IntegrationButtonGroup`, `CompactIntegrationButton`,
      `ConnectedContent`, `IntegrationConnectModal`,
      `FathomSetupWizard`, `ZoomSetupWizard`,
      `useIntegrationSync` (hook).
- [ ] ISC-11: Adding a new source touches exactly ONE file under
      `registry/adapters/`. No changes to any UI component to onboard
      a new source.
- [ ] ISC-12: Interceptor visual-diff: Settings + Import pages render
      pixel-identical before/after each consumer migration phase.
- [ ] ISC-13: RLS regression test still passes (no schema or auth
      changes).
- [ ] ISC-14: All existing edge function callsites for connect/disconnect
      continue to fire correctly; no API contract changes.
- [ ] ISC-15: Phase rollout: PR-per-phase, each independently revertable.
- [ ] Anti-ISC-16: No edge functions modified by this ISA.
- [ ] Anti-ISC-17: No `supabase/migrations/` changes by this ISA.
- [ ] Anti-ISC-18: No org-context or RLS changes.
- [ ] Anti-ISC-19: No visual redesign (parity-only migration).
- [ ] Anti-ISC-20: No mobile-specific layout components.

## Test Strategy

- **Unit tests** for pure functions (deriveConnectorStatus, registry
  lookups). Vitest. Run on every PR.
- **Integration tests** against real DB (skip-if-no-service-role).
  Existing RLS regression test must keep passing.
- **Interceptor visual regression** before/after each consumer
  migration phase. Screenshot Settings + Import + each detail pane.
  Pixel diff is a merge gate.
- **RPC type-smoke test** (PR #281 / migration 20260524020000)
  continues to run on every PR — catches schema-vs-RPC mismatches.
- **Smoke test the demo flow** after each migration:
  connect Fathom → see Connected on Settings AND Import → disconnect
  → see Setup needed on both → reconnect.

## Features

### Phase 1 — Foundation (LANDED in PR #284)
- ConnectorAdapter / ConnectorMetadata / ConnectorStatus / ConnectorRow types
- 6 per-source adapters (fathom, zoom, fireflies, plaud, youtube, file-upload)
- connectorRegistry with lookup + listing helpers
- useConnector hook + pure deriveConnectorStatus
- 10 unit tests for deriveConnectorStatus

### Phase 2 — ConnectorPanel UI Shell (THIS WORKTREE, NEXT PR)
- `src/components/connectors/ConnectorPanel.tsx` with 4 layout variants:
  - `settings` — matches current IntegrationsTab Manage Fathom Connection layout
  - `card` — matches current Import dashboard source card
  - `detail` — matches current FathomImportDetail layout
  - `wizard` — matches current FathomSetupWizard step layout
- Connect / Disconnect / Edit Credentials buttons wired through adapter
- Status badge (Connected / Setup needed / Expired / Error)
- No consumer migrations yet; ships purely as a new file

### Phase 3 — Migrate Settings IntegrationsTab
- IntegrationsTab.tsx uses `<ConnectorPanel layout="settings" />`
- Interceptor diff before/after: pixel-identical
- Remove `useIntegrationSync` import from IntegrationsTab
- Smoke-test full connect/disconnect flow

### Phase 4 — Migrate Import Dashboard
- ImportOverviewDashboard.tsx renders cards via `<ConnectorPanel layout="card" />`
- Remove `deriveSourceStatus` function
- Smoke-test connect flow on Import page

### Phase 5 — Migrate Import Detail Panes
- FathomImportDetail / ZoomImportDetail / FirefliesImportDetail all
  render via `<ConnectorPanel layout="detail" />`
- Per-source UI quirks (Fathom's 100-call count, Fireflies' webhook URL
  display) routed through ConnectorPanel slots

### Phase 6 — Migrate Setup Wizards
- SetupWizard renders via `<ConnectorPanel layout="wizard" />`
- Delete FathomSetupWizard.tsx + ZoomSetupWizard.tsx

### Phase 7 — Delete Legacy
- Remove all 14 dead components listed in ISC-10
- Remove `useIntegrationSync` hook
- Grep verification: zero matches for legacy names

## Decisions

- **2026-05-23 — Phased rollout, not single PR.** Today's incidents
  (PR #278 Fireflies RPC bugs, PR #282 missing column) show single mega-PRs
  ship breakage. Phasing means each migration is independently
  revertable. Issue #283 captures the full plan.
- **2026-05-23 — Registry pattern over class hierarchy.** Adapters are
  plain objects with optional methods. Easier to test, easier to add
  sources, no inheritance traps.
- **2026-05-23 — useConnector reads BOTH tables.** A single read of
  `import_sources` alone would miss the legacy `fathom_api_key` path;
  a single read of `user_settings` would miss multi-account state.
  The hook merges both into one ConnectorStatus.
- **2026-05-23 — Visual parity in migration phases.** No redesign
  while consolidating. A separate design ISA can come later.

## Changelog

- **2026-05-23** — ISA scaffolded. Phase 1 already landed via PR #284
  (useConnector + 6 adapters + 10 unit tests). Issue #283 holds public
  audit + plan.

## Verification

- ISC-02 verified by `npx vitest run src/components/connectors/__tests__/`
  → 10/10 passing as of 2026-05-23.
- All remaining ISCs verified per-phase. Each phase PR includes its
  own ISC check-off in the PR body.
- Final verification: after Phase 7, the grep at ISC-10 returns zero
  matches → ISA closed.
