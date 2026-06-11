import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateTicketQueueControls } from "@/services/admin-ticket-controls.service";
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
