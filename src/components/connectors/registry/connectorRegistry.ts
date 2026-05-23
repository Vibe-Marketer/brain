/**
 * Connector Registry — single source of truth for every integration in the app.
 *
 * Issue #283. To add a new source (Otter, Gong, Granola, etc.):
 *   1. Write `src/components/connectors/registry/adapters/<name>.ts`
 *      (one file, ~30 lines, follow fathom.ts / fireflies.ts as templates).
 *   2. Import it here and append to ALL_ADAPTERS.
 *   3. The new source automatically appears in every surface that consumes
 *      <ConnectorPanel /> (Settings, Import dashboard, Import detail, Setup
 *      Wizard). Zero changes to existing UI components.
 *
 * Target per issue #283 acceptance criteria:
 *   - Otter native ≤ 2 days
 *   - Gong Composio ≤ 1 day
 */

import { fathomAdapter } from "./adapters/fathom";
import { zoomAdapter } from "./adapters/zoom";
import { firefliesAdapter } from "./adapters/fireflies";
import { plaudAdapter } from "./adapters/plaud";
import { youtubeAdapter } from "./adapters/youtube";
import { fileUploadAdapter } from "./adapters/file-upload";
import type {
  ConnectorAdapter,
  ConnectorMetadata,
  ConnectorSourceApp,
} from "./types";

const ALL_ADAPTERS: readonly ConnectorAdapter[] = [
  fathomAdapter,
  zoomAdapter,
  firefliesAdapter,
  plaudAdapter,
  youtubeAdapter,
  fileUploadAdapter,
];

const ADAPTER_BY_SOURCE_APP: Record<ConnectorSourceApp, ConnectorAdapter> =
  Object.fromEntries(
    ALL_ADAPTERS.map((a) => [a.metadata.sourceApp, a]),
  ) as Record<ConnectorSourceApp, ConnectorAdapter>;

/**
 * Look up an adapter by source_app. Throws if the source is unknown — better
 * to fail loudly at consumer time than to render an empty card silently.
 */
export function getConnectorAdapter(
  sourceApp: ConnectorSourceApp,
): ConnectorAdapter {
  const adapter = ADAPTER_BY_SOURCE_APP[sourceApp];
  if (!adapter) {
    throw new Error(
      `[connectorRegistry] no adapter registered for source_app="${sourceApp}". ` +
        `Add an adapter at src/components/connectors/registry/adapters/${sourceApp}.ts ` +
        `and register it in connectorRegistry.ts.`,
    );
  }
  return adapter;
}

/** All registered adapters, ordered by ConnectorMetadata.order. */
export function listConnectorAdapters(): readonly ConnectorAdapter[] {
  return [...ALL_ADAPTERS].sort((a, b) => a.metadata.order - b.metadata.order);
}

/** All metadata only, for surfaces that don't need adapter actions. */
export function listConnectorMetadata(): readonly ConnectorMetadata[] {
  return listConnectorAdapters().map((a) => a.metadata);
}

/** Type guard for narrowing arbitrary strings to a known source. */
export function isKnownSourceApp(value: string): value is ConnectorSourceApp {
  return value in ADAPTER_BY_SOURCE_APP;
}

export type { ConnectorAdapter, ConnectorMetadata, ConnectorSourceApp };
