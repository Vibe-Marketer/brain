import { describe, expect, it, vi, beforeEach } from "vitest";
import { getTicketClassMetrics } from "@/services/admin-dashboard.service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

function mockRpc(response: Record<string, unknown>) {
  vi.mocked(supabase.rpc).mockResolvedValue(response as never);
}

describe("getTicketClassMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps ticket_class_metrics RPC rows to the typed recurrence service contract", async () => {
    mockRpc({
      data: [
        {
          class_key: "source:sentry:error:typeerror:fingerprint:sentry:checkout-submit",
          source: "sentry",
          error_class: "typeerror",
          fingerprint_root: "sentry:checkout-submit",
          resolved_count_30d: 4,
          occurrence_count_30d: 9,
          fresh_ticket_rate_30d: 0.3,
          baseline_rate_30d: 0.5,
          post_fix_rate_30d: 0.1,
          structural_ticket_id: "00000000-0000-4000-8000-000000000022",
          structural_fix_landed_at: "2026-06-14T02:40:00.000Z",
          killed_at: null,
          status: "landed",
          context: {
            recurrence_action: "tier2_digest_queued",
          },
        },
        {
          class_key: "source:nightly_qa:error:assertion:fingerprint:nightly_qa:settings",
          source: "nightly_qa",
          error_class: "assertion",
          fingerprint_root: "nightly_qa:settings",
          resolved_count_30d: "3",
          occurrence_count_30d: "3",
          fresh_ticket_rate_30d: "0.1",
          baseline_rate_30d: null,
          post_fix_rate_30d: null,
          structural_ticket_id: null,
          structural_fix_landed_at: null,
          killed_at: null,
          status: "recurring",
          context: {},
        },
      ],
      error: null,
    });

    const metrics = await getTicketClassMetrics();

    expect(supabase.rpc).toHaveBeenCalledWith("ticket_class_metrics");
    expect(metrics).toEqual([
      {
        classKey: "source:sentry:error:typeerror:fingerprint:sentry:checkout-submit",
        source: "sentry",
        errorClass: "typeerror",
        fingerprintRoot: "sentry:checkout-submit",
        resolvedCount30d: 4,
        occurrenceCount30d: 9,
        freshTicketRate30d: 0.3,
        baselineRate30d: 0.5,
        postFixRate30d: 0.1,
        structuralTicketId: "00000000-0000-4000-8000-000000000022",
        structuralFixLandedAt: "2026-06-14T02:40:00.000Z",
        killedAt: null,
        status: "landed",
        context: {
          recurrence_action: "tier2_digest_queued",
        },
      },
      {
        classKey: "source:nightly_qa:error:assertion:fingerprint:nightly_qa:settings",
        source: "nightly_qa",
        errorClass: "assertion",
        fingerprintRoot: "nightly_qa:settings",
        resolvedCount30d: 3,
        occurrenceCount30d: 3,
        freshTicketRate30d: 0.1,
        baselineRate30d: 0,
        postFixRate30d: 0,
        structuralTicketId: null,
        structuralFixLandedAt: null,
        killedAt: null,
        status: "recurring",
        context: {},
      },
    ]);
  });

  it("throws a labeled error when the recurrence metrics RPC fails", async () => {
    mockRpc({
      data: null,
      error: { message: "forbidden" },
    });

    await expect(getTicketClassMetrics()).rejects.toThrow(
      "Failed to fetch ticket class metrics: forbidden"
    );
  });
});
