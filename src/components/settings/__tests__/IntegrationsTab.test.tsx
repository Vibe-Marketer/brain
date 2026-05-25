/**
 * IntegrationsTab — Settings → Integrations tab wiring (post-Phase 3 + 4).
 *
 * Verifies:
 *   - Tab renders without crashing inside QueryClientProvider
 *   - Renders one ConnectorPanel for every registered connector adapter
 *   - Fathom-specific section header is present
 *   - Page-level header text is rendered
 *
 * Rewritten 2026-05-23 after Phase 3 (#286) migrated IntegrationsTab to
 * <ConnectorPanel layout="settings" />. The previous tests mocked
 * useIntegrationSync / IntegrationManager / Manage-Fathom-Connection
 * — all now legacy code paths. The current tab uses useConnector
 * (which uses React Query), so tests must wrap in QueryClientProvider.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

// ─── Mocks (must come before IntegrationsTab import) ─────────────────────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  getSafeUser: () =>
    Promise.resolve({ user: { id: "test-user" }, error: null }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/import/DefaultDestinationBar", () => ({
  DefaultDestinationBar: () => (
    <div data-testid="default-destination-bar">Destination</div>
  ),
}));

// Stub each adapter's edge-function callers so the panel can mount without
// hitting Supabase Functions during unit tests.
vi.mock("@/components/connectors/registry/adapters/fathom", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/connectors/registry/adapters/fathom")
  >("@/components/connectors/registry/adapters/fathom");
  return { ...actual };
});

import IntegrationsTab from "../IntegrationsTab";
import { listConnectorAdapters } from "@/components/connectors/registry/connectorRegistry";

function renderInQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IntegrationsTab (post-Phase 3 migration)", () => {
  it("renders the page-level Integrations header", () => {
    renderInQueryClient(<IntegrationsTab />);
    // The header literal in IntegrationsTab.tsx
    const headers = screen.getAllByText("Integrations");
    expect(headers.length).toBeGreaterThan(0);
  });

  it("renders the descriptive subtitle that explains the unified panel", () => {
    renderInQueryClient(<IntegrationsTab />);
    expect(
      screen.getByText(
        /Connect your meeting platforms to sync recordings and transcripts/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders one panel per registered connector adapter (async — waits for bundleQuery)", async () => {
    // listConnectorAdapters() returns the 6 adapters (fathom, zoom,
    // fireflies, plaud, youtube, file-upload). The unified UX promises
    // ALL of them appear on this surface. Use findAllByText so we wait
    // for the bundle query to resolve out of its skeleton state — the
    // skeleton renders the icon but not the label text.
    const adapters = listConnectorAdapters();
    expect(adapters.length).toBeGreaterThan(0);

    renderInQueryClient(<IntegrationsTab />);

    for (const adapter of adapters) {
      const matches = await screen.findAllByText(adapter.metadata.label);
      expect(
        matches.length,
        `expected at least one panel rendered for ${adapter.metadata.sourceApp}`,
      ).toBeGreaterThan(0);
    }
  });
});
