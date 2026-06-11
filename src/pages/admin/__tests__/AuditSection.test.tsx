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

describe("AuditSection (merged trail)", () => {
  it("renders both source badges and the action for each row", () => {
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

    // "admin" source badge is unique; "ticket" appears in both the source
    // badge and the target_type column, so assert it via getAllByText.
    expect(screen.getByText("admin")).toBeTruthy();
    expect(screen.getAllByText("ticket").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("change_role")).toBeTruthy();
    expect(screen.getByText("ticket_status_change")).toBeTruthy();
    // Both rows share the same actor → two email cells.
    expect(screen.getAllByText("a@vibeos.com").length).toBe(2);
  });

  it("renders collapsible metadata via a details element", () => {
    mockLogs([makeLog({ metadata: { new_role: "PRO" } })]);
    const { container } = render(<AuditSection />);
    // Metadata renders inside a native <details> with a JSON preview summary.
    const details = container.querySelector("details");
    expect(details).toBeTruthy();
    expect(details?.textContent).toContain("new_role");
  });

  it("shows the empty state with no entries", () => {
    mockLogs([]);
    render(<AuditSection />);
    expect(screen.getByText(/no audit entries/i)).toBeTruthy();
  });

  it("renders the error state", () => {
    mockLogs(undefined, { error: new Error("boom") });
    render(<AuditSection />);
    expect(screen.getByText(/failed to load audit log/i)).toBeTruthy();
  });
});
