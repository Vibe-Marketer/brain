import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAllUsers,
  updateUserRoleAsAdmin,
  resetUserPasswordAsAdmin,
  revokeAccessAsAdmin,
  restoreAccessAsAdmin,
} from "@/services/admin-users.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

/**
 * Chainable thenable builder (same pattern as admin-dashboard.service.test):
 * every query method returns the builder; awaiting it resolves the response.
 */
function makeBuilder(response: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
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

const PROFILE = {
  id: "profile-row-1",
  user_id: "auth-user-1",
  email: "a@vibeos.com",
  display_name: "Andrew",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  last_login_at: "2026-06-10T00:00:00Z",
  subscription_status: "active",
  product_id: "prod_team",
  polar_customer_id: "polar-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { success: true }, error: null } as never);
});

describe("fetchAllUsers", () => {
  it("joins user_profiles with user_roles keyed on the AUTH user id", async () => {
    mockTables({
      user_profiles: { data: [PROFILE], error: null },
      user_roles: { data: [{ user_id: "auth-user-1", role: "ADMIN" }], error: null },
    });

    const users = await fetchAllUsers();

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe("auth-user-1"); // auth id, NOT the profile row id
    expect(users[0].profile_id).toBe("profile-row-1");
    expect(users[0].role).toBe("ADMIN");
    expect(users[0].product_id).toBe("prod_team");
    expect(users[0].last_login_at).toBe("2026-06-10T00:00:00Z");
  });

  it("defaults users without a role row to FREE", async () => {
    mockTables({
      user_profiles: { data: [PROFILE], error: null },
      user_roles: { data: [], error: null },
    });

    const users = await fetchAllUsers();
    expect(users[0].role).toBe("FREE");
  });

  it("throws when the profiles query errors", async () => {
    mockTables({
      user_profiles: { data: null, error: new Error("rls denied") },
      user_roles: { data: [], error: null },
    });

    await expect(fetchAllUsers()).rejects.toThrow("rls denied");
  });
});

describe("privileged mutations route through admin-manage-user", () => {
  it("change_role invokes the edge function — never a direct table write", async () => {
    await updateUserRoleAsAdmin("auth-user-1", "TEAM");

    expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-user", {
      body: { action: "change_role", target_user_id: "auth-user-1", new_role: "TEAM" },
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("reset_password sends the new password to the edge function only", async () => {
    await resetUserPasswordAsAdmin("auth-user-1", "hunter2hunter2");

    expect(supabase.functions.invoke).toHaveBeenCalledWith("admin-manage-user", {
      body: {
        action: "reset_password",
        target_user_id: "auth-user-1",
        new_password: "hunter2hunter2",
      },
    });
  });

  it("revoke and restore map to their edge function actions", async () => {
    await revokeAccessAsAdmin("auth-user-1");
    await restoreAccessAsAdmin("auth-user-1");

    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(1, "admin-manage-user", {
      body: { action: "revoke_access", target_user_id: "auth-user-1" },
    });
    expect(supabase.functions.invoke).toHaveBeenNthCalledWith(2, "admin-manage-user", {
      body: { action: "restore_access", target_user_id: "auth-user-1" },
    });
  });

  it("propagates edge function errors", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: new Error("Admin access required"),
    } as never);

    await expect(updateUserRoleAsAdmin("auth-user-1", "ADMIN")).rejects.toThrow(
      "Admin access required"
    );
  });
});
