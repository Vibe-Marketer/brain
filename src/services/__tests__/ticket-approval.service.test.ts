import { describe, expect, it, vi, beforeEach } from "vitest";
import { approveTicket, rejectTicket } from "@/services/ticket-approval.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const mockInvoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveTicket", () => {
  it("invokes ticket-approval with the approve action and no reason", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, action: "approve", ticket_id: "t-1" },
      error: null,
    } as never);

    await expect(approveTicket("t-1")).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenCalledWith("ticket-approval", {
      body: { ticket_id: "t-1", action: "approve" },
    });
  });

  it("throws a 'Failed to approve ticket' error when invoke errors", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("network down"),
    } as never);

    await expect(approveTicket("t-1")).rejects.toThrow(/Failed to approve ticket: network down/);
  });

  it("surfaces the function's {error} payload on a non-2xx FunctionsHttpError", async () => {
    const httpError = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(
        JSON.stringify({ success: false, error: "ticket_not_awaiting_approval" }),
        { status: 409 },
      ),
    });
    mockInvoke.mockResolvedValue({ data: null, error: httpError } as never);

    await expect(approveTicket("t-1")).rejects.toThrow(
      /Failed to approve ticket: ticket_not_awaiting_approval/,
    );
  });

  it("throws when the function returns success:false without an invoke error", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: "Admin access required" },
      error: null,
    } as never);

    await expect(approveTicket("t-1")).rejects.toThrow(
      /Failed to approve ticket: Admin access required/,
    );
  });
});

describe("rejectTicket", () => {
  it("invokes ticket-approval with the reject action and trimmed reason", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, action: "reject", ticket_id: "t-2" },
      error: null,
    } as never);

    await expect(rejectTicket("t-2", "  not a real fix  ")).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenCalledWith("ticket-approval", {
      body: { ticket_id: "t-2", action: "reject", reason: "not a real fix" },
    });
  });

  it("rejects an empty reason client-side without invoking the function", async () => {
    await expect(rejectTicket("t-2", "   ")).rejects.toThrow(/a reason is required/);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("throws a 'Failed to reject ticket' error when invoke errors", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    } as never);

    await expect(rejectTicket("t-2", "bad fix")).rejects.toThrow(/Failed to reject ticket: boom/);
  });
});
