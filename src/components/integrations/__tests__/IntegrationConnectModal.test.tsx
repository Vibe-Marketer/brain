import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IntegrationConnectModal } from "../IntegrationConnectModal";

const mocks = vi.hoisted(() => ({
  closeModal: vi.fn(),
  disconnect: vi.fn(),
  invalidateConnectorQueries: vi.fn(),
  invalidateQueries: vi.fn(),
}));

function TestIcon({ className }: { className?: string }) {
  return <span className={className} data-testid="integration-icon" />;
}

vi.mock("@/stores/integrationModalStore", () => ({
  useIntegrationModalStore: () => ({
    isOpen: true,
    platform: "grain",
    closeModal: mocks.closeModal,
  }),
}));

vi.mock("@/hooks/useIntegrationSync", () => ({
  useIntegrationSync: () => ({
    integrations: [
      {
        platform: "grain",
        connected: true,
        lastSyncAt: null,
        syncStatus: "idle",
        email: "andrew@aisimple.co",
        sourceId: "src_grain_1",
      },
    ],
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({
      id: "query-client",
      invalidateQueries: mocks.invalidateQueries,
    }),
  };
});

vi.mock("@/components/connectors/hooks/useConnector", () => ({
  invalidateConnectorQueries: mocks.invalidateConnectorQueries,
}));

vi.mock("@/components/connectors/registry/connectorRegistry", () => ({
  getConnectorAdapter: (platform: string) => ({
    metadata: {
      sourceApp: platform,
      label: "Grain",
      description: "AI meeting recordings and transcripts",
      icon: TestIcon,
      authMethods: ["oauth"],
      order: 1,
    },
    setup: { kind: "oauth" },
    searchAvailable: vi.fn(),
    importSelected: vi.fn(),
    disconnect: mocks.disconnect,
  }),
  listConnectorAdapters: () => [
    {
      metadata: {
        sourceApp: "grain",
        label: "Grain",
        description: "AI meeting recordings and transcripts",
        icon: TestIcon,
        authMethods: ["oauth"],
        order: 1,
      },
      setup: { kind: "oauth" },
      searchAvailable: vi.fn(),
      importSelected: vi.fn(),
      disconnect: mocks.disconnect,
    },
  ],
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("IntegrationConnectModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.disconnect.mockResolvedValue(undefined);
    mocks.invalidateConnectorQueries.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it("disconnects the connected source row instead of the whole source app", async () => {
    render(
      <MemoryRouter>
        <IntegrationConnectModal />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(mocks.disconnect).toHaveBeenCalledWith("src_grain_1");
    });
    expect(mocks.closeModal).toHaveBeenCalled();
  });

  it("invalidates shared connector status after disconnect", async () => {
    render(
      <MemoryRouter>
        <IntegrationConnectModal />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(mocks.invalidateConnectorQueries).toHaveBeenCalledWith(
        { id: "query-client", invalidateQueries: mocks.invalidateQueries },
        "grain",
      );
    });
  });

  it("invalidates the integrations snapshot cache on disconnect (single invalidate, no double-refresh)", async () => {
    render(
      <MemoryRouter>
        <IntegrationConnectModal />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["integrations", "statuses"],
      });
    });
  });
});
