import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AuditSection from "../AuditSection";
import * as useAuditLogsHook from "@/hooks/useAuditLogs";
import type { AuditLog } from "@/services/admin-audit.service";

vi.mock("@/hooks/useAuditLogs", () => ({
  useAuditLogs: vi.fn(),
  useAuditActions: vi.fn(),
}));

function makeLog(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: "aal:1",
    source: "admin_audit_log",
    actor_user_id: "admin-1",
    action: "change_role",
    target_type: "user",
    target_id: "user-9",
    metadata: { new_role: "PRO" },
    created_at: "2026-06-12T10:00:00Z",
    actor_email: "a@vibeos.com",
    ...overrides,
  };
}

function mockLogs(logs: AuditLog[] | undefined, opts: Partial<{ isLoading: boolean; error: unknown }> = {}) {
  vi.mocked(useAuditLogsHook.useAuditLogs).mockReturnValue({
    data: logs,
    isLoading: opts.isLoading ?? false,
    error: opts.error ?? null,
  } as never);
  vi.mocked(useAuditLogsHook.useAuditActions).mockReturnValue({
    data: ["change_role", "ticket_status_change"],
    isLoading: false,
    error: null,
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe("AuditSection (plain-English activity log)", () => {
  it("renders human source badges and a plain sentence per row", () => {
    mockLogs([
      makeLog({ id: "aal:1", source: "admin_audit_log", action: "change_role" }),
      makeLog({
        id: "te:1",
        source: "ticket_events",
        action: "ticket_status_change",
        target_type: "ticket",
        target_id: "ticket-7",
        metadata: { old_value: "new", new_value: "in_progress" },
      }),
    ]);
    render(<AuditSection />);

    // Human-readable source badges (capitalized), not raw enum strings.
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("Ticket")).toBeTruthy();
    // The status change renders as a plain sentence, not "ticket_status_change".
    expect(screen.getByText(/Moved status from New → In progress/)).toBeTruthy();
    expect(screen.queryByText("ticket_status_change")).toBeNull();
    // Both rows share the same actor → two email cells.
    expect(screen.getAllByText("a@vibeos.com").length).toBe(2);
  });

  it("shows plain English, never raw JSON metadata", () => {
    mockLogs([
      makeLog({
        source: "ticket_events",
        action: "ticket_status_change",
        metadata: { old_value: "new", new_value: "resolved" },
      }),
    ]);
    const { container } = render(<AuditSection />);
    expect(screen.getByText(/Moved status from New → Resolved/)).toBeTruthy();
    // The old raw-JSON <details> dump must be gone.
    expect(container.querySelector("details")).toBeNull();
    expect(screen.queryByText(/new_value/)).toBeNull();
  });

  it("shows the empty state with no entries", () => {
    mockLogs([]);
    render(<AuditSection />);
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  it("renders the error state", () => {
    mockLogs(undefined, { error: new Error("boom") });
    render(<AuditSection />);
    expect(screen.getByText(/failed to load the activity log/i)).toBeTruthy();
  });
});
