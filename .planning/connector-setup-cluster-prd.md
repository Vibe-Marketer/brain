# Connector Setup Cluster PRD

**Status:** Active plan  
**Workstream:** Source connector unification  
**Owner surface:** CallVault connector setup across Settings, Import, and Onboarding  
**Created:** 2026-05-25

## Implementation Progress

- Session 0: complete. PRD, inventory, and staged work packets documented.
- Session 1: complete. Adapter setup metadata exists for current connectors.
- Session 2: complete. Shared setup field/status primitives exist under `src/components/connectors/setup/`.
- Session 3: complete. `ConnectorSetupCluster` shell and shared state machine exist.
- Session 4: complete for current migration needs. Disconnect/lifecycle normalization is in place, including legacy Fathom fallback; Fireflies webhook details/verification now flow through the adapter contract.
- Session 5: complete. Settings integrations render connector setup through `ConnectorSetupCluster`; the old inline Fathom credential editor has been removed from Settings.
- Session 6: complete. Import uses `ConnectorSetupCluster` for disconnected connector setup, and Fireflies now routes through the unified connector import wizard instead of the bespoke detail page.
- Session 7: complete. `/setup` uses `ConnectorSetupCluster` for the selected recorder connection flow, and Zoom is no longer presented as coming soon there.
- Session 8: complete. Legacy setup/import detail surfaces are retired, connected connectors collapse to a shared summary state, Fireflies pre-generates webhook URL/secret values, Fathom legacy account/secret details flow through the shared status path, duplicate setup badges are removed, and the shared destination bar is available from connector setup.
- Session 9: complete. The future-provider template is locked in the registry/cluster/pipeline contracts, Read.ai and Grain have been ported as beta template connectors, and failed-import clearing has been ported from the pending branch.

## 1. Product Summary

CallVault currently asks users to connect recording sources in several different ways depending on where they start:

- Settings > Integrations
- Import page connector details
- `/setup` first-run onboarding
- legacy Fathom setup wizard
- legacy Fathom/Zoom import detail files
- provider-specific custom flows, especially Fireflies and Plaud

The result is inconsistent UI, duplicated credential logic, broken or partial actions, and unclear user guidance. Users see different connected states, different API-key forms, different webhook instructions, and different reconnect/disconnect behavior depending on the screen.

We need one reusable connector setup system that can be mounted on every surface and configured by connector metadata. This should make Fathom, Zoom, Fireflies, Plaud, and future connectors feel like one product family while still allowing provider-specific auth mechanics.

## 2. User Problem

Users should not need to understand our internal difference between OAuth, API keys, webhooks, extension bridges, path tokens, signing secrets, or legacy settings. They should see a clear setup panel that tells them:

1. whether the connector is connected
2. which account is connected when we know it
3. what to do next
4. what to copy into the provider dashboard
5. whether the provider successfully reached CallVault
6. how to reconnect or disconnect

The current implementation violates the one-click promise because it exposes internal differences as UI inconsistency.

## 3. Goals

- Create one reusable `ConnectorSetupCluster` for connector account setup.
- Use the same cluster in Settings, Import, and Onboarding.
- Support all current connector auth patterns:
  - OAuth: Zoom, Fathom OAuth
  - API key: Fathom legacy/API-key mode, Fireflies
  - API key plus webhook URL plus signing secret: Fireflies
  - browser bridge/token capture: Plaud
  - no auth/public import: YouTube, File Upload
- Standardize connected, disconnected, reconnecting, saving, error, webhook waiting, and webhook verified states.
- Standardize the field order for webhook-capable API connectors:
  1. API key
  2. webhook URL
  3. webhook signing secret
- Make webhook verification visible and understandable after saving.
- Fix Settings > Integrations disconnect behavior, including legacy Fathom state.
- Keep provider secrets server-side or encrypted at rest; do not move raw secrets into durable frontend storage.
- Allow future connectors such as Read.ai, Grain, and tl;dv to opt into the same setup system by adding adapter metadata and minimal provider logic.

## 4. Non-Goals

- Do not redesign the whole Import workflow in this PRD.
- Do not change normalized recording ingestion, deduplication, routing defaults, or workspace assignment except where setup state depends on those values.
- Do not mark Read.ai, Grain, or tl;dv as complete production connectors in this workstream. Read.ai and Grain may be wired as Beta template connectors to validate that future providers can follow the same contract.
- Do not remove all legacy files until no active route imports them.
- Do not make Plaud official OAuth unless the provider flow is proven. Plaud remains a beta browser-bridge connector for now.

## 5. Current Code Inventory

### Active setup surfaces

- `src/components/settings/IntegrationsTab.tsx`
  - Uses `ConnectorPanel layout="settings"` but still owns Fathom-specific API key, webhook secret, webhook URL, and host email UI.
  - Disconnect currently depends on generic connector state and can miss legacy Fathom credentials.
- `src/pages/ImportPage.tsx`
  - Routes Fathom, Zoom, and Plaud through `ConnectorImportWizard`.
  - Routes Fireflies through bespoke `FirefliesImportDetail`.
  - Handles OAuth return query params and import-source upsert logic.
- `src/components/connectors/ConnectorImportWizard.tsx`
  - Main unified import wizard.
  - Contains internal API-key form logic and Plaud browser-token setup.
  - Uses `ConnectorPanel` for OAuth connector actions.
- `src/components/import/FirefliesImportDetail.tsx`
  - Bespoke Fireflies setup/import page with API key, generated signing secret, path-token webhook URL, save/reconnect, and webhook verification polling.
- `src/pages/SetupWizard.tsx`
  - Full-page first-run setup.
  - Hard-coded Fathom/Zoom cards.
  - Calls `fathom-oauth-url` and `zoom-oauth-url` directly instead of using connector adapters.
  - Shows Zoom as visually "Coming Soon" even though Zoom is supported elsewhere.
- `src/components/onboarding/OnboardingModal.tsx`
  - Older onboarding dialog that links to settings/import but does not authenticate directly.
- `src/pages/Settings.tsx`
  - Can still auto-open legacy `FathomSetupWizard`.
- `src/components/settings/FathomSetupWizard.tsx`
  - Legacy modal setup wizard for Fathom API key/webhook/OAuth.

### Legacy or bypassed connector details

- `src/components/import/FathomImportDetail.tsx`
  - Duplicates Fathom API key, webhook, OAuth, and connected-state UI.
  - Appears bypassed by current `ImportPage`, but remains in repo.
- `src/components/import/ZoomImportDetail.tsx`
  - Duplicates Zoom OAuth connection settings.
  - Appears bypassed by current `ImportPage`, but remains in repo.
- `src/components/settings/wizard/*`
  - Legacy Fathom wizard steps and webhook instructions.

### Current reusable pieces to keep

- `src/components/connectors/ConnectorPanel.tsx`
  - Shared card/detail/settings wrapper and OAuth connect/reconnect/disconnect actions.
- `src/components/connectors/ConnectorAccountHeader.tsx`
  - Shared connected/disconnected account summary header.
- `src/components/ui/status-badge.tsx`
  - Shared badge component for Beta, Connected, Setup Needed, and future states.
- `src/components/import/WebhookSetupCard.tsx`
  - Reusable-ish Fireflies webhook URL/signing-secret field display; should be folded into the new cluster primitives.
- `src/components/connectors/hooks/useConnector.ts`
  - Shared connector status, action, and adapter access.
- `src/components/connectors/registry/*`
  - Connector registry and adapter definitions.

### Duplicate metadata sources

- `src/components/connectors/registry/types.ts`
  - Auth methods: `oauth`, `api_key`, `webhook_only`, `none`.
- `src/config/source-registry.ts`
  - Separate auth modes: `oauth2`, `api-key`, `token-paste`, `public-url`, `none`, plus `hasWebhook`.

These should not both remain independent long-term. Session 1 should make connector setup metadata canonical in the connector registry/adapters, then later work can derive or reconcile source registry metadata.

## 6. Proposed UX Contract

Every connector setup cluster should render the same high-level structure:

1. Account header
   - provider icon/name
   - `StatusBadge`
   - connected account email or account label when available
   - concise state text
2. Setup action area
   - OAuth button, API key form, browser bridge action, or no-auth explanation
   - connected summary when already connected
   - reconnect/disconnect actions
3. Webhook area when required or recommended
   - webhook URL above signing secret
   - copy buttons
   - "Save first, then send a test event from provider" instruction
   - visible last-received verification state
4. Provider-specific helper text
   - short, practical, and placed beside the action it explains
   - no generic technical explanation blocks
5. Error area
   - visible provider/API failure messages
   - no silent failures

## 7. Proposed Technical Contract

### Component API

```ts
type ConnectorSetupClusterMode = "settings" | "import" | "onboarding";

interface ConnectorSetupClusterProps {
  sourceApp: SourceApp;
  mode: ConnectorSetupClusterMode;
  returnTo?: string;
  compact?: boolean;
  onConnected?: (sourceId: string) => void;
  onDisconnected?: () => void;
  onSaved?: (sourceId: string) => void;
}
```

### Adapter setup metadata

Add adapter-driven setup metadata so pages do not hard-code provider forms:

```ts
type ConnectorSetupKind =
  | "oauth"
  | "api_key"
  | "api_key_webhook"
  | "browser_bridge"
  | "none";

interface ConnectorSetupConfig {
  kind: ConnectorSetupKind;
  beta?: boolean;
  accountLabelField?: "email" | "hostEmail" | "accountName";
  credentialFields?: ConnectorCredentialField[];
  webhook?: ConnectorWebhookConfig;
  helperCopy?: {
    disconnected?: string;
    connected?: string;
    saveSuccess?: string;
    verificationWaiting?: string;
  };
}
```

### Adapter lifecycle methods

Extend connector adapters only where needed:

```ts
interface ConnectorAdapter {
  setup?: ConnectorSetupConfig;
  getOAuthAuthUrl?: (args: OAuthArgs) => Promise<string>;
  saveApiKeyCredentials?: (args: SaveCredentialArgs) => Promise<SaveCredentialResult>;
  getWebhookDetails?: (args: WebhookDetailsArgs) => Promise<WebhookDetailsResult>;
  saveWebhookConfig?: (args: SaveWebhookConfigArgs) => Promise<SaveCredentialResult>;
  getWebhookVerification?: (args: WebhookVerificationArgs) => Promise<WebhookVerificationResult>;
  disconnect?: (args: DisconnectArgs) => Promise<void>;
}
```

Do not require every adapter to implement every method. The cluster should branch from `setup.kind` and method availability.

### State machine

The cluster owns a simple shared state machine:

- `loading`: connector status and setup details are loading
- `disconnected`: no active credential/source exists
- `connected`: credential/source exists and is usable
- `editing`: user chose reconnect/edit credentials
- `saving`: credential or webhook config save in progress
- `waiting_for_webhook`: config saved and user needs to send provider test event
- `webhook_verified`: provider test event received by CallVault
- `disconnecting`: disconnect action in progress
- `error`: last action failed and needs visible explanation

## 8. Connector-Specific Requirements

### Fathom

- Support OAuth where available.
- Preserve legacy API-key + webhook-secret setup until fully migrated.
- Show host/account email when available.
- Disconnect must clear all active Fathom state:
  - active `import_sources` row when present
  - legacy `user_settings.fathom_api_key`
  - legacy `user_settings.webhook_secret`
  - legacy Fathom OAuth fields
- Replace Fathom-only settings/import/setup forms with `ConnectorSetupCluster`.

### Zoom

- OAuth-only setup.
- Use the same cluster in onboarding, settings, and import.
- Remove "Coming Soon" treatment from `/setup` if Zoom is still enabled in registry.

### Fireflies

- API key plus webhook URL plus signing secret.
- Webhook URL must display above signing secret.
- Save action must happen before webhook test verification.
- Verification panel should appear below Save and should instruct the user to send the provider test event, then return to CallVault.
- Poll or refresh connection details to show last received webhook event.
- Account email should show when the provider/API can return it.

### Plaud

- Keep Beta badge everywhere the connector appears.
- Use browser bridge/token-capture setup.
- Cluster should show:
  - bridge availability/status
  - opening Plaud state
  - waiting for valid token state
  - captured/connected state
  - helper text when no valid token is captured within a few seconds after login
- The extension UI remains separate, but the app-side setup cluster should present the same connected/disconnected/reconnect state as other connectors.

### YouTube and File Upload

- Use `kind: "none"` or an equivalent no-auth setup config.
- Do not show credential fields.
- They can still mount the cluster in compact/read-only mode when a page wants consistent connector status presentation.

## 9. Data and Security Rules

- `import_sources` is the canonical connector row for active source accounts.
- Legacy `user_settings` fallback is allowed for Fathom only until migrated.
- For single-account providers, only one active `import_sources` row per user/source app is allowed. Current single-account apps are Fireflies, Plaud, Zoom, Read.ai, and Grain.
- Disconnect must be atomic: deactivate the canonical `import_sources` row and clear any legacy `user_settings` state in one server-side operation.
- Secrets must never be logged.
- Secrets must not be stored in persistent frontend storage.
- Webhook signing secrets should remain encrypted/server-side where possible.
- Webhook receivers must fail closed on invalid signatures.
- Frontend connection details should return masked/boolean secret state, not raw secret values, unless the value is newly generated for display/copy and server policy explicitly allows it.
- OAuth return state must be keyed by provider-issued state. A single global `oauthReturnTo` key is not acceptable because multiple tabs can overwrite each other.
- Client-supplied `sourceId` values must be verified server-side before any credential save, token exchange, or sync operation uses them.
- Provider API base URLs must be allowlisted in both the UI and the edge function. Free-text API base values are not allowed.
- Query invalidation after save/disconnect should refresh:
  - connector bundle/status
  - import sources
  - connector-specific detail queries

## 10. Shippable Session Plan

### Session 0: Discovery, Contract, and Work Packets

**Purpose:** Lock the implementation contract before multiple agents edit the codebase.

**Steps:**

1. Inventory every connector setup surface.
2. Identify active routes vs bypassed legacy files.
3. Define `ConnectorSetupCluster` component contract.
4. Define adapter setup metadata shape.
5. Define connector-specific requirements for Fathom, Zoom, Fireflies, Plaud, YouTube, and File Upload.
6. Define session boundaries and file ownership for parallel work.
7. Document validation commands and acceptance criteria.

**Acceptance criteria:**

- This PRD exists under `.planning/`.
- Every known setup surface is listed.
- The implementation is split into sessions small enough for parallel agents.
- No production code changes are required for Session 0.

**Primary output:** `.planning/connector-setup-cluster-prd.md`

### Session 1: Adapter Setup Metadata

**Purpose:** Make connector setup behavior registry-driven instead of page-driven.

**Owned files:**

- `src/components/connectors/registry/types.ts`
- `src/components/connectors/registry/connectorRegistry.ts`
- connector adapter files under `src/components/connectors/registry/`
- tests near connector registry if present

**Steps:**

1. Add `ConnectorSetupKind`, `ConnectorSetupConfig`, credential field, webhook config, and verification result types.
2. Add setup config to Fathom, Zoom, Fireflies, Plaud, YouTube, and File Upload adapters.
3. Mark Plaud as Beta through shared metadata.
4. Represent Fireflies as `api_key_webhook`.
5. Represent Fathom as OAuth plus legacy API/webhook compatibility if current adapter supports both.
6. Represent Zoom as `oauth`.
7. Represent YouTube/File Upload as `none`.
8. Add helper functions for resolving setup config from source app.

**Acceptance criteria:**

- Pages can ask an adapter what setup UI it needs.
- No page needs to know that Fireflies has webhook URL plus signing secret.
- Type-check passes.

**Parallel notes:** Can run at the same time as Session 2 if component props are agreed in this PRD.

### Session 2: Shared Field and Status Primitives

**Purpose:** Build small reusable UI pieces before the cluster shell.

**Owned files:**

- `src/components/connectors/setup/*`
- `src/components/import/WebhookSetupCard.tsx` if folded or wrapped
- `src/components/ui/status-badge.tsx` only if missing variants are needed

**Steps:**

1. Create `ConnectorSecretField`.
2. Create `ConnectorReadonlyUrlField`.
3. Create `ConnectorCredentialForm`.
4. Create `ConnectorWebhookVerification`.
5. Create `ConnectorSetupInstructions`.
6. Use `StatusBadge` for all state badges.
7. Keep field layout responsive and stable.
8. Ensure webhook URL renders above signing secret.

**Acceptance criteria:**

- Fields are reusable across Settings, Import, and Onboarding.
- No provider-specific code is embedded in generic field components.
- Components have focused tests for display, copy affordances, and disabled/saving states.

**Parallel notes:** Can run at the same time as Session 1.

### Session 3: `ConnectorSetupCluster` Shell

**Purpose:** Create the reusable cluster and state machine.

**Owned files:**

- `src/components/connectors/setup/ConnectorSetupCluster.tsx`
- `src/components/connectors/setup/useConnectorSetupCluster.ts`
- related tests under `src/components/connectors/setup/__tests__/`

**Steps:**

1. Read setup config from adapter.
2. Read connector status through `useConnector`.
3. Render account header using `ConnectorAccountHeader`.
4. Render OAuth action for `oauth`.
5. Render credential form for `api_key`.
6. Render credential + webhook form for `api_key_webhook`.
7. Render Plaud bridge setup for `browser_bridge`.
8. Render no-auth summary for `none`.
9. Implement shared state transitions: loading, disconnected, connected, editing, saving, waiting for webhook, webhook verified, disconnecting, error.
10. Expose callbacks: `onConnected`, `onDisconnected`, `onSaved`.

**Acceptance criteria:**

- One component can render Fathom, Zoom, Fireflies, Plaud, YouTube, and File Upload setup variants.
- No page-specific credential forms are needed for the supported setup kinds.
- Unit tests cover each setup kind.

**Dependencies:** Sessions 1 and 2.

### Session 4: Save, Disconnect, and Legacy Fathom Fixes

**Purpose:** Centralize connector lifecycle mutations so every surface behaves the same.

**Owned files:**

- connector adapters
- `src/components/connectors/hooks/useConnector.ts`
- `src/lib/query-config.ts`
- Supabase functions only if an adapter save/disconnect endpoint is missing

**Steps:**

1. Add or normalize adapter save methods for API-key credentials.
2. Add or normalize adapter webhook save/details methods.
3. Add a single disconnect path that works with source IDs when present.
4. Add Fathom legacy disconnect fallback for `user_settings`.
5. Normalize query invalidation after save/disconnect.
6. Ensure save failures surface readable errors.
7. Ensure disconnect failures surface readable errors.

**Acceptance criteria:**

- Settings disconnect works for Fathom even when connection state comes from legacy settings.
- Fireflies save uses the same lifecycle path as other API-key connectors where possible.
- Type-check and focused tests pass.

**Parallel notes:** Can run while Session 3 builds the shell if adapter method names are stable.

### Session 5: Settings Integrations Migration

**Purpose:** Replace settings-specific credential UI with the cluster.

**Owned files:**

- `src/components/settings/IntegrationsTab.tsx`
- settings integration tests

**Steps:**

1. Remove inline Fathom credential editing from `IntegrationsTab`.
2. Mount `ConnectorSetupCluster mode="settings"` inside each `ConnectorPanel` detail/content area.
3. Preserve card-level connected/disconnected summary.
4. Ensure `StatusBadge` Beta appears for Plaud.
5. Ensure disconnect/reconnect actions come from the cluster/lifecycle path.
6. Update tests for connected, disconnected, Fathom legacy, Fireflies, and Plaud states.

**Acceptance criteria:**

- Settings uses the same setup cluster as import/onboarding.
- Fathom-only code is gone from settings except adapter-specific metadata.
- Disconnect button works.

**Dependencies:** Sessions 3 and 4.

### Session 6: Import Page Migration

**Purpose:** Replace bespoke import setup panels with the cluster while preserving import workflows.

**Owned files:**

- `src/components/connectors/ConnectorImportWizard.tsx`
- `src/components/import/FirefliesImportDetail.tsx`
- `src/pages/ImportPage.tsx`
- import connector tests

**Steps:**

1. Replace `ApiKeyConnectPanel` with `ConnectorSetupCluster mode="import"`.
2. Replace Plaud setup block with the cluster's `browser_bridge` mode while preserving bridge-specific callbacks.
3. Move Fireflies setup area to the cluster.
4. Keep Fireflies search/import result list behavior intact.
5. Decide whether Fireflies can route through `ConnectorImportWizard` now or whether only its setup section is migrated first.
6. Remove duplicate setup instructions after equivalent cluster coverage exists.
7. Update tests for setup then import.

**Acceptance criteria:**

- Fireflies setup no longer has bespoke API-key/webhook field markup.
- Generic import wizard uses the same cluster for OAuth, API key, and Plaud bridge.
- Existing import/search behavior still works.

**Dependencies:** Sessions 3 and 4.

### Session 7: Onboarding Migration

**Purpose:** Replace hard-coded `/setup` connector flow with registry-driven setup.

**Owned files:**

- `src/pages/SetupWizard.tsx`
- `src/pages/Settings.tsx`
- `src/components/onboarding/OnboardingModal.tsx`
- legacy `FathomSetupWizard` and wizard step files only if retiring them is safe

**Steps:**

1. Replace hard-coded Fathom/Zoom setup cards with registry-backed connector cards.
2. Mount `ConnectorSetupCluster mode="onboarding"` for the selected connector.
3. Use shared OAuth URL handling instead of direct page calls to individual functions.
4. Remove Zoom "Coming Soon" treatment if Zoom remains active.
5. Stop Settings from auto-opening legacy `FathomSetupWizard` once cluster onboarding covers the use case.
6. Update `OnboardingModal` links so users land on the modern setup flow.
7. Quarantine or delete legacy wizard files only after imports confirm no active usage.

**Acceptance criteria:**

- New users see the same setup mechanics as existing users.
- OAuth return still completes onboarding.
- No second legacy setup wizard appears from Settings.

**Dependencies:** Sessions 3 and 4.

### Session 8: Cleanup, Test, and Review

**Purpose:** Remove duplication, verify behavior, and make the work reviewable.

**Owned files:**

- legacy setup/import files if now unused
- tests across settings/import/onboarding
- active connector docs

**Steps:**

1. Use `rg` to confirm no duplicate inline API-key/webhook setup UI remains in active surfaces.
2. Remove or quarantine unused legacy Fathom/Zoom setup files.
3. Update connector docs if behavior changed.
4. Run type-check.
5. Run focused component tests.
6. Run lint on touched files.
7. Run browser verification for Settings, Import, and Onboarding.
8. Capture remaining risks in this PRD or follow-up docs.

**Acceptance criteria:**

- Settings, Import, and Onboarding all mount the same setup cluster.
- Fathom, Zoom, Fireflies, and Plaud setup flows are covered.
- Tests and type-check pass.
- Any intentionally deferred connector gaps are documented.

### Session 9: Lock Future-Provider Template and Port Pending Branches

**Purpose:** Prevent drift by proving the new connector architecture can absorb pending providers without adding bespoke setup UI.

**Owned files:**

- `src/components/connectors/registry/types.ts`
- `src/components/connectors/registry/connectorRegistry.ts`
- `src/components/connectors/registry/adapters/read-ai.ts`
- `src/components/connectors/registry/adapters/grain.ts`
- `src/config/source-registry.ts`
- `src/pages/OAuthCallback.tsx`
- `supabase/functions/_shared/*read-ai*`
- `supabase/functions/_shared/*grain*`
- `supabase/functions/read-ai-*`
- `supabase/functions/grain-*`
- `supabase/functions/clear-failed-imports/index.ts`

**Steps:**

1. Discover unmerged connector worktrees and identify branches with unique provider code.
2. Port Read.ai and Grain from the pending branch as Beta connectors.
3. Register both adapters in the connector registry and source registry.
4. Give both providers `setup` metadata that uses the shared cluster, not provider-specific page code.
5. Add OAuth callback routes and API client methods for both providers.
6. Register all Read.ai and Grain edge functions in Supabase config.
7. Port the failed-import clearing function and hook so broken connector imports can be cleared from the shared import UI.
8. Keep Composio-specific fields out of the current schema and code paths until the Composio migration is intentionally introduced.
9. Re-run frontend type-check, adapter tests, setup-cluster tests, and edge function tests for the affected providers.

**Acceptance criteria:**

- Read.ai and Grain appear as Beta providers and follow the exact same setup surface as Fathom, Zoom, Fireflies, and Plaud.
- No new provider-specific setup page or detail panel is introduced.
- Failed import clearing is available without changing the connector setup contract.
- Current code does not require `import_sources.composio_connected_account_id`.
- Focused frontend and edge function tests pass.

## 11. Canonical Provider Template

Every new provider must fit this checklist before it is considered implementation-ready.

### Frontend Contract

1. Add the provider id to `ConnectorSourceApp` in `src/components/connectors/registry/types.ts`.
2. Create exactly one adapter at `src/components/connectors/registry/adapters/<provider>.ts`.
3. Fill `metadata` with the label, description, icon, order, auth methods, and maturity badge.
4. Fill `setup` with one of the shared setup kinds:
   - `oauth`
   - `api_key`
   - `api_key_webhook`
   - `browser_bridge`
   - `none`
5. Add adapter lifecycle methods only when the setup kind requires them:
   - OAuth: `getOAuthAuthUrl`
   - API key: `saveApiKeyCredentials`
   - Webhook: `getWebhookDetails`, `saveWebhookConfig`, `getWebhookVerification`
   - Disconnect: `disconnect`
6. Register the adapter in `connectorRegistry.ts`.
7. Add the provider to `src/config/source-registry.ts` only for list/import metadata.
8. Use `ConnectorSetupCluster` in Settings, Import, and Onboarding. Do not create provider-specific setup markup.
9. Add adapter tests and registry tests that prove the provider has setup metadata.

### Backend Contract

1. Normalize provider records through `_shared/canonical-recording.ts`.
2. Add provider source helpers in `_shared/<provider>-source.ts` if the provider needs source lookup/upsert logic.
3. Add provider API client code in `_shared/<provider>-client.ts`.
4. Add provider pipeline integration through `_shared/connector-pipeline.ts` where recordings are imported.
5. Store credentials through edge functions and encrypted helpers. Do not expose durable raw secrets to the frontend.
6. Verify user ownership before using any client-supplied `sourceId`.
7. Enforce provider URL allowlists server-side when the provider has configurable endpoints.
8. Register edge functions in `supabase/config.toml`.
9. Add edge function tests for OAuth URL/callback, token save, fetch, sync/import, and source lookup.

### UI/UX Contract

1. Connected providers collapse into the shared account summary.
2. Setup-needed, Beta, Connected, and error labels must use `StatusBadge`.
3. Webhook-capable providers show webhook URL above signing secret.
4. Webhook verification appears after saving and tells users to save first, send the provider test event, then return to CallVault.
5. Every import connector shows the shared default destination bar.
6. The provider-specific "Create <provider> workspace" action uses the shared destination component.
7. Browser bridge providers must show bridge availability, opening, waiting, connected, and timed-helper states.

## 12. Parallel Agent Work Packets

### Agent A: Adapter metadata

Own Session 1. Do not edit UI surfaces. Deliver typed setup config for every registered connector.

### Agent B: Field primitives

Own Session 2. Do not edit registry/adapters. Deliver reusable field, URL, secret, instructions, and verification components.

### Agent C: Lifecycle service

Own Session 4. Do not edit page layout. Deliver normalized save/disconnect/verification methods, including Fathom legacy disconnect.

### Agent D: Settings migration

Own Session 5 after Sessions 3 and 4 land. Do not edit Import or Onboarding.

### Agent E: Import migration

Own Session 6 after Sessions 3 and 4 land. Do not edit Settings or Onboarding.

### Agent F: Onboarding migration

Own Session 7 after Sessions 3 and 4 land. Do not edit Settings or Import except shared cluster imports.

### Agent G: Verification/review

Own Session 8. Run tests, inspect active routes, and identify duplication or regressions.

## 13. Validation Plan

Run these as applicable to each session:

```bash
npm run type-check
npx eslint src/components/connectors src/components/settings src/components/import src/pages/ImportPage.tsx src/pages/SetupWizard.tsx
npx vitest run src/components/settings/__tests__/IntegrationsTab.test.tsx
npx vitest run src/components/connectors/__tests__/ConnectorImportWizard.test.tsx
```

Additional focused tests should be added for:

- `ConnectorSetupCluster` setup kinds
- Fireflies webhook URL/secret order
- Fireflies webhook verification state
- Fathom legacy disconnect
- Plaud beta/browser-bridge state
- onboarding OAuth return behavior

Use browser verification for final UI validation across:

- `/settings?tab=integrations`
- `/import?source=fathom`
- `/import?source=zoom`
- `/import?source=fireflies`
- `/import?source=plaud`
- `/setup`

## 14. Definition of Done

- One reusable setup cluster powers Settings, Import, and Onboarding.
- Fathom, Zoom, Fireflies, and Plaud are wired into it.
- YouTube and File Upload have no-auth setup behavior defined.
- Fireflies webhook URL appears above signing secret.
- Fireflies webhook verification appears after save, not above the save action.
- Settings disconnect works.
- Plaud Beta badge is consistent.
- No active page owns custom credential/webhook layout when the cluster can provide it.
- Existing import/search behavior remains intact.
- Type-check and focused tests pass.

## 14. Session 0 Findings

Session 0 is complete when this document is committed or handed to the implementation agents.

Findings:

- Connector setup duplication is broader than three screens. Active duplication exists across Settings, Import, `/setup`, legacy Fathom setup, legacy Fathom/Zoom import details, Fireflies bespoke setup, and Plaud browser bridge setup.
- `ConnectorPanel` is a good outer shell, but it is not a complete setup system because it does not model credential/webhook forms.
- Fireflies is the richest proof case because it needs API key, webhook URL, signing secret, save, and verification.
- Fathom is the riskiest compatibility case because active state can come from legacy `user_settings`.
- Plaud is the UX edge case because browser-bridge token capture needs visible status and helper text.
- Onboarding currently contradicts the rest of the app by hard-coding Fathom/Zoom and making Zoom appear unavailable.

Recommended next move:

1. Start Sessions 1, 2, and 4 in parallel.
2. Keep Session 3 local or with one owner after adapter/field contracts are stable.
3. Migrate Settings first because it exposes the broken disconnect path.
4. Migrate Import next because Fireflies and Plaud setup are currently the most user-visible.
5. Migrate Onboarding last because it depends on stable setup behavior and OAuth return handling.
