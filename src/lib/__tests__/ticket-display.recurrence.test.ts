import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { queryKeys } from "@/lib/query-config";
import {
  ticketClassLabel,
  ticketClassStatusLabel,
} from "@/lib/ticket-display";
import { useTicketClassMetrics } from "@/hooks/useAdminDashboard";
import { getTicketClassMetrics } from "@/services/admin-dashboard.service";

vi.mock("@/services/admin-dashboard.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/admin-dashboard.service")>();
  return {
    ...actual,
    getTicketClassMetrics: vi.fn(),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("recurrence query contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a stable admin query key for ticket class metrics", () => {
    expect(queryKeys.admin.ticketClassMetrics()).toEqual([
      "admin",
      "ticket-class-metrics",
    ]);
  });

  it("wraps ticket class metrics through the admin hook boundary", async () => {
    vi.mocked(getTicketClassMetrics).mockResolvedValue([
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
        structuralFixLandedAt: null,
        killedAt: null,
        status: "structural_fix_queued",
        context: {},
      },
    ]);

    const { result } = renderHook(() => useTicketClassMetrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTicketClassMetrics).toHaveBeenCalledTimes(1);
    expect(result.current.data?.[0].structuralTicketId).toBe(
      "00000000-0000-4000-8000-000000000022"
    );
  });
});

describe("recurrence display helpers", () => {
  it.each([
    ["watching", "Watching"],
    ["recurring", "Recurring"],
    ["structural_fix_queued", "Structural fix open"],
    ["landed", "Structural fix landed"],
    ["killed", "Killed"],
  ])("renders %s as %s", (status, label) => {
    expect(ticketClassStatusLabel(status)).toBe(label);
  });

  it("falls back to tidy text for unknown status values", () => {
    expect(ticketClassStatusLabel("needs_review")).toBe("Needs review");
    expect(ticketClassStatusLabel(null)).toBe("Unknown status");
  });

  it("renders a recurrence class label without showing raw class keys", () => {
    expect(
      ticketClassLabel({
        source: "sentry",
        errorClass: "typeerror",
      })
    ).toBe("Found by Sentry / Typeerror recurrence");
    expect(
      ticketClassLabel({
        source: "nightly_qa",
        errorClass: "assertion_error",
      })
    ).toBe("Found by nightly QA / Assertion error recurrence");
  });
});
