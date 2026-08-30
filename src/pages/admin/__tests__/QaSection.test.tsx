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

  it("shows the empty state when there are no runs", () => {
    mockRuns([]);
    render(<QaSection />);
    expect(screen.getByText(/no qa runs recorded/i)).toBeTruthy();
  });

  it("renders the run history when runs exist", () => {
    mockRuns([
      makeRun({ id: "r1", routes_crawled: 20, findings_count: 4, critical_count: 2 }),
      makeRun({ id: "r2", routes_crawled: 18, findings_count: 1, critical_count: 0 }),
    ]);
    render(<QaSection />);

    expect(screen.getByText("Run History")).toBeTruthy();
    // Latest run's routes_crawled surfaced as the top row.
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
    expect(screen.getByText(/\/home/)).toBeTruthy();
  });

  it("renders the error state", () => {
    mockRuns(undefined, { error: new Error("boom") });
    render(<QaSection />);
    expect(screen.getByText(/qa runs failed to load/i)).toBeTruthy();
  });

  describe("triage / review-lane audit block", () => {
    it("does not render the triage block when there is nothing to audit", () => {
      mockRuns([makeRun({})]);
      mockSummary(EMPTY_SUMMARY);
      render(<QaSection />);
      expect(screen.queryByText(/triage/i)).toBeNull();
    });

    it("renders plain-English lane counts for quarantined, review, and promoted", () => {
      mockRuns([makeRun({})]);
      mockSummary({
        counts: { quarantined: 4, qa_review: 3, promoted: 2, ignored_noise: 1 },
        latestReview: [makeFinding()],
      });
      render(<QaSection />);

      // Plain operational labels, not raw lane enums. ("Needs review" appears
      // both as a count tile and on the review-row status badge.)
      expect(screen.getByText("Quarantined")).toBeTruthy();
      expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0);
      expect(screen.getByText("Promoted")).toBeTruthy();
      // Counts surfaced. (Digits can recur across tiles/badges, so assert presence.)
      expect(screen.getAllByText("4").length).toBeGreaterThan(0);
      expect(screen.getAllByText("3").length).toBeGreaterThan(0);
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    });

    it("lists the latest review rows with route, occurrence count, and a concise reason", () => {
      mockRuns([makeRun({})]);
      mockSummary({
        counts: { quarantined: 0, qa_review: 1, promoted: 0, ignored_noise: 0 },
        latestReview: [
          makeFinding({
            route: "/calls",
            severity: "high",
            occurrence_count: 5,
            finding_type: "console_error",
          }),
        ],
      });
      render(<QaSection />);

      expect(screen.getByText(/\/calls/)).toBeTruthy();
      // occurrence count shown exactly (not a substring of a timestamp)
      expect(screen.getByText("5")).toBeTruthy();
      // concise reason in plain English, not the raw finding_type enum
      expect(screen.getByText(/Error on the page/i)).toBeTruthy();
      expect(screen.queryByText("console_error")).toBeNull();
    });

    it("never leaks raw lane enum strings into the UI", () => {
      mockRuns([makeRun({})]);
      mockSummary({
        counts: { quarantined: 1, qa_review: 1, promoted: 1, ignored_noise: 1 },
        latestReview: [makeFinding({ lane: "qa_review" })],
      });
      render(<QaSection />);

      expect(screen.queryByText("qa_review")).toBeNull();
      expect(screen.queryByText("quarantined")).toBeNull();
      expect(screen.queryByText("ignored_noise")).toBeNull();
    });
  });
});
