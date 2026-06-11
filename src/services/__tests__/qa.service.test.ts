import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchQaRuns, fetchLatestQaRun } from "@/services/qa.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

/** Chainable thenable builder — same pattern as admin-users.service.test. */
function makeBuilder(response: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject);
  return builder;
}

function mockTable(response: Record<string, unknown>) {
  vi.mocked(supabase.from).mockImplementation(((_table: string) =>
    makeBuilder(response)) as never);
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
