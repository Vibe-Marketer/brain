import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// jsdom lacks matchMedia (use-mobile reads it inside an effect). Polyfill it so
// the dense table + date picker mount without throwing.
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

/**
 * Wave 0 RED scaffold — TBL-01 / BROWSE-01.
 *
 * This suite is the failing contract Plan 02 turns GREEN. It imports the
 * not-yet-existing `<ImportSurface>` from `@/components/import/ImportSurface`,
 * so it fails at module resolution today. RED is the correct, expected state
 * for this Wave 0 task.
 *
 * Contract encoded here:
 *  - TBL-01: ONE shared surface built on the dense `TranscriptTable` (reused,
 *    not a hand-rolled checkbox list — the wizard regression).
 *  - BROWSE-01: TWO stacked sections in one surface — a find-new (live provider
 *    API, selectable, `isUnsyncedView`) section ABOVE a browse-synced
 *    (de-emphasized DB archive) section. NOT two separate apps.
 *
 * The implementation does not exist yet; mocks below describe the seams Plan 02
 * will wire (adapter search + durable selection hook + sync-status overlay).
 */

// Durable selection hook (Phase 25) — the surface consumes this, never useState.
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

// Canonical sync-status overlay (Phase 24) — provider-agnostic, never per-adapter.
vi.mock("@/services/sync-status.service", () => ({
  getSyncStatusForExternalIds: vi.fn(async () => new Map()),
}));

// Provider-coupled hooks are mocked to leaves so the surface renders without the
// full Auth/Org provider tree — the contract under test is the two-section
// TranscriptTable structure, not the auth chain (mirrors the wizard test + the
// Plan 01 TranscriptTableRow stub precedent).
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
    data: {
      // One already-synced zoom row so the browse-synced dense TranscriptTable
      // renders real <table> markup (+ its header select-all checkbox) — the
      // reuse contract under test. source_platform must match the surface's
      // sourceApp (per-provider browse scoping).
      rows: [
        {
          recording_id: "rec-zoom-1",
          canonical_uuid: "rec-zoom-1",
          title: "Synced Zoom call",
          created_at: "2026-06-01T00:00:00Z",
          recording_start_time: "2026-06-01T00:00:00Z",
          source_platform: "zoom",
          synced: true,
        },
      ],
      tagAssignments: {},
      totalCount: 1,
    },
    isLoading: false,
  })),
}));

// Stub the per-row component to a minimal <tr> (Plan 01 precedent): the real
// TranscriptTableRow pulls a deep org/auth/router chain (useOrgContext →
// useNavigate). The contract here is that ImportSurface mounts the dense
// TranscriptTable (real <table> + header select-all checkbox) in two sections —
// not that a row renders its full auth-coupled UI.
vi.mock("@/components/transcript-library/TranscriptTableRow", () => ({
  TranscriptTableRow: ({ call }: { call: { recording_id: string | number } }) => (
    <tr data-testid="transcript-row">
      <td>{String(call.recording_id)}</td>
    </tr>
  ),
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

describe("ImportSurface (TBL-01 / BROWSE-01)", () => {
  it("renders two stacked sections: find-new ABOVE browse-synced", () => {
    renderSurface();

    // Find-new section heading (live provider API — slow, on top).
    const findHeading = screen.getByText(
      /available to import|new to import/i,
    );
    // Browse-synced section heading (cheap DB read — the de-emphasized archive).
    const browseHeading = screen.getByText(
      /already in your vault|synced transcripts/i,
    );

    expect(findHeading).toBeTruthy();
    expect(browseHeading).toBeTruthy();

    // Cost-class order: find-new must appear BEFORE browse-synced in the DOM.
    expect(
      findHeading.compareDocumentPosition(browseHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the dense TranscriptTable (not a hand-rolled checkbox list)", () => {
    renderSurface();
    // The dense table renders a semantic <table>. The wizard regression used a
    // <label><Checkbox/></label> list — assert the real table markup exists.
    expect(document.querySelector("table")).toBeTruthy();
  });

  it("renders the find-new section as a selectable (isUnsyncedView) table", () => {
    renderSurface();
    // The find section is selectable — it must expose at least one checkbox
    // (the select-all-matching header checkbox lives in TranscriptTable).
    const checkboxes = screen.queryAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});
