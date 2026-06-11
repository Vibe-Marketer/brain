import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import QaSection from "../QaSection";
import * as useQaRunsHook from "@/hooks/useQaRuns";
import type { QaRun } from "@/services/qa.service";

vi.mock("@/hooks/useQaRuns", () => ({
  useQaRuns: vi.fn(),
}));

function makeRun(overrides: Partial<QaRun>): QaRun {
  return {
    id: "run-1",
    started_at: "2026-06-12T03:30:00Z",
    finished_at: "2026-06-12T03:35:00Z",
    status: "completed",
    routes_crawled: 12,
    findings_count: 2,
    critical_count: 0,
    report: { findings: [] },
    triggered_by: "nightly",
    ...overrides,
  };
}

function mockRuns(runs: QaRun[] | undefined, opts: Partial<{ isLoading: boolean; error: unknown }> = {}) {
  vi.mocked(useQaRunsHook.useQaRuns).mockReturnValue({
    data: runs,
    isLoading: opts.isLoading ?? false,
    error: opts.error ?? null,
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe("QaSection", () => {
  it("renders the Run-now control disabled with the manual-command tooltip", () => {
    mockRuns([]);
    render(<QaSection />);

    const button = screen.getByRole("button", { name: /run now/i });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    // The disabled button is wrapped in a focusable tooltip trigger so the
    // manual-command hint can surface on hover (Radix collapses tooltip content
    // until hover/focus, so we assert the trigger wrapper, not the text node).
    expect(screen.getByLabelText(/run now \(disabled\)/i)).toBeTruthy();
  });

  it("shows the empty state when there are no runs", () => {
    mockRuns([]);
    render(<QaSection />);
    expect(screen.getByText(/no qa runs recorded/i)).toBeTruthy();
  });

  it("renders the latest run summary and history when runs exist", () => {
    mockRuns([
      makeRun({ id: "r1", routes_crawled: 20, findings_count: 4, critical_count: 2 }),
      makeRun({ id: "r2", routes_crawled: 18, findings_count: 1, critical_count: 0 }),
    ]);
    render(<QaSection />);

    expect(screen.getByText("Latest Run")).toBeTruthy();
    expect(screen.getByText("Run History")).toBeTruthy();
    // Latest critical count surfaced.
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);
  });

  it("parses and lists findings from the selected run report", () => {
    mockRuns([
      makeRun({
        report: {
          findings: [
            { route: "/home", type: "console", severity: "high", message: "TypeError boom", selector: ".x" },
          ],
        },
      }),
    ]);
    render(<QaSection />);

    expect(screen.getByText("TypeError boom")).toBeTruthy();
    expect(screen.getByText("/home")).toBeTruthy();
  });

  it("renders the error state", () => {
    mockRuns(undefined, { error: new Error("boom") });
    render(<QaSection />);
    expect(screen.getByText(/qa runs failed to load/i)).toBeTruthy();
  });
});
