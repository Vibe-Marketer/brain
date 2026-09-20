import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import QaSection from "../QaSection";
import * as useQaRunsHook from "@/hooks/useQaRuns";
import type { QaRun, QaFinding, QaFindingSummary } from "@/services/qa.service";

vi.mock("@/hooks/useQaRuns", () => ({
  useQaRuns: vi.fn(),
  useRequestQaRun: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQaFindingSummary: vi.fn(),
}));

function makeFinding(overrides: Partial<QaFinding> = {}): QaFinding {
  return {
    fingerprint: "qa:home:console:abc",
    lane: "qa_review",
    severity: "high",
    route: "/home",
    selector: ".missing-button",
    finding_type: "console_error",
    message: "TypeError: cannot read x of undefined",
    first_seen_at: "2026-06-11T03:30:00Z",
    last_seen_at: "2026-06-12T03:30:00Z",
    occurrence_count: 2,
    consecutive_nightly_count: 2,
    repro_attempts: [],
    last_qa_run_id: "run-1",
    promoted_ticket_id: null,
    context: {},
    created_at: "2026-06-11T03:30:00Z",
    updated_at: "2026-06-12T03:30:00Z",
    ...overrides,
  };
}

function mockSummary(
  summary: QaFindingSummary | undefined,
  opts: Partial<{ isLoading: boolean; error: unknown }> = {},
) {
  vi.mocked(useQaRunsHook.useQaFindingSummary).mockReturnValue({
    data: summary,
    isLoading: opts.isLoading ?? false,
    error: opts.error ?? null,
  } as never);
}

const EMPTY_SUMMARY: QaFindingSummary = {
  counts: { quarantined: 0, qa_review: 0, promoted: 0, ignored_noise: 0 },
  latestReview: [],
};

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

beforeEach(() => {
  vi.clearAllMocks();
  // Default: an empty findings summary so existing run-focused tests render.
  mockSummary(EMPTY_SUMMARY);
});

describe("QaSection", () => {
  it("renders an enabled Request-scan control that queues a run", () => {
    const mutate = vi.fn();
    vi.mocked(useQaRunsHook.useRequestQaRun).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useQaRunsHook.useRequestQaRun>);
    mockRuns([]);
    render(<QaSection />);

    const button = screen.getByRole("button", { name: /run scan now/i });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(false);
    button.click();
    expect(mutate).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText(/\/home/)).toBeTruthy();
  });

});
