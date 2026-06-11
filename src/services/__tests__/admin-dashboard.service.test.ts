import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchDashboardStats,
  fetchRunnerCard,
  tagNeedsYou,
  needsYouQueue,
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
  for (const method of ["select", "eq", "gte", "in", "order", "limit"]) {
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

  it("computes heartbeat age from the latest row", async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockTables({
      runner_state: [
        {
          data: [{ id: "r1", status: "idle", updated_at: fiveMinAgo }],
          error: null,
        },
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ sha: "abc1234deadbeef" }),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

    // Deploy card: bundle SHA vs fetched main HEAD (prefix match)
    expect(stats.deploy.deployedSha).toBe("abc1234");
    expect(stats.deploy.mainHeadSha).toBe("abc1234deadbeef");
    expect(stats.deploy.inSync).toBe(true);

    // DB round-trip is a measured number
    expect(typeof stats.health.db).toBe("number");
    expect(stats.health.appVersion).toBe("2.4.0");
  });

  it("degrades the deploy comparison when GitHub is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    );
    mockTables({
      user_profiles: [{ count: 0, error: null }],
      user_roles: [{ data: [], error: null }],
      tickets: [
        { data: [], error: null },
        { count: 0, error: null },
      ],
      runner_state: [
        { data: null, error: { code: "PGRST205", message: "relation missing" } },
      ],
    });

    const stats = await fetchDashboardStats();
    expect(stats.deploy.mainHeadSha).toBeNull();
    expect(stats.deploy.inSync).toBeNull();
  });
});
