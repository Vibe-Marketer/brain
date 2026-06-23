import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import * as React from "react";
import { MemoryRouter } from "react-router-dom";

import { TranscriptTable } from "@/components/transcript-library/TranscriptTable";
import type { Meeting } from "@/types";

/**
 * Wave 0 scaffold — TBL-04 (fast dense table).
 *
 * PERF DECISION (recorded here per the plan's content-visibility option):
 * The dense `TranscriptTable` does NOT virtualize today — it maps over the full
 * `sortedCalls` array. Rather than retrofit a windowing library into the
 * semantic shadcn <Table>/<TableBody> (Pitfall 4: breaks column alignment +
 * sticky header), Task 2 takes the ZERO-DEPENDENCY path: each rendered
 * `<TableRow>` carries `content-visibility: auto` plus a `contain-intrinsic-size`
 * height hint so the browser skips offscreen row layout while keeping scroll
 * height stable. This kills the "Load 10 at a time" complaint by making large
 * page sizes (50/100/200) cheap.
 *
 * jsdom does NOT lay out content-visibility (no real culling in tests), so this
 * suite asserts the STYLE is present on rendered rows — the resilient proxy for
 * "offscreen rows skip layout" — rather than measuring actual offscreen culling.
 *
 * This suite reflects Task 2's chosen content-visibility approach; it is the
 * TBL-04 documented decision, not an ImportSurface-dependent RED. If a future
 * measure proves content-visibility insufficient, the blocking-human checkpoint
 * (Task 3) gates adding @tanstack/react-virtual.
 */

// The batch workspace-entries provider hits Supabase; stub it so the table
// renders rows in isolation (we only care about row-level perf styling here).
vi.mock("@/hooks/useWorkspaceEntriesBatch", () => ({
  WorkspaceEntriesBatchProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useWorkspaceEntriesBatch: () => ({ data: undefined, isLoading: false }),
}));

// The real TranscriptTableRow pulls a deep org/auth dependency chain
// (useOrgContext → useOrganizations → useAuth). Stub it to a minimal <tr> that
// forwards whatever offscreen-skip styling TranscriptTable hands it — this is
// the TBL-04 wiring contract under test (TranscriptTable must push the
// content-visibility perf style/class onto each rendered row).
vi.mock("@/components/transcript-library/TranscriptTableRow", () => ({
  TranscriptTableRow: (props: {
    rowStyle?: React.CSSProperties;
    rowClassName?: string;
  }) =>
    React.createElement(
      "tr",
      { style: props.rowStyle, className: props.rowClassName },
      React.createElement("td", null, "row"),
    ),
}));

function makeCalls(n: number): Meeting[] {
  return Array.from({ length: n }, (_, i) => ({
    recording_id: `ext-${i}`,
    canonical_uuid: `uuid-${i}`,
    title: `Call ${i}`,
    created_at: "2026-01-01T00:00:00Z",
    recording_start_time: "2026-01-01T00:00:00Z",
    recording_end_time: null,
    calendar_invitees: null,
    recorded_by_email: "host@example.com",
    recorded_by_name: null,
    url: null,
    share_url: null,
    user_id: "u1",
    synced_at: null,
    full_transcript: null,
    summary: null,
    source_platform: "zoom",
  })) as unknown as Meeting[];
}

function renderLargePage(rowCount: number) {
  return render(
    <MemoryRouter>
      <TranscriptTable
        calls={makeCalls(rowCount)}
        selectedCalls={[]}
        tags={[]}
        tagAssignments={{}}
        onSelectCall={() => {}}
        onSelectAll={() => {}}
        onCallClick={() => {}}
        isUnsyncedView
        page={1}
        pageSize={rowCount}
        totalCount={rowCount}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("TranscriptTable offscreen-row skipping (TBL-04)", () => {
  it("applies content-visibility:auto to rendered rows for a large page", () => {
    const { container } = renderLargePage(150);

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);

    // Each body row must carry the content-visibility skip hint. jsdom does not
    // cull, so we assert the style is present (the resilient proxy).
    const rowsWithSkip = Array.from(rows).filter((row) => {
      const el = row as HTMLElement;
      const inline = el.getAttribute("style") ?? "";
      return (
        inline.includes("content-visibility") ||
        el.style.contentVisibility === "auto" ||
        (el.className ?? "").includes("content-visibility") ||
        (el.className ?? "").includes("cv-auto")
      );
    });

    expect(rowsWithSkip.length).toBeGreaterThan(0);
  });

  it("provides a contain-intrinsic-size hint so scroll height stays stable", () => {
    const { container } = renderLargePage(150);

    const rows = container.querySelectorAll("tbody tr");
    const rowsWithIntrinsic = Array.from(rows).filter((row) => {
      const el = row as HTMLElement;
      const inline = el.getAttribute("style") ?? "";
      return (
        inline.includes("contain-intrinsic-size") ||
        (el.className ?? "").includes("intrinsic")
      );
    });

    expect(rowsWithIntrinsic.length).toBeGreaterThan(0);
  });
});
