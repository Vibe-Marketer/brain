import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorSetupCluster } from "../ConnectorSetupCluster";
import type {
  ConnectorAdapter,
  ConnectorSourceApp,
  ConnectorStatus,
} from "../../registry/types";

const toastError = vi.fn();
const toastSuccess = vi.fn();
const refresh = vi.fn();
const windowOpen = vi.fn();

function TestIcon({ className }: { className?: string }) {
  return <span className={className} data-testid="connector-icon" />;
}

const zoomGetOAuthAuthUrl = vi.fn();
const firefliesSaveApiKeyCredentials = vi.fn();
const firefliesGetWebhookDetails = vi.fn();
const firefliesGetWebhookVerification = vi.fn();
const firefliesDisconnect = vi.fn();
const plaudSaveApiKeyCredentials = vi.fn();

const adapters: Record<ConnectorSourceApp, ConnectorAdapter> = {
  zoom: {
    metadata: {
      sourceApp: "zoom",
      label: "Zoom",
      description: "Cloud recordings",
      icon: TestIcon,
      authMethods: ["oauth"],
      order: 1,
    },
    setup: {
      kind: "oauth",
      helperCopy: {
        disconnected: "Connect Zoom to import cloud recordings.",
        connected: "Zoom is connected.",
      },
    },
    getOAuthAuthUrl: zoomGetOAuthAuthUrl,
  },
  fireflies: {
    metadata: {
      sourceApp: "fireflies",
      label: "Fireflies",
      description: "Transcript API import",
      icon: TestIcon,
      authMethods: ["api_key", "webhook_only"],
      order: 2,
    },
    setup: {
      kind: "api_key_webhook",
      credentialFields: [
        {
          name: "apiKey",
          label: "Fireflies API key",
          required: true,
          secret: true,
          placeholder: "Your Fireflies API key",
        },
      ],
      webhook: {
        required: true,
        providerLabel: "Fireflies",
        urlLabel: "Webhook URL for Fireflies",
        signingSecretLabel: "Webhook signing secret",
        signingSecretField: "webhookSecret",
        destinationPath: "fireflies-webhook",
        verification: {
          required: true,
          lastVerifiedAtField: "lastVerifiedAt",
          lastMessageField: "lastMessage",
        },
      },
      helperCopy: {
        disconnected: "Paste a Fireflies API key.",
        saveSuccess: "Fireflies settings saved.",
      },
    },
    saveApiKeyCredentials: firefliesSaveApiKeyCredentials,
    getWebhookDetails: firefliesGetWebhookDetails,
    getWebhookVerification: firefliesGetWebhookVerification,
    disconnect: firefliesDisconnect,
  },
  fathom: mockNoAuthAdapter("fathom", "Fathom", 3),
  plaud: {
    metadata: {
      sourceApp: "plaud",
      label: "Plaud",
      description: "AI voice recorder",
      icon: TestIcon,
      authMethods: ["api_key"],
      order: 4,
      badge: "beta",
    },
    setup: {
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
          ],
        },
      ],
      helperCopy: {
        disconnected: "Use the CallVault Plaud Connector browser bridge.",
      },
    },
    saveApiKeyCredentials: plaudSaveApiKeyCredentials,
  },
  youtube: mockNoAuthAdapter("youtube", "YouTube", 5),
  "file-upload": mockNoAuthAdapter("file-upload", "File Upload", 6),
};

let currentStatus: ConnectorStatus | null = null;
let currentLoading = false;

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("../../hooks/useConnector", () => ({
  useConnector: (sourceApp: ConnectorSourceApp) => ({
    status: currentStatus ?? makeStatus(sourceApp, false),
    isLoading: currentLoading,
    error: null,
    refresh,
  }),
}));

vi.mock("../../registry/connectorRegistry", () => ({
  getConnectorAdapter: (sourceApp: ConnectorSourceApp) => adapters[sourceApp],
}));

vi.mock("@/components/import/DefaultDestinationBar", () => ({
  DefaultDestinationBar: () => (
    <div data-testid="default-destination-bar">Destination</div>
  ),
}));

describe("ConnectorSetupCluster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLoading = false;
    currentStatus = null;
    zoomGetOAuthAuthUrl.mockResolvedValue({
      authUrl: "https://zoom.example/oauth",
      sourceId: "src_zoom",
    });
    firefliesSaveApiKeyCredentials.mockResolvedValue({
      sourceId: "src_fireflies",
      webhookSigningSecret: "generated-secret",
      webhookPathToken: "ffwh_123",
    });
    firefliesGetWebhookDetails.mockResolvedValue({
      webhookSigningSecret: "saved-secret",
      webhookPathToken: "ffwh_saved",
      verification: {
        verified: true,
        lastVerifiedAt: "2026-05-25T12:00:00Z",
        lastMessage: "Fireflies webhook received",
      },
    });
    firefliesGetWebhookVerification.mockResolvedValue({
      verified: true,
      lastVerifiedAt: new Date().toISOString(),
      lastMessage: "Fireflies webhook received",
    });
    Object.defineProperty(window, "open", {
      configurable: true,
      value: windowOpen,
    });
  });

  it("starts OAuth setup through the adapter", async () => {
    render(<ConnectorSetupCluster sourceApp="zoom" mode="settings" />);

    fireEvent.click(screen.getByRole("button", { name: /connect zoom/i }));

    await waitFor(() => expect(zoomGetOAuthAuthUrl).toHaveBeenCalled());
    expect(windowOpen).toHaveBeenCalledWith(
      "https://zoom.example/oauth",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("saves API-key webhook credentials through the adapter", async () => {
    const onSaved = vi.fn();
    render(
      <ConnectorSetupCluster
        sourceApp="fireflies"
        mode="import"
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("Fireflies API key"), {
      target: { value: "ff-api-key" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save connection/i }));

    await waitFor(() =>
      expect(firefliesSaveApiKeyCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "ff-api-key" }),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith("src_fireflies");
    expect(toastSuccess).toHaveBeenCalledWith("Fireflies settings saved.");
  });

  it("loads connected webhook details and shows verification state", async () => {
    currentStatus = makeStatus("fireflies", true, {
      sourceId: "src_fireflies",
      accountEmail: "owner@example.com",
    });

    render(<ConnectorSetupCluster sourceApp="fireflies" mode="settings" />);

    await waitFor(() =>
      expect(firefliesGetWebhookDetails).toHaveBeenCalledWith({
        sourceId: "src_fireflies",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /reconnect/i }));

    expect(
      screen.getByDisplayValue(/fireflies-webhook\/ffwh_saved$/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
  });

  it("does not render a duplicate generic connect button for Plaud bridge setup", () => {
    render(<ConnectorSetupCluster sourceApp="plaud" mode="settings" />);

    expect(
      screen.queryByRole("button", { name: /^connect plaud$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with plaud/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open plaud web/i }),
    ).toBeInTheDocument();
  });
});

function makeStatus(
  sourceApp: ConnectorSourceApp,
  connected: boolean,
  overrides: Partial<ConnectorStatus> = {},
): ConnectorStatus {
  return {
    sourceApp,
    connected,
    hasEverConnected: connected,
    accountEmail: null,
    lastSyncAt: null,
    tokenExpiresMs: null,
    tokenExpired: false,
    errorMessage: null,
    sourceId: connected ? `src_${sourceApp}` : null,
    allRows: [],
    ...overrides,
  };
}

function mockNoAuthAdapter(
  sourceApp: ConnectorSourceApp,
  label: string,
  order: number,
): ConnectorAdapter {
  return {
    metadata: {
      sourceApp,
      label,
      description: `${label} setup`,
      icon: TestIcon,
      authMethods: ["none"],
      order,
    },
    setup: {
      kind: "none",
    },
  };
}
