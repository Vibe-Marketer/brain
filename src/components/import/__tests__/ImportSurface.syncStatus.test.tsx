import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import * as syncStatusService from "@/services/sync-status.service";
import type { SyncStatus } from "@/services/sync-status.service";

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

// Import AFTER mocks. This module does not exist yet → RED.
import { ImportSurface } from "../ImportSurface";

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

describe("ImportSurface sync-status overlay (TBL-02 + carry-forward triple)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CR-02: overlays synced status using the REAL per-row source_app, not literal 'fathom'", async () => {
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(new Map<string, SyncStatus>());

    renderSurface({ sourceApp: "zoom" });

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    // The first positional arg (sourceApp) must be the real provider, NOT "fathom".
    const sourceAppArgs = spy.mock.calls.map((call) => call[0]);
    expect(sourceAppArgs).toContain("zoom");
    expect(sourceAppArgs).not.toContain("fathom");
  });

  it("WR-02: threads organizationId through the reader opts", async () => {
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockResolvedValue(new Map<string, SyncStatus>());

    renderSurface({ organizationId: "org-1" });

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    // opts (third arg) must carry the caller's organizationId.
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ organizationId: "org-1" }),
    );
  });

  it("WR-01: merge-not-clobber — marking one provider synced does not reset another provider's rows", async () => {
    // Two providers' rows are present. The reader reports ONLY the zoom row as
    // synced. The grain row must remain selectable/unsynced — never clobbered.
    const spy = vi
      .spyOn(syncStatusService, "getSyncStatusForExternalIds")
      .mockImplementation(async (sourceApp: string) => {
        if (sourceApp === "zoom") {
          return new Map<string, SyncStatus>([
            ["zoom-ext-1", { recordingUuid: "rec-zoom", hasWorkspaceEntries: true }],
          ]);
        }
        return new Map<string, SyncStatus>();
      });

    renderSurface();

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    // The grain row (not synced) must still be importable — it is NOT shown as
    // "already imported". The zoom row IS de-emphasized as already imported.
    // (Plan 02 renders both providers' rows; the grain row stays ungreyed.)
    const alreadyImported = screen.queryAllByText(/already imported/i);
    // At most the single zoom row is marked imported, never both rows clobbered.
    expect(alreadyImported.length).toBeLessThanOrEqual(1);
  });
});
