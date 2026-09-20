import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchDashboardStats,
  fetchRunnerRuns,
  fetchRunnerRunsForTicket,
  fetchRunnerCard,
  demoteAutopilotCategory,
  formatSurvivalRate,
  formatTicketSourceCycleTime,
  formatTicketSourceFixRate,
  getAutopilotTrustMetrics,
  getTicketSourceMetrics,
  getRunnerState,
  isRunnerOffline,
  promoteAutopilotCategory,
  requeueTicketForAgent,
  setFixAgent,
  setKillSwitch,
  tagNeedsYou,
  needsYouQueue,
  RUNNER_STALE_MS,
  TicketKnownUnfixableError,
} from "@/services/admin-dashboard.service";
import { supabase } from "@/integrations/supabase/client";
import type { TicketRow } from "@/services/tickets.service";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

/**
 * Chainable thenable builder: every query method returns the builder, and
 * awaiting it resolves the next queued response for that table.
 */
function makeBuilder(responses: Array<Record<string, unknown>>) {
  let call = 0;
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "gte",
    "in",
    "order",
    "limit",
    "update",
    "maybeSingle",
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    const response = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return Promise.resolve(response).then(resolve, reject);
  };
  return builder;
}

function mockTables(tables: Record<string, Array<Record<string, unknown>>>) {
  const builders = new Map<string, ReturnType<typeof makeBuilder>>();
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    if (!builders.has(table)) {
      builders.set(
        table,
        makeBuilder(tables[table] ?? [{ data: [], count: 0, error: null }])
      );
    }
    return builders.get(table);
  }) as never);
}

function mockRpc(response: Record<string, unknown>) {
  vi.mocked(supabase.rpc).mockResolvedValue(response as never);
}

function mockInvoke(response: Record<string, unknown>) {
  vi.mocked(supabase.functions.invoke).mockResolvedValue(response as never);
}

function makeTicket(overrides: Partial<TicketRow>): TicketRow {
  return {
    id: "t1",
    reporter_id: "u1",
    type: "bug",
    severity: "medium",
    status: "new",
    source: "manual",
    fingerprint: null,
    context: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as TicketRow;
}

describe("tagNeedsYou", () => {
  const now = new Date("2026-06-11T12:00:00Z");

  it("tags awaiting_approval tickets", () => {
    const items = tagNeedsYou(
      [makeTicket({ id: "a", status: "awaiting_approval" })],
      now
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("awaiting_approval");
  });

  it("tags escalated tickets", () => {
    const items = tagNeedsYou([makeTicket({ id: "b", status: "escalated" })], now);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("escalated");
  });

  it("tags critical tickets older than 24h in an active status", () => {
    const old = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const items = tagNeedsYou(
      [makeTicket({ id: "c", severity: "critical", status: "new", created_at: old })],
      now
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("critical_aging");
  });

  it("does NOT tag a fresh critical ticket", () => {
    const fresh = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
    const items = tagNeedsYou(
      [makeTicket({ severity: "critical", status: "new", created_at: fresh })],
      now
    );
    expect(items).toHaveLength(0);
  });

  it("does NOT tag resolved or rejected tickets", () => {
    const old = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const items = tagNeedsYou(
      [
        makeTicket({ id: "r1", severity: "critical", status: "resolved", created_at: old }),
        makeTicket({ id: "r2", severity: "critical", status: "rejected", created_at: old }),
      ],
      now
    );
    expect(items).toHaveLength(0);
  });

  it("gives a ticket at most one tag, awaiting_approval first", () => {
    const old = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const items = tagNeedsYou(
      [
        makeTicket({
          id: "multi",
          severity: "critical",
          status: "awaiting_approval",
          created_at: old,
        }),
      ],
      now
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("awaiting_approval");
  });
});

function makeRunnerRow(overrides: Record<string, unknown> = {}) {
  return {
    status: "idle",
    current_ticket_id: null,
    run_started_at: null,
    last_heartbeat: null,
    last_result: null,
    kill_switch: false,
    fix_agent: "codex",
    ...overrides,
  };
}

describe("getRunnerState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null gracefully when the table is missing", async () => {
    mockTables({
      runner_state: [
        { data: null, error: { code: "PGRST205", message: "relation missing" } },
      ],
    });
    expect(await getRunnerState()).toBeNull();
  });
});

describe("isRunnerOffline", () => {
  const now = Date.parse("2026-06-11T12:00:00Z");

  it("is offline with no heartbeat on record", () => {
    expect(isRunnerOffline(null, now)).toBe(true);
  });

  it("is online when heartbeat is within the stale window", () => {
    const fresh = new Date(now - RUNNER_STALE_MS + 1000).toISOString();
    expect(isRunnerOffline(fresh, now)).toBe(false);
  });

  it("is offline when heartbeat is older than the stale window", () => {
    const stale = new Date(now - RUNNER_STALE_MS - 1000).toISOString();
    expect(isRunnerOffline(stale, now)).toBe(true);
  });

});

describe("fetchRunnerCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports not-deployed when runner_state is missing", async () => {
    mockTables({
      runner_state: [
        { data: null, error: { code: "PGRST205", message: "relation missing" } },
      ],
    });

    const card = await fetchRunnerCard();
    expect(card.available).toBe(false);
    expect(card.heartbeatAgeMinutes).toBeNull();
  });

});

function makeRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    ticket_id: "ticket-1",
    status: "awaiting_approval",
    outcome: "passed",
    gate_verdict: "pass",
    gate_stage: "denylist",
    duration_sec: 124,
    est_cost: "budget: low",
    branch: "fix/ticket-1",
    fix_sha: "abcdef1234567890",
    diff_stat: "1 file changed, 2 insertions(+)",
    test_cmd: "npm test -- targeted",
    test_exit: 0,
    detail: {
      test_output_tail: "Tests  4 passed",
      gate_reasoning: "in policy",
      rebase_result: "clean",
      repro_replay: "passed",
    },
    started_at: "2026-06-13T15:00:00.000Z",
    finished_at: "2026-06-13T15:02:04.000Z",
    tickets_processed: 1,
    ...overrides,
  };
}

describe("fetchRunnerRunsForTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters runner runs by ticket id", async () => {
    mockTables({
      runner_runs: [{ data: [makeRunRow({ id: "run-ticket" })], error: null }],
    });

    const runs = await fetchRunnerRunsForTicket("ticket-1");

    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe("run-ticket");
    const runnerRunsBuilder = vi.mocked(supabase.from).mock.results[0].value as {
      eq: ReturnType<typeof vi.fn>;
    };
    expect(runnerRunsBuilder.eq).toHaveBeenCalledWith("ticket_id", "ticket-1");
  });
});

describe("requeueTicketForAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to requeue a ticket whose most recent run was skipped:known-unfixable", async () => {
    mockTables({
      runner_runs: [
        { data: [makeRunRow({ status: "skipped", outcome: "skipped:known-unfixable" })], error: null },
      ],
    });

    await expect(requeueTicketForAgent("ticket-1")).rejects.toBeInstanceOf(TicketKnownUnfixableError);
    // The tickets table update must never be attempted.
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalledWith("tickets");
  });

  it("refuses to requeue a ticket whose most recent run escalated needs-human:*", async () => {
    mockTables({
      runner_runs: [
        { data: [makeRunRow({ status: "escalated", outcome: "needs-human:no-code-change" })], error: null },
      ],
    });

    await expect(requeueTicketForAgent("ticket-1")).rejects.toThrow(/needs-human:no-code-change/);
  });

  it("allows requeue when the most recent run outcome is fixable", async () => {
    mockTables({
      runner_runs: [{ data: [makeRunRow({ status: "awaiting_approval", outcome: "passed" })], error: null }],
      tickets: [{ data: null, error: null }],
    });

    await expect(requeueTicketForAgent("ticket-1")).resolves.toBeUndefined();
    expect(vi.mocked(supabase.from)).toHaveBeenCalledWith("tickets");
  });

  it("allows requeue when the ticket has never been run", async () => {
    mockTables({
      runner_runs: [{ data: [], error: null }],
      tickets: [{ data: null, error: null }],
    });

    await expect(requeueTicketForAgent("ticket-1")).resolves.toBeUndefined();
  });
});

describe("getAutopilotTrustMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps nullable and nonzero trust rows to the typed service contract", async () => {
    mockRpc({
      data: [
        {
          category: "frontend",
          rung: "eligible",
          completed_fixes: 5,
          survived_fixes: 5,
          reopened_fixes: 0,
          deferred_runs: 2,
          survival_rate: 1,
          eligible: true,
          canary_due_count: 1,
          canary_failed_count: 0,
          threshold: 0.9,
          min_fixes: 5,
        },
        {
          category: "billing",
          rung: "manual",
          completed_fixes: null,
          survived_fixes: null,
          reopened_fixes: null,
          deferred_runs: null,
          survival_rate: null,
          eligible: false,
          canary_due_count: null,
          canary_failed_count: 3,
          threshold: null,
          min_fixes: null,
        },
      ],
      error: null,
    });

    await expect(getAutopilotTrustMetrics()).resolves.toEqual([
      {
        category: "frontend",
        rung: "eligible",
        completedFixes: 5,
        survivedFixes: 5,
        reopenedFixes: 0,
        deferredRuns: 2,
        survivalRate: 1,
        eligible: true,
        canaryDueCount: 1,
        canaryFailedCount: 0,
        threshold: 0.9,
        minFixes: 5,
      },
      {
        category: "billing",
        rung: "manual",
        completedFixes: 0,
        survivedFixes: 0,
        reopenedFixes: 0,
        deferredRuns: 0,
        survivalRate: 0,
        eligible: false,
        canaryDueCount: 0,
        canaryFailedCount: 3,
        threshold: 0,
        minFixes: 0,
      },
    ]);
  });

});

describe("autopilot category mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes categories through the admin Edge Function", async () => {
    mockInvoke({
      data: { success: true, category: "frontend", action: "promote_auto" },
      error: null,
    });

    await expect(
      promoteAutopilotCategory({ category: "frontend", reason: "Stable survival" })
    ).resolves.toMatchObject({ success: true });
    expect(supabase.functions.invoke).toHaveBeenCalledWith("autopilot-trust-admin", {
      body: {
        category: "frontend",
        action: "promote_auto",
        reason: "Stable survival",
      },
    });
  });

  it("demotes categories through the admin Edge Function", async () => {
    mockInvoke({
      data: { success: true, category: "frontend", action: "demote_manual" },
      error: null,
    });

    await expect(demoteAutopilotCategory({ category: "frontend" })).resolves.toMatchObject({
      success: true,
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith("autopilot-trust-admin", {
      body: {
        category: "frontend",
        action: "demote_manual",
        reason: undefined,
      },
    });
  });

  it("throws a stable error when the function rejects promotion", async () => {
    mockInvoke({
      data: { success: false, error: "category_not_eligible" },
      error: null,
    });

    await expect(promoteAutopilotCategory({ category: "risky" })).rejects.toThrow(
      "category_not_eligible"
    );
  });

});

