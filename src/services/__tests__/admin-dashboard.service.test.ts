import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchDashboardStats,
  fetchRunnerCard,
  getRunnerState,
  isRunnerOffline,
  setKillSwitch,
  tagNeedsYou,
  needsYouQueue,
  RUNNER_STALE_MS,
} from "@/services/admin-dashboard.service";
import { supabase } from "@/integrations/supabase/client";
import type { TicketRow } from "@/services/tickets.service";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
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

describe("needsYouQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries live tickets and tags client-side", async () => {
    mockTables({
      tickets: [
        {
          data: [
            makeTicket({ id: "q1", status: "awaiting_approval" }),
            makeTicket({ id: "q2", status: "new" }),
          ],
          error: null,
        },
      ],
    });

    const items = await needsYouQueue();
    expect(items).toHaveLength(1);
    expect(items[0].ticket.id).toBe("q1");
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
    ...overrides,
  };
}

describe("getRunnerState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the typed singleton row", async () => {
    const hb = new Date().toISOString();
    mockTables({
      runner_state: [
        {
          data: makeRunnerRow({
            status: "running",
            current_ticket_id: "t-123",
            last_heartbeat: hb,
            kill_switch: true,
          }),
          error: null,
        },
      ],
    });

    const state = await getRunnerState();
    expect(state).toEqual({
      status: "running",
      current_ticket_id: "t-123",
      run_started_at: null,
      last_heartbeat: hb,
      last_result: null,
      kill_switch: true,
    });
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

describe("setKillSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates kill_switch on the singleton row", async () => {
    mockTables({ runner_state: [{ data: null, error: null }] });
    await expect(setKillSwitch(true)).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("runner_state");
  });

  it("throws a labeled error on failure", async () => {
    mockTables({
      runner_state: [{ data: null, error: { message: "trigger rejected" } }],
    });
    await expect(setKillSwitch(false)).rejects.toThrow(
      "Failed to update kill switch: trigger rejected"
    );
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

  it("respects a custom staleMs", () => {
    const twoMinAgo = new Date(now - 120_000).toISOString();
    expect(isRunnerOffline(twoMinAgo, now, 60_000)).toBe(true);
    expect(isRunnerOffline(twoMinAgo, now, 300_000)).toBe(false);
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

  it("computes heartbeat age from the singleton row", async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockTables({
      runner_state: [
        { data: makeRunnerRow({ last_heartbeat: fiveMinAgo }), error: null },
      ],
    });

    const card = await fetchRunnerCard();
    expect(card.available).toBe(true);
    expect(card.state).toBe("idle");
    expect(card.heartbeatAgeMinutes).toBeGreaterThanOrEqual(4);
    expect(card.heartbeatAgeMinutes).toBeLessThanOrEqual(6);
  });
});

describe("fetchDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_APP_VERSION", "2.4.0");
    vi.stubEnv("VITE_COMMIT_SHA", "abc1234");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives every stat from real query results", async () => {
    mockTables({
      user_profiles: [{ count: 10, error: null }],
      user_roles: [
        {
          data: [
            { user_id: "u1", role: "ADMIN" },
            { user_id: "u2", role: "PRO" },
            { user_id: "u3", role: "FREE" },
          ],
          error: null,
        },
      ],
      tickets: [
        // First call: status breakdown rows
        {
          data: [
            { status: "new" },
            { status: "new" },
            { status: "in_progress" },
            { status: "resolved" },
            { status: "escalated" },
          ],
          error: null,
        },
        // Second call: last-7-days head count
        { count: 2, error: null },
      ],
      runner_state: [
        { data: null, error: { code: "PGRST205", message: "relation missing" } },
      ],
    });

    const stats = await fetchDashboardStats();

    expect(stats.totalUsers).toBe(10);
    expect(stats.usersByRole.ADMIN).toBe(1);
    expect(stats.usersByRole.PRO).toBe(1);
    // 10 total - 1 admin - 1 pro = 8 free (role rows without ADMIN/TEAM/PRO count as FREE)
    expect(stats.usersByRole.FREE).toBe(8);

    expect(stats.ticketsByStatus.new).toBe(2);
    expect(stats.ticketsByStatus.in_progress).toBe(1);
    expect(stats.ticketsByStatus.resolved).toBe(1);
    expect(stats.ticketsByStatus.escalated).toBe(1);
    expect(stats.totalTickets).toBe(5);
    expect(stats.ticketsLast7d).toBe(2);

    // Runner table missing → graceful not-deployed card, never a throw
    expect(stats.runner.available).toBe(false);

    // Deploy card: only the bundle-baked SHA — no client-side GitHub fetch (CSP-clean)
    expect(stats.deploy.deployedSha).toBe("abc1234");

    // DB round-trip is a measured number
    expect(typeof stats.health.db).toBe("number");
    expect(stats.health.appVersion).toBe("2.4.0");
  });
});
