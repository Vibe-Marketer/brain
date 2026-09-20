import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchQaRuns,
  fetchLatestQaRun,
  fetchQaFindingSummary,
  fetchQaFindings,
} from "@/services/qa.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

/**
 * Chainable thenable builder — same pattern as admin-users.service.test.
 * Records the calls made against it so tests can assert table name, filters,
 * ordering, and limits without coupling to call order.
 */
function makeBuilder(response: Record<string, unknown>) {
  const calls: Record<string, unknown[][]> = {};
  const builder: Record<string, unknown> = { __calls: calls };
  for (const method of ["select", "order", "limit", "eq", "in"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      (calls[method] ??= []).push(args);
      return builder;
    });
  }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject);
  return builder;
}

function mockTable(response: Record<string, unknown>) {
  const builder = makeBuilder(response);
  vi.mocked(supabase.from).mockImplementation(((_table: string) => builder) as never);
  return builder;
}

const RUN = {
  id: "run-1",
  started_at: "2026-06-12T03:30:00Z",
  finished_at: "2026-06-12T03:35:00Z",
  status: "completed",
  routes_crawled: 12,
  findings_count: 3,
  critical_count: 1,
  report: { app_url: "https://app.callvaultai.com", findings: [] },
  triggered_by: "nightly",
};

beforeEach(() => vi.clearAllMocks());

const FINDING = {
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
};

describe("fetchQaFindings", () => {
  it("reads qa_findings filtered by lane, newest-first, within the limit", async () => {
    const builder = mockTable({ data: [FINDING], error: null });
    const rows = await fetchQaFindings({ lane: "qa_review", limit: 5 });

    expect(supabase.from).toHaveBeenCalledWith("qa_findings");
    expect(rows).toHaveLength(1);
    expect(rows[0].fingerprint).toBe("qa:home:console:abc");
    expect(rows[0].lane).toBe("qa_review");
    // lane filter applied
    expect((builder.__calls as Record<string, unknown[][]>).eq).toContainEqual(["lane", "qa_review"]);
    // ordered by last_seen_at desc
    expect((builder.__calls as Record<string, unknown[][]>).order).toContainEqual([
      "last_seen_at",
      { ascending: false },
    ]);
    // limit honored
    expect((builder.__calls as Record<string, unknown[][]>).limit).toContainEqual([5]);
  });

});

describe("fetchQaFindingSummary", () => {
  it("returns per-lane counts and the latest review rows", async () => {
    const builder = mockTable({
      data: [
        FINDING,
        { ...FINDING, fingerprint: "qa:a", lane: "quarantined" },
        { ...FINDING, fingerprint: "qa:b", lane: "promoted" },
        { ...FINDING, fingerprint: "qa:c", lane: "ignored_noise" },
        { ...FINDING, fingerprint: "qa:d", lane: "qa_review" },
      ],
      error: null,
    });

    const summary = await fetchQaFindingSummary();

    expect(supabase.from).toHaveBeenCalledWith("qa_findings");
    expect(summary.counts.qa_review).toBe(2);
    expect(summary.counts.quarantined).toBe(1);
    expect(summary.counts.promoted).toBe(1);
    expect(summary.counts.ignored_noise).toBe(1);
    // Latest review rows only contain qa_review findings.
    expect(summary.latestReview.every((f) => f.lane === "qa_review")).toBe(true);
    expect(summary.latestReview.length).toBe(2);
    // Reads are ordered newest-first.
    expect((builder.__calls as Record<string, unknown[][]>).order).toContainEqual([
      "last_seen_at",
      { ascending: false },
    ]);
  });

});
