import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAuditLogs, fetchAuditActions } from "@/services/admin-audit.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

/** Chainable thenable builder; awaiting resolves the per-table response. */
function makeBuilder(response: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject);
  return builder;
}

function mockTables(tables: Record<string, Record<string, unknown>>) {
  vi.mocked(supabase.from).mockImplementation(((table: string) =>
    makeBuilder(tables[table] ?? { data: [], error: null })) as never);
}

const ADMIN_ROW = {
  id: "aal-1",
  actor_user_id: "admin-1",
  action: "change_role",
  target_type: "user",
  target_id: "user-9",
  metadata: { new_role: "PRO" },
  created_at: "2026-06-12T10:00:00Z",
};

const TICKET_EVENT = {
  id: "te-1",
  ticket_id: "ticket-7",
  actor_id: "admin-1",
  event_type: "status_change",
  old_value: "new",
  new_value: "in_progress",
  created_at: "2026-06-12T11:00:00Z", // newer than the admin row
};

beforeEach(() => vi.clearAllMocks());

describe("fetchAuditLogs (merged trail)", () => {
  it("merges admin_audit_log + ticket_events newest-first and resolves actor email", async () => {
    mockTables({
      admin_audit_log: { data: [ADMIN_ROW], error: null },
      ticket_events: { data: [TICKET_EVENT], error: null },
      user_profiles: { data: [{ user_id: "admin-1", email: "a@vibeos.com" }], error: null },
    });

    const logs = await fetchAuditLogs();

    expect(logs).toHaveLength(2);
    // Ticket event is newer → first.
    expect(logs[0].source).toBe("ticket_events");
    expect(logs[0].action).toBe("ticket_status_change");
    expect(logs[0].target_type).toBe("ticket");
    expect(logs[0].target_id).toBe("ticket-7");
    expect(logs[0].metadata).toEqual({ old_value: "new", new_value: "in_progress" });
    expect(logs[0].id).toBe("te:te-1"); // namespaced id

    expect(logs[1].source).toBe("admin_audit_log");
    expect(logs[1].action).toBe("change_role");
    expect(logs[1].id).toBe("aal:aal-1");

    // Both rows share actor admin-1 → email resolved on each.
    expect(logs[0].actor_email).toBe("a@vibeos.com");
    expect(logs[1].actor_email).toBe("a@vibeos.com");
  });

  it("applies the action filter across both sources", async () => {
    mockTables({
      admin_audit_log: { data: [ADMIN_ROW], error: null },
      ticket_events: { data: [TICKET_EVENT], error: null },
      user_profiles: { data: [{ user_id: "admin-1", email: "a@vibeos.com" }], error: null },
    });

    const logs = await fetchAuditLogs({ action: "ticket_status_change" });

    expect(logs).toHaveLength(1);
    expect(logs[0].source).toBe("ticket_events");
  });

  it("throws if either source query errors", async () => {
    mockTables({
      admin_audit_log: { data: null, error: { message: "rls denied" } },
      ticket_events: { data: [], error: null },
    });
    await expect(fetchAuditLogs()).rejects.toMatchObject({ message: "rls denied" });
  });

  it("leaves actor_email null when no profile resolves", async () => {
    mockTables({
      admin_audit_log: { data: [{ ...ADMIN_ROW, actor_user_id: "ghost" }], error: null },
      ticket_events: { data: [], error: null },
      user_profiles: { data: [], error: null },
    });
    const logs = await fetchAuditLogs();
    expect(logs[0].actor_email).toBeNull();
  });
});

describe("fetchAuditActions", () => {
  it("returns sorted distinct actions, ticket events prefixed", async () => {
    mockTables({
      admin_audit_log: { data: [{ action: "change_role" }, { action: "reset_password" }], error: null },
      ticket_events: { data: [{ event_type: "status_change" }, { event_type: "created" }], error: null },
    });

    const actions = await fetchAuditActions();

    expect(actions).toEqual([
      "change_role",
      "reset_password",
      "ticket_created",
      "ticket_status_change",
    ]);
  });
});
