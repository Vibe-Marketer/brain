import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardSection from "@/pages/admin/DashboardSection";
import type {
  AdminDashboardStats,
  TicketClassMetric,
} from "@/services/admin-dashboard.service";

const hookState = vi.hoisted(() => ({
  dashboard: { data: undefined as AdminDashboardStats | undefined, isLoading: false, error: null as Error | null },
  needsYou: { data: [], isLoading: false },
  runnerState: { data: null, isLoading: false },
  runnerRuns: { data: [], isLoading: false },
  trustMetrics: { data: [], isLoading: false, error: null as Error | null },
  ticketClassMetrics: {
    data: [] as TicketClassMetric[] | undefined,
    isLoading: false,
    error: null as Error | null,
  },
}));

vi.mock("@/hooks/useAdminDashboard", () => ({
  useAdminDashboard: () => hookState.dashboard,
  useNeedsYou: () => hookState.needsYou,
  useRunnerState: () => hookState.runnerState,
  useRunnerRuns: () => hookState.runnerRuns,
  useSelfAudit: () => ({
    data: { overall: "ok", signals: [], generatedAt: "2026-06-16T00:00:00.000Z" },
    isLoading: false,
  }),
  useAutopilotTrustMetrics: () => hookState.trustMetrics,
  useTicketClassMetrics: () => hookState.ticketClassMetrics,
  usePromoteAutopilotCategory: () => ({
    isPending: false,
    variables: undefined,
    mutate: vi.fn(),
  }),
  useDemoteAutopilotCategory: () => ({
    isPending: false,
    variables: undefined,
    mutate: vi.fn(),
  }),
  useSetKillSwitch: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useSetFixAgent: () => ({
    isPending: false,
    variables: undefined,
    mutate: vi.fn(),
  }),
  useRequeueTicketForAgent: () => ({
    isPending: false,
    variables: undefined,
    mutate: vi.fn(),
  }),
  useDismissTicket: () => ({
    isPending: false,
    variables: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isAdmin: true }),
}));

vi.mock("@/stores/adminDetailStore", () => ({
  useAdminDetailStore: (selector: (state: { openTicket: (id: string) => void }) => unknown) =>
    selector({ openTicket: vi.fn() }),
}));

function dashboardStats(): AdminDashboardStats {
  return {
    usersByRole: { ADMIN: 1, TEAM: 0, PRO: 0, FREE: 0 },
    totalUsers: 1,
    ticketsByStatus: {
      new: 0,
      triaged: 0,
      in_progress: 0,
      awaiting_approval: 0,
      awaiting_user: 0,
      resolved: 12,
      rejected: 0,
      escalated: 0,
    },
    totalTickets: 12,
    ticketsLast7d: 2,
    sourceMetrics: [],
    trustMetrics: [],
    runner: {
      available: false,
      heartbeatAgeMinutes: null,
      state: null,
    },
    deploy: { deployedSha: "abcdef1234567890" },
    health: { db: 42, appVersion: "test" },
  };
}

function metric(overrides: Partial<TicketClassMetric> = {}): TicketClassMetric {
  return {
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
    ...overrides,
  };
}

function renderDashboard() {
  render(
    <MemoryRouter>
      <DashboardSection />
    </MemoryRouter>
  );
}

describe("DashboardSection recurrence classes", () => {
  beforeEach(() => {
    hookState.dashboard = { data: dashboardStats(), isLoading: false, error: null };
    hookState.needsYou = { data: [], isLoading: false };
    hookState.runnerState = { data: null, isLoading: false };
    hookState.runnerRuns = { data: [], isLoading: false };
    hookState.trustMetrics = { data: [], isLoading: false, error: null };
    hookState.ticketClassMetrics = { data: [], isLoading: false, error: null };
  });

  it("renders stable skeleton rows while recurrence metrics load", () => {
    hookState.ticketClassMetrics = {
      data: undefined,
      isLoading: true,
      error: null,
    };

    renderDashboard();

    const section = screen.getByTestId("recurrence-classes-card");
    expect(within(section).getByText("Recurrence Classes")).toBeInTheDocument();
    expect(within(section).getAllByTestId("recurrence-class-skeleton")).toHaveLength(3);
  });

  it("renders an empty state when there are no recurring classes yet", () => {
    renderDashboard();

    expect(
      screen.getByText("No recurring classes yet.")
    ).toBeInTheDocument();
  });

  it("renders a retrying error state when recurrence metrics fail to load", () => {
    hookState.ticketClassMetrics = {
      data: undefined,
      isLoading: false,
      error: new Error("forbidden"),
    };

    renderDashboard();

    expect(
      screen.getByText("Recurrence metrics failed to load. Retrying in the background.")
    ).toBeInTheDocument();
  });

  it("shows recurrence rates, counts, status, and structural task review link", () => {
    hookState.ticketClassMetrics = {
      data: [metric()],
      isLoading: false,
      error: null,
    };

    renderDashboard();

    const row = screen.getByTestId("recurrence-class-row-source:sentry:error:typeerror:fingerprint:sentry:checkout-submit");
    expect(within(row).getByText("Found by Sentry / Typeerror recurrence")).toBeInTheDocument();
    expect(within(row).getByText("Structural fix open")).toBeInTheDocument();
    expect(within(row).getByText("30%")).toBeInTheDocument();
    expect(within(row).getByText("50%")).toBeInTheDocument();
    expect(within(row).getByText("10%")).toBeInTheDocument();
    expect(within(row).getByText("9 occurrences")).toBeInTheDocument();
    expect(within(row).getByText("Review structural task")).toBeInTheDocument();
  });

  it("shows killed classes with post-fix rate and no autonomous push affordance", () => {
    hookState.ticketClassMetrics = {
      data: [
        metric({
          classKey: "source:nightly_qa:error:assertion_error:fingerprint:nightly_qa:settings",
          source: "nightly_qa",
          errorClass: "assertion_error",
          fingerprintRoot: "nightly_qa:settings",
          occurrenceCount30d: 3,
          freshTicketRate30d: 0,
          baselineRate30d: 0.4,
          postFixRate30d: 0,
          status: "killed",
          killedAt: "2026-06-14T03:00:00.000Z",
        }),
      ],
      isLoading: false,
      error: null,
    };

    renderDashboard();

    const row = screen.getByTestId("recurrence-class-row-source:nightly_qa:error:assertion_error:fingerprint:nightly_qa:settings");
    expect(within(row).getByText("Found by nightly QA / Assertion error recurrence")).toBeInTheDocument();
    expect(within(row).getByText("Killed")).toBeInTheDocument();
    expect(within(row).getAllByText("0%").length).toBeGreaterThan(0);
    expect(screen.queryByText(/auto-push/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /push/i })).not.toBeInTheDocument();
  });
});
