/**
 * Integration test for ConnectionHealthGate — the login-time popup wiring.
 *
 * Proves the seams the unit test can't: the gate opens the dialog when a
 * source needs attention, "Review connections" routes to the reconnect page
 * and closes, healthy accounts render nothing, and the session dedupe stops it
 * re-nagging on remount.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { ConnectorStatus } from "../registry/types";

const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigateMock }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

let healthReturn: {
  needsAttention: ConnectorStatus[];
  isFetched: boolean;
  isLoading: boolean;
};
vi.mock("../hooks/useConnector", () => ({
  useConnectionHealth: () => healthReturn,
}));

import { ConnectionHealthGate } from "../ConnectionHealthGate";

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

function brokenStatus(overrides: Partial<ConnectorStatus> = {}): ConnectorStatus {
  return {
    sourceApp: "fathom",
    connected: false,
    hasEverConnected: true,
    accountEmail: "andrew@aisimple.co",
    lastSyncAt: null,
    tokenExpiresMs: null,
    tokenExpired: true,
    errorMessage: "Reconnect required",
    sourceId: "src-1",
    workspaceId: null,
    workspaceName: null,
    lifecycleStatus: "reconnect_required",
    statusLabel: "Reconnect required",
    actionNeeded: true,
    retryAfter: null,
    allRows: [],
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
  navigateMock.mockClear();
  sessionStorage.clear();
  healthReturn = {
    needsAttention: [brokenStatus()],
    isFetched: true,
    isLoading: false,
  };
});

// The gate delays its auto-open (see OPEN_DELAY_MS in ConnectionHealthGate)
// so the popup doesn't steal the very first click on a freshly-painted page.
async function waitForDialogOpen() {
  await waitFor(
    () =>
      expect(
        screen.getByTestId("connection-health-dialog"),
      ).toBeInTheDocument(),
    { timeout: 2000 },
  );
}

describe("ConnectionHealthGate", () => {
  it("does not steal the first paint — dialog is absent immediately after mount", () => {
    render(<ConnectionHealthGate />);
    expect(
      screen.queryByTestId("connection-health-dialog"),
    ).not.toBeInTheDocument();
  });

  it("opens the popup and shows the broken source", async () => {
    render(<ConnectionHealthGate />);
    await waitForDialogOpen();
    expect(screen.getByText("andrew@aisimple.co")).toBeInTheDocument();
    expect(screen.getByText("Reconnect required")).toBeInTheDocument();
  });

  it("'Review connections' routes to /settings/integrations and closes", async () => {
    render(<ConnectionHealthGate />);
    await waitForDialogOpen();
    fireEvent.click(screen.getByTestId("connection-health-fix-now"));
    expect(navigateMock).toHaveBeenCalledWith("/settings/integrations");
    await waitFor(() =>
      expect(
        screen.queryByTestId("connection-health-dialog"),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders nothing when every connection is healthy", () => {
    healthReturn = { needsAttention: [], isFetched: true, isLoading: false };
    const { container } = render(<ConnectionHealthGate />);
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByTestId("connection-health-dialog"),
    ).not.toBeInTheDocument();
  });

  it("does not re-nag on remount once shown this session", async () => {
    const first = render(<ConnectionHealthGate />);
    await waitForDialogOpen();
    first.unmount();

    render(<ConnectionHealthGate />);
    // Session flag was set on first show → stays closed on the second mount.
    await waitFor(() =>
      expect(
        screen.queryByTestId("connection-health-dialog"),
      ).not.toBeInTheDocument(),
    );
  });
});
