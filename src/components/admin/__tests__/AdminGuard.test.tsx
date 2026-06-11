import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { AdminGuard } from "../AdminGuard";
import * as useUserRoleHook from "@/hooks/useUserRole";

// Mock router primitives used by the guard's access-required state
vi.mock("react-router-dom", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-testid="guard-home-link">
      {children}
    </a>
  ),
}));

// Mock the hook
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: vi.fn(),
}));

function mockRole(overrides: Partial<ReturnType<typeof useUserRoleHook.useUserRole>>) {
  vi.spyOn(useUserRoleHook, "useUserRole").mockReturnValue({
    role: "FREE",
    loading: false,
    isAdmin: false,
    isTeam: false,
    isPro: false,
    isFree: true,
    ...overrides,
  });
}

describe("AdminGuard", () => {
  it("shows a loading spinner while the role is loading", () => {
    mockRole({ loading: true });

    const { queryByText, getByTestId } = render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    expect(queryByText("Admin Content")).toBeNull();
    expect(getByTestId("admin-guard-loading")).toBeDefined();
  });

  it("shows the access-required state when user is not an admin", () => {
    mockRole({ role: "FREE", isAdmin: false });

    const { getByText, getByTestId, queryByText } = render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    expect(getByText(/admin access required/i)).toBeDefined();
    expect(getByTestId("guard-home-link").getAttribute("href")).toBe("/");
    expect(queryByText("Admin Content")).toBeNull();
  });

  it("renders children when user is an admin", () => {
    mockRole({ role: "ADMIN", isAdmin: true, isFree: false });

    const { getByText, queryByText } = render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    expect(getByText("Admin Content")).toBeDefined();
    expect(queryByText(/admin access required/i)).toBeNull();
  });
});
