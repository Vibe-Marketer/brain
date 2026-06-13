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

describe("fetchQaRuns", () => {
  it("returns rows newest-first within the limit", async () => {
    mockTable({ data: [RUN], error: null });
    const runs = await fetchQaRuns(20);
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe("run-1");
    expect(runs[0].critical_count).toBe(1);
    expect(supabase.from).toHaveBeenCalledWith("qa_runs");
  });

  it("returns [] when the table is empty", async () => {
    mockTable({ data: [], error: null });
    expect(await fetchQaRuns()).toEqual([]);
  });

  it("throws on a query error", async () => {
    mockTable({ data: null, error: { message: "rls denied" } });
    await expect(fetchQaRuns()).rejects.toMatchObject({ message: "rls denied" });
  });
});

describe("fetchLatestQaRun", () => {
  it("returns the single newest run", async () => {
    mockTable({ data: [RUN], error: null });
    const latest = await fetchLatestQaRun();
    expect(latest?.id).toBe("run-1");
  });

  it("returns null when no runs exist", async () => {
    mockTable({ data: [], error: null });
    expect(await fetchLatestQaRun()).toBeNull();
  });
});

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

  it("returns [] when there are no findings in the lane", async () => {
    mockTable({ data: [], error: null });
    expect(await fetchQaFindings({ lane: "quarantined" })).toEqual([]);
  });

  it("throws when the query errors", async () => {
    mockTable({ data: null, error: { message: "rls denied" } });
    await expect(fetchQaFindings({ lane: "promoted" })).rejects.toMatchObject({
      message: "rls denied",
    });
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

  it("returns zeroed counts and no review rows on an empty table", async () => {
    mockTable({ data: [], error: null });
    const summary = await fetchQaFindingSummary();
    expect(summary.counts).toEqual({
      quarantined: 0,
      qa_review: 0,
      promoted: 0,
      ignored_noise: 0,
    });
    expect(summary.latestReview).toEqual([]);
  });

  it("throws when the summary query errors", async () => {
    mockTable({ data: null, error: { message: "boom" } });
    await expect(fetchQaFindingSummary()).rejects.toMatchObject({ message: "boom" });
  });
});
