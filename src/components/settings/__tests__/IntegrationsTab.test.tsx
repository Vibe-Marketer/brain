/**
 * IntegrationsTab — Settings → Integrations tab wiring
 *
 * Verifies:
 *   - Smoke test: tab renders without crashing
 *   - Uses shared IntegrationManager (same code path as ImportPage)
 *   - Credential section is gated on Fathom connection state
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";

// ─── Mocks (must come before IntegrationsTab import) ─────────────────────────

const mockUseIntegrationSync = vi.fn(() => ({
  integrations: [] as Array<{
    platform: string;
    connected: boolean;
    email?: string;
  }>,
  isLoading: false,
  refreshIntegrations: vi.fn(),
  triggerManualSync: vi.fn(),
}));

vi.mock("@/hooks/useIntegrationSync", () => ({
  useIntegrationSync: () => mockUseIntegrationSync(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  getSafeUser: () =>
    Promise.resolve({ user: { id: "test-user" }, error: null }),
}));

vi.mock("@/components/shared/IntegrationManager", () => ({
  IntegrationManager: ({ variant }: { variant?: string }) => (
    <div data-testid="integration-manager" data-variant={variant} />
  ),
}));

vi.mock("@/lib/api-client", () => ({
  getFathomOAuthUrl: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import IntegrationsTab from "../IntegrationsTab";

beforeEach(() => {
  mockUseIntegrationSync.mockReturnValue({
    integrations: [],
    isLoading: false,
    refreshIntegrations: vi.fn(),
    triggerManualSync: vi.fn(),
  });
});

describe("IntegrationsTab", () => {
  it("renders without crashing", () => {
    render(<IntegrationsTab />);
    // Smoke: header text exists
    expect(screen.getByText("Integrations")).toBeInTheDocument();
  });

  it("renders IntegrationManager with full variant (shared code path)", () => {
    render(<IntegrationsTab />);
    const manager = screen.getByTestId("integration-manager");
    expect(manager).toBeInTheDocument();
    expect(manager.getAttribute("data-variant")).toBe("full");
  });

  it("hides Fathom credential section when Fathom is not connected", async () => {
    render(<IntegrationsTab />);
    // Flush microtask queue so the credential-loading useEffect settles
    await new Promise((r) => setTimeout(r, 0));
    expect(
      screen.queryByText("Manage Fathom Connection"),
    ).not.toBeInTheDocument();
  });

  it("shows Fathom credential section when Fathom is connected", async () => {
    mockUseIntegrationSync.mockReturnValue({
      integrations: [
        { platform: "fathom", connected: true, email: "test@example.com" },
      ],
      isLoading: false,
      refreshIntegrations: vi.fn(),
      triggerManualSync: vi.fn(),
    });
    render(<IntegrationsTab />);
    // loadCredentialSettings is async and toggles hasCredentialsLoaded; wait
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByText("Manage Fathom Connection")).toBeInTheDocument();
  });
});
