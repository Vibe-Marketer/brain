import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { searchAllAvailableConnectorCalls } from "@/components/connectors/connectorSearch";

// jsdom lacks matchMedia (use-mobile reads it). Polyfill so the surface mounts.
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

import * as syncStatusService from "@/services/sync-status.service";
import type { SyncStatus } from "@/services/sync-status.service";

import { overlaySyncStatus } from "../importSurfaceSyncStatus";

/**
 * Wave 0 RED scaffold — TBL-02 + the Phase 24 carry-forward triple.
 *
 * This suite is the failing contract Plan 02 turns GREEN. It imports the
 * not-yet-existing `<ImportSurface>` so it fails at module resolution today;
 * RED is the correct, expected state for this Wave 0 task.
 *
 * Encodes three deferred carry-forward defects from
 * .planning/phases/24-sync-status-foundation/deferred-items.md:
 *  - CR-02: the surface calls getSyncStatusForExternalIds with the REAL per-row
 *    `source_app` (e.g. "zoom"), NOT the literal "fathom" SyncTab hardcoded.
 *  - WR-02: the surface threads `organizationId` through opts so it cannot read
 *    another org's synced status.
 *  - WR-01: merge-not-clobber — marking one provider's row synced must NOT reset
 *    another provider's rows back to unsynced (the bridge force-set bug).
 *
 * External ids stay opaque TEXT end to end — never numerically coerced.
 */

// Durable selection hook (Phase 25) — surface consumes this, never useState.
vi.mock("@/hooks/useImportSelection", () => ({
  useImportSelection: vi.fn(() => ({
    scopeKey: "zoom::*::*",
    toggle: vi.fn(),
    selectAllMatching: vi.fn(),
    clearAllMatching: vi.fn(),
    clearSelection: vi.fn(),
    isSelected: vi.fn(() => false),
    count: 0,
    reconcile: vi.fn(async () => {}),
    useReconcileOnIds: vi.fn(),
  })),
}));

// Provider-coupled hooks mocked to leaves so the surface renders without the
// full Auth/Org/Router tree — the contract under test is the synced-status
// overlay wiring, not the auth chain.
vi.mock("@/components/connectors/hooks/useConnector", () => ({
  useConnector: vi.fn(() => ({
    status: {
      connected: true,
      sourceId: "src-1",
      accountEmail: "user@example.com",
      workspaceId: null,
      workspaceName: null,
      lastSyncAt: null,
      allRows: [],
    },
    isLoading: false,
    error: null,
    refresh: vi.fn(async () => {}),
  })),
  invalidateConnectorQueries: vi.fn(async () => {}),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useOrganizationWorkspaces: vi.fn(() => ({
    workspaces: [{ id: "ws-1", name: "Workspace 1" }],
    isLoading: false,
    error: null,
  })),
  useWorkspaces: vi.fn(() => ({ workspaces: [], isLoading: false })),
}));

vi.mock("@/hooks/useExistingTranscripts", () => ({
  useExistingTranscripts: vi.fn(() => ({
    data: { rows: [], tagAssignments: {}, totalCount: 0 },
    isLoading: false,
  })),
}));

// Auto-paged provider search — mocked so a search returns deterministic rows.
vi.mock("@/components/connectors/connectorSearch", () => ({
  searchAllAvailableConnectorCalls: vi.fn(async () => []),
  appendUniqueAvailableCalls: (a: unknown[], b: unknown[]) => [...a, ...b],
}));

// DateRangePicker mocked (wizard-test precedent): a single button that applies a
// valid range on click, so the Search button enables without driving the popover.
vi.mock("@/components/ui/date-range-picker", () => ({
  DateRangePicker: ({
    onDateRangeChange,
  }: {
    onDateRangeChange: (r: { from?: Date; to?: Date }) => void;
  }) => (
    <button
      type="button"
      data-testid="apply-date-range"
      onClick={() =>
        onDateRangeChange({
          from: new Date("2026-06-01T00:00:00Z"),
          to: new Date("2026-06-30T00:00:00Z"),
        })
      }
    >
      pick dates
    </button>
  ),
}));

// Minimal row stub (Plan 01 precedent): real TranscriptTableRow pulls a deep
// org/auth/router chain. The overlay contract does not require the full row UI.
vi.mock("@/components/transcript-library/TranscriptTableRow", () => ({
  TranscriptTableRow: ({
    call,
  }: {
    call: { recording_id: string | number; synced?: boolean };
  }) => (
    <tr data-testid="transcript-row">
      <td>{String(call.recording_id)}</td>
      {call.synced ? <td>(already imported)</td> : null}
    </tr>
  ),
}));

// Import AFTER mocks. This module does not exist yet → RED.
import { ImportSurface } from "../ImportSurface";

const searchMock = vi.mocked(searchAllAvailableConnectorCalls);

/** Apply a date range then fire Search so the find-new overlay runs. */
function runSearch() {
  fireEvent.click(screen.getByTestId("apply-date-range"));
  fireEvent.click(screen.getByRole("button", { name: /search/i }));
}

function renderSurface(props?: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ImportSurface
        sourceApp="zoom"
        sourceId="zoom"
        workspaceId="ws-1"
        organizationId="org-1"
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("overlaySyncStatus helper (TBL-02 + carry-forward triple, unit)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CR-02: calls the reader with each row's REAL source_app, never literal 'fathom'", async () => {
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(new Map<string, SyncStatus>());

    await overlaySyncStatus(
      [
        { externalId: "zoom-ext-1", sourceApp: "zoom" },
        { externalId: "grain-ext-1", sourceApp: "grain" },
      ],
      { organizationId: "org-1" },
    );

    const sourceAppArgs = spy.mock.calls.map((call) => call[0]);
    expect(sourceAppArgs).toContain("zoom");
    expect(sourceAppArgs).toContain("grain");
    expect(sourceAppArgs).not.toContain("fathom");
  });

  it("WR-02: threads organizationId through the reader opts for every provider group", async () => {
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(new Map<string, SyncStatus>());

    await overlaySyncStatus([{ externalId: "zoom-ext-1", sourceApp: "zoom" }], {
      organizationId: "org-1",
    });

    expect(spy).toHaveBeenCalledWith(
      "zoom",
      ["zoom-ext-1"],
      expect.objectContaining({ organizationId: "org-1" }),
    );
  });

  it("WR-01: merge-not-clobber — a hit in one provider never resets another provider's rows", async () => {
    vi.spyOn(syncStatusService, "getSyncStatusForExternalIds").mockImplementation(
      async (sourceApp: string) => {
        if (sourceApp === "zoom") {
          return new Map<string, SyncStatus>([
            [
              "zoom-ext-1",
              { recordingUuid: "rec-zoom", hasWorkspaceEntries: true },
            ],
          ]);
        }
        // grain returns nothing synced
        return new Map<string, SyncStatus>();
      },
    );

    const imported = await overlaySyncStatus(
      [
        { externalId: "zoom-ext-1", sourceApp: "zoom" },
        { externalId: "grain-ext-1", sourceApp: "grain" },
      ],
      { organizationId: "org-1" },
    );

    // Only the zoom row is imported; the grain row is NOT clobbered to imported.
    expect(imported.has("zoom-ext-1")).toBe(true);
    expect(imported.has("grain-ext-1")).toBe(false);
    expect(imported.size).toBe(1);
  });

  it("does NOT mark a row imported when it exists but has no workspace entries (re-importable)", async () => {
    vi.spyOn(syncStatusService, "getSyncStatusForExternalIds").mockResolvedValue(
      new Map<string, SyncStatus>([
        ["zoom-ext-1", { recordingUuid: "rec-zoom", hasWorkspaceEntries: false }],
      ]),
    );

    const imported = await overlaySyncStatus(
      [{ externalId: "zoom-ext-1", sourceApp: "zoom" }],
      { organizationId: "org-1" },
    );

    expect(imported.has("zoom-ext-1")).toBe(false);
  });

  it("fail-open: empty input marks nothing imported and never calls the reader", async () => {
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(new Map<string, SyncStatus>());

    const imported = await overlaySyncStatus([], { organizationId: "org-1" });

    expect(imported.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("ImportSurface sync-status overlay (TBL-02 + carry-forward triple)", () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it("CR-02: overlays synced status using the REAL per-row source_app, not literal 'fathom'", async () => {
    searchMock.mockResolvedValue([
      {
        externalId: "zoom-ext-1",
        title: "Zoom call 1",
        startTime: "2026-06-02T00:00:00Z",
        durationSeconds: 600,
        alreadyImported: false,
      },
    ]);
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(new Map<string, SyncStatus>());

    renderSurface({ sourceApp: "zoom" });
    runSearch();

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    // The first positional arg (sourceApp) must be the real provider, NOT "fathom".
    const sourceAppArgs = spy.mock.calls.map((call) => call[0]);
    expect(sourceAppArgs).toContain("zoom");
    expect(sourceAppArgs).not.toContain("fathom");
  });

  it("WR-02: threads organizationId through the reader opts", async () => {
    searchMock.mockResolvedValue([
      {
        externalId: "zoom-ext-1",
        title: "Zoom call 1",
        startTime: "2026-06-02T00:00:00Z",
        durationSeconds: 600,
        alreadyImported: false,
      },
    ]);
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(new Map<string, SyncStatus>());

    renderSurface({ organizationId: "org-1" });
    runSearch();

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    // opts (third arg) must carry the caller's organizationId.
    expect(spy).toHaveBeenCalledWith(
      "zoom",
      expect.arrayContaining(["zoom-ext-1"]),
      expect.objectContaining({ organizationId: "org-1" }),
    );
  });

  it("WR-01: merge-not-clobber — a synced row does not flip an unsynced row in the same find list", async () => {
    // Two rows in the find list. The reader reports ONLY the first as synced
    // (with workspace entries). The second row must stay ungreyed — never
    // clobbered to "already imported" by the other row's hit.
    searchMock.mockResolvedValue([
      {
        externalId: "zoom-ext-1",
        title: "Zoom call 1",
        startTime: "2026-06-02T00:00:00Z",
        durationSeconds: 600,
        alreadyImported: false,
      },
      {
        externalId: "zoom-ext-2",
        title: "Zoom call 2",
        startTime: "2026-06-03T00:00:00Z",
        durationSeconds: 600,
        alreadyImported: false,
      },
    ]);
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(
        new Map<string, SyncStatus>([
          [
            "zoom-ext-1",
            { recordingUuid: "rec-zoom", hasWorkspaceEntries: true },
          ],
        ]),
      );

    renderSurface();
    runSearch();

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    // Exactly one row is marked imported — the other is never clobbered.
    await waitFor(() => {
      const alreadyImported = screen.queryAllByText(/already imported/i);
      expect(alreadyImported.length).toBe(1);
    });
  });
});
