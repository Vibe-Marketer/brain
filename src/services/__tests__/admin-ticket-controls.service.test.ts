import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateTicketQueueControls, workTicketNow } from "@/services/admin-ticket-controls.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function mockUpdateChain(response: { data: unknown; error: unknown }) {
  const select = vi.fn(() => Promise.resolve(response));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  vi.mocked(supabase.from).mockReturnValue({ update } as never);
  return { update, eq, select };
}

/**
 * Chainable builder queued per-table: every method (select/eq/order/limit/
 * update/maybeSingle) returns the same builder, and `maybeSingle`/`select`
 * resolve the next queued response for that table. Mirrors workTicketNow's
 * three sequential `.from()` calls (tickets type check, runner_runs last
 * outcome, tickets update).
 */
function mockWorkTicketNowChain(responses: {
  ticketType?: { data: unknown; error?: unknown };
  lastRun?: { data: unknown; error?: unknown };
  update?: { data: unknown; error?: unknown };
}) {
  let ticketFromCalls = 0;
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const builder: Record<string, unknown> = {};
    const record =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    for (const m of ["select", "eq", "order", "limit", "update"]) {
      builder[m] = record(m);
    }
    builder.maybeSingle = () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      if (table === "tickets" && ticketFromCalls === 0) {
        ticketFromCalls++;
        return Promise.resolve(responses.ticketType ?? { data: null, error: null });
      }
      return Promise.resolve(responses.lastRun ?? { data: null, error: null });
    };
    // The final tickets UPDATE chain ends on .select(...), which must resolve
    // (not just record) — override select's return for that call.
    builder.select = (...args: unknown[]) => {
      calls.push({ table, method: "select", args });
      // If this select follows an update() call on tickets, resolve the update response.
      const wasUpdate = calls.some((c) => c.table === "tickets" && c.method === "update");
      if (table === "tickets" && wasUpdate) {
        return Promise.resolve(responses.update ?? { data: [{ id: "t1", priority: 3, urgent: true }], error: null });
      }
      return builder;
    };
    return builder as never;
  }) as never);
  return { calls };
}

describe("updateTicketQueueControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates priority and urgent and returns the row", async () => {
    const { update, eq } = mockUpdateChain({
      data: [{ id: "t1", priority: 5, urgent: true }],
      error: null,
    });

    const row = await updateTicketQueueControls("t1", { priority: 5, urgent: true });
    expect(row).toEqual({ id: "t1", priority: 5, urgent: true });
    expect(supabase.from).toHaveBeenCalledWith("tickets");
    expect(update).toHaveBeenCalledWith({ priority: 5, urgent: true });
    expect(eq).toHaveBeenCalledWith("id", "t1");
  });

  it("clamps priority to an integer", async () => {
    const { update } = mockUpdateChain({
      data: [{ id: "t1", priority: 3, urgent: false }],
      error: null,
    });
    await updateTicketQueueControls("t1", { priority: 3.9 });
    expect(update).toHaveBeenCalledWith({ priority: 3 });
  });

  it("throws on a zero-row result (RLS-blocked non-admin or missing ticket)", async () => {
    mockUpdateChain({ data: [], error: null });
    await expect(updateTicketQueueControls("t1", { urgent: true })).rejects.toThrow(
      "Failed to update queue controls"
    );
  });

  it("throws with the DB message on error", async () => {
    mockUpdateChain({ data: null, error: { message: "permission denied" } });
    await expect(updateTicketQueueControls("t1", { priority: 1 })).rejects.toThrow(
      "Failed to update queue controls: permission denied"
    );
  });

  it("rejects an empty patch without touching the database", async () => {
    await expect(updateTicketQueueControls("t1", {})).rejects.toThrow(
      "empty patch"
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("workTicketNow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a suggestion/question ticket the claim loop never fetches (honesty fix, ticket 632728)", async () => {
    mockWorkTicketNowChain({ ticketType: { data: { type: "suggestion" }, error: null } });

    await expect(workTicketNow("t1")).rejects.toThrow(
      /doesn't work "suggestion" tickets/
    );
  });

  it("allows a bug ticket through and sets urgent/priority/status", async () => {
    const { calls } = mockWorkTicketNowChain({
      ticketType: { data: { type: "bug" }, error: null },
      lastRun: { data: null, error: null },
      update: { data: [{ id: "t1", priority: 3, urgent: true }], error: null },
    });

    const row = await workTicketNow("t1");
    expect(row).toEqual({ id: "t1", priority: 3, urgent: true });
    expect(calls.some((c) => c.method === "update" && JSON.stringify(c.args[0]).includes("\"urgent\":true"))).toBe(
      true
    );
  });

  it("allows a previously-unclaimable improvement ticket through now that the type is claimable (ticket 632728)", async () => {
    mockWorkTicketNowChain({
      ticketType: { data: { type: "improvement" }, error: null },
      lastRun: { data: null, error: null },
      update: { data: [{ id: "632728", priority: 3, urgent: true }], error: null },
    });

    const row = await workTicketNow("632728");
    expect(row).toEqual({ id: "632728", priority: 3, urgent: true });
  });

  it("still refuses a ticket the daemon already flagged unfixable", async () => {
    mockWorkTicketNowChain({
      ticketType: { data: { type: "bug" }, error: null },
      lastRun: { data: { outcome: "skipped:known-unfixable" }, error: null },
    });

    await expect(workTicketNow("t1")).rejects.toThrow(/already flagged this ticket as unfixable/);
  });
});
