import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectorAdapter } from "../registry/types";

const searchAvailable = vi.fn();
const importSelected = vi.fn();
const saveApiKeyCredentials = vi.fn();
const getConnectorAdapter = vi.fn();
const useConnector = vi.fn();
const useOrganizationContext = vi.fn();
const useWorkspaces = vi.fn();
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

vi.mock("../ConnectorPanel", () => ({
  ConnectorPanel: ({ sourceApp }: { sourceApp: string }) => (
    <div>Connector panel: {sourceApp}</div>
  ),
}));

vi.mock("../registry/connectorRegistry", () => ({
  getConnectorAdapter: (...args: unknown[]) => getConnectorAdapter(...args),
}));

vi.mock("../hooks/useConnector", () => ({
  useConnector: (...args: unknown[]) => useConnector(...args),
}));

vi.mock("@/hooks/useOrganizationContext", () => ({
  useOrganizationContext: () => useOrganizationContext(),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useWorkspaces: (...args: unknown[]) => useWorkspaces(...args),
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
    getConnectorAdapter.mockReturnValue(makeAdapter());
    useConnector.mockReturnValue({
      status: {
        connected: true,
        sourceId: "source-1",
      },
      refresh: vi.fn(),
    });
    useOrganizationContext.mockReturnValue({ activeOrgId: "org-1" });
    useWorkspaces.mockReturnValue({
      workspaces: [
        { id: "workspace-1", name: "Sales" },
        { id: "workspace-2", name: "Support" },
      ],
      isLoading: false,
      error: null,
    });
    searchAvailable.mockResolvedValue({ items: [], nextCursor: null });
    importSelected.mockResolvedValue({ jobId: "job-1", total: 1 });
    saveApiKeyCredentials.mockResolvedValue({ sourceId: "source-1" });
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
    expect(screen.getByRole("option", { name: "Sales" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Support" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /import 1 call/i }));

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

    const importButton = screen.getByRole("button", { name: /import 1 call/i });
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
      expect(saveApiKeyCredentials).toHaveBeenCalledWith({
        apiKey: "ff-key",
        webhookSecret: "secret-1",
        accountEmail: undefined,
      });
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
    fireEvent.click(screen.getByRole("button", { name: /import 1 call/i }));

    await waitFor(() => {
      expect(searchAvailable).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: "source-2" }),
      );
      expect(importSelected).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: "source-2" }),
      );
    });
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
    expect(
      screen.getByRole("link", { name: /open plaud web/i }),
    ).toHaveAttribute("href", "https://web.plaud.ai");

    fireEvent.change(screen.getByPlaceholderText(/paste the plaud bearer token/i), {
      target: { value: "header.payload.signature" },
    });
    fireEvent.change(screen.getByLabelText("Plaud region"), {
      target: { value: "https://api-euc1.plaud.ai" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save plaud connection/i }));

    await waitFor(() => {
      expect(saveApiKeyCredentials).toHaveBeenCalledWith({
        apiKey: "header.payload.signature",
        apiBase: "https://api-euc1.plaud.ai",
      });
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("uses the CallVault Plaud browser connector when the extension bridge is present", async () => {
    const refresh = vi.fn();
    window.__callvaultPlaudConnector = {
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

    fireEvent.click(await screen.findByRole("button", { name: /continue with plaud/i }));

    await waitFor(() => {
      expect(saveApiKeyCredentials).toHaveBeenCalledWith({
        apiKey: "header.payload.signature",
        apiBase: "https://api-apse1.plaud.ai",
      });
    });
    expect(refresh).toHaveBeenCalled();
  });
});
