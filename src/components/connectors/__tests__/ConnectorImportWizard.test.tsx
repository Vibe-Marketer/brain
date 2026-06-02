import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectorAdapter } from "../registry/types";
import { useOrgContextStore } from "@/stores/orgContextStore";

const searchAvailable = vi.fn();
const importSelected = vi.fn();
const saveApiKeyCredentials = vi.fn();
const getConnectorAdapter = vi.fn();
const useConnector = vi.fn();
const invalidateConnectorQueries = vi.fn();
const useOrganizationContext = vi.fn();
const useOrgContext = vi.fn();
const useWorkspaces = vi.fn();
const useOrganizationWorkspaces = vi.fn();
const useRoutingDefault = vi.fn();
const useUpsertRoutingDefault = vi.fn();
const useCreateWorkspace = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: ({
    onDateRangeChange,
    disabled,
  }: {
    onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        onDateRangeChange({
          from: new Date("2026-05-01T00:00:00Z"),
          to: new Date("2026-05-02T23:59:59Z"),
        })
      }
    >
      Set date range
    </button>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    disabled,
    onCheckedChange,
    "aria-label": ariaLabel,
  }: {
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange?: () => void;
    "aria-label"?: string;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={() => onCheckedChange?.()}
      readOnly
    />
  ),
}));

vi.mock("@/components/import/DefaultDestinationBar", () => ({
  DefaultDestinationBar: () => (
    <div data-testid="default-destination-bar">Destination</div>
  ),
}));

vi.mock("../registry/connectorRegistry", () => ({
  getConnectorAdapter: (...args: unknown[]) => getConnectorAdapter(...args),
}));

vi.mock("../hooks/useConnector", () => ({
  useConnector: (...args: unknown[]) => useConnector(...args),
  invalidateConnectorQueries: (...args: unknown[]) =>
    invalidateConnectorQueries(...args),
}));

vi.mock("@/hooks/useOrganizationContext", () => ({
  useOrganizationContext: () => useOrganizationContext(),
}));

vi.mock("@/hooks/useOrgContext", () => ({
  useOrgContext: () => useOrgContext(),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useWorkspaces: (...args: unknown[]) => useWorkspaces(...args),
  useOrganizationWorkspaces: (...args: unknown[]) =>
    useOrganizationWorkspaces(...args),
}));

vi.mock("@/hooks/useRoutingRules", () => ({
  useRoutingDefault: (...args: unknown[]) => useRoutingDefault(...args),
  useUpsertRoutingDefault: (...args: unknown[]) => useUpsertRoutingDefault(...args),
}));

vi.mock("@/hooks/useWorkspaceMutations", () => ({
  useCreateWorkspace: () => useCreateWorkspace(),
}));

import { ConnectorImportWizard } from "../ConnectorImportWizard";

function makeAdapter(overrides: Partial<ConnectorAdapter> = {}): ConnectorAdapter {
  return {
    metadata: {
      sourceApp: "fathom",
      label: "Fathom",
      description: "Fathom calls",
      icon: () => null,
      authMethods: ["api_key"],
      order: 1,
    },
    setup: {
      kind: "api_key",
      credentialFields: [
        {
          name: "apiKey",
          label: "Fathom API key",
          required: true,
          secret: true,
          placeholder: "Fathom API key",
        },
      ],
    },
    searchAvailable,
    importSelected,
    saveApiKeyCredentials,
    ...overrides,
  };
}

function renderWizard(props: Partial<React.ComponentProps<typeof ConnectorImportWizard>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectorImportWizard sourceApp="fathom" {...props} />
    </QueryClientProvider>,
  );
}

describe("ConnectorImportWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__callvaultPlaudConnector;
    delete window.__openplaudConnector;
    useOrgContextStore.setState({
      activeOrgId: "org-1",
      activeWorkspaceId: null,
      activeFolderId: null,
      isSharedView: false,
      isInitialized: true,
    });
    getConnectorAdapter.mockReturnValue(makeAdapter());
    useConnector.mockReturnValue({
      status: {
        connected: true,
        sourceId: "source-1",
      },
      refresh: vi.fn(),
    });
    useOrganizationContext.mockReturnValue({ activeOrgId: "org-1" });
    useOrgContext.mockReturnValue({
      activeOrgId: "org-1",
      activeWorkspaceId: "workspace-1",
      activeFolderId: null,
      setActiveOrgId: vi.fn(),
      setActiveWorkspaceId: vi.fn(),
      setActiveFolderId: vi.fn(),
      refreshContext: vi.fn(),
    });
    useWorkspaces.mockReturnValue({
      workspaces: [
        { id: "workspace-1", name: "Sales" },
        { id: "workspace-2", name: "Support" },
      ],
      isLoading: false,
      error: null,
    });
    useOrganizationWorkspaces.mockReturnValue({
      workspaces: [
        { id: "workspace-1", name: "Sales" },
        { id: "workspace-2", name: "Support" },
      ],
      isLoading: false,
      error: null,
    });
    useRoutingDefault.mockReturnValue({
      data: null,
      isLoading: false,
    });
    useUpsertRoutingDefault.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    searchAvailable.mockResolvedValue({ items: [], nextCursor: null });
    importSelected.mockResolvedValue({ jobId: "job-1", total: 1 });
    saveApiKeyCredentials.mockResolvedValue({ sourceId: "source-1" });
    invalidateConnectorQueries.mockResolvedValue(undefined);
  });

  it("loads workspace options for the active organization", async () => {
    searchAvailable.mockResolvedValueOnce({
      items: [
        {
          externalId: "call-1",
          title: "Pipeline review",
          startTime: "2026-05-01T12:00:00Z",
          durationSeconds: 1800,
          alreadyImported: false,
        },
      ],
      nextCursor: null,
    });

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));

    expect(await screen.findByLabelText("Destination workspace")).toBeInTheDocument();
    expect(useWorkspaces).toHaveBeenCalledWith("org-1");
    expect(screen.getAllByRole("option", { name: "Sales" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: "Support" }).length).toBeGreaterThan(0);
  });

  it("collapses setup when the connector is already connected", () => {
    useConnector.mockReturnValue({
      status: {
        connected: true,
        sourceId: "source-1",
        accountEmail: "owner@example.com",
        workspaceId: "workspace-1",
        workspaceName: "Sales",
      },
      refresh: vi.fn(),
    });

    renderWizard();

    expect(screen.getByText("Fathom connected")).toBeInTheDocument();
    expect(screen.getByText(/owner@example\.com .* Future imports: Sales/)).toBeInTheDocument();
    expect(screen.queryByText("Connect account")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/future landing workspace/i)).not.toBeInTheDocument();
  });

  it("passes nextCursor when loading more and appends the new page", async () => {
    searchAvailable
      .mockResolvedValueOnce({
        items: [
          {
            externalId: "call-1",
            title: "First page call",
            startTime: "2026-05-01T12:00:00Z",
            durationSeconds: 1200,
            alreadyImported: false,
          },
        ],
        nextCursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        items: [
          {
            externalId: "call-2",
            title: "Second page call",
            startTime: "2026-05-02T12:00:00Z",
            durationSeconds: 900,
            alreadyImported: false,
          },
        ],
        nextCursor: null,
      });

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));

    expect(await screen.findByText("First page call")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(searchAvailable).toHaveBeenCalledTimes(2);
    });
    expect(searchAvailable).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: "cursor-2" }),
    );
    expect(await screen.findByText("Second page call")).toBeInTheDocument();
  });

  it("keeps already imported calls disabled and excludes them from import", async () => {
    searchAvailable.mockResolvedValueOnce({
      items: [
        {
          externalId: "imported-call",
          title: "Already here",
          startTime: "2026-05-01T12:00:00Z",
          durationSeconds: 1200,
          alreadyImported: true,
        },
        {
          externalId: "new-call",
          title: "New call",
          startTime: "2026-05-01T13:00:00Z",
          durationSeconds: 900,
          alreadyImported: false,
        },
      ],
      nextCursor: null,
    });

    renderWizard({ initialWorkspaceId: "workspace-1" });

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));

    const importedCheckbox = await screen.findByLabelText("Select Already here");
    expect(importedCheckbox).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    fireEvent.click(screen.getByRole("button", { name: /sync all/i }));

    await waitFor(() => {
      expect(importSelected).toHaveBeenCalledWith({
        sourceId: "source-1",
        externalIds: ["new-call"],
        workspaceId: "workspace-1",
      });
    });
  });

  it("disables import until an available workspace is selected", async () => {
    searchAvailable.mockResolvedValueOnce({
      items: [
        {
          externalId: "call-1",
          title: "Ready call",
          startTime: "2026-05-01T12:00:00Z",
          durationSeconds: 1200,
          alreadyImported: false,
        },
      ],
      nextCursor: null,
    });

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));
    fireEvent.click(await screen.findByLabelText("Select Ready call"));

    const importButton = screen.getByRole("button", { name: /sync all/i });
    expect(importButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Destination workspace"), {
      target: { value: "workspace-2" },
    });

    expect(importButton).not.toBeDisabled();
  });

  it("saves API-key credentials for disconnected Fireflies", async () => {
    const refresh = vi.fn();
    getConnectorAdapter.mockReturnValue(
      makeAdapter({
        metadata: {
          sourceApp: "fireflies",
          label: "Fireflies",
          description: "Transcript API import",
          icon: () => null,
          authMethods: ["api_key", "webhook_only"],
          order: 30,
        },
        setup: {
          kind: "api_key_webhook",
          credentialFields: [
            {
              name: "apiKey",
              label: "Fireflies API key",
              required: true,
              secret: true,
              placeholder: "Fireflies API key",
            },
            {
              name: "webhookSecret",
              label: "Webhook signing secret",
              secret: true,
              placeholder: "Optional webhook signing secret",
            },
          ],
        },
      }),
    );
    useConnector.mockReturnValue({
      status: {
        connected: false,
        sourceId: null,
      },
      refresh,
    });

    renderWizard({ sourceApp: "fireflies" });

    fireEvent.change(screen.getByPlaceholderText("Fireflies API key"), {
      target: { value: "ff-key" },
    });
    fireEvent.change(screen.getByPlaceholderText("Optional webhook signing secret"), {
      target: { value: "secret-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save connection/i }));

    await waitFor(() => {
      expect(saveApiKeyCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "ff-key",
          webhookSecret: "secret-1",
          accountEmail: undefined,
        }),
      );
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("uses the selected connected account source id for search and import", async () => {
    useConnector.mockReturnValue({
      status: {
        connected: true,
        sourceId: "source-1",
        allRows: [
          {
            id: "source-1",
            is_active: true,
            account_email: "first@example.com",
          },
          {
            id: "source-2",
            is_active: true,
            account_email: "second@example.com",
          },
        ],
      },
      refresh: vi.fn(),
    });
    searchAvailable.mockResolvedValueOnce({
      items: [
        {
          externalId: "call-1",
          title: "Second account call",
          startTime: "2026-05-01T12:00:00Z",
          durationSeconds: 1200,
          alreadyImported: false,
        },
      ],
      nextCursor: null,
    });

    renderWizard({ initialWorkspaceId: "workspace-1" });

    fireEvent.change(screen.getByLabelText("Connected account"), {
      target: { value: "source-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));
    fireEvent.click(await screen.findByLabelText("Select Second account call"));
    fireEvent.click(screen.getByRole("button", { name: /sync selected \(1\)/i }));

    await waitFor(() => {
      expect(searchAvailable).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: "source-2" }),
      );
      expect(importSelected).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: "source-2" }),
      );
    });
  });

  it("clears stale search results when switching connected accounts", async () => {
    useConnector.mockReturnValue({
      status: {
        connected: true,
        sourceId: "source-1",
        allRows: [
          {
            id: "source-1",
            is_active: true,
            account_email: "first@example.com",
          },
          {
            id: "source-2",
            is_active: true,
            account_email: "second@example.com",
          },
        ],
      },
      refresh: vi.fn(),
    });
    searchAvailable.mockResolvedValueOnce({
      items: [
        {
          externalId: "call-1",
          title: "First account call",
          startTime: "2026-05-01T12:00:00Z",
          durationSeconds: 1200,
          alreadyImported: false,
        },
      ],
      nextCursor: "cursor-2",
    });

    renderWizard({ initialWorkspaceId: "workspace-1" });

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));

    expect(await screen.findByText("First account call")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Connected account"), {
      target: { value: "source-2" },
    });

    await waitFor(() => {
      expect(screen.queryByText("First account call")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Destination workspace")).not.toBeInTheDocument();
  });

  it("clears stale search results when changing the date range", async () => {
    searchAvailable.mockResolvedValueOnce({
      items: [
        {
          externalId: "call-1",
          title: "Previous date call",
          startTime: "2026-05-01T12:00:00Z",
          durationSeconds: 1200,
          alreadyImported: false,
        },
      ],
      nextCursor: null,
    });

    renderWizard({ initialWorkspaceId: "workspace-1" });

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));
    expect(await screen.findByText("Previous date call")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));

    await waitFor(() => {
      expect(screen.queryByText("Previous date call")).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Destination workspace")).not.toBeInTheDocument();
  });

  it("shows Load more even when the current Plaud page has no matching results", async () => {
    searchAvailable.mockResolvedValueOnce({
      items: [],
      nextCursor: "cursor-2",
    });

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /set date range/i }));
    fireEvent.click(screen.getByRole("button", { name: /search fathom/i }));

    expect(await screen.findByText("No calls found for that date range.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("shows the Plaud browser-token connection flow when Plaud is disconnected", async () => {
    const refresh = vi.fn();
    getConnectorAdapter.mockReturnValue(
      makeAdapter({
        metadata: {
          sourceApp: "plaud",
          label: "Plaud",
          description: "AI voice recorder",
          icon: () => null,
          authMethods: ["api_key"],
          order: 40,
        },
        setup: makePlaudSetup(),
      }),
    );
    useConnector.mockReturnValue({
      status: {
        connected: false,
        sourceId: null,
      },
      refresh,
    });

    renderWizard({ sourceApp: "plaud" });

    expect(
      screen.getByText("Connect with Plaud Web token"),
    ).toBeInTheDocument();
    expect(screen.getByText("Plaud connector not detected")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open plaud web only/i }),
    ).toHaveAttribute("href", "https://web.plaud.ai");
    expect(
      screen.getByRole("link", { name: /download bridge/i }),
    ).toHaveAttribute("href", "/downloads/callvault-plaud-connector.zip");
    expect(screen.getByText("Bridge Beta")).toBeInTheDocument();
    expect(screen.getByText("Latest v0.1.2")).toBeInTheDocument();
    expect(screen.getByText("1. Download Bridge.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/paste the plaud bearer token/i), {
      target: { value: "header.payload.signature" },
    });
    fireEvent.change(screen.getByLabelText("Plaud region"), {
      target: { value: "https://api-euc1.plaud.ai" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save plaud connection/i }));

    await waitFor(() => {
      expect(saveApiKeyCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "header.payload.signature",
          apiBase: "https://api-euc1.plaud.ai",
        }),
      );
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("uses the CallVault Plaud browser connector when the extension bridge is present", async () => {
    const refresh = vi.fn();
    let resolveSave: (value: { sourceId: string }) => void = () => undefined;
    saveApiKeyCredentials.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    window.__callvaultPlaudConnector = {
      version: "0.1.2",
      connect: vi.fn().mockResolvedValue({
        accessToken: "header.payload.signature",
        apiBase: "https://api-apse1.plaud.ai",
      }),
    };
    getConnectorAdapter.mockReturnValue(
      makeAdapter({
        metadata: {
          sourceApp: "plaud",
          label: "Plaud",
          description: "AI voice recorder",
          icon: () => null,
          authMethods: ["api_key"],
          order: 40,
        },
        setup: makePlaudSetup(),
      }),
    );
    useConnector.mockReturnValue({
      status: {
        connected: false,
        sourceId: null,
      },
      refresh,
    });

    renderWizard({ sourceApp: "plaud" });

    expect(screen.getByText("Plaud connector ready (v0.1.2)")).toBeInTheDocument();
    expect(screen.getByText("Installed v0.1.2")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /^connect plaud$/i }));

    expect(await screen.findByText("Saving Plaud connection")).toBeInTheDocument();
    await waitFor(() => {
      expect(saveApiKeyCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "header.payload.signature",
          apiBase: "https://api-apse1.plaud.ai",
        }),
      );
    });
    resolveSave({ sourceId: "source-1" });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });
});

function makePlaudSetup(): ConnectorAdapter["setup"] {
  return {
    kind: "browser_bridge",
    beta: true,
    credentialFields: [
      {
        name: "apiKey",
        label: "Plaud Web token",
        required: true,
        secret: true,
        placeholder: "Paste the Plaud Bearer token from Plaud Web",
      },
      {
        name: "apiBase",
        label: "Plaud region",
        required: true,
        placeholder: "https://api.plaud.ai",
        options: [
          { label: "Global", value: "https://api.plaud.ai" },
          { label: "Europe", value: "https://api-euc1.plaud.ai" },
          { label: "Asia Pacific", value: "https://api-apse1.plaud.ai" },
        ],
      },
    ],
    helperCopy: {
      disconnected: "Use the CallVault Plaud Connector browser bridge.",
    },
  };
}
