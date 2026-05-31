import { readFileSync } from "node:fs";
import type * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionsPanel } from "../ConnectionsPanel";
import type { ConnectorAccountWithWorkspace } from "@/services/import-sources.service";

vi.mock("@/hooks/useImportSources", () => ({
  useConnectorAccounts: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ConnectionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders compact connection rows with provider, account, workspace, status, and Manage", () => {
    renderConnections({
      scope: "global",
      rows: [
        makeAccount({
          id: "src_fathom",
          source_app: "fathom",
          account_email: "andrew@example.com",
          workspace_id: "ws_sales",
          workspaceName: "Sales",
        }),
      ],
    });

    const row = screen.getByText("Fathom").closest("div");
    expect(row).not.toBeNull();
    expect(screen.getByText("andrew@example.com")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^manage$/i })).toBeInTheDocument();
  });

  it("filters workspace scope to the supplied workspace and shows global rows together", () => {
    const rows = [
      makeAccount({
        id: "src_fathom",
        source_app: "fathom",
        account_email: "sales@example.com",
        workspace_id: "ws_sales",
        workspaceName: "Sales",
      }),
      makeAccount({
        id: "src_zoom",
        source_app: "zoom",
        account_email: "cs@example.com",
        workspace_id: "ws_cs",
        workspaceName: "CS",
      }),
    ];

    const { rerender } = renderConnections({
      scope: "workspace",
      workspaceId: "ws_sales",
      rows,
    });

    expect(screen.getByText("sales@example.com")).toBeInTheDocument();
    expect(screen.queryByText("cs@example.com")).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ConnectionsPanel scope="global" rows={rows} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("sales@example.com")).toBeInTheDocument();
    expect(screen.getByText("cs@example.com")).toBeInTheDocument();
  });

  it("surfaces PLAUD bridge management copy", () => {
    renderConnections({
      scope: "global",
      rows: [
        makeAccount({
          id: "src_plaud",
          source_app: "plaud",
          account_email: "plaud@example.com",
          workspace_id: "ws_sales",
          workspaceName: "Sales",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /manage bridge/i }));

    expect(screen.getByText("Plaud connection")).toBeInTheDocument();
    expect(screen.getAllByText("Manage bridge").length).toBeGreaterThan(0);
  });

  it("distinguishes passive and action-needed lifecycle states", () => {
    renderConnections({
      scope: "global",
      rows: [
        makeAccount({
          id: "src_rate",
          source_app: "fathom",
          account_email: "rate@example.com",
          connection_metadata: { status: "rate_limited" },
        }),
        makeAccount({
          id: "src_partial",
          source_app: "zoom",
          account_email: "partial@example.com",
          connection_metadata: { status: "partial_sync" },
        }),
        makeAccount({
          id: "src_reconnect",
          source_app: "read-ai",
          account_email: "reconnect@example.com",
          error_message: "OAuth refresh failed",
        }),
      ],
    });

    expect(screen.getByText("Rate limited")).toBeInTheDocument();
    expect(screen.getByText("Partial sync")).toBeInTheDocument();
    expect(screen.getByText("Reconnect required")).toBeInTheDocument();

    const reconnectRow = screen
      .getByText("reconnect@example.com")
      .closest("div");
    expect(reconnectRow).not.toBeNull();
    fireEvent.click(
      within(reconnectRow!.parentElement!.parentElement!).getByRole("button", {
        name: /^manage$/i,
      }),
    );
    expect(screen.getByText("Change future landing workspace")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
    expect(screen.getByText("Reconnect")).toBeInTheDocument();
  });

  it("keeps Import provider cards setup-first instead of adding management controls", () => {
    const source = readFileSync(
      "src/components/connectors/ConnectorPanel.tsx",
      "utf8",
    );

    expect(source).not.toContain("ConnectorManageDialog");
    expect(source).not.toContain("Change future landing workspace");
    expect(source).not.toContain("onDisconnect");
  });
});

function renderConnections(props: React.ComponentProps<typeof ConnectionsPanel>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectionsPanel {...props} />
    </QueryClientProvider>,
  );
}

function makeAccount(
  overrides: Partial<ConnectorAccountWithWorkspace>,
): ConnectorAccountWithWorkspace {
  return {
    id: "src_default",
    user_id: "user_1",
    source_app: "fathom",
    is_active: true,
    account_email: "account@example.com",
    last_sync_at: null,
    error_message: null,
    workspace_id: "ws_sales",
    workspaceName: "Sales",
    connection_metadata: null,
    webhook_path_token: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}
